import { eq, desc, asc, sql, and, or, like, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, uploads, orderItems, predictionHistory, InsertUploadRecord, InsertOrderItem, InsertPredictionHistoryRecord } from "../drizzle/schema";
import { ENV } from './_core/env';

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

export { users, uploads, orderItems, predictionHistory, sql, eq, desc, and, or, like };

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
  
  const conditions = [];
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
    const normalizedShipTo = filters.shipTo.trim();
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
    lastUploadFileName: upload?.fileName ?? null,
    lastUploadDate: upload?.uploadDate ?? null,
  }));
}

export async function getOrderItemById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [item] = await db.select().from(orderItems).where(eq(orderItems.id, id)).limit(1);
  return item || null;
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

export async function getPredictionAlerts(thresholdDays: number, shipTo?: string) {
  const db = await getDb();
  if (!db) return [];

  const normalizedShipTo = shipTo?.trim();
  const conditions = normalizedShipTo ? [sql`TRIM(${orderItems.shipTo}) = ${normalizedShipTo}`] : [];
  const items = conditions.length > 0
    ? await db.select().from(orderItems).where(and(...conditions))
    : await db.select().from(orderItems);
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
      .where(sql`TRIM(${orderItems.shipTo}) = ${shipTo.trim()}`)
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
    .map(row => row.shipTo?.trim())
    .filter((value): value is string => Boolean(value));
  return Array.from(new Set(options)).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export async function getBranchSummary() {
  const db = await getDb();
  if (!db) return [];
  const allItems = await db.select().from(orderItems);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parsePredictionDate = (value: string | null) => {
    if (!value || !/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const toNumber = (value: unknown) => {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const groups = new Map<string, typeof allItems>();
  for (const item of allItems) {
    const branch = item.shipTo?.trim() || "Sem filial informada";
    const current = groups.get(branch) || [];
    current.push(item);
    groups.set(branch, current);
  }
  const totalItems = allItems.length || 1;
  return Array.from(groups.entries()).map(([shipTo, items]) => {
    const changedItems = items.filter(item => item.predictionChangesCount > 0);
    const overdueItems = items.filter(item => {
      const date = parsePredictionDate(item.currentPrediction);
      return Boolean(date && date < today);
    });
    const noSupplier = items.filter(item => Boolean(item.currentPrediction?.toLowerCase().includes("sem fornecedor")));
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
      trend: [],
      actionQueue: [],
      latestUpload: null,
    };
  }

  const allItems = shipTo
    ? await db.select().from(orderItems).where(sql`TRIM(${orderItems.shipTo}) = ${shipTo.trim()}`)
    : await db.select().from(orderItems);
  const uploadList = await db.select().from(uploads).orderBy(desc(uploads.uploadDate), desc(uploads.id)).limit(8);
  const latestUpload = uploadList[0] || null;
  let changedLastUpload = latestUpload?.changedRowsCount || 0;
  if (shipTo && latestUpload) {
    const scopedHistory = await db.select({
      id: predictionHistory.id,
      orderItemId: predictionHistory.orderItemId,
      uploadId: predictionHistory.uploadId,
      prediction: predictionHistory.prediction,
    }).from(predictionHistory).innerJoin(orderItems, eq(predictionHistory.orderItemId, orderItems.id)).where(sql`TRIM(${orderItems.shipTo}) = ${shipTo.trim()}`).orderBy(asc(predictionHistory.uploadId), asc(predictionHistory.id), asc(predictionHistory.recordedAt));
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

  const parsePredictionDate = (value: string | null) => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const isNoSupplier = (value: string | null) => Boolean(value && value.toLowerCase().includes("sem fornecedor"));
  const totalItems = allItems.length;
  const noSupplier = allItems.filter(item => isNoSupplier(item.currentPrediction)).length;
  const changedItems = allItems.filter(item => item.predictionChangesCount > 0);
  const stableItems = totalItems - changedItems.length;
  const highPriorityItems = allItems.filter(item => (item.shipmentPriority || "").toLowerCase() === "high").length;
  const overdueItems = allItems.filter(item => {
    const predictionDate = parsePredictionDate(item.currentPrediction);
    return Boolean(predictionDate && predictionDate < today);
  }).length;
  const totalOrderValue = allItems.reduce((sum, item) => sum + toNumber(item.extendedPrice), 0);
  const valueAtRisk = changedItems.reduce((sum, item) => sum + toNumber(item.extendedPrice), 0);

  const rankItem = (item: typeof allItems[number]) => {
    const predictionDate = parsePredictionDate(item.currentPrediction);
    const supplierIssue = isNoSupplier(item.currentPrediction);
    const overdue = Boolean(predictionDate && predictionDate < today);
    const highPriority = (item.shipmentPriority || "").toLowerCase() === "high";
    const score = item.predictionChangesCount * 4 + (supplierIssue ? 5 : 0) + (overdue ? 3 : 0) + (highPriority ? 2 : 0);
    const reasons = [];
    if (supplierIssue) reasons.push("Sem fornecedor");
    if (item.predictionChangesCount > 0) reasons.push(`${item.predictionChangesCount} alterações`);
    if (overdue) reasons.push("Previsão vencida");
    if (highPriority) reasons.push("Prioridade alta");

    return {
      id: item.id,
      item: item.item,
      itemDescription: item.itemDescription,
      customerPo: item.customerPo,
      shipmentPriority: item.shipmentPriority,
      currentPrediction: item.currentPrediction,
      previousPrediction: item.previousPrediction,
      predictionChangesCount: item.predictionChangesCount,
      lastPredictionChangeDate: item.lastPredictionChangeDate,
      extendedPrice: toNumber(item.extendedPrice),
      riskScore: score,
      riskLevel: score >= 8 ? "CRÍTICO" : score >= 4 ? "ATENÇÃO" : "MONITORAR",
      reasons: reasons.length > 0 ? reasons : ["Sem alteração registrada"],
    };
  };

  const actionQueue = allItems
    .map(rankItem)
    .filter(item => item.riskScore > 0)
    .sort((a, b) => b.riskScore - a.riskScore || b.predictionChangesCount - a.predictionChangesCount)
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

  const latestChangeRate = totalItems > 0 ? Math.round((changedLastUpload / totalItems) * 1000) / 10 : 0;
  const latestStabilityRate = Math.max(0, Math.round((100 - latestChangeRate) * 10) / 10);

  return {
    totalItems,
    changedLastUpload,
    noSupplier,
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
