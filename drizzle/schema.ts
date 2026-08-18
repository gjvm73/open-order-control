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
  acceptedRows: int("acceptedRows").notNull().default(0),
  consolidatedRows: int("consolidatedRows").notNull().default(0),
  rejectedRows: int("rejectedRows").notNull().default(0),
  duplicateRows: int("duplicateRows").notNull().default(0),
  rejectionReasons: text("rejectionReasons"),
  changedRowsCount: int("changedRowsCount").notNull().default(0),
  uploadedBy: int("uploadedBy"),
});

export type UploadRecord = typeof uploads.$inferSelect;
export type InsertUploadRecord = typeof uploads.$inferInsert;

// Tabela de Itens de Open Orders (Estado atual de cada item/PO)
export const orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  shipTo: text("shipTo"),
  comparisonKey: varchar("comparisonKey", { length: 255 }).notNull(),
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
  status: varchar("status", { length: 20 }).notNull().default("active"), // 'active' ou 'delivered'
  deliveredAt: timestamp("deliveredAt"),
  deliveredUploadId: int("deliveredUploadId"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  comparisonKeyUnique: uniqueIndex("order_items_comparison_key_unique").on(table.comparisonKey),
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

// Configuração administrativa única para os pesos usados na Fila de Ação.
export const prioritizationSettings = mysqlTable("prioritization_settings", {
  id: int("id").primaryKey(),
  predictionChangeWeight: int("predictionChangeWeight").notNull().default(4),
  noSupplierWeight: int("noSupplierWeight").notNull().default(5),
  overdueWeight: int("overdueWeight").notNull().default(3),
  highPriorityWeight: int("highPriorityWeight").notNull().default(2),
  financialImpactWeight: int("financialImpactWeight").notNull().default(3),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PrioritizationSettings = typeof prioritizationSettings.$inferSelect;
export type InsertPrioritizationSettings = typeof prioritizationSettings.$inferInsert;
