import { eq, desc, asc, sql, and, or, like, gte, lte, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, uploads, orderItems, predictionHistory, prioritizationSettings, InsertUploadRecord, InsertOrderItem, InsertPredictionHistoryRecord } from "../drizzle/schema";
import { ENV } from './_core/env';
import { normalizeShipTo } from './shipTo';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export { users, uploads, orderItems, predictionHistory, prioritizationSettings, sql, eq, desc, and, or, like };

export const DEFAULT_PRIORITIZATION_WEIGHTS = {
  predictionChangeWeight: 4,
  noSupplierWeight: 5,
  overdueWeight: 3,
  highPriorityWeight: 2,
  financialImpactWeight: 3,
} as const;

export type PrioritizationWeights = {
  predictionChangeWeight: number;
  noSupplierWeight: number;
  overdueWeight: number;
  highPriorityWeight: number;
  financialImpactWeight: number;
};

export type PrioritizationSettingsResponse = PrioritizationWeights & {
  updatedAt: Date | null;
};

type PredictionClassification = "noSupplier" | "obsolete" | "noDeadline" | "withDeadline";

function parseValidPredictionDate(value: string | null) {
  const normalized = value?.trim();
  const match = normalized?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) return null;
  return date;
}

function classifyPrediction(value: string | null): PredictionClassification {
  const normalized = value?.trim().toLocaleLowerCase("pt-BR") || "";
  if (normalized.includes("sem fornecedor")) return "noSupplier";
  if (normalized.includes("obsoleto")) return "obsolete";
  if (parseValidPredictionDate(value)) return "withDeadline";
  return "noDeadline";
}

export async function getPrioritizationSettings(): Promise<PrioritizationSettingsResponse> {
  const db = await getDb();
  if (!db) return { ...DEFAULT_PRIORITIZATION_WEIGHTS, updatedAt: null };

  const [settings] = await db.select().from(prioritizationSettings).where(eq(prioritizationSettings.id, 1)).limit(1);
  if (!settings) return { ...DEFAULT_PRIORITIZATION_WEIGHTS, updatedAt: null };

  return {
    predictionChangeWeight: settings.predictionChangeWeight,
    noSupplierWeight: settings.noSupplierWeight,
    overdueWeight: settings.overdueWeight,
    highPriorityWeight: settings.highPriorityWeight,
    financialImpactWeight: settings.financialImpactWeight,
    updatedAt: settings.updatedAt,
  };
}

export async function savePrioritizationSettings(weights: PrioritizationWeights): Promise<PrioritizationSettingsResponse> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(prioritizationSettings).values({ id: 1, ...weights }).onDuplicateKeyUpdate({
    set: weights,
  });

  return await getPrioritizationSettings();
}

export async function resetPrioritizationSettings(): Promise<PrioritizationSettingsResponse> {
  return await savePrioritizationSettings({ ...DEFAULT_PRIORITIZATION_WEIGHTS });
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createUploadRecord(data: InsertUploadRecord) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(uploads).values(data);
  return result.insertId;
}

export async function getUploadsList() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(uploads).orderBy(desc(uploads.uploadDate), desc(uploads.id));
}

export async function resetImportedData() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.transaction(async (tx) => {
    // As tabelas filhas são removidas primeiro para respeitar as chaves estrangeiras.
    const historyResult = await tx.delete(predictionHistory);
    const itemsResult = await tx.delete(orderItems);
    const uploadsResult = await tx.delete(uploads);

    const affectedRows = (result: unknown) => Number((result as { affectedRows?: number }).affectedRows || 0);
    return {
      deletedHistory: affectedRows(historyResult),
      deletedItems: affectedRows(itemsResult),
      deletedUploads: affectedRows(uploadsResult),
    };
  });
}

export async function getOrderItems(filters?: { search?: string; item?: string; customerPo?: string; prediction?: string; shipTo?: string }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions: any[] = [sql`status = 'active'`];
  if (filters?.search) {
    const s = `%${filters.search}%`;
    conditions.push(or(
      like(orderItems.item, s),
      like(orderItems.customerPo, s),
      like(orderItems.itemDescription, s)
    ));
  }
  if (filters?.item) {
    conditions.push(like(orderItems.item, `%${filters.item}%`));
  }
  if (filters?.customerPo) {
    conditions.push(like(orderItems.customerPo, `%${filters.customerPo}%`));
  }
  if (filters?.prediction) {
    conditions.push(like(orderItems.currentPrediction, `%${filters.prediction}%`));
  }
  if (filters?.shipTo) {
    const normalizedShipTo = normalizeShipTo(filters.shipTo);
    if (normalizedShipTo) {
      conditions.push(sql`TRIM(${orderItems.shipTo}) = ${normalizedShipTo}`);
    }
  }
  
  const itemsQuery = db.select().from(orderItems).leftJoin(uploads, eq(orderItems.lastUploadId, uploads.id));
  const rows = conditions.length > 0
    ? await itemsQuery.where(and(...conditions)).orderBy(desc(orderItems.updatedAt))
    : await itemsQuery.orderBy(desc(orderItems.updatedAt));

  return rows.map(({ order_items: item, uploads: upload }) => ({
    ...item,
    shipTo: normalizeShipTo(item.shipTo) || "Sem filial informada",
    lastUploadFileName: upload?.fileName ?? null,
    lastUploadDate: upload?.uploadDate ?? null,
  }));
}

export async function getOrderItemById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [item] = await db.select().from(orderItems).where(eq(orderItems.id, id)).limit(1);
  if (!item) return null;
  return {
    ...item,
    shipTo: normalizeShipTo(item.shipTo) || "Sem filial informada",
  };
}

