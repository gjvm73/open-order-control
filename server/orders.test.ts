import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import type { TrpcContext } from "./_core/context";
import * as XLSX from "xlsx";
import { normalizeShipTo } from "./shipTo";

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

    // Upload semana 2: ITEM-B desapareceu (deve ser marcado como entregue), ITEM-A continua
    const wb2 = XLSX.utils.book_new();
    const ws2 = XLSX.utils.aoa_to_sheet([
      ["Filial", "Item", "Customer PO", "Previsão"],
      ["PORTO ALEGRE", "ITEM-A", "PO-1", "2025-06"],
    ]);
    XLSX.utils.book_append_sheet(wb2, ws2, "Orders");
    const buf2 = XLSX.write(wb2, { type: "buffer", bookType: "xlsx" });

    await caller.orders.uploadExcel({
      fileName: "upload_week2.xlsx",
      fileBase64: buf2.toString("base64"),
    });

    const activeAfter = await caller.orders.listItems();
    expect(activeAfter).toHaveLength(1);
    expect(activeAfter[0].item).toBe("ITEM-A");

    const delivered = await caller.orders.listDeliveredItems();
    expect(delivered).toHaveLength(1);
    expect(delivered[0].item).toBe("ITEM-B");
    expect(delivered[0].status).toBe("delivered");
    expect(delivered[0].deliveredAt).toBeDefined();
  });
