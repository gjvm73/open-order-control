import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { sql } from "./db";
import { z } from "zod";
import * as XLSX from "xlsx";

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
    }).optional()).query(async ({ input }) => {
      return await db.getOrderItems({ search: input?.search });
    }),

    getItemDetail: publicProcedure.input(z.object({
      id: z.number(),
    })).query(async ({ input }) => {
      const item = await db.getOrderItemById(input.id);
      if (!item) throw new Error("Item não encontrado");
      const history = await db.getPredictionHistoryByItem(item.id);
      return { item, history };
    }),

    getStats: publicProcedure.query(async () => {
      return await db.getDashboardStats();
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

        const uploadId = await db.createUploadRecord({
          fileName: input.fileName,
          totalRows: rows.length,
          uploadedBy: ctx.user.id,
          changedRowsCount: 0,
        });

        let changedCount = 0;

        for (const row of rows) {
          const shipTo = String(row['Endereco (ship To)'] || row['Endereço (ship To)'] || '');
          const customerPo = String(row['Customer PO'] || '');
          const shipmentPriority = String(row['Shipment Priority'] || '');
          const orderCreationDate = String(row['Data Criacao da Ordem'] || row['Data Criação da Ordem'] || '');
          const itemCode = String(row['Item'] || '').trim();
          const itemDescription = String(row['Descricao do Item'] || row['Descrição do Item'] || '');
          const quantity = String(row['Quantidade'] || '0');
          const scheduledReserved = String(row['Scheduled Reserved'] || '0');
          const unitSellingPrice = String(row['Unit Selling Price'] || '0');
          const extendedPrice = String(row['Extended Price'] || '0');
          
          let rawPrediction = row['Previsão'] ?? row['Previsao'];
          let prediction = 'Sem previsão';
          if (rawPrediction instanceof Date) {
            prediction = rawPrediction.toISOString().split('T')[0];
          } else if (typeof rawPrediction === 'number') {
            const utcDays = Math.floor(rawPrediction - 25569);
            const utcValue = utcDays * 86400 * 1000;
            prediction = new Date(utcValue).toISOString().split('T')[0];
          } else if (rawPrediction) {
            prediction = String(rawPrediction).trim();
          }

          const longText = String(row['Long Text'] || '');

          if (!itemCode) continue;

          const existingItems = await database.select().from(db.orderItems).where(
            sql`item = ${itemCode} AND customerPo = ${customerPo}`
          );

          if (existingItems.length > 0) {
            const existing = existingItems[0];
            const oldPrediction = existing.currentPrediction;

            if (oldPrediction !== prediction) {
              changedCount++;
              const newChangesCount = existing.predictionChangesCount + 1;

              await database.update(db.orderItems).set({
                shipTo,
                shipmentPriority,
                orderCreationDate,
                itemDescription,
                quantity,
                scheduledReserved,
                unitSellingPrice,
                extendedPrice,
                previousPrediction: oldPrediction,
                currentPrediction: prediction,
                longText,
                predictionChangesCount: newChangesCount,
                lastPredictionChangeDate: new Date(),
                lastUploadId: uploadId,
                updatedAt: new Date(),
              }).where(sql`id = ${existing.id}`);

              await database.insert(db.predictionHistory).values({
                orderItemId: existing.id,
                uploadId: uploadId,
                item: itemCode,
                customerPo: customerPo,
                prediction: prediction,
              });
            } else {
              await database.update(db.orderItems).set({
                shipTo,
                shipmentPriority,
                orderCreationDate,
                itemDescription,
                quantity,
                scheduledReserved,
                unitSellingPrice,
                extendedPrice,
                longText,
                lastUploadId: uploadId,
                updatedAt: new Date(),
              }).where(sql`id = ${existing.id}`);
            }
          } else {
            const [insertResult] = await database.insert(db.orderItems).values({
              shipTo,
              customerPo,
              shipmentPriority,
              orderCreationDate,
              item: itemCode,
              itemDescription,
              quantity,
              scheduledReserved,
              unitSellingPrice,
              extendedPrice,
              currentPrediction: prediction,
              previousPrediction: null,
              longText,
              predictionChangesCount: 0,
              lastUploadId: uploadId,
            });

            const newId = insertResult.insertId;

            await database.insert(db.predictionHistory).values({
              orderItemId: newId,
              uploadId: uploadId,
              item: itemCode,
              customerPo: customerPo,
              prediction: prediction,
            });
          }
        }

        await database.update(db.uploads).set({
          changedRowsCount: changedCount,
        }).where(sql`id = ${uploadId}`);

        return {
          success: true,
          uploadId,
          totalRows: rows.length,
          changedRowsCount: changedCount,
        };
      } catch (error: any) {
        console.error("Erro no upload do Excel:", error);
        throw new Error(error.message || "Erro ao processar planilha Excel.");
      }
    }),
  }),
});

export type AppRouter = typeof appRouter;
