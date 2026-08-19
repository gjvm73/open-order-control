// @vitest-environment happy-dom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const itemDetailQuery = vi.hoisted(() => vi.fn());
const invalidate = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const statsQuery = vi.hoisted(() => vi.fn());
const deliveredItemsRefetch = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const deliveredItemsInvalidate = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const managementOverviewRefetch = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const managementOverviewInvalidate = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const deliveredItemRows = vi.hoisted(() => ({ current: [] as any[] }));
const resetImportsMutate = vi.hoisted(() => vi.fn().mockResolvedValue({ deletedUploads: 1, deletedItems: 4, deletedHistory: 2 }));
const uploadExcelMutate = vi.hoisted(() => vi.fn());
const prioritizationSettingsRows = vi.hoisted(() => ({ current: null as any }));
const prioritizationSettingsRefetch = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const updatePrioritizationMutate = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({ user: null as { role: string; name: string } | null, isAuthenticated: false, logout: vi.fn() }));
const emptyQuery = <T,>(data: T) => ({ data, isLoading: false, refetch: vi.fn() });
const branchSummary = [
  { shipTo: "PORTO ALEGRE", totalItems: 3, changedItems: 2, overdueItems: 2, noSupplier: 0, highPriorityItems: 1, valueAtRisk: 18000, changeRate: 66.7, shareOfItems: 60 },
  { shipTo: "COLOMBO", totalItems: 2, changedItems: 1, overdueItems: 1, noSupplier: 0, highPriorityItems: 0, valueAtRisk: 7000, changeRate: 50, shareOfItems: 40 },
];
const defaultStats = { totalItems: 4, changedLastUpload: 0, noSupplier: 1, obsoleteItems: 1, noDeadlineItems: 1, withDeadlineItems: 1, mostChanged: [], totalOrderValue: 0, valueAtRisk: 0, changedItems: 0, stableItems: 4, highPriorityItems: 0, overdueItems: 0, stabilityRate: 100, riskRate: 0, latestChangeRate: 0, latestStabilityRate: 100, trend: [], actionQueue: [], latestUpload: null };
const managementOverview = {
  portfolio: { activeItems: 3, activeValue: 9000, overdueItems: 1, noSupplierItems: 0, noDeadlineItems: 1, changedItems: 2 },
  delivery: { totalDelivered: 4, deliveredValue: 12000, lifecycleMeasuredItems: 4, averageOpenDays: 38.5, within30Days: 2, from31To60Days: 1, from61To90Days: 1, over90Days: 0, withoutLifecycleDate: 0, deliveryWithPrediction: 4, onTimeCount: 3, lateCount: 1, onTimeRate: 75, averageLateDays: 7 },
  pendingAging: [{ key: "upTo30", label: "Até 30 dias", items: 1 }, { key: "from31To60", label: "31–60 dias", items: 1 }, { key: "from61To90", label: "61–90 dias", items: 0 }, { key: "over90", label: "Acima de 90 dias", items: 1 }, { key: "withoutCreationDate", label: "Sem data de criação", items: 0 }],
  branchPerformance: [{ shipTo: "PORTO ALEGRE", activeItems: 3, deliveredItems: 4, overdueItems: 1, averageOpenDays: 38.5, onTimeRate: 75, activeValue: 9000, deliveredValue: 12000 }],
  deliveryTrend: [{ month: "ago. 26", deliveredItems: 4, averageOpenDays: 38.5 }],
  latestUpload: null,
};

