import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import type { TrpcContext } from "./_core/context";
import * as XLSX from "xlsx";

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
    const alerts = await caller.orders.getAlerts({ thresholdDays: 7 });
    expect(Array.isArray(alerts)).toBe(true);
  });

  it("blocks resetImports for non-admin users", async () => {
    const ctx: TrpcContext = {
      user: {
        id: 2,
        openId: "regular-user",
        name: "Regular User",
        email: "user@test.com",
        loginMethod: "manus",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.orders.resetImports()).rejects.toMatchObject({ code: "FORBIDDEN" });
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
    const customerPo = `PO-${Date.now()}`;

    // Criar uma planilha Excel em memória para teste
    const wsData = [
      {
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
        "Previsão": "2025-06-01",
        "Long Text": "Teste inicial"
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
    expect(res1.totalRows).toBe(1);

    // Verificar listagem
    const items = await caller.orders.listItems({ item: itemCode, customerPo, shipTo: "TESTE RS" });
    expect(items.length).toBeGreaterThan(0);
    const targetItem = items.find(i => i.item === itemCode && i.customerPo === customerPo);
    expect(targetItem).toBeDefined();
    expect(targetItem?.currentPrediction).toBe("2025-06-01");
    expect(targetItem?.predictionChangesCount).toBe(0);

    // Segundo upload com mudança na Previsão
    const wsData2 = [
      {
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

    const filteredStats = await caller.orders.getStats({ shipTo: "TESTE RS" });
    expect(filteredStats.totalItems).toBeGreaterThanOrEqual(1);
    expect(filteredStats.changedItems).toBeGreaterThanOrEqual(1);
    expect(filteredStats.changedLastUpload).toBeGreaterThanOrEqual(1);

    const alertsAboveThirtyDays = await caller.orders.getAlerts({ thresholdDays: 30, shipTo: "TESTE RS" });
    const targetAlert = alertsAboveThirtyDays.find((alert) => alert.item === itemCode && alert.customerPo === customerPo);
    expect(targetAlert).toMatchObject({
      shipTo: "TESTE RS",
      previousPrediction: "2025-07-15",
      currentPrediction: "2025-08-20",
      differenceDays: 36,
      absoluteDifferenceDays: 36,
      direction: "ADIAMENTO",
    });
    expect(targetAlert?.severity).toBe("ATENÇÃO");

    const alertsAboveFortyDays = await caller.orders.getAlerts({ thresholdDays: 40, shipTo: "TESTE RS" });
    expect(alertsAboveFortyDays.some((alert) => alert.item === itemCode && alert.customerPo === customerPo)).toBe(false);
  });
});
