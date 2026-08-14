import fs from "node:fs/promises";
import path from "node:path";
import { appRouter } from "../server/routers.ts";
import { getUserByOpenId } from "../server/db.ts";
import { ENV } from "../server/_core/env.ts";

const filePath = "/home/ubuntu/upload/RelatóriodeOpenOrder-DMMC-15-05-25.xlsx";
const buffer = await fs.readFile(filePath);
const user = await getUserByOpenId(ENV.ownerOpenId);

if (!user) {
  throw new Error("Usuário proprietário não encontrado para autenticar a validação da planilha.");
}

const ctx = {
  user,
  req: { protocol: "https", headers: {} },
  res: {},
};

const caller = appRouter.createCaller(ctx);
const result = await caller.orders.uploadExcel({
  fileName: path.basename(filePath),
  fileBase64: buffer.toString("base64"),
});

const stats = await caller.orders.getStats();
const items = await caller.orders.listItems({});

console.log(JSON.stringify({
  upload: result,
  dashboard: {
    totalItems: stats.totalItems,
    changedLastUpload: stats.changedLastUpload,
    noSupplier: stats.noSupplier,
    mostChanged: stats.mostChanged.slice(0, 5).map((item) => ({
      item: item.item,
      changes: item.predictionChangesCount,
      currentPrediction: item.currentPrediction,
    })),
  },
  firstItems: items.slice(0, 5).map((item) => ({
    id: item.id,
    item: item.item,
    customerPo: item.customerPo,
    currentPrediction: item.currentPrediction,
    previousPrediction: item.previousPrediction,
    predictionChangesCount: item.predictionChangesCount,
  })),
}, null, 2));
