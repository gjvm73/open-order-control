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

  it("allows admin reset and returns the deleted record counts", async () => {
    const resetSpy = vi.spyOn(db, "resetImportedData").mockResolvedValue({
      deletedHistory: 12,
      deletedItems: 5,
      deletedUploads: 2,
    });
    const ctx: TrpcContext = {
      user: {
        id: 1,
        openId: "admin-reset-test",
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

    try {
      const caller = appRouter.createCaller(ctx);
      await expect(caller.orders.resetImports()).resolves.toEqual({
        deletedHistory: 12,
        deletedItems: 5,
        deletedUploads: 2,
      });
      expect(resetSpy).toHaveBeenCalledOnce();
    } finally {
      resetSpy.mockRestore();
    }
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
  });
});
