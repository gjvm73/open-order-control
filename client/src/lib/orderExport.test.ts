import { describe, expect, it } from "vitest";
import { buildOperationalExportFileName, buildOperationalExportRows } from "./orderExport";

describe("operational Excel export", () => {
  it("maps the filtered operational items to complete spreadsheet rows", () => {
    const rows = buildOperationalExportRows([
      {
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
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      "Filial solicitante": "PORTO ALEGRE",
      "Item": "ITEM-001",
      "Descrição do item": "Componente de teste",
      "Customer PO": "PO-001",
      "Quantidade": 3,
      "Valor estendido": 376.5,
      "Previsão anterior": "2026-08-10",
      "Previsão atual": "2026-08-20",
      "Total de alterações": 2,
    });
    expect(rows[0]?.["Data de criação"]).toBe("01/08/2026");
    expect(rows[0]?.["Último upload"]).toBe("14/08/2026");
  });

  it("uses a deterministic date-based filename", () => {
    expect(buildOperationalExportFileName(new Date("2026-08-14T12:00:00.000Z"))).toBe("open-order-base-operacional-2026-08-14.xlsx");
  });
});