export async function getPredictionHistoryByItem(orderItemId: number) {
  const db = await getDb();
  if (!db) return [];

  const records = await db.select({
    id: predictionHistory.id,
    orderItemId: predictionHistory.orderItemId,
    uploadId: predictionHistory.uploadId,
    item: predictionHistory.item,
    customerPo: predictionHistory.customerPo,
    prediction: predictionHistory.prediction,
    recordedAt: predictionHistory.recordedAt,
    fileName: uploads.fileName,
    uploadDate: uploads.uploadDate,
  })
  .from(predictionHistory)
  .innerJoin(uploads, eq(predictionHistory.uploadId, uploads.id))
  .where(eq(predictionHistory.orderItemId, orderItemId))
  .orderBy(asc(predictionHistory.uploadId), asc(predictionHistory.id), asc(predictionHistory.recordedAt));

  return records.map((record, index) => {
    const previousPrediction = index > 0 ? records[index - 1].prediction : null;
    const changed = previousPrediction !== null && previousPrediction !== record.prediction;
    const previousDate = previousPrediction ? Date.parse(previousPrediction) : Number.NaN;
    const currentDate = Date.parse(record.prediction);
    const differenceDays = Number.isNaN(previousDate) || Number.isNaN(currentDate)
      ? null
      : Math.round((currentDate - previousDate) / 86400000);

    return {
      ...record,
      sequence: index + 1,
      previousPrediction,
      changed,
      differenceDays,
    };
  });
}

export async function getPredictionHistoryByItemIds(orderItemIds: number[]) {
  const db = await getDb();
  const ids = Array.from(new Set(orderItemIds.filter((id) => Number.isInteger(id) && id > 0)));
  if (!db || ids.length === 0) return [];

  const records = await db.select({
    id: predictionHistory.id,
    orderItemId: predictionHistory.orderItemId,
    uploadId: predictionHistory.uploadId,
    item: predictionHistory.item,
    customerPo: predictionHistory.customerPo,
    prediction: predictionHistory.prediction,
    recordedAt: predictionHistory.recordedAt,
    fileName: uploads.fileName,
    uploadDate: uploads.uploadDate,
  })
    .from(predictionHistory)
    .innerJoin(uploads, eq(predictionHistory.uploadId, uploads.id))
    .where(inArray(predictionHistory.orderItemId, ids))
    .orderBy(asc(predictionHistory.orderItemId), asc(predictionHistory.uploadId), asc(predictionHistory.id), asc(predictionHistory.recordedAt));

  const previousByItem = new Map<number, string | null>();
  return records.map((record) => {
    const previousPrediction = previousByItem.get(record.orderItemId) ?? null;
    const changed = previousPrediction !== null && previousPrediction !== record.prediction;
    const previousDate = previousPrediction ? Date.parse(previousPrediction) : Number.NaN;
    const currentDate = Date.parse(record.prediction);
    const differenceDays = Number.isNaN(previousDate) || Number.isNaN(currentDate)
      ? null
      : Math.round((currentDate - previousDate) / 86400000);
    previousByItem.set(record.orderItemId, record.prediction);

    return {
      ...record,
      previousPrediction,
      changed,
      differenceDays,
    };
  });
}

export type CompleteChangesReportFilters = {
  shipTo?: string;
  startDate?: string;
  endDate?: string;
};

function parseReportBoundary(value: string | undefined, endOfDay: boolean) {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Retorna somente os eventos em que a previsão mudou, mantendo a linha
 * operacional completa e a sequência histórica necessária para auditoria.
 */
export async function getCompleteChangesReport(filters: CompleteChangesReportFilters = {}) {
  const db = await getDb();
  if (!db) return [];

  const conditions: any[] = [sql`${orderItems.status} = 'active'`];
  const normalizedShipTo = filters.shipTo ? normalizeShipTo(filters.shipTo) : undefined;
  if (normalizedShipTo) {
    conditions.push(sql`TRIM(${orderItems.shipTo}) = ${normalizedShipTo}`);
  }

  const recordsQuery = db.select({
    historyId: predictionHistory.id,
    orderItemId: predictionHistory.orderItemId,
    uploadId: predictionHistory.uploadId,
    prediction: predictionHistory.prediction,
    recordedAt: predictionHistory.recordedAt,
    fileName: uploads.fileName,
    uploadDate: uploads.uploadDate,
    item: orderItems.item,
    itemDescription: orderItems.itemDescription,
    shipTo: orderItems.shipTo,
    customerPo: orderItems.customerPo,
    shipmentPriority: orderItems.shipmentPriority,
    orderCreationDate: orderItems.orderCreationDate,
    quantity: orderItems.quantity,
    scheduledReserved: orderItems.scheduledReserved,
    unitSellingPrice: orderItems.unitSellingPrice,
    extendedPrice: orderItems.extendedPrice,
    currentPrediction: orderItems.currentPrediction,
    previousPrediction: orderItems.previousPrediction,
    predictionChangesCount: orderItems.predictionChangesCount,
    lastPredictionChangeDate: orderItems.lastPredictionChangeDate,
    status: orderItems.status,
    deliveredAt: orderItems.deliveredAt,
    longText: orderItems.longText,
  }).from(predictionHistory)
    .innerJoin(orderItems, eq(predictionHistory.orderItemId, orderItems.id))
    .innerJoin(uploads, eq(predictionHistory.uploadId, uploads.id));

  const records = conditions.length > 0
    ? await recordsQuery.where(and(...conditions)).orderBy(asc(predictionHistory.orderItemId), asc(predictionHistory.uploadId), asc(predictionHistory.id))
    : await recordsQuery.orderBy(asc(predictionHistory.orderItemId), asc(predictionHistory.uploadId), asc(predictionHistory.id));

  const startDate = parseReportBoundary(filters.startDate, false);
  const endDate = parseReportBoundary(filters.endDate, true);
  const previousPredictionByItem = new Map<number, string>();

  return records.flatMap((record) => {
    const previousPrediction = previousPredictionByItem.get(record.orderItemId) ?? null;
    previousPredictionByItem.set(record.orderItemId, record.prediction);
    if (previousPrediction === null || previousPrediction === record.prediction) return [];

    const changedAt = record.recordedAt ?? record.uploadDate;
    if (!changedAt) return [];
    const changeMoment = new Date(changedAt);
    if (startDate && changeMoment < startDate) return [];
    if (endDate && changeMoment > endDate) return [];

    const previousDate = parseValidPredictionDate(previousPrediction);
    const currentDate = parseValidPredictionDate(record.prediction);
    const differenceDays = previousDate && currentDate
      ? Math.round((currentDate.getTime() - previousDate.getTime()) / 86400000)
      : null;

    return [{
      ...record,
      shipTo: normalizeShipTo(record.shipTo) || "Sem filial informada",
      previousPrediction,
      currentPredictionAtChange: record.prediction,
      differenceDays,
      direction: differenceDays === null ? "SEM DATA" : differenceDays > 0 ? "ADIAMENTO" : differenceDays < 0 ? "ANTECIPAÇÃO" : "SEM ALTERAÇÃO DE DIAS",
      changedAt: changeMoment,
    }];
  }).sort((left, right) => right.changedAt.getTime() - left.changedAt.getTime() || right.historyId - left.historyId);
}

type LifecycleFilters = CompleteChangesReportFilters & {
  scope?: "active" | "all";
};

function parseOperationalDate(value: string | Date | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day)
      ? date
      : null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getMonthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, 1)))
    .replace(".", "");
}

