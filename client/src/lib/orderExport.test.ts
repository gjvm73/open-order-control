import { describe, expect, it } from "vitest";
import { buildOperationalExportFileName, buildOperationalExportRows, filterOperationalItemsWithChanges, generateProfessionalOperationalWorkbook } from "./orderExport";

describe("operational Excel export", () => {
  it("selects only items with accumulated prediction changes", () => {
    const selected = filterOperationalItemsWithChanges([
      { id: 1, item: "ITEM-001", predictionChangesCount: 0 },
      { id: 2, item: "ITEM-002", predictionChangesCount: 2 },
      { id: 3, item: "ITEM-003", predictionChangesCount: "1" },
    ]);

    expect(selected.map((item) => item.item)).toEqual(["ITEM-002", "ITEM-003"]);
  });

  it("maps the filtered operational items to complete spreadsheet rows", () => {
    const rows = buildOperationalExportRows([
      {
        id: 1,
        shipTo: "PORTO ALEGRE",
        item: "ITEM-001",
        itemDescription: "Componente de teste",
        customerPo: "PO-001",
        shipmentPriority: "High",
        orderCreationDate: "2026-08-01T00:00:00.000Z",
        quantity: 3,
        scheduledReserved: 1,
        unitSellingPrice: 125.5,
        extendedPrice: 376.5,
        previousPrediction: "2026-08-10",
        currentPrediction: "2026-08-20",
        lastUploadDate: "2026-08-14T00:00:00.000Z",
        lastUploadFileName: "semana-32.xlsx",
        predictionChangesCount: 2,
        lastPredictionChangeDate: "2026-08-14T00:00:00.000Z",
        longText: "Acompanhar com logística",
      },
    ], [
      {
        id: 11,
        orderItemId: 1,
        uploadDate: "2026-08-08T00:00:00.000Z",
        recordedAt: "2026-08-08T00:00:00.000Z",
        prediction: "2026-08-10",
        previousPrediction: "2026-08-01",
        changed: true,
        differenceDays: 9,
      },
      {
        id: 12,
        orderItemId: 1,
        uploadDate: "2026-08-14T00:00:00.000Z",
        recordedAt: "2026-08-14T00:00:00.000Z",
        prediction: "2026-08-20",
        previousPrediction: "2026-08-10",
        changed: true,
        differenceDays: 10,
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      "Filial solicitante": "PORTO ALEGRE",
      "Item": "ITEM-001",
      "Descrição do item": "Componente de teste",
      "Customer PO": "PO-001",
      "Quantidade": 3,
      "Valor estendido": 376.5,
      "Previsão anterior": "10/08/2026",
      "Previsão atual": "20/08/2026",
      "Total de alterações": 2,
    });
    expect(rows[0]?.["Data de criação"]).toBe("01/08/2026");
    expect(rows[0]?.["Último upload"]).toBe("14/08/2026");
    expect(rows[0]?.["Previsão anterior"]).toBe("10/08/2026");
    expect(rows[0]?.["Previsão atual"]).toBe("20/08/2026");
    expect(rows[0]?.["Todas as datas de alteração"]).toBe("08/08/2026; 14/08/2026");
    expect(rows[0]?.["Histórico das previsões"]).toContain("08/08/2026: 01/08/2026 → 10/08/2026 (+9 dias)");
    expect(rows[0]?.["Histórico das previsões"]).toContain("14/08/2026: 10/08/2026 → 20/08/2026 (+10 dias)");
  });

  it("formats prediction dates in Brazilian format", async () => {
    const { formatBrazilianPredictionDate } = await import("./orderExport");
    expect(formatBrazilianPredictionDate("2026-08-20")).toBe("20/08/2026");
    expect(formatBrazilianPredictionDate("20/08/2026")).toBe("20/08/2026");
    expect(formatBrazilianPredictionDate("sem fornecedor")).toBe("sem fornecedor");
    expect(formatBrazilianPredictionDate(null)).toBe("");
  });

  it("uses a deterministic date-based filename", () => {
    expect(buildOperationalExportFileName(new Date("2026-08-14T12:00:00.000Z"))).toBe("open-order-base-operacional-2026-08-14.xlsx");
  });

  it("generates a professional workbook with executive summary and operational sheets", () => {
    const workbook = generateProfessionalOperationalWorkbook(
      [
        {
          shipTo: "PORTO ALEGRE",
          item: "ITEM-001",
          itemDescription: "Componente de teste",
          customerPo: "PO-001",
          quantity: 10,
          extendedPrice: 1000,
          id: 1,
          predictionChangesCount: 1,
        },
      ],
      { branch: "PORTO ALEGRE", search: "PO-001" },
      [
        {
          id: 11,
          orderItemId: 1,
          item: "ITEM-001",
          customerPo: "PO-001",
          uploadDate: "2026-08-14T00:00:00.000Z",
          recordedAt: "2026-08-14T00:00:00.000Z",
          fileName: "semana-32.xlsx",
          prediction: "2026-08-20",
          previousPrediction: "2026-08-10",
          changed: true,
          differenceDays: 10,
        },
      ]
    );

    expect(workbook.SheetNames).toEqual(["Resumo Executivo", "Base Operacional", "Histórico de Alterações"]);
    expect(workbook.Sheets["Resumo Executivo"]).toBeDefined();
    expect(workbook.Sheets["Base Operacional"]).toBeDefined();
    expect(workbook.Sheets["Histórico de Alterações"]).toBeDefined();
    expect(workbook.Sheets["Base Operacional"]["!freeze"]).toEqual({ xSplit: 0, ySplit: 4 });
    expect(workbook.Sheets["Base Operacional"]["!autofilter"]).toEqual({ ref: "A4:S5" });
    expect(workbook.Sheets["Base Operacional"]["Q5"].v).toBe("14/08/2026");
    expect(workbook.Sheets["Base Operacional"]["R5"].v).toContain("14/08/2026: 10/08/2026 → 20/08/2026");
    expect(workbook.Sheets["Histórico de Alterações"]["F5"].v).toBe("14/08/2026");
    expect(workbook.Sheets["Histórico de Alterações"]["I5"].v).toBe("20/08/2026");
  });
});
