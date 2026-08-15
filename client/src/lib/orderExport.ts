import * as XLSX from "xlsx";

export type OperationalPredictionHistory = {
  id?: number;
  orderItemId: number;
  uploadId?: number;
  item?: string | null;
  customerPo?: string | null;
  prediction?: string | null;
  previousPrediction?: string | null;
  changed?: boolean;
  differenceDays?: number | null;
  uploadDate?: string | Date | null;
  recordedAt?: string | Date | null;
  fileName?: string | null;
};

export type OperationalExportItem = {
  id?: number;
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

function historyByItemId(history: OperationalPredictionHistory[]) {
  const grouped = new Map<number, OperationalPredictionHistory[]>();
  for (const record of history) {
    const records = grouped.get(record.orderItemId) || [];
    records.push(record);
    grouped.set(record.orderItemId, records);
  }
  return grouped;
}

function getChangeRecords(history: OperationalPredictionHistory[]) {
  return history.filter((record) => record.changed === true);
}

function formatChangeDate(record: OperationalPredictionHistory) {
  return formatDate(record.uploadDate ?? record.recordedAt);
}

function formatChangeDates(history: OperationalPredictionHistory[]) {
  return getChangeRecords(history)
    .map(formatChangeDate)
    .filter(Boolean)
    .join("; ");
}

function formatChangeTimeline(history: OperationalPredictionHistory[]) {
  return getChangeRecords(history)
    .map((record) => {
      const date = formatChangeDate(record);
      const previous = formatBrazilianPredictionDate(record.previousPrediction);
      const current = formatBrazilianPredictionDate(record.prediction);
      const difference = record.differenceDays === null || record.differenceDays === undefined
        ? ""
        : ` (${record.differenceDays > 0 ? "+" : ""}${record.differenceDays} dias)`;
      return `${date}: ${previous || "—"} → ${current || "—"}${difference}`;
    })
    .join(" | ");
}

export function formatBrazilianPredictionDate(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    const isoDateOnly = /^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})(?:$|T)/.exec(trimmed);
    if (isoDateOnly) {
      const [, year, month, day] = isoDateOnly;
      return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
    }

    const brazilianDate = /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/.exec(trimmed);
    if (brazilianDate) {
      const [, day, month, year] = brazilianDate;
      return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
    }
  }

  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("pt-BR");
}

export function buildOperationalExportRows(items: OperationalExportItem[], history: OperationalPredictionHistory[] = []) {
  const historyMap = historyByItemId(history);
  return items.map((row) => {
    const itemHistory = row.id ? historyMap.get(row.id) || [] : [];
    return {
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
    "Previsão anterior": formatBrazilianPredictionDate(row.previousPrediction),
    "Previsão atual": formatBrazilianPredictionDate(row.currentPrediction),
    "Último upload": formatDate(row.lastUploadDate),
    "Arquivo do último upload": row.lastUploadFileName || "",
    "Total de alterações": row.predictionChangesCount ?? 0,
    "Data da última alteração": formatDate(row.lastPredictionChangeDate),
    "Todas as datas de alteração": formatChangeDates(itemHistory),
    "Histórico das previsões": formatChangeTimeline(itemHistory),
    "Observações": row.longText || "",
    };
  });
}

export function buildOperationalExportFileName(now = new Date()) {
  const stamp = now.toISOString().slice(0, 10);
  return `open-order-base-operacional-${stamp}.xlsx`;
}

