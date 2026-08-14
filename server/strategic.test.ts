import { describe, it, expect } from "vitest";

describe("Cálculos Estratégicos do Dashboard Gerencial", () => {
  it("calcula corretamente o índice de risco executivo e o nível de risco", () => {
    const stats = {
      totalItems: 100,
      riskRate: 30, // 30% alterados
      overdueItems: 20, // 20% vencidos
      noSupplier: 10, // 10% sem fornecedor
      highPriorityItems: 15, // 15% prioridade alta
      totalOrderValue: 100000,
      valueAtRisk: 25000, // 25% exposição financeira
    };

    const total = stats.totalItems;
    const rate = (val: number) => (val / total) * 100;
    const changeRate = stats.riskRate;
    const overdueRate = rate(stats.overdueItems);
    const supplierRate = rate(stats.noSupplier);
    const priorityRate = rate(stats.highPriorityItems);
    const financialExposureRate = (stats.valueAtRisk / stats.totalOrderValue) * 100;

    const executiveRiskIndex = Math.min(
      100,
      Number((changeRate * 0.35 + overdueRate * 0.25 + supplierRate * 0.2 + priorityRate * 0.1 + financialExposureRate * 0.1).toFixed(1))
    );

    const riskLevel = executiveRiskIndex >= 50 ? "CRÍTICO" : executiveRiskIndex >= 25 ? "ATENÇÃO" : "CONTROLADO";

    expect(changeRate).toBe(30);
    expect(overdueRate).toBe(20);
    expect(supplierRate).toBe(10);
    expect(priorityRate).toBe(15);
    expect(financialExposureRate).toBe(25);
    expect(executiveRiskIndex).toBe(21.5);
    expect(riskLevel).toBe("CONTROLADO");
  });

  it("atribui nível CRÍTICO quando os indicadores excedem limiares severos", () => {
    const changeRate = 80;
    const overdueRate = 50;
    const supplierRate = 40;
    const priorityRate = 60;
    const financialExposureRate = 70;

    const executiveRiskIndex = Math.min(
      100,
      Number((changeRate * 0.35 + overdueRate * 0.25 + supplierRate * 0.2 + priorityRate * 0.1 + financialExposureRate * 0.1).toFixed(1))
    );

    const riskLevel = executiveRiskIndex >= 50 ? "CRÍTICO" : executiveRiskIndex >= 25 ? "ATENÇÃO" : "CONTROLADO";

    expect(executiveRiskIndex).toBeGreaterThanOrEqual(50);
    expect(riskLevel).toBe("CRÍTICO");
  });
});
