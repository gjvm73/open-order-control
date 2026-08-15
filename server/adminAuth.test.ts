import { describe, expect, it } from "vitest";
import { authenticateLocalAdmin, getLocalAdminUser } from "./adminAuth";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("Local admin authentication", () => {
  it("accepts the configured administrator credentials and rejects invalid ones", () => {
    expect(authenticateLocalAdmin("giovani.martino", "M@rtino")).toEqual({
      username: "giovani.martino",
      role: "admin",
    });
    expect(authenticateLocalAdmin("giovani.martino", "senha-incorreta")).toBeNull();
    expect(authenticateLocalAdmin("outro.usuario", "M@rtino")).toBeNull();
  });

  it("sets a signed admin session through the tRPC login endpoint", async () => {
    const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {
        cookie: (name: string, value: string, options: Record<string, unknown>) => cookies.push({ name, value, options }),
      } as TrpcContext["res"],
    };

    const result = await appRouter.createCaller(ctx).auth.localLogin({ username: "giovani.martino", password: "M@rtino" });
    expect(result).toEqual({ username: "giovani.martino", role: "admin" });
    expect(cookies).toHaveLength(1);
    expect(cookies[0]?.value.split(".")).toHaveLength(2);

    const authenticatedUser = getLocalAdminUser({
      headers: { cookie: `${cookies[0]?.name}=${encodeURIComponent(cookies[0]?.value || "")}` },
    } as TrpcContext["req"]);
    expect(authenticatedUser?.role).toBe("admin");
    expect(authenticatedUser?.name).toBe("giovani.martino");
  });
});