vi.mock("@/lib/trpc", () => ({
  trpc: {
    orders: {
      listDeliveredItems: { useQuery: () => ({ ...emptyQuery(deliveredItemRows.current), refetch: deliveredItemsRefetch }) },
      getManagementOverview: { useQuery: () => ({ ...emptyQuery(managementOverview), refetch: managementOverviewRefetch }) },
      getStats: { useQuery: () => emptyQuery(statsQuery()) },
      listItems: { useQuery: () => emptyQuery([]) },
      listShipTo: { useQuery: () => emptyQuery([]) },
      getBranchSummary: { useQuery: () => emptyQuery(branchSummary) },
      getAlerts: { useQuery: () => emptyQuery({ alerts: [{ id: 42, severity: "CRÍTICO", direction: "ADIAMENTO", item: "ITEM-42", itemDescription: "Item de teste", shipTo: "PORTO ALEGRE", customerPo: "PO-42", previousPrediction: "2025-05-01", currentPrediction: "2025-05-20", differenceDays: 19 }], summary: { totalAlerts: 1, criticalCount: 1, attentionCount: 0, criticalRatio: 100, attentionRatio: 0 } }) },
      getAlertsTrend: { useQuery: () => emptyQuery([]) },
      getItemDetail: { useQuery: itemDetailQuery },
      resetImports: { useMutation: () => ({ mutateAsync: resetImportsMutate, isPending: false }) },
      getPrioritizationSettings: { useQuery: () => ({ ...emptyQuery(prioritizationSettingsRows.current), refetch: prioritizationSettingsRefetch }) },
      updatePrioritizationSettings: { useMutation: () => ({ mutateAsync: updatePrioritizationMutate, isPending: false }) },
      resetPrioritizationSettings: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
    },
    auth: { localLogin: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) } },
    useUtils: () => ({
      client: { orders: { uploadExcel: { mutate: uploadExcelMutate } } },
      auth: { me: { invalidate } },
      orders: { listPredictionHistory: { fetch: vi.fn().mockResolvedValue([]) }, getStats: { invalidate }, listItems: { invalidate }, listUploads: { invalidate }, listShipTo: { invalidate }, getBranchSummary: { invalidate }, getAlerts: { invalidate }, getAlertsTrend: { invalidate }, listDeliveredItems: { invalidate: deliveredItemsInvalidate }, getManagementOverview: { invalidate: managementOverviewInvalidate }, getPrioritizationSettings: { invalidate } },
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
  deliveredItemRows.current = [];
  prioritizationSettingsRows.current = null;
  prioritizationSettingsRefetch.mockClear();
  updatePrioritizationMutate.mockReset();
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

  it("apresenta a Visão Gerencial com desempenho de entregas, pendências e filial", () => {
    itemDetailQuery.mockReturnValue(emptyQuery(null));

    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Visão Gerencial" }));

    expect(screen.getByRole("button", { name: "Visão Gerencial" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("Desempenho de entregas e pressão da carteira")).toBeTruthy();
    expect(screen.getByText("Tempo médio em aberto")).toBeTruthy();
    expect(screen.getByText("39 dias")).toBeTruthy();
    expect(screen.queryByText("38.5 dias")).toBeNull();
    expect(screen.getByText(/data do último upload − Data de criação do pedido/i)).toBeTruthy();
    expect(screen.getByText(/Alterações de previsão não influenciam/)).toBeTruthy();
    expect(screen.getByText(/Comparativo por filial/)).toBeTruthy();
    const executiveHelp = screen.getByRole("button", { name: "Entenda os indicadores da Síntese Executiva" });
    expect(executiveHelp).toBeTruthy();
    fireEvent.focus(executiveHelp);
    expect(screen.getAllByText("Como interpretar este quadro").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Entregas em atraso/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("PORTO ALEGRE").length).toBeGreaterThan(0);
  });

  it("aciona a impressão exclusiva da Visão Gerencial", () => {
    itemDetailQuery.mockReturnValue(emptyQuery(null));
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => undefined);
    vi.useFakeTimers();

    try {
      render(<Home />);
      fireEvent.click(screen.getByRole("button", { name: "Visão Gerencial" }));
      fireEvent.click(screen.getByRole("button", { name: "Imprimir Visão Gerencial" }));

      expect(document.body.dataset.pdfMode).toBe("management");
      act(() => {
        vi.advanceTimersByTime(80);
      });

      expect(printSpy).toHaveBeenCalledTimes(1);
    } finally {
      printSpy.mockRestore();
      vi.useRealTimers();
      delete document.body.dataset.pdfMode;
    }
  });

  it("exibe a data de entrega e os dias em aberto na tabela de itens concluídos", () => {
    itemDetailQuery.mockReturnValue(emptyQuery(null));
    deliveredItemRows.current = [{
      id: 81,
      shipTo: "PORTO ALEGRE",
      item: "ITEM-ENTREGUE",
      itemDescription: "Item concluído para teste",
      customerPo: "PO-ENTREGA",
      currentPrediction: "2026-08-10",
      orderCreationDate: "2026-08-01",
      deliveredAt: "2026-08-18T15:00:00.000Z",
      quantity: "3",
      extendedPrice: "4500",
    }];

    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: /Itens Entregues/i }));

    expect(screen.getByRole("columnheader", { name: "Data de entrega" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Data de criação" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Dias em aberto" })).toBeTruthy();
    expect(screen.getByText("01/08/2026")).toBeTruthy();
    expect(screen.getByText("18/08/2026")).toBeTruthy();
    expect(screen.getAllByText("17 dias")).toHaveLength(2);
    expect(screen.getByLabelText("Tempo médio em aberto: 17 dias")).toBeTruthy();
  });

  it("salva os pesos configurados e atualiza a consulta imediatamente", async () => {
    itemDetailQuery.mockReturnValue(emptyQuery(null));
    authState.user = { role: "admin", name: "Giovani" };
    authState.isAuthenticated = true;
    prioritizationSettingsRows.current = {
      predictionChangeWeight: 4,
      noSupplierWeight: 5,
      overdueWeight: 3,
      highPriorityWeight: 2,
      financialImpactWeight: 3,
      agingWeight: 2,
      updatedAt: null,
    };
    updatePrioritizationMutate.mockResolvedValue(prioritizationSettingsRows.current);

    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "Configurar pesos da Fila de Ação" }));
    fireEvent.change(screen.getByLabelText("Alteração de previsão"), { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar pesos" }));

    await waitFor(() => {
      expect(updatePrioritizationMutate).toHaveBeenCalledWith({
        predictionChangeWeight: 9,
        noSupplierWeight: 5,
        overdueWeight: 3,
        highPriorityWeight: 2,
        financialImpactWeight: 3,
        agingWeight: 2,
      });
      expect(prioritizationSettingsRefetch).toHaveBeenCalledTimes(1);
    });
  });

  it("recarrega os itens entregues e a Visão Gerencial após reset das importações", async () => {
    authState.user = { role: "admin", name: "Giovani Martino" };
    itemDetailQuery.mockReturnValue(emptyQuery(null));

    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: /Resetar importações/i }));
    fireEvent.change(screen.getByPlaceholderText("RESETAR"), { target: { value: "RESETAR" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar reset" }));

    await waitFor(() => expect(deliveredItemsRefetch).toHaveBeenCalledTimes(1));
    expect(managementOverviewRefetch).toHaveBeenCalledTimes(1);
  });

  it("exige confirmação antes de processar uma planilha selecionada", () => {
    authState.user = { role: "admin", name: "Giovani Martino" };
    itemDetailQuery.mockReturnValue(emptyQuery(null));

    render(<Home />);
    const uploadInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(uploadInput).toBeTruthy();
    fireEvent.change(uploadInput!, { target: { files: [new File(["conteúdo"], "carteira-semanal.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })] } });

    expect(screen.getByRole("heading", { name: "Processar esta planilha?" })).toBeTruthy();
    expect(screen.getByText("carteira-semanal.xlsx")).toBeTruthy();
    expect(uploadExcelMutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(uploadExcelMutate).not.toHaveBeenCalled();
  });

  it("invalida os itens entregues e a Visão Gerencial somente após confirmar o upload", async () => {
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
      expect(uploadExcelMutate).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Confirmar upload" }));

      await waitFor(() => expect(deliveredItemsInvalidate).toHaveBeenCalledTimes(1));
      expect(managementOverviewInvalidate).toHaveBeenCalledTimes(1);
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
