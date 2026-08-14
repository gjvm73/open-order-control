import { eq, desc, sql, and, or, like, gte, lte } from "drizzle-orm";
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
  return await db.select().from(uploads).orderBy(desc(uploads.uploadDate));
}

export async function getOrderItems(filters?: { search?: string; item?: string; customerPo?: string; prediction?: string }) {
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
  
  if (conditions.length > 0) {
    return await db.select().from(orderItems).where(and(...conditions)).orderBy(desc(orderItems.updatedAt));
  }
  
  return await db.select().from(orderItems).orderBy(desc(orderItems.updatedAt));
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
  // Retornar histórico incluindo a data do upload correspondente
  return await db.select({
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
  .orderBy(desc(predictionHistory.recordedAt));
}

export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return { totalItems: 0, changedLastUpload: 0, noSupplier: 0, mostChanged: [] };

  const allItems = await db.select().from(orderItems);
  const totalItems = allItems.length;

  const noSupplier = allItems.filter(i => i.currentPrediction && i.currentPrediction.toLowerCase().includes("sem fornecedor")).length;

  const mostChanged = [...allItems].sort((a, b) => b.predictionChangesCount - a.predictionChangesCount).slice(0, 5);

  const uploadList = await db.select().from(uploads).orderBy(desc(uploads.uploadDate)).limit(1);
  let changedLastUpload = 0;
  if (uploadList.length > 0) {
    const lastUploadId = uploadList[0].id;
    // Contar quantas entradas no histórico pertencem ao último upload e representam mudança
    const historyLastUpload = await db.select()
      .from(predictionHistory)
      .innerJoin(orderItems, eq(predictionHistory.orderItemId, orderItems.id))
      .where(and(
        eq(predictionHistory.uploadId, lastUploadId),
        sql`${orderItems.previousPrediction} IS NOT NULL AND ${orderItems.previousPrediction} != ${predictionHistory.prediction}`
      ));
    changedLastUpload = historyLastUpload.length;
    // Fallback se necessário
    if (changedLastUpload === 0) {
      const changedInUpload = await db.select().from(orderItems).where(eq(orderItems.lastUploadId, lastUploadId));
      changedLastUpload = changedInUpload.filter(i => i.predictionChangesCount > 0 && i.lastUploadId === lastUploadId).length;
    }
  }

  return {
    totalItems,
    changedLastUpload,
    noSupplier,
    mostChanged,
  };
}