function getOperationalAgeDays(start: Date, end: Date) {
  return Math.max(0, Math.floor((Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()) - Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())) / 86400000));
}

function getAgeBand(days: number) {
  if (days <= 30) return "upTo30" as const;
  if (days <= 60) return "from31To60" as const;
  if (days <= 90) return "from61To90" as const;
  return "above90" as const;
}

function isBetween(date: Date, startDate: Date | null, endDate: Date | null) {
  return (!startDate || date >= startDate) && (!endDate || date <= endDate);
}

/**
 * Analisa o ciclo de vida dos pedidos pela data de criação. A abertura é
 * atribuída ao mês da criação e o fechamento ao mês de entrega identificado
 * pelo desaparecimento do item em um upload posterior.
 */
export async function getOrderLifecycleAnalysis(filters: LifecycleFilters = {}) {
  const db = await getDb();
  const referenceDate = parseReportBoundary(filters.endDate, true) ?? new Date();
  if (!db) {
    return { referenceDate, summary: { openedOrders: 0, closedSameMonth: 0, openOrders: 0, averageLifeDays: null, withoutCreationDate: 0 }, monthly: [] as any[] };
  }

  const normalizedShipTo = filters.shipTo ? normalizeShipTo(filters.shipTo) : undefined;
  const startDate = parseReportBoundary(filters.startDate, false);
  const endDate = parseReportBoundary(filters.endDate, true);
  const rows = await db.select({
    id: orderItems.id,
    item: orderItems.item,
    shipTo: orderItems.shipTo,
    customerPo: orderItems.customerPo,
    orderCreationDate: orderItems.orderCreationDate,
    status: orderItems.status,
    deliveredAt: orderItems.deliveredAt,
  }).from(orderItems);

  const matchingRows = rows.filter((row) => (
    (filters.scope !== "active" || row.status === "active")
    && (!normalizedShipTo || normalizeShipTo(row.shipTo) === normalizedShipTo)
  ));
  const monthly = new Map<string, {
    month: string;
    label: string;
    openedOrders: number;
    closedSameMonth: number;
    pendingOrClosedLater: number;
    upTo30: number;
    from31To60: number;
    from61To90: number;
    above90: number;
    openOrders: number;
    lifeDays: number[];
  }>();
  let withoutCreationDate = 0;

  for (const row of matchingRows) {
    const createdAt = parseOperationalDate(row.orderCreationDate);
    if (!createdAt) {
      withoutCreationDate += 1;
      continue;
    }
    if (!isBetween(createdAt, startDate, endDate)) continue;

    const month = getMonthKey(createdAt);
    const bucket = monthly.get(month) ?? {
      month,
      label: formatMonthLabel(month),
      openedOrders: 0,
      closedSameMonth: 0,
      pendingOrClosedLater: 0,
      upTo30: 0,
      from31To60: 0,
      from61To90: 0,
      above90: 0,
      openOrders: 0,
      lifeDays: [],
    };
    bucket.openedOrders += 1;

    const deliveredAt = row.status === "delivered" ? parseOperationalDate(row.deliveredAt) : null;
    const lifecycleEnd = deliveredAt ?? referenceDate;
    const lifeDays = getOperationalAgeDays(createdAt, lifecycleEnd);
    bucket.lifeDays.push(lifeDays);

    if (deliveredAt && getMonthKey(deliveredAt) === month) {
      bucket.closedSameMonth += 1;
    } else {
      bucket.pendingOrClosedLater += 1;
      bucket[getAgeBand(lifeDays)] += 1;
      if (!deliveredAt) bucket.openOrders += 1;
    }
    monthly.set(month, bucket);
  }

  const monthlyRows = Array.from(monthly.values())
    .sort((left, right) => left.month.localeCompare(right.month))
    .map(({ lifeDays, ...row }) => ({
      ...row,
      averageLifeDays: lifeDays.length ? Math.round(lifeDays.reduce((sum, value) => sum + value, 0) / lifeDays.length) : null,
    }));
  const allLifeDays = monthlyRows.flatMap((row) => {
    const source = monthly.get(row.month)?.lifeDays ?? [];
    return source;
  });

  return {
    referenceDate,
    summary: {
      openedOrders: monthlyRows.reduce((sum, row) => sum + row.openedOrders, 0),
      closedSameMonth: monthlyRows.reduce((sum, row) => sum + row.closedSameMonth, 0),
      openOrders: monthlyRows.reduce((sum, row) => sum + row.openOrders, 0),
      averageLifeDays: allLifeDays.length ? Math.round(allLifeDays.reduce((sum, value) => sum + value, 0) / allLifeDays.length) : null,
      withoutCreationDate,
    },
    monthly: monthlyRows,
  };
}

