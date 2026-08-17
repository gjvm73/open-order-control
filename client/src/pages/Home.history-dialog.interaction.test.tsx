// @vitest-environment happy-dom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const itemDetailQuery = vi.hoisted(() => vi.fn());
const invalidate = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const statsQuery = vi.hoisted(() => vi.fn());
const emptyQuery = <T,>(data: T) => ({ data, isLoading: false, refetch: vi.fn() });
const branchSummary = [
  { shipTo: "PORTO ALEGRE", totalItems: 3, changedItems: 2, overdueItems: 2, noSupplier: 0, highPriorityItems: 1, valueAtRisk: 18000, changeRate: 66.7, shareOfItems: 60 },
  { shipTo: "COLOMBO", totalItems: 2, changedItems: 1, overdueItems: 1, noSupplier: 0, highPriorityItems: 0, valueAtRisk: 7000, changeRate: 50, shareOfItems: 40 },
];
const defaultStats = { totalItems: 4, changedLastUpload: 0, noSupplier: 1, obsoleteItems: 1, noDeadlineItems: 1, withDeadlineItems: 1, mostChanged: [], totalOrderValue: 0, valueAtRisk: 0, changedItems: 0, stableItems: 4, highPriorityItems: 0, overdueItems: 0, stabilityRate: 100, riskRate: 0, latestChangeRate: 0, latestStabilityRate: 100, trend: [], actionQueue: [], latestUpload: null };

vi.mock("@/lib/trpc", () => ({
  trpc: {
    orders: {
      listDeliveredItems: { useQuery: () => emptyQuery([]) },
      getStats: { useQuery: () => emptyQuery(statsQuery()) },
      listItems: { useQuery: () => emptyQuery([]) },
      listUploads: { useQuery: () => emptyQuery([]) },
      listShipTo: { useQuery: () => emptyQuery([]) },
      getBranchSummary: { useQuery: () => emptyQuery(branchSummary) },
      getAlerts: { useQuery: () => emptyQuery({ alerts: [{ id: 42, severity: "CRÍTICO", direction: "ADIAMENTO", item: "ITEM-42", itemDescription: "Item de teste", shipTo: "PORTO ALEGRE", customerPo: "PO-42", previousPrediction: "2025-05-01", currentPrediction: "2025-05-20", differenceDays: 19 }], summary: { totalAlerts: 1, criticalCount: 1, attentionCount: 0, criticalRatio: 100, attentionRatio: 0 } }) },
      getAlertsTrend: { useQuery: () => emptyQuery([]) },
      getCompleteChangesReport: { useQuery: () => emptyQuery([]) },
      getItemDetail: { useQuery: itemDetailQuery },
      resetImports: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
      getPrioritizationSettings: { useQuery: () => emptyQuery(null) },
      updatePrioritizationSettings: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
      resetPrioritizationSettings: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
    },
    auth: { localLogin: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) } },
    useUtils: () => ({
      client: { orders: { uploadExcel: { mutate: vi.fn() } } },
      auth: { me: { invalidate } },
      orders: { listPredictionHistory: { fetch: vi.fn().mockResolvedValue([]) }, getStats: { invalidate }, listItems: { invalidate }, listUploads: { invalidate }, listShipTo: { invalidate }, getBranchSummary: { invalidate }, getAlerts: { invalidate }, getAlertsTrend: { invalidate }, getPrioritizationSettings: { invalidate } },
    }),
  },
}));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: null, isAuthenticated: false, logout: vi.fn() }) }));

import Home from "./Home";

afterEach(() => cleanup());
beforeEach(() => statsQuery.mockReturnValue(defaultStats));

describe("histórico acionado pelos Alertas de Variação", () => {
  it("mostra a quantidade de vencidos de cada filial no quadro de Prazos críticos", () => {
    itemDetailQuery.mockReturnValue(emptyQuery(null));

    render(<Home />);

    expect(screen.getByText("Prazos críticos por filial")).toBeTruthy();
    expect(screen.getByText("2 vencidos")).toBeTruthy();
    expect(screen.getByText("1 vencidos")).toBeTruthy();
  });

  it("exibe os quatro cartões de classificação de previsão", () => {
    itemDetailQuery.mockReturnValue(emptyQuery(null));

    render(<Home />);

    expect(screen.getAllByText("Sem fornecedor").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Obsoletos").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sem prazo").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Com prazo").length).toBeGreaterThan(0);
  });

  it("mostra estabilidade neutra quando não há itens importados", () => {
    statsQuery.mockReturnValue({ ...defaultStats, totalItems: 0, changedItems: 0, stableItems: 0, stabilityRate: 0, latestStabilityRate: null });
    itemDetailQuery.mockReturnValue(emptyQuery(null));

    render(<Home />);

    expect(screen.getAllByText("Sem itens importados").length).toBeGreaterThan(0);
    const stabilityCard = screen.getByText("Estabilidade do último ciclo").parentElement;
    expect(stabilityCard).toBeTruthy();
    expect(within(stabilityCard!).getByText("—")).toBeTruthy();
    expect(within(stabilityCard!).queryByText("100%")).toBeNull();
  });

  it("exibe o Relatório Gerencial em uma guia exclusiva pelo menu superior", () => {
    itemDetailQuery.mockReturnValue(emptyQuery(null));

    render(<Home />);
    expect(screen.getByText("Onde a gestão deve concentrar atenção")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Relatório Gerencial" }));

    expect(screen.getByText("Alterações por filial e período")).toBeTruthy();
    expect(screen.getByText("Envelhecimento das pendências")).toBeTruthy();
    expect(screen.queryByText("Onde a gestão deve concentrar atenção")).toBeNull();
    expect(screen.queryByText("Itens, previsões e respectivas alterações")).toBeNull();
  });

  it("abre o modal global com o detalhe do item selecionado", async () => {
    itemDetailQuery.mockImplementation(({ id }: { id: number | null }) => emptyQuery(id === 42 ? {
      item: { item: "ITEM-42", customerPo: "PO-42", currentPrediction: "2025-05-20", previousPrediction: "2025-05-01", predictionChangesCount: 1 },
      history: [{ id: 1, sequence: 1, fileName: "semana.xlsx", uploadId: 1, uploadDate: "2025-05-10T10:00:00.000Z", prediction: "2025-05-20", previousPrediction: "2025-05-01", changed: true, differenceDays: 19 }],
    } : null));

    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "Ver histórico" }));

    await waitFor(() => expect(screen.getByText(/Histórico completo — ITEM-42/)).toBeTruthy());
    expect(itemDetailQuery).toHaveBeenLastCalledWith({ id: 42 }, { enabled: true });
  });
});
