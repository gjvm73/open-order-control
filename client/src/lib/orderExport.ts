export type OperationalExportItem = {
  shipTo?: string | null;
  item?: string | null;
  itemDescription?: string | null;
  customerPo?: string | null;
  shipmentPriority?: string | null;
  orderCreationDate?: string | Date | null;
  quantity?: number | string | null;
  scheduledReserved?: number | string | null;
  unitSellingPrice?: number | string | null;
  extendedPrice?: number | string | null;
  previousPrediction?: string | null;
  currentPrediction?: string | null;
  lastUploadDate?: string | Date | null;
  lastUploadFileName?: string | null;
  predictionChangesCount?: number | null;
  lastPredictionChangeDate?: string | Date | null;
  longText?: string | null;
};

function formatDate(value: unknown) {
  if (!value) return "";
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("pt-BR");
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildOperationalExportRows(items: OperationalExportItem[]) {
  return items.map((row) => ({
    "Filial solicitante": row.shipTo || "Sem filial informada",
    "Item": row.item || "",
    "Descrição do item": row.itemDescription || "",
    "Customer PO": row.customerPo || "",
    "Prioridade de embarque": row.shipmentPriority || "",
    "Data de criação": formatDate(row.orderCreationDate),
    "Quantidade": toNumber(row.quantity),
    "Scheduled Reserved": toNumber(row.scheduledReserved),
    "Preço unitário": toNumber(row.unitSellingPrice),
    "Valor estendido": toNumber(row.extendedPrice),
    "Previsão anterior": row.previousPrediction || "",
    "Previsão atual": row.currentPrediction || "",
    "Último upload": formatDate(row.lastUploadDate),
    "Arquivo do último upload": row.lastUploadFileName || "",
    "Total de alterações": row.predictionChangesCount ?? 0,
    "Data da última alteração": formatDate(row.lastPredictionChangeDate),
    "Observações": row.longText || "",
  }));
}

export function buildOperationalExportFileName(now = new Date()) {
  const stamp = now.toISOString().slice(0, 10);
  return `open-order-base-operacional-${stamp}.xlsx`;
}