/**
 * Resume cada carga para avaliação histórica, incluindo filiais, itens
 * registrados, alterações de previsão e tempo médio planejado até a entrega.
 */
export async function getHistoricalAssessment(filters: LifecycleFilters = {}) {
  const db = await getDb();
  if (!db) return { summary: { uploads: 0, itemsRecorded: 0, branches: 0, changeEvents: 0, deliveredItems: 0, averagePlannedLeadDays: null, averageDeliveryLeadDays: null }, uploads: [], branches: [] };

  const normalizedShipTo = filters.shipTo ? normalizeShipTo(filters.shipTo) : undefined;
  const startDate = parseReportBoundary(filters.startDate, false);
  const endDate = parseReportBoundary(filters.endDate, true);
  const allUploads = await db.select().from(uploads).orderBy(asc(uploads.uploadDate), asc(uploads.id));
  const uploadsInRange = allUploads.filter((upload) => {
    const uploadDate = parseOperationalDate(upload.uploadDate);
    return uploadDate ? isBetween(uploadDate, startDate, endDate) : false;
  });
  const selectedUploadIds = new Set(uploadsInRange.map((upload) => upload.id));
  if (selectedUploadIds.size === 0) {
    return { summary: { uploads: 0, itemsRecorded: 0, branches: 0, changeEvents: 0, deliveredItems: 0, averagePlannedLeadDays: null, averageDeliveryLeadDays: null }, uploads: [], branches: [] };
  }

  const historyRows = await db.select({
    uploadId: predictionHistory.uploadId,
    orderItemId: predictionHistory.orderItemId,
    prediction: predictionHistory.prediction,
    item: orderItems.item,
    shipTo: orderItems.shipTo,
    orderCreationDate: orderItems.orderCreationDate,
  }).from(predictionHistory)
    .innerJoin(orderItems, eq(predictionHistory.orderItemId, orderItems.id))
    .orderBy(asc(predictionHistory.orderItemId), asc(predictionHistory.uploadId), asc(predictionHistory.id));

  const createUploadMetric = () => ({ itemIds: new Set<number>(), branchNames: new Set<string>(), changes: 0, deliveredItems: 0, plannedLeadDays: [] as number[], deliveryLeadDays: [] as number[] });
  const createBranchMetric = (uploadId: number, uploadDate: Date, branch: string) => ({ uploadId, uploadDate, branch, itemIds: new Set<number>(), changes: 0, deliveredItems: 0, plannedLeadDays: [] as number[], deliveryLeadDays: [] as number[] });
  const previousPredictionByItem = new Map<number, string>();
  const uploadMetrics = new Map<number, ReturnType<typeof createUploadMetric>>();
  const branchMetrics = new Map<string, ReturnType<typeof createBranchMetric>>();

  for (const record of historyRows) {
    const previousPrediction = previousPredictionByItem.get(record.orderItemId);
    previousPredictionByItem.set(record.orderItemId, record.prediction);
    if (!selectedUploadIds.has(record.uploadId)) continue;

    const branch = normalizeShipTo(record.shipTo) || "Sem filial informada";
    if (normalizedShipTo && branch !== normalizedShipTo) continue;
    const upload = uploadsInRange.find((entry) => entry.id === record.uploadId);
    if (!upload) continue;
    const metric = uploadMetrics.get(record.uploadId) ?? createUploadMetric();
    metric.itemIds.add(record.orderItemId);
    metric.branchNames.add(branch);
    const branchKey = `${record.uploadId}:${branch}`;
    const branchMetric = branchMetrics.get(branchKey) ?? createBranchMetric(record.uploadId, parseOperationalDate(upload.uploadDate) ?? new Date(), branch);
    branchMetric.itemIds.add(record.orderItemId);

    if (previousPrediction !== undefined && previousPrediction !== record.prediction) {
      metric.changes += 1;
      branchMetric.changes += 1;
    }

    const createdAt = parseOperationalDate(record.orderCreationDate);
    const predictionDate = parseValidPredictionDate(record.prediction);
    if (createdAt && predictionDate) {
      const leadDays = getOperationalAgeDays(createdAt, predictionDate);
      metric.plannedLeadDays.push(leadDays);
      branchMetric.plannedLeadDays.push(leadDays);
    }
    uploadMetrics.set(record.uploadId, metric);
    branchMetrics.set(branchKey, branchMetric);
  }

  const deliveredRows = await db.select({
    id: orderItems.id,
    shipTo: orderItems.shipTo,
    orderCreationDate: orderItems.orderCreationDate,
    status: orderItems.status,
    deliveredAt: orderItems.deliveredAt,
    deliveredUploadId: orderItems.deliveredUploadId,
  }).from(orderItems);

  for (const item of deliveredRows) {
    if (item.status !== "delivered") continue;
    const deliveredAt = parseOperationalDate(item.deliveredAt);
    const createdAt = parseOperationalDate(item.orderCreationDate);
    if (!deliveredAt || !createdAt) continue;
    const deliveryUpload = item.deliveredUploadId
      ? allUploads.find((upload) => upload.id === item.deliveredUploadId) ?? null
      : allUploads.reduce<typeof allUploads[number] | null>((latest, upload) => {
        const uploadDate = parseOperationalDate(upload.uploadDate);
        if (!uploadDate || uploadDate > deliveredAt) return latest;
        if (!latest) return upload;
        const latestDate = parseOperationalDate(latest.uploadDate);
        return !latestDate || uploadDate > latestDate ? upload : latest;
      }, null);
    if (!deliveryUpload || !selectedUploadIds.has(deliveryUpload.id)) continue;

    const branch = normalizeShipTo(item.shipTo) || "Sem filial informada";
    if (normalizedShipTo && branch !== normalizedShipTo) continue;
    const deliveryUploadDate = parseOperationalDate(deliveryUpload.uploadDate);
    if (!deliveryUploadDate) continue;
    const deliveryLeadDays = getOperationalAgeDays(createdAt, deliveryUploadDate);
    const metric = uploadMetrics.get(deliveryUpload.id) ?? createUploadMetric();
    metric.deliveredItems += 1;
    metric.branchNames.add(branch);
    metric.deliveryLeadDays.push(deliveryLeadDays);
    uploadMetrics.set(deliveryUpload.id, metric);

    const branchKey = `${deliveryUpload.id}:${branch}`;
    const branchMetric = branchMetrics.get(branchKey) ?? createBranchMetric(deliveryUpload.id, deliveryUploadDate, branch);
    branchMetric.deliveredItems += 1;
    branchMetric.deliveryLeadDays.push(deliveryLeadDays);
    branchMetrics.set(branchKey, branchMetric);
  }

  const uploadRows = uploadsInRange.map((upload) => {
    const metric = uploadMetrics.get(upload.id) ?? createUploadMetric();
    return {
      uploadId: upload.id,
      uploadDate: upload.uploadDate,
      fileName: upload.fileName,
      acceptedRows: upload.acceptedRows ?? upload.totalRows,
      rejectedRows: upload.rejectedRows ?? 0,
      itemsRecorded: metric.itemIds.size,
      branches: metric.branchNames.size,
      changeEvents: metric.changes,
      deliveredItems: metric.deliveredItems,
      averagePlannedLeadDays: metric.plannedLeadDays.length ? Math.round(metric.plannedLeadDays.reduce((sum, value) => sum + value, 0) / metric.plannedLeadDays.length) : null,
      averageDeliveryLeadDays: metric.deliveryLeadDays.length ? Math.round(metric.deliveryLeadDays.reduce((sum, value) => sum + value, 0) / metric.deliveryLeadDays.length) : null,
    };
  }).filter((row) => !normalizedShipTo || row.itemsRecorded > 0);

  const branchRows = Array.from(branchMetrics.values())
    .map((metric) => ({
      uploadId: metric.uploadId,
      uploadDate: metric.uploadDate,
      branch: metric.branch,
      itemsRecorded: metric.itemIds.size,
      changeEvents: metric.changes,
      deliveredItems: metric.deliveredItems,
      averagePlannedLeadDays: metric.plannedLeadDays.length ? Math.round(metric.plannedLeadDays.reduce((sum, value) => sum + value, 0) / metric.plannedLeadDays.length) : null,
      averageDeliveryLeadDays: metric.deliveryLeadDays.length ? Math.round(metric.deliveryLeadDays.reduce((sum, value) => sum + value, 0) / metric.deliveryLeadDays.length) : null,
    }))
    .sort((left, right) => left.uploadDate.getTime() - right.uploadDate.getTime() || left.branch.localeCompare(right.branch, "pt-BR"));
  const allLeadDays = uploadRows.flatMap((row) => {
    const metric = uploadMetrics.get(row.uploadId);
    return metric?.plannedLeadDays ?? [];
  });
  const allDeliveryLeadDays = uploadRows.flatMap((row) => {
    const metric = uploadMetrics.get(row.uploadId);
    return metric?.deliveryLeadDays ?? [];
  });

  return {
    summary: {
      uploads: uploadRows.length,
      itemsRecorded: uploadRows.reduce((sum, row) => sum + row.itemsRecorded, 0),
      branches: new Set(branchRows.map((row) => row.branch)).size,
      changeEvents: uploadRows.reduce((sum, row) => sum + row.changeEvents, 0),
      deliveredItems: uploadRows.reduce((sum, row) => sum + row.deliveredItems, 0),
      averagePlannedLeadDays: allLeadDays.length ? Math.round(allLeadDays.reduce((sum, value) => sum + value, 0) / allLeadDays.length) : null,
      averageDeliveryLeadDays: allDeliveryLeadDays.length ? Math.round(allDeliveryLeadDays.reduce((sum, value) => sum + value, 0) / allDeliveryLeadDays.length) : null,
    },
    uploads: uploadRows,
    branches: branchRows,
  };
}

