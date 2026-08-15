import * as XLSX from "xlsx";

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

export function generateProfessionalOperationalWorkbook(items: OperationalExportItem[], filterSummary?: { branch?: string; search?: string }) {
  const workbook = XLSX.utils.book_new();

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
      "Observações",
    ],
  ];

  const dataRows = items.map((row) => [
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
    row.previousPrediction || "",
    row.currentPrediction || "",
    formatDate(row.lastUploadDate),
    row.lastUploadFileName || "",
    toNumber(row.predictionChangesCount),
    formatDate(row.lastPredictionChangeDate),
    row.longText || "",
  ]);

  const operationalWs = XLSX.utils.aoa_to_sheet([...headerRows, ...dataRows]);

  // Congelar painel abaixo do cabeçalho da tabela (linha 4) e habilitar filtro automático
  operationalWs["!freeze"] = { xSplit: 0, ySplit: 4 };
  operationalWs["!autofilter"] = { ref: `A4:Q${4 + dataRows.length}` };

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
    { wch: 48 }, // Observações
  ];

  XLSX.utils.book_append_sheet(workbook, operationalWs, "Base Operacional");

  return workbook;
}
