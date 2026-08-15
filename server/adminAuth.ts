import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import type { User } from "../drizzle/schema";
import { getSessionCookieOptions } from "./_core/cookies";

export const ADMIN_SESSION_COOKIE = "open_order_admin_session";
export const ADMIN_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

type AdminSessionPayload = {
  username: string;
  role: "admin";
  exp: number;
};

function getSigningSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET não configurado para a sessão administrativa.");
  return secret;
}

function secureEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function signPayload(encodedPayload: string) {
  return createHmac("sha256", getSigningSecret()).update(encodedPayload).digest("base64url");
}

function encodePayload(payload: AdminSessionPayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodePayload(encodedPayload: string): AdminSessionPayload | null {
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<AdminSessionPayload>;
    if (payload.role !== "admin" || typeof payload.username !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp <= Date.now()) return null;
    if (payload.username !== process.env.LOCAL_ADMIN_USERNAME) return null;
    return { username: payload.username, role: "admin", exp: payload.exp };
  } catch {
    return null;
  }
}

function getCookieValue(req: Request, cookieName: string) {
  const header = req.headers.cookie || "";
  const entry = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`));
  return entry ? decodeURIComponent(entry.slice(cookieName.length + 1)) : null;
}

export function authenticateLocalAdmin(username: string, password: string) {
  const configuredUsername = process.env.LOCAL_ADMIN_USERNAME;
  const configuredPassword = process.env.LOCAL_ADMIN_PASSWORD;
  if (!configuredUsername || !configuredPassword) return null;
  if (!secureEquals(username, configuredUsername) || !secureEquals(password, configuredPassword)) return null;
  return { username: configuredUsername, role: "admin" as const };
}

export function createAdminSessionToken(username: string) {
  const payload = encodePayload({ username, role: "admin", exp: Date.now() + ADMIN_SESSION_MAX_AGE_MS });
  return `${payload}.${signPayload(payload)}`;
}

export function getLocalAdminFromRequest(req: Request) {
  const token = getCookieValue(req, ADMIN_SESSION_COOKIE);
  if (!token) return null;
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature || !secureEquals(signature, signPayload(encodedPayload))) return null;
  return decodePayload(encodedPayload);
}

export function getLocalAdminUser(req: Request): User | null {
  const session = getLocalAdminFromRequest(req);
  if (!session) return null;
  const now = new Date();
  return {
    id: 0,
    openId: `local-admin:${session.username}`,
    name: session.username,
    email: null,
    loginMethod: "local",
    role: "admin",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
}

export function setAdminSession(req: Request, res: Response, username: string) {
  res.cookie(ADMIN_SESSION_COOKIE, createAdminSessionToken(username), {
    ...getSessionCookieOptions(req),
    maxAge: ADMIN_SESSION_MAX_AGE_MS,
  });
}

export function clearAdminSession(req: Request, res: Response) {
  res.clearCookie(ADMIN_SESSION_COOKIE, {
    ...getSessionCookieOptions(req),
    maxAge: 0,
  });
}
