import { COOKIE_NAME } from "@shared/const";
import { asc, desc, inArray } from "drizzle-orm";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { sql } from "./db";
import { z } from "zod";
import * as XLSX from "xlsx";

function normalizeComparisonPart(value: string) {
  return value.trim().toLocaleUpperCase("pt-BR");
}

function buildComparisonKey(shipTo: string, itemCode: string, customerPo: string) {
  return `${normalizeComparisonPart(shipTo || "SEM FILIAL INFORMADA")}::${normalizeComparisonPart(itemCode)}::${normalizeComparisonPart(customerPo || "SEM PO")}`;
}

function getExcelRowValue(row: Record<string, any>, keys: string[]): any {
  if (!row) return undefined;
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== '') {
      return row[k];
    }
  }
  const rowKeys = Object.keys(row);
  for (const targetKey of keys) {
    const normalizedTarget = targetKey.toLowerCase().replace(/[\s\(\)\-_]/g, '');
    for (const rk of rowKeys) {
      const normalizedRk = rk.toLowerCase().replace(/[\s\(\)\-_]/g, '');
      if (normalizedRk === normalizedTarget) {
        const val = row[rk];
        if (val !== undefined && val !== null && val !== '') {
          return val;
        }
      }
    }
  }
  return undefined;
}

