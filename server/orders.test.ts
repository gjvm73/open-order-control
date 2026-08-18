import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import type { TrpcContext } from "./_core/context";
import * as XLSX from "xlsx";
import { normalizeShipTo } from "./shipTo";
import { readFileSync } from "node:fs";

describe("Open Orders Backend & Upload Logic", () => {
  it("allows fetching dashboard stats and item list", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    };
    const caller = appRouter.createCaller(ctx);

    const stats = await caller.orders.getStats();
    expect(stats).toHaveProperty("totalItems");
    expect(stats).toHaveProperty("changedLastUpload");
    expect(stats).toHaveProperty("stabilityRate");
    expect(stats).toHaveProperty("valueAtRisk");
    expect(stats).toHaveProperty("actionQueue");
    expect(stats).toHaveProperty("trend");
    expect(Array.isArray(stats.actionQueue)).toBe(true);
    expect(Array.isArray(stats.trend)).toBe(true);

    const items = await caller.orders.listItems();
    expect(Array.isArray(items)).toBe(true);
    const shipToOptions = await caller.orders.listShipTo();
    expect(Array.isArray(shipToOptions)).toBe(true);
    const branches = await caller.orders.getBranchSummary();
    expect(Array.isArray(branches)).toBe(true);
    const alertResponse = await caller.orders.getAlerts({ thresholdDays: 7 });
    expect(Array.isArray(alertResponse.alerts)).toBe(true);
    expect(alertResponse.summary).toBeDefined();

    const trend = await caller.orders.getAlertsTrend({ thresholdDays: 7 });
    expect(Array.isArray(trend)).toBe(true);
  });

  it("rejects resetImports without an authenticated admin", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.orders.resetImports()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.orders.uploadExcel({ fileName: "forbidden.xlsx", fileBase64: "AA==" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("permite ao administrador salvar e restaurar os pesos de priorização", async () => {
    const anonymousContext: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    };
    const anonymousCaller = appRouter.createCaller(anonymousContext);
    await expect(anonymousCaller.orders.updatePrioritizationSettings({
      predictionChangeWeight: 7,
      noSupplierWeight: 6,
      overdueWeight: 5,
      highPriorityWeight: 4,
      financialImpactWeight: 3,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });

    const adminContext: TrpcContext = {
      user: {
        id: 1,
        openId: "admin-prioritization-settings",
        name: "Admin User",
        email: "admin-settings@test.com",
        loginMethod: "manus",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    };
    const adminCaller = appRouter.createCaller(adminContext);

    try {
      const saved = await adminCaller.orders.updatePrioritizationSettings({
        predictionChangeWeight: 7,
        noSupplierWeight: 6,
        overdueWeight: 5,
        highPriorityWeight: 4,
        financialImpactWeight: 3,
      });
      expect(saved).toMatchObject({
        predictionChangeWeight: 7,
        noSupplierWeight: 6,
        overdueWeight: 5,
        highPriorityWeight: 4,
        financialImpactWeight: 3,
      });

      const readBack = await anonymousCaller.orders.getPrioritizationSettings();
      expect(readBack).toMatchObject({
        predictionChangeWeight: 7,
        noSupplierWeight: 6,
        overdueWeight: 5,
        highPriorityWeight: 4,
        financialImpactWeight: 3,
      });
    } finally {
      const restored = await adminCaller.orders.resetPrioritizationSettings();
      expect(restored).toMatchObject(db.DEFAULT_PRIORITIZATION_WEIGHTS);
    }
  });

  it("allows admin reset, executes real DB cleanup, and validates resulting empty dashboard and tables", async () => {
    const ctx: TrpcContext = {
      user: {
        id: 1,
        openId: "admin-real-reset",
        name: "Admin User",
        email: "admin-reset@test.com",
        loginMethod: "manus",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    };

    const caller = appRouter.createCaller(ctx);
    const resetResult = await caller.orders.resetImports();
    expect(resetResult).toHaveProperty("deletedHistory");
    expect(resetResult).toHaveProperty("deletedItems");
    expect(resetResult).toHaveProperty("deletedUploads");

    const itemsAfterReset = await caller.orders.listItems();
    expect(itemsAfterReset).toEqual([]);

    const uploadsAfterReset = await caller.orders.listUploads();
    expect(uploadsAfterReset).toEqual([]);

    const shipToAfterReset = await caller.orders.listShipTo();
    expect(shipToAfterReset).toEqual([]);

    const branchSummaryAfterReset = await caller.orders.getBranchSummary();
    expect(branchSummaryAfterReset).toEqual([]);

    const statsAfterReset = await caller.orders.getStats();
    expect(statsAfterReset.totalItems).toBe(0);
    expect(statsAfterReset.changedItems).toBe(0);
    expect(statsAfterReset.totalOrderValue).toBe(0);
    expect(statsAfterReset.valueAtRisk).toBe(0);
    expect(statsAfterReset.latestStabilityRate).toBeNull();
  });

  it("returns upload diagnostics with rejection reasons", async () => {
    const ctx: TrpcContext = {
      user: {
        id: 1,
        openId: `test-admin-upload-diagnostics-${Date.now()}`,
        name: "Test Admin",
        email: `admin-upload-diagnostics-${Date.now()}@test.com`,
        loginMethod: "manus",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    };
    const caller = appRouter.createCaller(ctx);
    await caller.orders.resetImports();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Item", "Previsão", "Ship To", "Customer PO"],
      ["ITEM-DIAGNOSTICO-VALIDO", "2026-09-01", "PORTO ALEGRE", "PO-DIAGNOSTICO-1"],
      ["", "2026-09-02", "PORTO ALEGRE", "PO-DIAGNOSTICO-2"],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Open Orders");
    const fileBase64 = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }).toString("base64");

    const result = await caller.orders.uploadExcel({
      fileName: "diagnostico-upload.xlsx",
      fileBase64,
    });

    expect(result.totalRows).toBe(2);
    expect(result.acceptedRows).toBe(1);
    expect(result.consolidatedRows).toBe(0);
    expect(result.rejectedRows).toBe(1);
    expect(result.duplicateRows).toBe(0);
    expect(result.rejectionReasons).toEqual([{ reason: "Linha sem código de Item", count: 1 }]);
    const uploads = await caller.orders.listUploads();
    const latestUpload = uploads.find((upload) => upload.id === result.uploadId);
    expect(latestUpload?.rejectedRows).toBe(1);
    expect(latestUpload?.rejectionReasons).toBe('[{"reason":"Linha sem código de Item","count":1}]');
  });

  it("processes Excel buffer and tracks prediction history correctly", async () => {
    const itemCode = `ITEM-TEST-${Date.now()}`;
    const itemWithoutPrediction = `ITEM-SEM-PREVISAO-${Date.now()}`;
    const customerPo = `PO-${Date.now()}`;

    // Criar uma planilha Excel em memória para teste
    const wsData = [
      {
        "Endereco (ship To)": "TESTE RS",
        "Customer PO": customerPo,
        "Shipment Priority": "High",
        "Data Criacao da Ordem": new Date("2025-01-01T00:00:00.000Z"),
        "Item": itemCode,
        "Descricao do Item": "PEÇA DE TESTE",
        "Quantidade": 10,
        "Scheduled Reserved": 0,
        "Unit Selling Price": 100,
        "Extended Price": 1000,
        "Previsão": "2025-06-01",
        "Long Text": "Teste inicial"
      },
      {
        "Endereco (ship To)": "TESTE RS",
        "Customer PO": customerPo,
        "Shipment Priority": "Normal",
        "Data Criacao da Ordem": new Date("2025-01-01T00:00:00.000Z"),
        "Item": itemWithoutPrediction,
        "Descricao do Item": "PEÇA SEM DATA DE PREVISÃO",
        "Quantidade": 1,
        "Scheduled Reserved": 0,
        "Unit Selling Price": 10,
        "Extended Price": 10,
        "Previsão": "A definir",
        "Long Text": "Previsão não informada"
      }
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "OpenOrders");
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const base64 = buffer.toString('base64');

    const ctx: TrpcContext = {
      user: {
        id: 1,
        openId: "test-admin",
        name: "Test Admin",
        email: "admin@test.com",
        loginMethod: "manus",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    };

    const caller = appRouter.createCaller(ctx);

    // Primeiro upload
    const res1 = await caller.orders.uploadExcel({
      fileName: "Relatorio_Semana_1.xlsx",
      fileBase64: base64,
    });

    expect(res1.success).toBe(true);
    expect(res1.totalRows).toBe(2);

    // Verificar listagem
    const items = await caller.orders.listItems({ customerPo, shipTo: "TESTE RS" });
    expect(items.length).toBeGreaterThan(0);
    const targetItem = items.find(i => i.item === itemCode && i.customerPo === customerPo);
    expect(targetItem).toBeDefined();
    expect(targetItem?.currentPrediction).toBe("2025-06-01");
    expect(targetItem?.predictionChangesCount).toBe(0);
    const itemWithoutPredictionResult = items.find(i => i.item === itemWithoutPrediction && i.customerPo === customerPo);
    expect(itemWithoutPredictionResult?.currentPrediction).toBe("Sem previsão");

    try {
      await caller.orders.updatePrioritizationSettings({
        predictionChangeWeight: 0,
        noSupplierWeight: 0,
        overdueWeight: 0,
        highPriorityWeight: 0,
        financialImpactWeight: 10,
      });
      const financialStats = await caller.orders.getStats({ shipTo: "TESTE RS" });
      const highValueItem = financialStats.actionQueue.find((entry) => entry.item === itemCode && entry.customerPo === customerPo);
      const lowValueItem = financialStats.actionQueue.find((entry) => entry.item === itemWithoutPrediction && entry.customerPo === customerPo);
      expect(highValueItem).toMatchObject({ financialImpactScore: 10, riskScore: 10 });
      expect(lowValueItem).toMatchObject({ financialImpactScore: 1, riskScore: 1 });
      expect(financialStats.actionQueue[0]?.item).toBe(itemCode);
    } finally {
      await caller.orders.resetPrioritizationSettings();
    }

    // Segundo upload com mudança na Previsão
    const wsData2 = [
      {
        "Endereco (ship To)": "TESTE RS",
        "Customer PO": customerPo,
        "Shipment Priority": "High",
        "Data Criacao da Ordem": new Date("2025-01-01T00:00:00.000Z"),
        "Item": itemCode,
        "Descricao do Item": "PEÇA DE TESTE",
        "Quantidade": 10,
        "Scheduled Reserved": 0,
        "Unit Selling Price": 100,
        "Extended Price": 1000,
        "Previsão": "2025-07-15", // Mudança de previsão!
        "Long Text": "Teste alterado"
      }
    ];

    const wb2 = XLSX.utils.book_new();
    const ws2 = XLSX.utils.json_to_sheet(wsData2);
    XLSX.utils.book_append_sheet(wb2, ws2, "OpenOrders");
    const buffer2 = XLSX.write(wb2, { type: 'buffer', bookType: 'xlsx' });
    const base642 = buffer2.toString('base64');

    const res2 = await caller.orders.uploadExcel({
      fileName: "Relatorio_Semana_2.xlsx",
      fileBase64: base642,
    });

    expect(res2.success).toBe(true);
    expect(res2.changedRowsCount).toBe(1);

    // Verificar se o contador de alterações foi incrementado
    const updatedItems = await caller.orders.listItems({ item: itemCode, customerPo });
    const updatedItem = updatedItems.find(i => i.item === itemCode && i.customerPo === customerPo);
    expect(updatedItem?.currentPrediction).toBe("2025-07-15");
    expect(updatedItem?.previousPrediction).toBe("2025-06-01");
    expect(updatedItem?.predictionChangesCount).toBe(1);

    // Verificar detalhe e histórico
    const detail = await caller.orders.getItemDetail({ id: updatedItem!.id });
    expect(detail.history.length).toBe(2); // Histórico dos 2 uploads
    expect(detail.history[1]).toMatchObject({
      previousPrediction: "2025-06-01",
      prediction: "2025-07-15",
      changed: true,
    });

    // Terceiro upload: a comparação deve usar a segunda previsão, não apenas a primeira.
    const wsData3 = [{
      "Endereco (ship To)": "TESTE RS",
      "Customer PO": customerPo,
      "Shipment Priority": "High",
      "Data Criacao da Ordem": "2025-01-01",
      "Item": itemCode,
      "Descricao do Item": "PEÇA DE TESTE",
      "Quantidade": 10,
      "Scheduled Reserved": 0,
      "Unit Selling Price": 100,
      "Extended Price": 1000,
      "Previsão": "2025-08-20",
      "Long Text": "Terceira previsão",
    }];
    const wb3 = XLSX.utils.book_new();
    const ws3 = XLSX.utils.json_to_sheet(wsData3);
    XLSX.utils.book_append_sheet(wb3, ws3, "OpenOrders");
    const base643 = XLSX.write(wb3, { type: "buffer", bookType: "xlsx" }).toString("base64");
    const res3 = await caller.orders.uploadExcel({ fileName: "Relatorio_Semana_3.xlsx", fileBase64: base643 });
    expect(res3.changedRowsCount).toBe(1);

    const thirdItems = await caller.orders.listItems({ item: itemCode, customerPo, shipTo: "TESTE RS" });
    const thirdItem = thirdItems.find(i => i.item === itemCode && i.customerPo === customerPo);
    expect(thirdItem).toMatchObject({
      currentPrediction: "2025-08-20",
      previousPrediction: "2025-07-15",
      predictionChangesCount: 2,
    });
    const thirdDetail = await caller.orders.getItemDetail({ id: thirdItem!.id });
    expect(thirdDetail.history).toHaveLength(3);
    expect(thirdDetail.history[2]).toMatchObject({
      previousPrediction: "2025-07-15",
      prediction: "2025-08-20",
      changed: true,
    });

    const branches = await caller.orders.getBranchSummary();
    const branch = branches.find((entry) => entry.shipTo === "TESTE RS");
    expect(branch).toMatchObject({
      totalItems: expect.any(Number),
      changedItems: expect.any(Number),
      changeRate: expect.any(Number),
      valueAtRisk: expect.any(Number),
    });
    expect(branch?.totalItems).toBeGreaterThanOrEqual(1);
    expect(branch?.changedItems).toBeGreaterThanOrEqual(1);
    expect(branch?.valueAtRisk).toBeGreaterThanOrEqual(1000);
    expect(branch?.overdueItems).toBeGreaterThanOrEqual(1);

    const filteredStats = await caller.orders.getStats({ shipTo: "TESTE RS" });
    expect(filteredStats.totalItems).toBeGreaterThanOrEqual(1);
    expect(filteredStats.changedItems).toBeGreaterThanOrEqual(1);
    expect(filteredStats.changedLastUpload).toBeGreaterThanOrEqual(1);
    expect(filteredStats.latestChangeRate).toBe(100);
    expect(filteredStats.latestStabilityRate).toBe(0);
    expect(filteredStats.stabilityRate).toBe(0);
    expect(filteredStats.riskRate).toBe(100);

    try {
      await caller.orders.updatePrioritizationSettings({
        predictionChangeWeight: 7,
        noSupplierWeight: 0,
        overdueWeight: 0,
        highPriorityWeight: 0,
        financialImpactWeight: 0,
      });
      const weightedStats = await caller.orders.getStats({ shipTo: "TESTE RS" });
      const weightedItem = weightedStats.actionQueue.find((entry) => entry.item === itemCode && entry.customerPo === customerPo);
      expect(weightedItem?.riskScore).toBe(14);
    } finally {
      await caller.orders.resetPrioritizationSettings();
    }

    const alertResponse = await caller.orders.getAlerts({ thresholdDays: 30, shipTo: "TESTE RS" });
    const targetAlert = alertResponse.alerts.find((alert) => alert.item === itemCode && alert.customerPo === customerPo);
    expect(targetAlert).toMatchObject({
      shipTo: "TESTE RS",
      previousPrediction: "2025-07-15",
      currentPrediction: "2025-08-20",
      differenceDays: 36,
      absoluteDifferenceDays: 36,
      direction: "ADIAMENTO",
    });
    expect(targetAlert?.severity).toBe("ATENÇÃO");

    const alertResponse40 = await caller.orders.getAlerts({ thresholdDays: 40, shipTo: "TESTE RS" });
    expect(alertResponse40.alerts.some((alert) => alert.item === itemCode && alert.customerPo === customerPo)).toBe(false);

    const wsData4 = [{
      "Endereco (ship To)": "TESTE RS",
      "Customer PO": customerPo,
      "Shipment Priority": "High",
      "Data Criacao da Ordem": "2025-01-01",
      "Item": itemCode,
      "Descricao do Item": "PEÇA DE TESTE",
      "Quantidade": 10,
      "Scheduled Reserved": 0,
      "Unit Selling Price": 100,
      "Extended Price": 1000,
      "Previsão": "2025-08-01",
      "Long Text": "Prazo antecipado",
    }];
    const wb4 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb4, XLSX.utils.json_to_sheet(wsData4), "OpenOrders");
    const base644 = XLSX.write(wb4, { type: "buffer", bookType: "xlsx" }).toString("base64");
    const res4 = await caller.orders.uploadExcel({ fileName: "Relatorio_Semana_4.xlsx", fileBase64: base644 });
    expect(res4.changedRowsCount).toBe(1);

    try {
      await caller.orders.updatePrioritizationSettings({
        predictionChangeWeight: 8,
        noSupplierWeight: 0,
        overdueWeight: 0,
        highPriorityWeight: 0,
        financialImpactWeight: 0,
      });
      const directionalStats = await caller.orders.getStats({ shipTo: "TESTE RS" });
      const directionalItem = directionalStats.actionQueue.find((entry) => entry.item === itemCode && entry.customerPo === customerPo);
      expect(directionalItem).toMatchObject({
        postponementsCount: 2,
        anticipationsCount: 1,
        predictionChangeScore: 18,
        riskScore: 18,
      });
    } finally {
      await caller.orders.resetPrioritizationSettings();
    }
  });

  it("separa fornecedor, obsolescência e prazo em categorias mutuamente exclusivas", async () => {
    const suffix = Date.now();
    const shipTo = `CLASSIFICACAO RS ${suffix}`;
    const rows = [
      ["SEM-FORN", "Sem fornecedor", "SEM FORNECEDOR"],
      ["OBSOLETO", "Item obsoleto", "OBSOLETO"],
      ["SEM-PRAZO", "Item aguardando prazo", "Aguardando prazo"],
      ["COM-PRAZO", "Item com previsão confirmada", "2030-12-31"],
    ].map(([item, itemDescription, prediction], index) => ({
      "Endereco (ship To)": shipTo,
      "Customer PO": `PO-CLASS-${suffix}-${index}`,
      "Shipment Priority": "Normal",
      "Data Criacao da Ordem": "2025-01-01",
      "Item": item,
      "Descricao do Item": itemDescription,
      "Quantidade": 1,
      "Scheduled Reserved": 0,
      "Unit Selling Price": 100,
      "Extended Price": 100,
      "Previsão": prediction,
      "Long Text": "Teste de classificação",
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "OpenOrders");
    const fileBase64 = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }).toString("base64");
    const caller = appRouter.createCaller({
      user: {
        id: 1,
        openId: `admin-classification-${suffix}`,
        name: "Admin User",
        email: "admin-classification@test.com",
        loginMethod: "manus",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    });

    const result = await caller.orders.uploadExcel({ fileName: "classificacao.xlsx", fileBase64 });
    expect(result.totalRows).toBe(4);

    const stats = await caller.orders.getStats({ shipTo });
    expect(stats).toMatchObject({
      totalItems: 4,
      noSupplier: 1,
      obsoleteItems: 1,
      noDeadlineItems: 1,
      withDeadlineItems: 1,
    });
    expect(stats.noSupplier + stats.obsoleteItems + stats.noDeadlineItems + stats.withDeadlineItems).toBe(stats.totalItems);

    const items = await caller.orders.listItems({ shipTo });
    expect(items.find((entry) => entry.item === "SEM-FORN")?.currentPrediction).toBe("Sem fornecedor");
    expect(items.find((entry) => entry.item === "OBSOLETO")?.currentPrediction).toBe("Obsoleto");
    expect(items.find((entry) => entry.item === "SEM-PRAZO")?.currentPrediction).toBe("Aguardando prazo");
    expect(items.find((entry) => entry.item === "COM-PRAZO")?.currentPrediction).toBe("2030-12-31");
  });

  it("preserves all rows when two lines share the base business key", async () => {
    const suffix = Date.now();
    const shipTo = `TEST DUP RS ${suffix}`;
    const rows = Array.from({ length: 47 }, (_, index) => ({
      "Endereco (ship To)": shipTo,
      "Customer PO": `PO-${suffix}-${index}`,
      "Shipment Priority": "Standard",
      "Data Criacao da Ordem": new Date("2025-01-01T00:00:00.000Z"),
      "Item": `ITEM-DUP-${suffix}-${index}`,
      "Descricao do Item": `ITEM ${index}`,
      "Quantidade": 1,
      "Scheduled Reserved": 0,
      "Unit Selling Price": 10,
      "Extended Price": 10,
      "Previsão": "2026-06-01",
      "Long Text": "",
    }));
    rows.push(
      {
        "Endereco (ship To)": shipTo,
        "Customer PO": `PO-DUP-${suffix}`,
        "Shipment Priority": "High",
        "Data Criacao da Ordem": new Date("2025-02-28T00:00:00.000Z"),
        "Item": `ITEM-DUPLICATE-${suffix}`,
        "Descricao do Item": "PORCA TRAVA",
        "Quantidade": 1,
        "Scheduled Reserved": 0,
        "Unit Selling Price": 30.04,
        "Extended Price": 30.04,
        "Previsão": "2026-05-26",
        "Long Text": "",
      },
      {
        "Endereco (ship To)": shipTo,
        "Customer PO": `PO-DUP-${suffix}`,
        "Shipment Priority": "High",
        "Data Criacao da Ordem": new Date("2025-04-09T00:00:00.000Z"),
        "Item": `ITEM-DUPLICATE-${suffix}`,
        "Descricao do Item": "PORCA TRAVA",
        "Quantidade": 1,
        "Scheduled Reserved": 0,
        "Unit Selling Price": 30.04,
        "Extended Price": 30.04,
        "Previsão": "2026-05-26",
        "Long Text": "",
      },
    );

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "OpenOrders");
    const base64 = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }).toString("base64");
    const ctx: TrpcContext = {
      user: {
        id: 1,
        openId: `test-admin-duplicates-${suffix}`,
        name: "Test Admin",
        email: `admin-duplicates-${suffix}@test.com`,
        loginMethod: "manus",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    };

    const result = await appRouter.createCaller(ctx).orders.uploadExcel({
      fileName: `duplicated-rows-${suffix}.xlsx`,
      fileBase64: base64,
    });
    expect(result.success).toBe(true);
    expect(result.totalRows).toBe(49);

    const items = await appRouter.createCaller(ctx).orders.listItems({ shipTo });
    expect(items).toHaveLength(49);
    expect(items.filter((item) => item.item === `ITEM-DUPLICATE-${suffix}`)).toHaveLength(2);

    const reorderedRows = [...rows].reverse().map((row) =>
      row["Data Criacao da Ordem"] instanceof Date &&
        row["Item"] === `ITEM-DUPLICATE-${suffix}` &&
        row["Data Criacao da Ordem"].toISOString().startsWith("2025-04-09")
        ? { ...row, "Previsão": "2026-06-30" }
        : row,
    );
    const reorderedWorkbook = XLSX.utils.book_new();
    const reorderedSheet = XLSX.utils.json_to_sheet(reorderedRows);
    XLSX.utils.book_append_sheet(reorderedWorkbook, reorderedSheet, "OpenOrders");
    const reorderedBase64 = XLSX.write(reorderedWorkbook, { type: "buffer", bookType: "xlsx" }).toString("base64");
    const secondResult = await appRouter.createCaller(ctx).orders.uploadExcel({
      fileName: `duplicated-rows-reordered-${suffix}.xlsx`,
      fileBase64: reorderedBase64,
    });
    expect(secondResult.success).toBe(true);
    expect(secondResult.totalRows).toBe(49);
    expect(secondResult.changedRowsCount).toBe(1);

    const itemsAfterReorder = await appRouter.createCaller(ctx).orders.listItems({ shipTo });
    expect(itemsAfterReorder).toHaveLength(49);
    const duplicatedItems = itemsAfterReorder
      .filter((item) => item.item === `ITEM-DUPLICATE-${suffix}`)
      .sort((left, right) => String(left.orderCreationDate).localeCompare(String(right.orderCreationDate)));
    expect(duplicatedItems).toHaveLength(2);
    expect(duplicatedItems[0].currentPrediction).toBe("2026-05-26");
    expect(duplicatedItems[1].currentPrediction).toBe("2026-06-30");
    expect(duplicatedItems[1].predictionChangesCount).toBe(1);
    const changedDetail = await appRouter.createCaller(ctx).orders.getItemDetail({ id: duplicatedItems[1].id });
    expect(changedDetail.history).toHaveLength(2);
    expect(changedDetail.history[1].prediction).toBe("2026-06-30");
  });

  it("imports the real 01.xlsx fixture with all 49 active items", async () => {
    const ctx: TrpcContext = {
      user: {
        id: 1,
        openId: `test-admin-real-fixture-${Date.now()}`,
        name: "Test Admin",
        email: `admin-real-fixture-${Date.now()}@test.com`,
        loginMethod: "manus",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    };
    const caller = appRouter.createCaller(ctx);
    await caller.orders.resetImports();
    const fileBase64 = readFileSync("/home/ubuntu/open-order-control/server/fixtures/01.xlsx").toString("base64");
    const result = await caller.orders.uploadExcel({
      fileName: "01.xlsx",
      fileBase64,
    });
    expect(result.success).toBe(true);
    expect(result.totalRows).toBe(49);
    expect(result.acceptedRows).toBe(49);
    expect(result.consolidatedRows).toBe(0);
    expect(result.rejectedRows).toBe(0);
    expect(result.duplicateRows).toBe(1);
    expect(result.rejectionReasons).toEqual([]);
    const uploads = await caller.orders.listUploads();
    const latestUpload = uploads.find((upload) => upload.id === result.uploadId);
    expect(latestUpload?.acceptedRows).toBe(49);
    expect(latestUpload?.duplicateRows).toBe(1);
    expect(latestUpload?.rejectedRows).toBe(0);
    const items = await caller.orders.listItems();
    expect(items).toHaveLength(49);
    const stats = await caller.orders.getStats();
    expect(stats.totalItems).toBe(49);
    const branchSummary = await caller.orders.getBranchSummary();
    expect(branchSummary.reduce((sum, branch) => sum + branch.totalItems, 0)).toBe(49);
  });

  it("handles shifted headers and tracks history across multiple weekly uploads correctly", async () => {
    const ctx: TrpcContext = {
      user: {
        id: 1,
        openId: "test-admin-shifted",
        name: "Test Admin",
        email: "admin@test.com",
        loginMethod: "manus",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    };
    const caller = appRouter.createCaller(ctx);

    const itemCode = `ITEM-SHIFT-${Date.now()}`;
    const customerPo = `PO-SHIFT-${Date.now()}`;

    // Planilha 1 com linhas vazias antes do cabeçalho real
    const sheetData1 = [
      ["Relatório Semanal de Open Orders", "", ""],
      ["", "", ""],
      ["Filial", "Customer PO", "Item", "Previsão de Entrega"],
      ["FILIAL SP", customerPo, itemCode, "2025-10-01"],
    ];

    const wb1 = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet(sheetData1);
    XLSX.utils.book_append_sheet(wb1, ws1, "Sheet1");
    const buf1 = XLSX.write(wb1, { type: "buffer", bookType: "xlsx" });

    const res1 = await caller.orders.uploadExcel({ fileName: "Semana1.xlsx", fileBase64: buf1.toString("base64") });
    expect(res1.success).toBe(true);
    expect(res1.totalRows).toBe(1);

    const items1 = await caller.orders.listItems({ item: itemCode });
    expect(items1).toHaveLength(1);
    expect(items1[0].currentPrediction).toBe("2025-10-01");
    expect(items1[0].predictionChangesCount).toBe(0);

    // Planilha 2 com nova data de previsão
    const sheetData2 = [
      ["Relatório Semanal de Open Orders Semana 2", "", ""],
      ["", "", ""],
      ["Filial", "Customer PO", "Item", "Previsão de Entrega"],
      ["FILIAL SP", customerPo, itemCode, "2025-10-25"], // Mudou 24 dias
    ];

    const wb2 = XLSX.utils.book_new();
    const ws2 = XLSX.utils.aoa_to_sheet(sheetData2);
    XLSX.utils.book_append_sheet(wb2, ws2, "Sheet1");
    const buf2 = XLSX.write(wb2, { type: "buffer", bookType: "xlsx" });

    const res2 = await caller.orders.uploadExcel({ fileName: "Semana2.xlsx", fileBase64: buf2.toString("base64") });
    expect(res2.success).toBe(true);
    expect(res2.changedRowsCount).toBe(1);

    const items2 = await caller.orders.listItems({ item: itemCode });
    expect(items2).toHaveLength(1);
    expect(items2[0].currentPrediction).toBe("2025-10-25");
    expect(items2[0].previousPrediction).toBe("2025-10-01");
    expect(items2[0].predictionChangesCount).toBe(1);

    const detail = await caller.orders.getItemDetail({ id: items2[0].id });
    expect(detail.history).toHaveLength(2);
    expect(detail.history[1].prediction).toBe("2025-10-25");
    expect(detail.history[1].previousPrediction).toBe("2025-10-01");

    const invalidWorkbook = XLSX.utils.book_new();
    const invalidSheet = XLSX.utils.aoa_to_sheet([["Arquivo sem tabela reconhecível"], ["texto"]]);
    XLSX.utils.book_append_sheet(invalidWorkbook, invalidSheet, "Sheet1");
    const invalidBuffer = XLSX.write(invalidWorkbook, { type: "buffer", bookType: "xlsx" });
    await expect(caller.orders.uploadExcel({
      fileName: "SemTabela.xlsx",
      fileBase64: invalidBuffer.toString("base64"),
    })).rejects.toThrow("Não foi possível localizar uma tabela válida");
  });

  it("returns a complete changes report filtered by branch and change period", async () => {
    await db.resetImportedData();
    const suffix = Date.now();
    const ctx: TrpcContext = {
      user: {
        id: 1,
        openId: `report-complete-admin-${suffix}`,
        name: "Admin User",
        email: `report-complete-${suffix}@test.com`,
        loginMethod: "local",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    };
    const caller = appRouter.createCaller(ctx);
    const toBase64 = (rows: Record<string, unknown>[]) => {
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "OpenOrders");
      return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }).toString("base64");
    };
    const portoItem = `ITEM-REPORT-POA-${suffix}`;
    const colomboItem = `ITEM-REPORT-CWB-${suffix}`;
    const baseRows = [
      {
        "Endereco (ship To)": "AVENIDA ASSIS BRASIL RS BR",
        "Customer PO": `PO-REPORT-POA-${suffix}`,
        "Shipment Priority": "High",
        "Data Criacao da Ordem": "2025-01-10",
        "Item": portoItem,
        "Descricao do Item": "Item com alteração em Porto Alegre",
        "Quantidade": 4,
        "Scheduled Reserved": 1,
        "Unit Selling Price": 25,
        "Extended Price": 100,
        "Previsão": "2026-06-10",
        "Long Text": "Rastreabilidade completa",
      },
      {
        "Endereco (ship To)": "RUA ABEL SCUISSIATO PR BR",
        "Customer PO": `PO-REPORT-CWB-${suffix}`,
        "Shipment Priority": "Normal",
        "Data Criacao da Ordem": "2025-01-11",
        "Item": colomboItem,
        "Descricao do Item": "Item com alteração em Colombo",
        "Quantidade": 2,
        "Scheduled Reserved": 0,
        "Unit Selling Price": 30,
        "Extended Price": 60,
        "Previsão": "2026-06-12",
        "Long Text": "Outro item alterado",
      },
    ];
    await caller.orders.uploadExcel({ fileName: "report-week-1.xlsx", fileBase64: toBase64(baseRows) });
    await caller.orders.uploadExcel({
      fileName: "report-week-2.xlsx",
      fileBase64: toBase64([
        { ...baseRows[0], "Previsão": "2026-06-25" },
        { ...baseRows[1], "Previsão": "2026-06-05" },
      ]),
    });

    const today = new Date().toISOString().slice(0, 10);
    const portoReport = await caller.orders.getCompleteChangesReport({
      shipTo: "PORTO ALEGRE",
      startDate: today,
      endDate: today,
    });
    expect(portoReport).toHaveLength(1);
    expect(portoReport[0]).toMatchObject({
      item: portoItem,
      shipTo: "PORTO ALEGRE",
      previousPrediction: "2026-06-10",
      currentPredictionAtChange: "2026-06-25",
      differenceDays: 15,
      direction: "ADIAMENTO",
      quantity: "4.00",
      extendedPrice: "100.0000",
    });

    const fullReport = await caller.orders.getCompleteChangesReport({ startDate: today, endDate: today });
    expect(fullReport).toHaveLength(2);
    expect(fullReport.map((entry) => entry.shipTo)).toEqual(expect.arrayContaining(["PORTO ALEGRE", "COLOMBO"]));
    await expect(caller.orders.getCompleteChangesReport({ startDate: "2026-12-31", endDate: "2026-01-01" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});


  it("normalizes Ship To filters when imported values contain surrounding spaces", async () => {
    await db.resetImportedData();

    const ctx: TrpcContext = {
      user: {
        id: 1,
        openId: "shipto-trim-admin",
        name: "Test Admin",
        email: "admin@test.com",
        loginMethod: "local",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    };
    const caller = appRouter.createCaller(ctx);
    const itemCode = `ITEM-SHIPTO-TRIM-${Date.now()}`;
    const customerPo = `PO-SHIPTO-TRIM-${Date.now()}`;
    const wsData = [{
      "Endereco (ship To)": "  FILIAL ESPAÇADA  ",
      "Customer PO": customerPo,
      "Shipment Priority": "High",
      "Data Criacao da Ordem": new Date("2025-01-01T00:00:00.000Z"),
      "Item": itemCode,
      "Descricao do Item": "Teste de filial com espaços",
      "Quantidade": 1,
      "Scheduled Reserved": 0,
      "Unit Selling Price": 10,
      "Extended Price": 10,
      "Previsão": "2025-06-01",
      "Long Text": "Teste de normalização",
    }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(wsData), "OpenOrders");
    const fileBase64 = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }).toString("base64");

    await caller.orders.uploadExcel({ fileName: "shipto-trim.xlsx", fileBase64 });

    const filteredItems = await caller.orders.listItems({ shipTo: "FILIAL ESPAÇADA" });
    expect(filteredItems.some((item) => item.item === itemCode)).toBe(true);

    const filteredStats = await caller.orders.getStats({ shipTo: "FILIAL ESPAÇADA" });
    expect(filteredStats.totalItems).toBe(1);

    const filteredAlerts = await caller.orders.getAlerts({ thresholdDays: 7, shipTo: "FILIAL ESPAÇADA" });
    expect(filteredAlerts.alerts).toEqual([]);
  });

  it("normalizes specified addresses to corresponding cities", () => {
    expect(normalizeShipTo("AVENIDA ASSIS BRASIL RS BR")).toBe("PORTO ALEGRE");
    expect(normalizeShipTo("  RUA ABEL SCUISSIATO PR BR  ")).toBe("COLOMBO");
    expect(normalizeShipTo("R VIDAL PROCOPIO LOHN SC BR")).toBe("SÃO JOSÉ");
    expect(normalizeShipTo("AV PREFEITO SINCLER SAMBATTI PR BR")).toBe("MARINGÁ");
    expect(normalizeShipTo("RUA VALDEMIRO BELINSKI PARALELA A BR 282 SC BR")).toBe("CHAPECÓ");
    expect(normalizeShipTo("OUTRA FILIAL SP BR")).toBe("OUTRA FILIAL SP BR");
  });

  it("restores the full dataset after clearing a branch filter", async () => {
    await db.resetImportedData();
    const ctx: TrpcContext = {
      user: {
        id: 1,
        openId: "clear-filter-admin",
        name: "Test Admin",
        email: "admin@test.com",
        loginMethod: "local",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    };
    const caller = appRouter.createCaller(ctx);
    const suffix = Date.now();
    const wsData = [
      {
        "Endereco (ship To)": "AVENIDA ASSIS BRASIL RS BR",
        "Customer PO": `PO-CLEAR-PA-${suffix}`,
        "Item": `ITEM-CLEAR-PA-${suffix}`,
        "Descricao do Item": "Item Porto Alegre",
        "Quantidade": 1,
        "Unit Selling Price": 10,
        "Extended Price": 10,
        "Previsão": "2025-09-01",
      },
      {
        "Endereco (ship To)": "RUA ABEL SCUISSIATO PR BR",
        "Customer PO": `PO-CLEAR-CO-${suffix}`,
        "Item": `ITEM-CLEAR-CO-${suffix}`,
        "Descricao do Item": "Item Colombo",
        "Quantidade": 1,
        "Unit Selling Price": 20,
        "Extended Price": 20,
        "Previsão": "2025-09-10",
      },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(wsData), "OpenOrders");
    const fileBase64 = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }).toString("base64");
    await caller.orders.uploadExcel({ fileName: "clear-filter-test.xlsx", fileBase64 });

    const filteredItems = await caller.orders.listItems({ shipTo: "PORTO ALEGRE" });
    expect(filteredItems).toHaveLength(1);
    expect(filteredItems[0].shipTo).toBe("PORTO ALEGRE");

    const allItemsAfterClear = await caller.orders.listItems({ shipTo: undefined });
    expect(allItemsAfterClear).toHaveLength(2);
    expect(new Set(allItemsAfterClear.map(item => item.shipTo))).toEqual(new Set(["PORTO ALEGRE", "COLOMBO"]));

    const allStatsAfterClear = await caller.orders.getStats({ shipTo: undefined });
    expect(allStatsAfterClear.totalItems).toBe(2);

    const branchSummary = await caller.orders.getBranchSummary();
    expect(branchSummary.find(branch => branch.shipTo === "PORTO ALEGRE")).toMatchObject({
      totalItems: 1,
      overdueItems: 1,
    });
    expect(branchSummary.find(branch => branch.shipTo === "COLOMBO")).toMatchObject({
      totalItems: 1,
      overdueItems: 1,
    });

    const alertsAfterClear = await caller.orders.getAlerts({ thresholdDays: 7, shipTo: undefined });
    expect(alertsAfterClear.alerts).toBeDefined();

    const trendAfterClear = await caller.orders.getAlertsTrend({ thresholdDays: 7, shipTo: undefined });
    expect(trendAfterClear).toBeDefined();
  });

  it("uploads order with mapped address and filters correctly by canonical city PORTO ALEGRE", async () => {
    await db.resetImportedData();
    const ctx: TrpcContext = {
      user: {
        id: 1,
        openId: "test-admin-city",
        name: "Test Admin",
        email: "admin@test.com",
        loginMethod: "manus",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    };
    const caller = appRouter.createCaller(ctx);
    const itemCode = `ITEM-CITY-${Date.now()}`;
    const customerPo = `PO-CITY-${Date.now()}`;
    const wsData = [{
      "Endereco (ship To)": "AVENIDA ASSIS BRASIL RS BR",
      "Customer PO": customerPo,
      "Shipment Priority": "High",
      "Data Criacao da Ordem": new Date("2025-01-01T00:00:00.000Z"),
      "Item": itemCode,
      "Descricao do Item": "Teste de cidade mapeada",
      "Quantidade": 5,
      "Scheduled Reserved": 0,
      "Unit Selling Price": 50,
      "Extended Price": 250,
      "Previsão": "2025-09-01",
      "Long Text": "Mapeamento Porto Alegre",
    }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(wsData), "OpenOrders");
    const fileBase64 = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }).toString("base64");

    await caller.orders.uploadExcel({ fileName: "city-test.xlsx", fileBase64 });

    const shipToOptions = await caller.orders.listShipTo();
    expect(shipToOptions).toContain("PORTO ALEGRE");
    expect(shipToOptions).not.toContain("AVENIDA ASSIS BRASIL RS BR");

    const filteredItems = await caller.orders.listItems({ shipTo: "PORTO ALEGRE" });
    expect(filteredItems.length).toBe(1);
    expect(filteredItems[0].shipTo).toBe("PORTO ALEGRE");
    expect(filteredItems[0].item).toBe(itemCode);

    const branches = await caller.orders.getBranchSummary();
    const portoBranch = branches.find(b => b.shipTo === "PORTO ALEGRE");
    expect(portoBranch).toBeDefined();
    expect(portoBranch?.totalItems).toBe(1);
  });

  it("marks items as delivered when they disappear from a newer upload", async () => {
    await db.resetImportedData();
    const ctx: TrpcContext = {
      user: { id: 1, openId: "admin", name: "Admin", email: "admin@test.com", loginMethod: "oauth", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
      req: {} as any,
      res: {} as any,
    };
    const caller = appRouter.createCaller(ctx);

    const wb1 = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet([
      ["Filial", "Item", "Customer PO", "Previsão"],
      ["PORTO ALEGRE", "ITEM-A", "PO-1", "2025-06"],
      ["PORTO ALEGRE", "ITEM-B", "PO-2", "2025-07"],
    ]);
    XLSX.utils.book_append_sheet(wb1, ws1, "Orders");
    const buf1 = XLSX.write(wb1, { type: "buffer", bookType: "xlsx" });

    await caller.orders.uploadExcel({
      fileName: "upload_week1.xlsx",
      fileBase64: buf1.toString("base64"),
    });

    const activeBefore = await caller.orders.listItems();
    expect(activeBefore).toHaveLength(2);

    // Upload semana 2: ITEM-B sofre alteração de previsão, enquanto ITEM-A continua estável.
    const wb2 = XLSX.utils.book_new();
    const ws2 = XLSX.utils.aoa_to_sheet([
      ["Filial", "Item", "Customer PO", "Previsão"],
      ["PORTO ALEGRE", "ITEM-A", "PO-1", "2025-06"],
      ["PORTO ALEGRE", "ITEM-B", "PO-2", "2025-08"],
    ]);
    XLSX.utils.book_append_sheet(wb2, ws2, "Orders");
    const buf2 = XLSX.write(wb2, { type: "buffer", bookType: "xlsx" });

    await caller.orders.uploadExcel({
      fileName: "upload_week2.xlsx",
      fileBase64: buf2.toString("base64"),
    });

    // Upload semana 3: ITEM-B desapareceu e deve sair do relatório gerencial.
    const wb3 = XLSX.utils.book_new();
    const ws3 = XLSX.utils.aoa_to_sheet([
      ["Filial", "Item", "Customer PO", "Previsão"],
      ["PORTO ALEGRE", "ITEM-A", "PO-1", "2025-06"],
    ]);
    XLSX.utils.book_append_sheet(wb3, ws3, "Orders");
    const buf3 = XLSX.write(wb3, { type: "buffer", bookType: "xlsx" });

    await caller.orders.uploadExcel({
      fileName: "upload_week3.xlsx",
      fileBase64: buf3.toString("base64"),
    });

    const activeAfter = await caller.orders.listItems();
    expect(activeAfter).toHaveLength(1);
    expect(activeAfter[0].item).toBe("ITEM-A");

    const delivered = await caller.orders.listDeliveredItems();
    expect(delivered).toHaveLength(1);
    expect(delivered[0].item).toBe("ITEM-B");
    expect(delivered[0].status).toBe("delivered");
    expect(delivered[0].deliveredAt).toBeDefined();

    const report = await caller.orders.getCompleteChangesReport({});
    expect(report).not.toEqual(expect.arrayContaining([expect.objectContaining({ item: "ITEM-B" })]));
  });

  it("summarizes opened orders, lifecycle bands and upload history for the selected period", async () => {
    await db.resetImportedData();
    const caller = appRouter.createCaller({
      user: { id: 1, openId: "analytics-admin", name: "Analytics Admin", email: "analytics@test.com", loginMethod: "oauth", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
      req: {} as any,
      res: {} as any,
    });
    const toBase64 = (rows: Record<string, string>[]) => {
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "OpenOrders");
      return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }).toString("base64");
    };
    const firstUpload = [
      { "Filial": "PORTO ALEGRE", "Item": "LIFECYCLE-A", "Customer PO": "PO-LIFE-A", "Data de criação": "2025-01-15", "Previsão": "2025-03-01" },
      { "Filial": "PORTO ALEGRE", "Item": "LIFECYCLE-B", "Customer PO": "PO-LIFE-B", "Data de criação": "2025-02-10", "Previsão": "2025-04-01" },
    ];
    await caller.orders.uploadExcel({ fileName: "lifecycle-week-1.xlsx", fileBase64: toBase64(firstUpload) });
    await caller.orders.uploadExcel({
      fileName: "lifecycle-week-2.xlsx",
      fileBase64: toBase64([firstUpload[0]]),
    });

    const today = new Date().toISOString().slice(0, 10);
    const activeLifecycle = await caller.orders.getOrderLifecycleAnalysis({ startDate: "2025-01-01", endDate: today, scope: "active" });
    expect(activeLifecycle.summary.openedOrders).toBe(1);
    expect(activeLifecycle.monthly).toEqual(expect.arrayContaining([
      expect.objectContaining({ month: "2025-01", openedOrders: 1 }),
    ]));
    expect(activeLifecycle.monthly).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ month: "2025-02" }),
    ]));
    expect(activeLifecycle.monthly.reduce((sum, month) => sum + month.above90, 0)).toBeGreaterThanOrEqual(1);

    const completeLifecycle = await caller.orders.getOrderLifecycleAnalysis({ startDate: "2025-01-01", endDate: today, scope: "all" });
    expect(completeLifecycle.summary.openedOrders).toBe(2);
    expect(completeLifecycle.monthly).toEqual(expect.arrayContaining([
      expect.objectContaining({ month: "2025-01", openedOrders: 1 }),
      expect.objectContaining({ month: "2025-02", openedOrders: 1 }),
    ]));

    const historical = await caller.orders.getHistoricalAssessment({ startDate: "2025-01-01", endDate: today, shipTo: "PORTO ALEGRE" });
    expect(historical.summary.uploads).toBe(2);
    expect(historical.summary.branches).toBe(1);
    expect(historical.uploads).toHaveLength(2);
    expect(historical.branches).toEqual(expect.arrayContaining([
      expect.objectContaining({ branch: "PORTO ALEGRE" }),
    ]));
  });