export function generateProfessionalOperationalWorkbook(
  items: OperationalExportItem[],
  filterSummary?: { branch?: string; search?: string },
  history: OperationalPredictionHistory[] = [],
) {
  const workbook = XLSX.utils.book_new();
  const historyMap = historyByItemId(history);
  const changeHistory = getChangeRecords(history);

  // 1. Aba de Resumo Executivo
  const totalItems = items.length;
  const totalExtendedPrice = items.reduce((acc, row) => acc + toNumber(row.extendedPrice), 0);
  const totalQuantity = items.reduce((acc, row) => acc + toNumber(row.quantity), 0);
  const totalChanges = items.reduce((acc, row) => acc + toNumber(row.predictionChangesCount), 0);
  const itemsWithChanges = items.filter((row) => toNumber(row.predictionChangesCount) > 0).length;

  const summaryData = [
    ["OPEN ORDER CONTROL — RESUMO EXECUTIVO DA BASE OPERACIONAL", "", ""],
    ["Data de Geração:", new Date().toLocaleDateString("pt-BR"), ""],
    ["Filtrado por Filial:", filterSummary?.branch || "Todas as filiais", ""],
    ["Termo de Busca:", filterSummary?.search || "Nenhum", ""],
    ["", "", ""],
    ["MÉTRICA CHAVE", "VALOR CONSOLIDADO", "OBSERVAÇÃO"],
    ["Total de Itens na Base", totalItems, "Itens ativos filtrados"],
    ["Quantidade Total", totalQuantity, "Soma das quantidades dos pedidos"],
    ["Valor Total da Carteira", totalExtendedPrice, "Soma dos preços estendidos (R$)"],
    ["Itens com Alteração de Prazo", itemsWithChanges, `Representa ${totalItems ? ((itemsWithChanges / totalItems) * 100).toFixed(1) : 0}% da base filtrada`],
    ["Total Acumulado de Modificações", totalChanges, "Soma de alterações de previsão registradas"],
    ["Datas de Alteração Exportadas", changeHistory.length, "Uma linha por alteração na aba Histórico de Alterações"],
  ];

  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
  summaryWs["!cols"] = [{ wch: 36 }, { wch: 22 }, { wch: 48 }];
  XLSX.utils.book_append_sheet(workbook, summaryWs, "Resumo Executivo");

  // 2. Aba de Base Operacional Detalhada
  const headerRows = [
    ["OPEN ORDER CONTROL — BASE OPERACIONAL DETALHADA DE PEDIDOS E PREVISÕES"],
    [`Gerado em: ${new Date().toLocaleString("pt-BR")} | Total de registros: ${totalItems}`],
    [],
    [
      "Filial solicitante",
      "Item",
      "Descrição do item",
      "Customer PO",
      "Prioridade de embarque",
      "Data de criação",
      "Quantidade",
      "Scheduled Reserved",
      "Preço unitário",
      "Valor estendido",
      "Previsão anterior",
      "Previsão atual",
      "Último upload",
      "Arquivo do último upload",
      "Total de alterações",
      "Data da última alteração",
      "Todas as datas de alteração",
      "Histórico das previsões",
      "Observações",
    ],
  ];

  const dataRows = items.map((row) => {
    const itemHistory = row.id ? historyMap.get(row.id) || [] : [];
    return [
    row.shipTo || "Sem filial informada",
    row.item || "",
    row.itemDescription || "",
    row.customerPo || "",
    row.shipmentPriority || "",
    formatDate(row.orderCreationDate),
    toNumber(row.quantity),
    toNumber(row.scheduledReserved),
    toNumber(row.unitSellingPrice),
    toNumber(row.extendedPrice),
    formatBrazilianPredictionDate(row.previousPrediction),
    formatBrazilianPredictionDate(row.currentPrediction),
    formatDate(row.lastUploadDate),
    row.lastUploadFileName || "",
    toNumber(row.predictionChangesCount),
    formatDate(row.lastPredictionChangeDate),
    formatChangeDates(itemHistory),
    formatChangeTimeline(itemHistory),
    row.longText || "",
    ];
  });

  const operationalWs = XLSX.utils.aoa_to_sheet([...headerRows, ...dataRows]);

  // Congelar painel abaixo do cabeçalho da tabela (linha 4) e habilitar filtro automático
  operationalWs["!freeze"] = { xSplit: 0, ySplit: 4 };
  operationalWs["!autofilter"] = { ref: `A4:S${4 + dataRows.length}` };

  operationalWs["!cols"] = [
    { wch: 28 }, // Filial
    { wch: 18 }, // Item
    { wch: 38 }, // Descrição
    { wch: 18 }, // PO
    { wch: 20 }, // Prioridade
    { wch: 16 }, // Data criação
    { wch: 14 }, // Qtde
    { wch: 18 }, // Reserved
    { wch: 16 }, // Preço unit
    { wch: 18 }, // Valor estendido
    { wch: 18 }, // Prev anterior
    { wch: 18 }, // Prev atual
    { wch: 16 }, // Último upload
    { wch: 32 }, // Arquivo
    { wch: 16 }, // Alterações
    { wch: 22 }, // Data alteração
    { wch: 28 }, // Todas as datas de alteração
    { wch: 68 }, // Histórico das previsões
    { wch: 48 }, // Observações
  ];

  XLSX.utils.book_append_sheet(workbook, operationalWs, "Base Operacional");

  // 3. Aba de Histórico de Alterações: uma linha para cada mudança efetiva de previsão.
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const historyHeaderRows = [
    ["OPEN ORDER CONTROL — HISTÓRICO COMPLETO DE ALTERAÇÕES DE PREVISÃO"],
    [`Gerado em: ${new Date().toLocaleString("pt-BR")} | Total de alterações: ${changeHistory.length}`],
    [],
    [
      "Filial solicitante",
      "Item",
      "Descrição do item",
      "Customer PO",
      "Sequência",
      "Data do upload",
      "Arquivo",
      "Previsão anterior",
      "Previsão alterada",
      "Data registrada",
      "Variação (dias)",
    ],
  ];
  const historyRows = changeHistory.map((record) => {
    const item = itemMap.get(record.orderItemId);
    return [
      item?.shipTo || "Sem filial informada",
      item?.item || record.item || "",
      item?.itemDescription || "",
      item?.customerPo || record.customerPo || "",
      historyMap.get(record.orderItemId)?.findIndex((entry) => entry.id === record.id) !== undefined
        ? (historyMap.get(record.orderItemId)?.findIndex((entry) => entry.id === record.id) ?? 0) + 1
        : "",
      formatDate(record.uploadDate),
      record.fileName || "",
      formatBrazilianPredictionDate(record.previousPrediction),
      formatBrazilianPredictionDate(record.prediction),
      formatDate(record.recordedAt),
      record.differenceDays ?? "",
    ];
  });
  const historyWs = XLSX.utils.aoa_to_sheet([...historyHeaderRows, ...historyRows]);
  historyWs["!freeze"] = { xSplit: 0, ySplit: 4 };
  historyWs["!autofilter"] = { ref: `A4:K${4 + historyRows.length}` };
  historyWs["!cols"] = [
    { wch: 28 }, { wch: 18 }, { wch: 38 }, { wch: 18 }, { wch: 12 },
    { wch: 16 }, { wch: 32 }, { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(workbook, historyWs, "Histórico de Alterações");

  return workbook;
}
