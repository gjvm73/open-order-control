// @vitest-environment happy-dom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const itemDetailQuery = vi.hoisted(() => vi.fn());
const invalidate = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const statsQuery = vi.hoisted(() => vi.fn());
const deliveredItemsRefetch = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const completeChangesReportRefetch = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const deliveredItemsInvalidate = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const completeChangesReportInvalidate = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const resetImportsMutate = vi.hoisted(() => vi.fn().mockResolvedValue({ deletedUploads: 1, deletedItems: 4, deletedHistory: 2 }));
const uploadExcelMutate = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({ user: null as { role: string; name: string } | null, isAuthenticated: false, logout: vi.fn() }));
const emptyQuery = <T,>(data: T) => ({ data, isLoading: false, refetch: vi.fn() });
const branchSummary = [
  { shipTo: "PORTO ALEGRE", totalItems: 3, changedItems: 2, overdueItems: 2, noSupplier: 0, highPriorityItems: 1, valueAtRisk: 18000, changeRate: 66.7, shareOfItems: 60 },
  { shipTo: "COLOMBO", totalItems: 2, changedItems: 1, overdueItems: 1, noSupplier: 0, highPriorityItems: 0, valueAtRisk: 7000, changeRate: 50, shareOfItems: 40 },
];
const defaultStats = { totalItems: 4, changedLastUpload: 0, noSupplier: 1, obsoleteItems: 1, noDeadlineItems: 1, withDeadlineItems: 1, mostChanged: [], totalOrderValue: 0, valueAtRisk: 0, changedItems: 0, stableItems: 4, highPriorityItems: 0, overdueItems: 0, stabilityRate: 100, riskRate: 0, latestChangeRate: 0, latestStabilityRate: 100, trend: [], actionQueue: [], latestUpload: null };

vi.mock("@/lib/trpc", () => ({
  trpc: {
    orders: {
      listDeliveredItems: { useQuery: () => ({ ...emptyQuery([]), refetch: deliveredItemsRefetch }) },
      getStats: { useQuery: () => emptyQuery(statsQuery()) },
      listItems: { useQuery: () => emptyQuery([]) },
      listUploads: { useQuery: () => emptyQuery([]) },
      listShipTo: { useQuery: () => emptyQuery([]) },
      getBranchSummary: { useQuery: () => emptyQuery(branchSummary) },
      getAlerts: { useQuery: () => emptyQuery({ alerts: [{ id: 42, severity: "CRÍTICO", direction: "ADIAMENTO", item: "ITEM-42", itemDescription: "Item de teste", shipTo: "PORTO ALEGRE", customerPo: "PO-42", previousPrediction: "2025-05-01", currentPrediction: "2025-05-20", differenceDays: 19 }], summary: { totalAlerts: 1, criticalCount: 1, attentionCount: 0, criticalRatio: 100, attentionRatio: 0 } }) },
      getAlertsTrend: { useQuery: () => emptyQuery([]) },
      getCompleteChangesReport: { useQuery: () => ({ ...emptyQuery([]), refetch: completeChangesReportRefetch }) },
      getItemDetail: { useQuery: itemDetailQuery },
      resetImports: { useMutation: () => ({ mutateAsync: resetImportsMutate, isPending: false }) },
      getPrioritizationSettings: { useQuery: () => emptyQuery(null) },
      updatePrioritizationSettings: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
      resetPrioritizationSettings: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
    },
    auth: { localLogin: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) } },
    useUtils: () => ({
      client: { orders: { uploadExcel: { mutate: uploadExcelMutate } } },
      auth: { me: { invalidate } },
      orders: { listPredictionHistory: { fetch: vi.fn().mockResolvedValue([]) }, getStats: { invalidate }, listItems: { invalidate }, listUploads: { invalidate }, listShipTo: { invalidate }, getBranchSummary: { invalidate }, getAlerts: { invalidate }, getAlertsTrend: { invalidate }, listDeliveredItems: { invalidate: deliveredItemsInvalidate }, getCompleteChangesReport: { invalidate: completeChangesReportInvalidate }, getPrioritizationSettings: { invalidate } },
    }),
  },
}));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => authState }));

import Home from "./Home";

afterEach(() => cleanup());
beforeEach(() => {
  statsQuery.mockReturnValue(defaultStats);
  authState.user = null;
  authState.isAuthenticated = false;
  vi.clearAllMocks();
});

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

  it("mantém a navegação principal em uma faixa fixa com a guia ativa identificada", () => {
    itemDetailQuery.mockReturnValue(emptyQuery(null));

    render(<Home />);

    const navigation = screen.getByRole("navigation", { name: "Navegação principal do controle de pedidos" });
    expect(navigation.parentElement?.parentElement?.className).toContain("sticky");
    expect(screen.getByRole("button", { name: "Dashboard Ativo" }).getAttribute("aria-current")).toBe("page");
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

    const reportTable = screen.getByRole("table", { name: "Alterações do relatório gerencial" });
    expect(reportTable.className).toContain("table-fixed");
    expect(reportTable.className).not.toContain("min-w");
    expect(reportTable.parentElement?.className).not.toContain("overflow-x-auto");
    expect(screen.queryByRole("columnheader", { name: "Prioridade" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Status atual" })).toBeNull();
  });

  it("exibe o gráfico de colunas logo abaixo do envelhecimento das pendências", () => {
    itemDetailQuery.mockReturnValue(emptyQuery(null));

    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "Relatório Gerencial" }));

    expect(screen.getByText("Dias pendentes por item ativo")).toBeTruthy();
    expect(screen.getByLabelText("Gráfico de colunas da distribuição de dias pendentes")).toBeTruthy();
  });

  it("recarrega Itens Entregues e Relatório Gerencial após reset das importações", async () => {
    authState.user = { role: "admin", name: "Giovani Martino" };
    itemDetailQuery.mockReturnValue(emptyQuery(null));

    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: /Resetar importações/i }));
    fireEvent.change(screen.getByPlaceholderText("RESETAR"), { target: { value: "RESETAR" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar reset" }));

    await waitFor(() => expect(deliveredItemsRefetch).toHaveBeenCalledTimes(1));
    expect(completeChangesReportRefetch).toHaveBeenCalledTimes(1);
  });

  it("invalida Itens Entregues e Relatório Gerencial após upload de planilha", async () => {
    authState.user = { role: "admin", name: "Giovani Martino" };
    itemDetailQuery.mockReturnValue(emptyQuery(null));
    uploadExcelMutate.mockResolvedValue({ acceptedRows: 1, totalRows: 1, duplicateRows: 0, rejectedRows: 0, changedRowsCount: 0, rejectionReasons: [] });

    class TestFileReader {
      onload: ((event: ProgressEvent<FileReader>) => void) | null = null;

      readAsDataURL() {
        this.onload?.({ target: { result: "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,ZmFrZQ==" } } as unknown as ProgressEvent<FileReader>);
      }
    }

    vi.stubGlobal("FileReader", TestFileReader);
    try {
      render(<Home />);
      const uploadInput = document.querySelector<HTMLInputElement>('input[type="file"]');
      expect(uploadInput).toBeTruthy();
      fireEvent.change(uploadInput!, { target: { files: [new File(["conteúdo"], "carga.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })] } });

      await waitFor(() => expect(deliveredItemsInvalidate).toHaveBeenCalledTimes(1));
      expect(completeChangesReportInvalidate).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
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