function parseExcelDate(raw: any): string {
  if (raw === undefined || raw === null || raw === '') return 'Sem previsão';
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return String(raw);
    return raw.toISOString().split('T')[0];
  }
  if (typeof raw === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const jsDate = new Date(excelEpoch.getTime() + raw * 86400000);
    if (isNaN(jsDate.getTime())) return String(raw);
    return jsDate.toISOString().split('T')[0];
  }
  const str = String(raw).trim();
  if (!str) return 'Sem previsão';

  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const brMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (brMatch) {
    let [, d, m, y] = brMatch;
    if (y.length === 2) {
      y = (parseInt(y, 10) > 50 ? '19' : '20') + y;
    }
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return str;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  orders: router({
    listUploads: publicProcedure.query(async () => {
      return await db.getUploadsList();
    }),

    listItems: publicProcedure.input(z.object({
      search: z.string().optional(),
      item: z.string().optional(),
      customerPo: z.string().optional(),
      prediction: z.string().optional(),
      shipTo: z.string().optional(),
    }).optional()).query(async ({ input }) => {
      return await db.getOrderItems({
        search: input?.search,
        item: input?.item,
        customerPo: input?.customerPo,
        prediction: input?.prediction,
        shipTo: input?.shipTo,
      });
    }),

    listShipTo: publicProcedure.query(async () => {
      return await db.getShipToOptions();
    }),

    getBranchSummary: publicProcedure.query(async () => {
      return await db.getBranchSummary();
    }),

    getItemDetail: publicProcedure.input(z.object({
      id: z.number(),
    })).query(async ({ input }) => {
      const item = await db.getOrderItemById(input.id);
      if (!item) throw new Error("Item não encontrado");
      const history = await db.getPredictionHistoryByItem(item.id);
      return { item, history };
    }),

    getStats: publicProcedure.input(z.object({ shipTo: z.string().optional() }).optional()).query(async ({ input }) => {
      return await db.getDashboardStats(input?.shipTo);
    }),

    getAlerts: publicProcedure.input(z.object({
      thresholdDays: z.number().int().min(1).max(3650).default(7),
      shipTo: z.string().optional(),
    })).query(async ({ input }) => {
      const alerts = await db.getPredictionAlerts(input.thresholdDays, input.shipTo);
      const criticalCount = alerts.filter(a => a.severity === "CRÍTICO").length;
      const attentionCount = alerts.filter(a => a.severity === "ATENÇÃO").length;
      const totalAlerts = alerts.length;
      const criticalRatio = totalAlerts > 0 ? Number(((criticalCount / totalAlerts) * 100).toFixed(1)) : 0;
      const attentionRatio = totalAlerts > 0 ? Number(((attentionCount / totalAlerts) * 100).toFixed(1)) : 0;
      return {
        alerts,
        summary: {
          totalAlerts,
          criticalCount,
          attentionCount,
          criticalRatio,
          attentionRatio,
        },
      };
    }),

    getAlertsTrend: publicProcedure.input(z.object({
      thresholdDays: z.number().int().min(1).max(3650).default(7),
      shipTo: z.string().optional(),
    })).query(async ({ input }) => {
      return await db.getAlertsTrend(input.thresholdDays, input.shipTo);
    }),

    resetImports: adminProcedure.mutation(async () => {
      return await db.resetImportedData();
    }),

    uploadExcel: protectedProcedure.input(z.object({
      fileName: z.string(),
      fileBase64: z.string(),
    })).mutation(async ({ input, ctx }) => {
      try {
        const buffer = Buffer.from(input.fileBase64, 'base64');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);

        if (!rows || rows.length === 0) {
          throw new Error("A planilha está vazia ou em formato inválido.");
        }

        const database = await db.getDb();
        if (!database) throw new Error("Banco de dados indisponível");

        type PreparedRow = {
          shipTo: string;
          customerPo: string;
          shipmentPriority: string;
          orderCreationDate: string;
          itemCode: string;
          itemDescription: string;
          quantity: string;
          scheduledReserved: string;
          unitSellingPrice: string;
          extendedPrice: string;
          prediction: string;
          longText: string;
          comparisonKey: string;
        };

        const preparedByKey = new Map<string, PreparedRow>();
        for (const row of rows) {
          const shipToVal = getExcelRowValue(row, ['Endereco (ship To)', 'Endereço (ship To)', 'Ship To', 'Filial', 'Endereço', 'Endereco', 'ShipTo']);
          const shipTo = String(shipToVal || '').trim();

          const customerPoVal = getExcelRowValue(row, ['Customer PO', 'PO', 'Pedido', 'Pedido do Cliente', 'Cust PO', 'Purchase Order']);
          const customerPo = String(customerPoVal || '').trim();

          const shipmentPriorityVal = getExcelRowValue(row, ['Shipment Priority', 'Prioridade', 'Priority']);
          const shipmentPriority = String(shipmentPriorityVal || '').trim();

          const orderCreationDateVal = getExcelRowValue(row, ['Data Criacao da Ordem', 'Data Criação da Ordem', 'Data da Ordem', 'Data Ordem', 'Creation Date']);
          const orderCreationDate = String(orderCreationDateVal || '').trim();

          const itemCodeVal = getExcelRowValue(row, ['Item', 'Código do Item', 'Codigo do Item', 'Material', 'SKU', 'Item Code', 'Cod Item']);
          const itemCode = String(itemCodeVal || '').trim();
          if (!itemCode) continue;

          const comparisonKey = buildComparisonKey(shipTo, itemCode, customerPo);

          const itemDescriptionVal = getExcelRowValue(row, ['Descricao do Item', 'Descrição do Item', 'Descrição', 'Descricao', 'Item Description']);
          const itemDescription = String(itemDescriptionVal || '');

          const quantityVal = getExcelRowValue(row, ['Quantidade', 'Qtde', 'Qtd', 'Quantity']);
          const quantity = String(quantityVal || '0');

          const scheduledReservedVal = getExcelRowValue(row, ['Scheduled Reserved', 'Reservado', 'Reserved']);
          const scheduledReserved = String(scheduledReservedVal || '0');

          const unitSellingPriceVal = getExcelRowValue(row, ['Unit Selling Price', 'Preço Unitário', 'Preco Unitario', 'Unit Price']);
          const unitSellingPrice = String(unitSellingPriceVal || '0');

          const extendedPriceVal = getExcelRowValue(row, ['Extended Price', 'Preço Total', 'Preco Total', 'Total Price', 'ExtendedPrice']);
          const extendedPrice = String(extendedPriceVal || '0');

          const rawPrediction = getExcelRowValue(row, ['Previsão', 'Previsao', 'Data Previsão', 'Data Previsao', 'Data de Entrega', 'Previsão de Entrega', 'Previsao de Entrega', 'Delivery Date', 'Previsao Entrega', 'Data Entrega', 'Data Entr']);
          const prediction = parseExcelDate(rawPrediction);

          const longTextVal = getExcelRowValue(row, ['Long Text', 'Observações', 'Observacoes', 'Notes', 'Texto Longo']);
          const longText = String(longTextVal || '');

          preparedByKey.set(comparisonKey, {
            shipTo,
            comparisonKey,
            customerPo,
            shipmentPriority,
            orderCreationDate,
            itemCode,
            itemDescription,
            quantity,
            scheduledReserved,
            unitSellingPrice,
            extendedPrice,
            prediction,
            longText,
          });
        }

        const preparedRows = Array.from(preparedByKey.values());
        const result = await database.transaction(async (tx) => {
          const [uploadResult] = await tx.insert(db.uploads).values({
            fileName: input.fileName,
            totalRows: rows.length,
            uploadedBy: ctx.user.id,
            changedRowsCount: 0,
          });
          const uploadId = Number(uploadResult.insertId);
          const comparisonKeys = Array.from(new Set(preparedRows.map((row) => row.comparisonKey)));
          const existingRows = comparisonKeys.length > 0
            ? await tx.select().from(db.orderItems).where(inArray(db.orderItems.comparisonKey, comparisonKeys))
            : [];
          const existingByKey = new Map(existingRows.map((item) => [item.comparisonKey, item] as const));
          const existingIds = existingRows.map((item) => item.id);
          const priorHistoryRows = existingIds.length > 0
            ? await tx.select({
                id: db.predictionHistory.id,
                orderItemId: db.predictionHistory.orderItemId,
                prediction: db.predictionHistory.prediction,
              }).from(db.predictionHistory)
                .where(inArray(db.predictionHistory.orderItemId, existingIds))
                .orderBy(asc(db.predictionHistory.orderItemId), desc(db.predictionHistory.uploadId), desc(db.predictionHistory.id))
            : [];
          const latestHistoryByItemId = new Map<number, string>();
          for (const historyRow of priorHistoryRows) {
            if (!latestHistoryByItemId.has(historyRow.orderItemId)) {
              latestHistoryByItemId.set(historyRow.orderItemId, historyRow.prediction);
            }
          }
          const changedExistingRows = preparedRows.map((row) => {
            const existing = existingByKey.get(row.comparisonKey);
            if (!existing) return null;
            const previousPrediction = latestHistoryByItemId.get(existing.id) ?? existing.currentPrediction;
            if (previousPrediction === row.prediction) return null;
            return {
              id: existing.id,
              previousPrediction,
              predictionChangesCount: existing.predictionChangesCount + 1,
            };
          }).filter((change): change is { id: number; previousPrediction: string | null; predictionChangesCount: number } => change !== null);
          const changedCount = changedExistingRows.length;

          const importBatchSize = 500;
          for (let start = 0; start < preparedRows.length; start += importBatchSize) {
            const batch = preparedRows.slice(start, start + importBatchSize);
            await tx.insert(db.orderItems).values(batch.map((row) => ({
              shipTo: row.shipTo,
              comparisonKey: row.comparisonKey,
              customerPo: row.customerPo,
              shipmentPriority: row.shipmentPriority,
              orderCreationDate: row.orderCreationDate,
              item: row.itemCode,
              itemDescription: row.itemDescription,
              quantity: row.quantity,
              scheduledReserved: row.scheduledReserved,
              unitSellingPrice: row.unitSellingPrice,
              extendedPrice: row.extendedPrice,
              currentPrediction: row.prediction,
              previousPrediction: null,
              longText: row.longText,
              predictionChangesCount: 0,
              lastUploadId: uploadId,
            }))).onDuplicateKeyUpdate({
              set: {
                shipTo: sql`VALUES(\`shipTo\`)`,
                shipmentPriority: sql`VALUES(\`shipmentPriority\`)`,
                orderCreationDate: sql`VALUES(\`orderCreationDate\`)`,
                itemDescription: sql`VALUES(\`itemDescription\`)`,
                quantity: sql`VALUES(\`quantity\`)`,
                scheduledReserved: sql`VALUES(\`scheduledReserved\`)`,
                unitSellingPrice: sql`VALUES(\`unitSellingPrice\`)`,
                extendedPrice: sql`VALUES(\`extendedPrice\`)`,
                previousPrediction: sql`IF(NOT (\`currentPrediction\` <=> VALUES(\`currentPrediction\`)), \`currentPrediction\`, \`previousPrediction\`)`,
                currentPrediction: sql`VALUES(\`currentPrediction\`)`,
                longText: sql`VALUES(\`longText\`)`,
                predictionChangesCount: sql`\`predictionChangesCount\` + (NOT (\`currentPrediction\` <=> VALUES(\`currentPrediction\`)))`,
                lastPredictionChangeDate: sql`IF(NOT (\`currentPrediction\` <=> VALUES(\`currentPrediction\`)), NOW(), \`lastPredictionChangeDate\`)`,
                lastUploadId: sql`VALUES(\`lastUploadId\`)`,
                updatedAt: sql`NOW()`,
              },
            });
          }

          if (changedExistingRows.length > 0) {
            const previousPredictionCases = sql.join(
              changedExistingRows.map((change) => sql`WHEN ${change.id} THEN ${change.previousPrediction}`),
              sql.raw(" "),
            );
            const changesCountCases = sql.join(
              changedExistingRows.map((change) => sql`WHEN ${change.id} THEN ${change.predictionChangesCount}`),
              sql.raw(" "),
            );
            await tx.update(db.orderItems).set({
              previousPrediction: sql`CASE ${db.orderItems.id} ${previousPredictionCases} ELSE ${db.orderItems.previousPrediction} END`,
              predictionChangesCount: sql`CASE ${db.orderItems.id} ${changesCountCases} ELSE ${db.orderItems.predictionChangesCount} END`,
            }).where(inArray(db.orderItems.id, changedExistingRows.map((change) => change.id)));
          }

          const refreshedRows = comparisonKeys.length > 0
            ? await tx.select().from(db.orderItems).where(inArray(db.orderItems.comparisonKey, comparisonKeys))
            : [];
          const refreshedByKey = new Map(refreshedRows.map((item) => [item.comparisonKey, item] as const));
          const historyRows = preparedRows.map((row) => {
            const item = refreshedByKey.get(row.comparisonKey);
            if (!item) throw new Error(`Não foi possível localizar o item ${row.itemCode} após o upsert.`);
            return {
              orderItemId: item.id,
              uploadId,
              item: row.itemCode,
              customerPo: row.customerPo,
              prediction: row.prediction,
            };
          });
          for (let start = 0; start < historyRows.length; start += importBatchSize) {
            await tx.insert(db.predictionHistory).values(historyRows.slice(start, start + importBatchSize));
          }
          await tx.update(db.uploads).set({ changedRowsCount: changedCount }).where(sql`id = ${uploadId}`);
          return { uploadId, changedCount };
        });

        return {
          success: true,
          uploadId: result.uploadId,
          totalRows: rows.length,
          changedRowsCount: result.changedCount,
        };
      } catch (error: any) {
        console.error("Erro no upload do Excel:", error);
        throw new Error(error.message || "Erro ao processar planilha Excel.");
      }
    }),
  }),
});

export type AppRouter = typeof appRouter;