export async function getPredictionAlerts(thresholdDays: number, shipTo?: string) {
  const db = await getDb();
  if (!db) return [];

  const normalizedShipTo = shipTo ? normalizeShipTo(shipTo) : undefined;
  const conditions: any[] = [sql`status = 'active'`];
  if (normalizedShipTo) {
    conditions.push(sql`TRIM(${orderItems.shipTo}) = ${normalizedShipTo}`);
  }
  const items = await db.select().from(orderItems).where(and(...conditions));
  const threshold = Math.max(1, Math.floor(thresholdDays));

  const parseDate = (value: string | null) => {
    if (!value) return null;
    const normalized = value.trim();
    const date = /^\d{4}-\d{2}-\d{2}$/.test(normalized)
      ? new Date(`${normalized}T00:00:00`)
      : new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  return items
    .map((item) => {
      const previousDate = parseDate(item.previousPrediction);
      const currentDate = parseDate(item.currentPrediction);
      if (!previousDate || !currentDate) return null;
      const differenceDays = Math.round((currentDate.getTime() - previousDate.getTime()) / 86400000);
      const absoluteDifferenceDays = Math.abs(differenceDays);
      if (absoluteDifferenceDays <= threshold) return null;
      return {
        id: item.id,
        item: item.item,
        itemDescription: item.itemDescription,
        shipTo: item.shipTo || "Sem filial informada",
        customerPo: item.customerPo,
        currentPrediction: item.currentPrediction,
        previousPrediction: item.previousPrediction,
        differenceDays,
        absoluteDifferenceDays,
        direction: differenceDays > 0 ? "ADIAMENTO" as const : "ANTECIPAÇÃO" as const,
        severity: absoluteDifferenceDays >= threshold * 2 ? "CRÍTICO" as const : "ATENÇÃO" as const,
        predictionChangesCount: item.predictionChangesCount,
        lastPredictionChangeDate: item.lastPredictionChangeDate,
        extendedPrice: item.extendedPrice,
      };
    })
    .filter((alert): alert is NonNullable<typeof alert> => alert !== null)
    .sort((a, b) => b.absoluteDifferenceDays - a.absoluteDifferenceDays || b.id - a.id);
}

export async function getAlertsTrend(thresholdDays: number, shipTo?: string) {
  const db = await getDb();
  if (!db) return [];

  const allUploads = await db.select().from(uploads).orderBy(asc(uploads.id));
  if (allUploads.length === 0) return [];

  const threshold = Math.max(1, Math.floor(thresholdDays));
  const parseDate = (value: string | null) => {
    if (!value) return null;
    const normalized = value.trim();
    const date = /^\d{4}-\d{2}-\d{2}$/.test(normalized)
      ? new Date(`${normalized}T00:00:00`)
      : new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const trendResult: { uploadId: number; fileName: string; uploadDate: string; criticalCount: number; attentionCount: number; totalAlerts: number }[] = [];

  // Para calcular o histórico por upload, buscamos todos os registros de histórico até este upload
  // agrupados por item, para determinar o estado de cada item em cada semana.
  const allHistory = shipTo
    ? await db.select({
        orderItemId: predictionHistory.orderItemId,
        uploadId: predictionHistory.uploadId,
        prediction: predictionHistory.prediction,
        shipTo: orderItems.shipTo,
      })
      .from(predictionHistory)
      .innerJoin(orderItems, eq(predictionHistory.orderItemId, orderItems.id))
      .where(sql`TRIM(${orderItems.shipTo}) = ${normalizeShipTo(shipTo)}`)
      .orderBy(asc(predictionHistory.uploadId), asc(predictionHistory.id))
    : await db.select({
        orderItemId: predictionHistory.orderItemId,
        uploadId: predictionHistory.uploadId,
        prediction: predictionHistory.prediction,
        shipTo: orderItems.shipTo,
      })
      .from(predictionHistory)
      .innerJoin(orderItems, eq(predictionHistory.orderItemId, orderItems.id))
      .orderBy(asc(predictionHistory.uploadId), asc(predictionHistory.id));

  // Agrupar histórico por orderItemId
  const itemHistories = new Map<number, { uploadId: number; prediction: string }[]>();
  for (const h of allHistory) {
    const list = itemHistories.get(h.orderItemId) || [];
    list.push({ uploadId: h.uploadId, prediction: h.prediction });
    itemHistories.set(h.orderItemId, list);
  }

  for (const upload of allUploads) {
    let criticalCount = 0;
    let attentionCount = 0;

    for (const historyList of Array.from(itemHistories.values())) {
      // Encontrar o registro correspondente a este upload ou o último anterior
      const relevantIndex = historyList.findIndex((h: { uploadId: number; prediction: string }) => h.uploadId === upload.id);
      if (relevantIndex <= 0) continue; // Precisa ter upload atual e anterior

      const currRecord = historyList[relevantIndex];
      const prevRecord = historyList[relevantIndex - 1];

      const prev = parseDate(prevRecord.prediction);
      const curr = parseDate(currRecord.prediction);
      if (!prev || !curr) continue;

      const diffDays = Math.abs(Math.round((curr.getTime() - prev.getTime()) / 86400000));
      if (diffDays > threshold) {
        if (diffDays >= threshold * 2) {
          criticalCount++;
        } else {
          attentionCount++;
        }
      }
    }

    const dateStr = new Date(upload.uploadDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    trendResult.push({
      uploadId: upload.id,
      fileName: upload.fileName,
      uploadDate: dateStr,
      criticalCount,
      attentionCount,
      totalAlerts: criticalCount + attentionCount,
    });
  }

  return trendResult;
}

export async function getShipToOptions() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ shipTo: orderItems.shipTo }).from(orderItems);
  const options = rows
    .map(row => normalizeShipTo(row.shipTo))
    .filter((value): value is string => Boolean(value));
  return Array.from(new Set(options)).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export async function getBranchSummary() {
  const db = await getDb();
  if (!db) return [];
  const allItems = await db.select().from(orderItems).where(sql`status = 'active'`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const toNumber = (value: unknown) => {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const groups = new Map<string, typeof allItems>();
  for (const item of allItems) {
    const branch = normalizeShipTo(item.shipTo) || "Sem filial informada";
    const current = groups.get(branch) || [];
    current.push(item);
    groups.set(branch, current);
  }
  const totalItems = allItems.length || 1;
  return Array.from(groups.entries()).map(([shipTo, items]) => {
    const changedItems = items.filter(item => item.predictionChangesCount > 0);
    const overdueItems = items.filter(item => {
      const date = parseValidPredictionDate(item.currentPrediction);
      return Boolean(date && date < today);
    });
    const noSupplier = items.filter(item => classifyPrediction(item.currentPrediction) === "noSupplier");
    const totalOrderValue = items.reduce((sum, item) => sum + toNumber(item.extendedPrice), 0);
    const valueAtRisk = changedItems.reduce((sum, item) => sum + toNumber(item.extendedPrice), 0);
    return {
      shipTo,
      totalItems: items.length,
      changedItems: changedItems.length,
      stableItems: items.length - changedItems.length,
      noSupplier: noSupplier.length,
      overdueItems: overdueItems.length,
      highPriorityItems: items.filter(item => (item.shipmentPriority || "").toLowerCase() === "high").length,
      totalOrderValue,
      valueAtRisk,
      changeRate: items.length > 0 ? Math.round((changedItems.length / items.length) * 1000) / 10 : 0,
      shareOfItems: Math.round((items.length / totalItems) * 1000) / 10,
    };
  }).sort((a, b) => b.changedItems - a.changedItems || b.totalItems - a.totalItems || a.shipTo.localeCompare(b.shipTo, "pt-BR"));
}

export async function getDashboardStats(shipTo?: string) {
  const db = await getDb();
  if (!db) {
    return {
      totalItems: 0,
      changedLastUpload: 0,
      noSupplier: 0,
      mostChanged: [],
      totalOrderValue: 0,
      valueAtRisk: 0,
      changedItems: 0,
      stableItems: 0,
      stabilityRate: 0,
      riskRate: 0,
      latestChangeRate: 0,
      latestStabilityRate: 0,
      highPriorityItems: 0,
      overdueItems: 0,
      obsoleteItems: 0,
      noDeadlineItems: 0,
      withDeadlineItems: 0,
      trend: [],
      actionQueue: [],
      latestUpload: null,
    };
  }

  const allItems = shipTo
    ? await db.select().from(orderItems).where(and(sql`status = 'active'`, sql`TRIM(${orderItems.shipTo}) = ${normalizeShipTo(shipTo)}`))
    : await db.select().from(orderItems).where(sql`status = 'active'`);
  const prioritizationWeights = await getPrioritizationSettings();
  const uploadList = await db.select().from(uploads).orderBy(desc(uploads.uploadDate), desc(uploads.id)).limit(8);
  const latestUpload = uploadList[0] || null;
  let changedLastUpload = latestUpload?.changedRowsCount || 0;
  if (shipTo && latestUpload) {
    const scopedHistory = await db.select({
      id: predictionHistory.id,
      orderItemId: predictionHistory.orderItemId,
      uploadId: predictionHistory.uploadId,
      prediction: predictionHistory.prediction,
    }).from(predictionHistory).innerJoin(orderItems, eq(predictionHistory.orderItemId, orderItems.id)).where(sql`TRIM(${orderItems.shipTo}) = ${normalizeShipTo(shipTo)}`).orderBy(asc(predictionHistory.uploadId), asc(predictionHistory.id), asc(predictionHistory.recordedAt));
    const historyByItem = new Map<number, Array<{ uploadId: number; prediction: string }>>();
    for (const record of scopedHistory) {
      const series = historyByItem.get(record.orderItemId) || [];
      series.push({ uploadId: record.uploadId, prediction: record.prediction });
      historyByItem.set(record.orderItemId, series);
    }
    changedLastUpload = Array.from(historyByItem.values()).filter(series => {
      const current = series[series.length - 1];
      const previous = series[series.length - 2];
      return Boolean(current && previous && current.uploadId === latestUpload.id && current.prediction !== previous.prediction);
    }).length;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const toNumber = (value: unknown) => {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const totalItems = allItems.length;
  const classificationTotals = allItems.reduce<Record<PredictionClassification, number>>((totals, item) => {
    totals[classifyPrediction(item.currentPrediction)] += 1;
    return totals;
  }, { noSupplier: 0, obsolete: 0, noDeadline: 0, withDeadline: 0 });
  const noSupplier = classificationTotals.noSupplier;
  const obsoleteItems = classificationTotals.obsolete;
  const noDeadlineItems = classificationTotals.noDeadline;
  const withDeadlineItems = classificationTotals.withDeadline;
  const changedItems = allItems.filter(item => item.predictionChangesCount > 0);
  const stableItems = totalItems - changedItems.length;
  const highPriorityItems = allItems.filter(item => (item.shipmentPriority || "").toLowerCase() === "high").length;
  const overdueItems = allItems.filter(item => {
    const predictionDate = parseValidPredictionDate(item.currentPrediction);
    return Boolean(predictionDate && predictionDate < today);
  }).length;
  const totalOrderValue = allItems.reduce((sum, item) => sum + toNumber(item.extendedPrice), 0);
  const valueAtRisk = changedItems.reduce((sum, item) => sum + toNumber(item.extendedPrice), 0);
  const highestItemValue = Math.max(...allItems.map((item) => Math.max(0, toNumber(item.extendedPrice))), 0);
  const directionalHistory = allItems.length === 0
    ? []
    : await db.select({
      orderItemId: predictionHistory.orderItemId,
      prediction: predictionHistory.prediction,
      uploadId: predictionHistory.uploadId,
      historyId: predictionHistory.id,
      recordedAt: predictionHistory.recordedAt,
    }).from(predictionHistory)
      .where(inArray(predictionHistory.orderItemId, allItems.map((item) => item.id)))
      .orderBy(asc(predictionHistory.orderItemId), asc(predictionHistory.uploadId), asc(predictionHistory.id), asc(predictionHistory.recordedAt));
  const directionalChangesByItem = new Map<number, { postponements: number; anticipations: number }>();
  const historyByItem = new Map<number, Array<{ prediction: string; uploadId: number }>>();
  for (const record of directionalHistory) {
    const series = historyByItem.get(record.orderItemId) || [];
    series.push({ prediction: record.prediction, uploadId: record.uploadId });
    historyByItem.set(record.orderItemId, series);
  }
  for (const [orderItemId, series] of Array.from(historyByItem.entries())) {
    let postponements = 0;
    let anticipations = 0;
    for (let index = 1; index < series.length; index += 1) {
      const previous = parseValidPredictionDate(series[index - 1].prediction);
      const current = parseValidPredictionDate(series[index].prediction);
      if (!previous || !current) continue;
      const differenceDays = Math.round((current.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24));
      if (differenceDays > 0) postponements += 1;
      if (differenceDays < 0) anticipations += 1;
    }
    directionalChangesByItem.set(orderItemId, { postponements, anticipations });
  }

  const rankItem = (item: typeof allItems[number]) => {
    const predictionDate = parseValidPredictionDate(item.currentPrediction);
    const supplierIssue = classifyPrediction(item.currentPrediction) === "noSupplier";
    const overdue = Boolean(predictionDate && predictionDate < today);
    const highPriority = (item.shipmentPriority || "").toLowerCase() === "high";
    const financialImpactScore = highestItemValue > 0 && prioritizationWeights.financialImpactWeight > 0
      ? Math.min(
        prioritizationWeights.financialImpactWeight,
        Math.ceil((Math.max(0, toNumber(item.extendedPrice)) / highestItemValue) * prioritizationWeights.financialImpactWeight)
      )
      : 0;
    const directionalChanges = directionalChangesByItem.get(item.id) || { postponements: 0, anticipations: 0 };
    const unclassifiedChanges = Math.max(0, item.predictionChangesCount - directionalChanges.postponements - directionalChanges.anticipations);
    const anticipationWeight = prioritizationWeights.predictionChangeWeight === 0
      ? 0
      : Math.max(1, Math.ceil(prioritizationWeights.predictionChangeWeight / 4));
    const predictionChangeScore = (directionalChanges.postponements + unclassifiedChanges) * prioritizationWeights.predictionChangeWeight
      + directionalChanges.anticipations * anticipationWeight;
    const score = predictionChangeScore
      + (supplierIssue ? prioritizationWeights.noSupplierWeight : 0)
      + (overdue ? prioritizationWeights.overdueWeight : 0)
      + (highPriority ? prioritizationWeights.highPriorityWeight : 0)
      + financialImpactScore;
    const reasons = [];
    if (supplierIssue) reasons.push("Sem fornecedor");
    if (directionalChanges.postponements > 0) reasons.push(`${directionalChanges.postponements} adiamento(s)`);
    if (directionalChanges.anticipations > 0) reasons.push(`${directionalChanges.anticipations} antecipação(ões) com peso reduzido`);
    if (unclassifiedChanges > 0) reasons.push(`${unclassifiedChanges} alteração(ões) sem direção classificável`);
    if (overdue) reasons.push("Previsão vencida");
    if (highPriority) reasons.push("Prioridade alta");
    if (financialImpactScore > 0) reasons.push(`Impacto financeiro +${financialImpactScore} pts`);

    return {
      id: item.id,
      item: item.item,
      itemDescription: item.itemDescription,
      customerPo: item.customerPo,
      shipmentPriority: item.shipmentPriority,
      currentPrediction: item.currentPrediction,
      previousPrediction: item.previousPrediction,
      predictionChangesCount: item.predictionChangesCount,
      postponementsCount: directionalChanges.postponements,
      anticipationsCount: directionalChanges.anticipations,
      predictionChangeScore,
      lastPredictionChangeDate: item.lastPredictionChangeDate,
      extendedPrice: toNumber(item.extendedPrice),
      financialImpactScore,
      riskScore: score,
      riskLevel: score >= 8 ? "CRÍTICO" : score >= 4 ? "ATENÇÃO" : "MONITORAR",
      reasons: reasons.length > 0 ? reasons : ["Sem alteração registrada"],
    };
  };

  const actionQueue = allItems
    .map(rankItem)
    .filter(item => item.riskScore > 0)
    .sort((a, b) => b.riskScore - a.riskScore || b.financialImpactScore - a.financialImpactScore || b.predictionChangesCount - a.predictionChangesCount)
    .slice(0, 10);

  const mostChanged = [...allItems]
    .sort((a, b) => b.predictionChangesCount - a.predictionChangesCount)
    .slice(0, 8)
    .map(rankItem);

  const trend = [...uploadList].reverse().map(upload => ({
    id: upload.id,
    fileName: upload.fileName,
    uploadDate: upload.uploadDate,
    totalRows: upload.totalRows,
    changedRowsCount: upload.changedRowsCount,
    changeRate: upload.totalRows > 0 ? Math.round((upload.changedRowsCount / upload.totalRows) * 1000) / 10 : 0,
  }));

  const hasActivePortfolio = totalItems > 0;
  const latestChangeRate = hasActivePortfolio ? Math.round((changedLastUpload / totalItems) * 1000) / 10 : 0;
  const latestStabilityRate = hasActivePortfolio && latestUpload
    ? Math.max(0, Math.round((100 - latestChangeRate) * 10) / 10)
    : null;

  return {
    totalItems,
    changedLastUpload,
    noSupplier,
    obsoleteItems,
    noDeadlineItems,
    withDeadlineItems,
    mostChanged,
    totalOrderValue,
    valueAtRisk,
    changedItems: changedItems.length,
    stableItems,
    highPriorityItems,
    overdueItems,
    stabilityRate: totalItems > 0 ? Math.round((stableItems / totalItems) * 1000) / 10 : 0,
    riskRate: totalItems > 0 ? Math.round((changedItems.length / totalItems) * 1000) / 10 : 0,
    latestChangeRate,
    latestStabilityRate,
    trend,
    actionQueue,
    latestUpload,
  };
}

export async function getDeliveredItems(filters?: { search?: string; item?: string; customerPo?: string; shipTo?: string }) {
  const db = await getDb();
  if (!db) return [];

  const conditions: any[] = [sql`status = 'delivered'`];
  if (filters?.search) {
    const s = `%${filters.search}%`;
    conditions.push(or(
      like(orderItems.item, s),
      like(orderItems.customerPo, s),
      like(orderItems.itemDescription, s)
    ));
  }
  if (filters?.item) {
    conditions.push(like(orderItems.item, `%${filters.item}%`));
  }
  if (filters?.customerPo) {
    conditions.push(like(orderItems.customerPo, `%${filters.customerPo}%`));
  }
  if (filters?.shipTo) {
    const normalizedShipTo = normalizeShipTo(filters.shipTo);
    if (normalizedShipTo) {
      conditions.push(sql`TRIM(${orderItems.shipTo}) = ${normalizedShipTo}`);
    }
  }

  const itemsQuery = db.select().from(orderItems).leftJoin(uploads, eq(orderItems.lastUploadId, uploads.id));
  const rows = await itemsQuery.where(conditions.length > 1 ? and(...conditions) : conditions[0]).orderBy(desc(orderItems.deliveredAt), desc(orderItems.updatedAt));

  return rows.map(({ order_items: item, uploads: upload }) => ({
    ...item,
    shipTo: normalizeShipTo(item.shipTo) || "Sem filial informada",
    lastUploadFileName: upload?.fileName ?? null,
    lastUploadDate: upload?.uploadDate ?? null,
  }));
}
