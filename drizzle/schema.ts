import { decimal, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Tabela de Uploads (Histórico de arquivos enviados semanalmente)
export const uploads = mysqlTable("uploads", {
  id: int("id").autoincrement().primaryKey(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  uploadDate: timestamp("uploadDate").defaultNow().notNull(),
  totalRows: int("totalRows").notNull().default(0),
  changedRowsCount: int("changedRowsCount").notNull().default(0),
  uploadedBy: int("uploadedBy"),
});

export type UploadRecord = typeof uploads.$inferSelect;
export type InsertUploadRecord = typeof uploads.$inferInsert;

// Tabela de Itens de Open Orders (Estado atual de cada item/PO)
export const orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  shipTo: text("shipTo"),
  customerPo: varchar("customerPo", { length: 100 }),
  shipmentPriority: varchar("shipmentPriority", { length: 50 }),
  orderCreationDate: varchar("orderCreationDate", { length: 50 }),
  item: varchar("item", { length: 100 }).notNull(),
  itemDescription: text("itemDescription"),
  quantity: decimal("quantity", { precision: 12, scale: 2 }).default("0"),
  scheduledReserved: decimal("scheduledReserved", { precision: 12, scale: 2 }).default("0"),
  unitSellingPrice: decimal("unitSellingPrice", { precision: 12, scale: 4 }).default("0"),
  extendedPrice: decimal("extendedPrice", { precision: 12, scale: 4 }).default("0"),
  currentPrediction: text("currentPrediction"), // Campo "Previsão"
  previousPrediction: text("previousPrediction"),
  longText: text("longText"),
  predictionChangesCount: int("predictionChangesCount").notNull().default(0),
  lastPredictionChangeDate: timestamp("lastPredictionChangeDate"),
  lastUploadId: int("lastUploadId"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  itemCustomerPoUnique: uniqueIndex("order_items_item_customer_po_unique").on(table.item, table.customerPo),
}));

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;

// Tabela de Histórico de Previsões por Upload/Item para rastreabilidade completa
export const predictionHistory = mysqlTable("prediction_history", {
  id: int("id").autoincrement().primaryKey(),
  orderItemId: int("orderItemId").notNull(),
  uploadId: int("uploadId").notNull(),
  item: varchar("item", { length: 100 }).notNull(),
  customerPo: varchar("customerPo", { length: 100 }),
  prediction: text("prediction").notNull(),
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
});

export type PredictionHistoryRecord = typeof predictionHistory.$inferSelect;
export type InsertPredictionHistoryRecord = typeof predictionHistory.$inferInsert;
