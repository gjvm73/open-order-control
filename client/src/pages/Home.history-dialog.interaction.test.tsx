// @vitest-environment happy-dom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const itemDetailQuery = vi.hoisted(() => vi.fn());
const invalidate = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const emptyQuery = <T,>(data: T) => ({ data, isLoading: false, refetch: vi.fn() });

vi.mock("@/lib/trpc", () => ({
  trpc: {
    orders: {
      listDeliveredItems: { useQuery: () => emptyQuery([]) },
      getStats: { useQuery: () => emptyQuery({ totalItems: 0, changedLastUpload: 0, noSupplier: 0, mostChanged: [], totalOrderValue: 0, valueAtRisk: 0, changedItems: 0, stableItems: 0, highPriorityItems: 0, overdueItems: 0, stabilityRate: 0, riskRate: 0, latestChangeRate: 0, latestStabilityRate: 0, trend: [], actionQueue: [], latestUpload: null }) },
      listItems: { useQuery: () => emptyQuery([]) },
      listUploads: { useQuery: () => emptyQuery([]) },
      listShipTo: { useQuery: () => emptyQuery([]) },
      getBranchSummary: { useQuery: () => emptyQuery([]) },
      getAlerts: { useQuery: () => emptyQuery({ alerts: [{ id: 42, severity: "CRÍTICO", direction: "ADIAMENTO", item: "ITEM-42", itemDescription: "Item de teste", shipTo: "PORTO ALEGRE", customerPo: "PO-42", previousPrediction: "2025-05-01", currentPrediction: "2025-05-20", differenceDays: 19 }], summary: { totalAlerts: 1, criticalCount: 1, attentionCount: 0, criticalRatio: 100, attentionRatio: 0 } }) },
      getAlertsTrend: { useQuery: () => emptyQuery([]) },
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

describe("histórico acionado pelos Alertas de Variação", () => {
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
