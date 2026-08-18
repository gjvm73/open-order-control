// @vitest-environment happy-dom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const itemDetailQuery = vi.hoisted(() => vi.fn());
const invalidate = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const statsQuery = vi.hoisted(() => vi.fn());
const deliveredItemsRefetch = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const completeChangesReportRefetch = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const lifecycleAnalysisRefetch = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const historicalAssessmentRefetch = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const deliveredItemsInvalidate = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const completeChangesReportInvalidate = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const completeChangesReportRows = vi.hoisted(() => ({ current: [] as any[] }));
const uploadsRows = vi.hoisted(() => ({ current: [] as any[] }));
const deliveredItemRows = vi.hoisted(() => ({ current: [] as any[] }));
const lifecycleQueryInputs = vi.hoisted(() => ({ current: [] as Array<{ scope?: "active" | "all" }> }));
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

vi.mock("@/lib/trpc", () => ({
  trpc: {
    orders: {
      listDeliveredItems: { useQuery: () => ({ ...emptyQuery(deliveredItemRows.current), refetch: deliveredItemsRefetch }) },
      getStats: { useQuery: () => emptyQuery(statsQuery()) },
      listItems: { useQuery: () => emptyQuery([]) },
      listUploads: { useQuery: () => emptyQuery(uploadsRows.current) },
      listShipTo: { useQuery: () => emptyQuery([]) },
      getBranchSummary: { useQuery: () => emptyQuery(branchSummary) },
      getAlerts: { useQuery: () => emptyQuery({ alerts: [{ id: 42, severity: "CRÍTICO", direction: "ADIAMENTO", item: "ITEM-42", itemDescription: "Item de teste", shipTo: "PORTO ALEGRE", customerPo: "PO-42", previousPrediction: "2025-05-01", currentPrediction: "2025-05-20", differenceDays: 19 }], summary: { totalAlerts: 1, criticalCount: 1, attentionCount: 0, criticalRatio: 100, attentionRatio: 0 } }) },
      getAlertsTrend: { useQuery: () => emptyQuery([]) },
      getCompleteChangesReport: { useQuery: () => ({ ...emptyQuery(completeChangesReportRows.current), refetch: completeChangesReportRefetch }) },
      getOrderLifecycleAnalysis: { useQuery: (input: { scope?: "active" | "all" }) => {
        lifecycleQueryInputs.current.push(input);
        const isCompleteHistory = input.scope === "all";
        return { ...emptyQuery({ referenceDate: new Date("2026-05-20T00:00:00.000Z"), summary: { openedOrders: isCompleteHistory ? 2 : 1, closedSameMonth: 0, openOrders: 1, averageLifeDays: 35, withoutCreationDate: 0 }, monthly: [{ label: "mai. de 2026", openedOrders: isCompleteHistory ? 2 : 1, closedSameMonth: 0, openOrders: 1 }] }), refetch: lifecycleAnalysisRefetch };
      } },
      getHistoricalAssessment: { useQuery: () => ({ ...emptyQuery({ summary: { uploads: 0, itemsRecorded: 0, branches: 0, changeEvents: 0, deliveredItems: 0, averagePlannedLeadDays: null, averageDeliveryLeadDays: null }, uploads: [], branches: [] }), refetch: historicalAssessmentRefetch }) },
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
  completeChangesReportRows.current = [];
  uploadsRows.current = [];
  deliveredItemRows.current = [];
  lifecycleQueryInputs.current = [];
  prioritizationSettingsRows.current = null;
  lifecycleAnalysisRefetch.mockClear();
  historicalAssessmentRefetch.mockClear();
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
    expect(screen.getByRole("columnheader", { name: "Dias em aberto" })).toBeTruthy();
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

  it("exibe o Relatório Gerencial em uma guia exclusiva pelo menu superior", () => {
    itemDetailQuery.mockReturnValue(emptyQuery(null));

    render(<Home />);
    expect(screen.getByText("Onde a gestão deve concentrar atenção")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Relatório Gerencial" }));

    expect(screen.getByText("Alterações por filial e período")).toBeTruthy();
    expect(screen.getByText("Envelhecimento das pendências")).toBeTruthy();
    expect(screen.queryByText("Onde a gestão deve concentrar atenção")).toBeNull();
    expect(screen.queryByText("Itens, previsões e respectivas alterações")).toBeNull();

    const reportTable = screen.getByRole("table", { name: "Itens alterados do relatório gerencial" });
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

  it("aplica escopo ativo ao Relatório Gerencial e exibe o ciclo completo na Avaliação Histórica", () => {
    itemDetailQuery.mockReturnValue(emptyQuery(null));

    render(<Home />);
    expect(lifecycleQueryInputs.current).toEqual(expect.arrayContaining([
      expect.objectContaining({ scope: "active" }),
      expect.objectContaining({ scope: "all" }),
    ]));

    fireEvent.click(screen.getByRole("button", { name: "Avaliação Histórica" }));

    expect(screen.getByText("Ciclo de vida completo")).toBeTruthy();
    expect(screen.getByText(/Inclui todos os itens que passaram pelo sistema/)).toBeTruthy();
    expect(screen.getByLabelText("Gráfico mensal completo de abertura e finalização de pedidos")).toBeTruthy();
    expect(screen.getByText(/A Data de criação representa a abertura do pedido/)).toBeTruthy();
    expect(screen.getByText("Tempo efetivo médio")).toBeTruthy();
  });

  it("remove o histórico de cargas visível e mantém a última carga como referência temporal do envelhecimento", () => {
    itemDetailQuery.mockReturnValue(emptyQuery(null));
    uploadsRows.current = [
      { id: 1, fileName: "carga-abril.xlsx", uploadDate: "2026-04-15T10:00:00.000Z", totalRows: 49, acceptedRows: 49, changedRowsCount: 2 },
      { id: 2, fileName: "carga-maio.xlsx", uploadDate: "2026-05-20T10:00:00.000Z", totalRows: 51, acceptedRows: 50, changedRowsCount: 4 },
    ];

    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "Relatório Gerencial" }));

    expect(screen.queryByText("Cargas consideradas no período")).toBeNull();
    expect(screen.queryByText("carga-abril.xlsx")).toBeNull();
    expect(screen.queryByText("carga-maio.xlsx")).toBeNull();
    expect(screen.getByText(/Referência: 20\/05\/2026/)).toBeTruthy();
  });

  it("adapta o painel de ciclo de vida ao modo claro e ao modo noturno", () => {
    itemDetailQuery.mockReturnValue(emptyQuery(null));

    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "Relatório Gerencial" }));

    const getLifecyclePanel = () => screen.getByText("Ciclo de vida dos pedidos").closest("div.border");
    expect(getLifecyclePanel()?.className).toContain("bg-white");

    fireEvent.click(screen.getByRole("button", { name: "Ativar modo noturno" }));
    expect(getLifecyclePanel()?.className).toContain("bg-zinc-950");
  });

  it("alinha o card de itens alterados à quantidade exibida na tabela final do Relatório Gerencial", () => {
    itemDetailQuery.mockReturnValue(emptyQuery(null));
    completeChangesReportRows.current = [
      {
        historyId: 10, orderItemId: 88, item: "ITEM-88", itemDescription: "Item em acompanhamento", shipTo: "PORTO ALEGRE", customerPo: "PO-88",
        previousPrediction: "2026-07-10", currentPredictionAtChange: "2026-07-30", currentPrediction: "2026-08-12", differenceDays: 20,
        direction: "ADIAMENTO", quantity: "2", extendedPrice: "1500", status: "active", orderCreationDate: "2026-06-01",
        predictionChangesCount: 2, changesInPeriod: 2, lastPredictionChangeDate: "2026-08-17T12:00:00.000Z", fileName: "semana-3.xlsx", changedAt: "2026-08-17T12:00:00.000Z",
      },
    ];

    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "Relatório Gerencial" }));

    expect(screen.getByText("Itens alterados")).toBeTruthy();
    expect(screen.getByText("Pedidos únicos exibidos na tabela final")).toBeTruthy();
    expect(screen.getByText("1 item(ns) alterado(s)")).toBeTruthy();
    expect(screen.getByText("2 alteração(ões) histórica(s)")).toBeTruthy();
    expect(screen.getAllByText("2 alterações no período").length).toBe(1);
    expect(screen.getByText("Tempo médio de vida")).toBeTruthy();
  });

  it("recarrega Itens Entregues, Relatório Gerencial e Avaliação Histórica após reset das importações", async () => {
    authState.user = { role: "admin", name: "Giovani Martino" };
    itemDetailQuery.mockReturnValue(emptyQuery(null));

    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: /Resetar importações/i }));
    fireEvent.change(screen.getByPlaceholderText("RESETAR"), { target: { value: "RESETAR" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar reset" }));

    await waitFor(() => expect(deliveredItemsRefetch).toHaveBeenCalledTimes(1));
    expect(completeChangesReportRefetch).toHaveBeenCalledTimes(1);
    expect(lifecycleAnalysisRefetch).toHaveBeenCalledTimes(2);
    expect(historicalAssessmentRefetch).toHaveBeenCalledTimes(1);
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

  it("invalida Itens Entregues e Relatório Gerencial somente após confirmar o upload", async () => {
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
