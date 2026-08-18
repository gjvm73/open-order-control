import React, { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import * as XLSX from "xlsx";
import { buildOperationalExportFileName, buildOperationalExportRows, filterOperationalItemsWithChanges, formatBrazilianPredictionDate, generateProfessionalOperationalWorkbook } from "@/lib/orderExport";
import { getPendingAgingSummary } from "@/lib/pendingAging";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import {
  Upload, Printer, Download, TrendingUp, AlertTriangle, Package, History, Search, LogOut,
  ArrowRight, Minus, ShieldAlert, Clock3, CircleDollarSign, Target, Moon, Sun, CircleHelp,
  SlidersHorizontal, RotateCcw, Save,
} from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts";

type PrioritizationWeights = {
  predictionChangeWeight: number;
  noSupplierWeight: number;
  overdueWeight: number;
  highPriorityWeight: number;
  financialImpactWeight: number;
  agingWeight: number;
};

const DEFAULT_PRIORITIZATION_WEIGHTS: PrioritizationWeights = {
  predictionChangeWeight: 4,
  noSupplierWeight: 5,
  overdueWeight: 3,
  highPriorityWeight: 2,
  financialImpactWeight: 3,
  agingWeight: 2,
};

const pendingAgingChartConfig = {
  items: { label: "Pendências", color: "#18181b" },
} satisfies ChartConfig;

function createLifecycleChartConfig(isDarkMode: boolean) {
  return {
    abertos: { label: "Pedidos efetuados", color: isDarkMode ? "#e4e4e7" : "#18181b" },
    finalizados: { label: "Finalizados no mês", color: isDarkMode ? "#34d399" : "#059669" },
    pendentes: { label: "Abertos pendentes", color: isDarkMode ? "#fb7185" : "#dc2626" },
  } satisfies ChartConfig;
}

const historicalChartConfig = {
  itens: { label: "Novos pedidos", color: "#18181b" },
  alteracoes: { label: "Alterações de previsão", color: "#dc2626" },
  entregues: { label: "Itens entregues por ausência", color: "#059669" },
} satisfies ChartConfig;

function formatDate(value: unknown) {
  if (!value) return "—";
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("pt-BR");
}

function formatPrediction(value: unknown) {
  return formatBrazilianPredictionDate(value) || "";
}

function formatDateTime(value: unknown) {
  if (!value) return "—";
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("pt-BR");
}

function formatCurrency(value: unknown) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function riskClass(level: string) {
  if (level === "CRÍTICO") return "bg-red-600 text-white";
  if (level === "ATENÇÃO") return "bg-amber-100 text-amber-800";
  return "bg-zinc-100 text-zinc-700";
}

export default function Home() {
  const { user, isAuthenticated, logout } = useAuth();
  const [search, setSearch] = useState("");
  const [filterItem, setFilterItem] = useState("");
  const [filterPo, setFilterPo] = useState("");
  const [filterPrediction, setFilterPrediction] = useState("");
  const [filterShipTo, setFilterShipTo] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "reading" | "processing" | "refreshing">("idle");
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [alertThresholdDays, setAlertThresholdDays] = useState(7);
  const [alertThresholdDraft, setAlertThresholdDraft] = useState("7");
  const [activeTab, setActiveTab] = useState<"active" | "delivered" | "report" | "historical">("active");
  const [deliveredSearch, setDeliveredSearch] = useState("");
  const [deliveredShipTo, setDeliveredShipTo] = useState("");
  const [deliveredItemFilter, setDeliveredItemFilter] = useState("");
  const [deliveredPoFilter, setDeliveredPoFilter] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [pdfMode, setPdfMode] = useState<"executive" | "detailed" | null>(null);
  const [prioritizationOpen, setPrioritizationOpen] = useState(false);
  const [reportShipTo, setReportShipTo] = useState("");
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  const lifecycleChartConfig = React.useMemo(() => createLifecycleChartConfig(isDarkMode), [isDarkMode]);
  const lifecycleTheme = React.useMemo(() => ({
    panel: isDarkMode ? "border-zinc-700 bg-zinc-950 text-zinc-50" : "border-zinc-200 bg-white text-zinc-950",
    divider: isDarkMode ? "border-zinc-700" : "border-zinc-200",
    subdued: isDarkMode ? "text-zinc-400" : "text-zinc-500",
    neutralCard: isDarkMode ? "border-zinc-700 bg-zinc-900" : "border-zinc-200 bg-zinc-50",
    successCard: isDarkMode ? "border-emerald-800 bg-emerald-950/40" : "border-emerald-200 bg-emerald-50",
    successText: isDarkMode ? "text-emerald-300" : "text-emerald-700",
    successDetail: isDarkMode ? "text-emerald-200" : "text-emerald-800",
    riskCard: isDarkMode ? "border-red-900 bg-red-950/40" : "border-red-200 bg-red-50",
    riskText: isDarkMode ? "text-red-300" : "text-red-700",
    riskDetail: isDarkMode ? "text-red-200" : "text-red-800",
    agingCard: isDarkMode ? "border-amber-800 bg-amber-950/40" : "border-amber-200 bg-amber-50",
    agingText: isDarkMode ? "text-amber-300" : "text-amber-700",
    agingDetail: isDarkMode ? "text-amber-200" : "text-amber-800",
    gridStroke: isDarkMode ? "#3f3f46" : "#d4d4d8",
    axisClass: isDarkMode ? "fill-zinc-300" : "fill-zinc-600",
    tooltipCursor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(24,24,27,0.06)",
  }), [isDarkMode]);

  const deliveredInput = React.useMemo(() => ({
    search: deliveredSearch,
    item: deliveredItemFilter,
    customerPo: deliveredPoFilter,
    shipTo: deliveredShipTo.trim() || undefined,
  }), [deliveredSearch, deliveredItemFilter, deliveredPoFilter, deliveredShipTo]);

  const deliveredItemsQuery = trpc.orders.listDeliveredItems.useQuery(deliveredInput);
  const deliveredItems = (deliveredItemsQuery.data ?? []).map((item) => ({
    ...item,
    previousPrediction: formatPrediction(item.previousPrediction),
    currentPrediction: formatPrediction(item.currentPrediction),
  }));

  React.useEffect(() => {
    const storedTheme = window.localStorage.getItem("open-order-dark-mode");
    if (storedTheme === "true") setIsDarkMode(true);
    const stored = Number(window.localStorage.getItem("open-order-alert-threshold-days"));
    if (Number.isInteger(stored) && stored >= 1 && stored <= 3650) {
      setAlertThresholdDays(stored);
      setAlertThresholdDraft(String(stored));
    }
  }, []);

  const selectedShipTo = filterShipTo.trim();
  const statsInput = React.useMemo(() => ({ shipTo: selectedShipTo || undefined }), [selectedShipTo]);
  const itemsInput = React.useMemo(() => ({ search, item: filterItem, customerPo: filterPo, prediction: filterPrediction, shipTo: selectedShipTo || undefined }), [search, filterItem, filterPo, filterPrediction, selectedShipTo]);
  const statsQuery = trpc.orders.getStats.useQuery(statsInput);
  const itemsQuery = trpc.orders.listItems.useQuery(itemsInput);
  const uploadsQuery = trpc.orders.listUploads.useQuery();
  const shipToQuery = trpc.orders.listShipTo.useQuery();
  const branchSummaryQuery = trpc.orders.getBranchSummary.useQuery();
  const alertsInput = React.useMemo(() => ({ thresholdDays: alertThresholdDays, shipTo: selectedShipTo || undefined }), [alertThresholdDays, selectedShipTo]);
  const alertsQuery = trpc.orders.getAlerts.useQuery(alertsInput);
  const alertsTrendQuery = trpc.orders.getAlertsTrend.useQuery(alertsInput);
  const itemDetailQuery = trpc.orders.getItemDetail.useQuery({ id: selectedItemId! }, { enabled: selectedItemId !== null });
  const resetMutation = trpc.orders.resetImports.useMutation();
  const localLoginMutation = trpc.auth.localLogin.useMutation();
  const prioritizationSettingsQuery = trpc.orders.getPrioritizationSettings.useQuery();
  const updatePrioritizationMutation = trpc.orders.updatePrioritizationSettings.useMutation();
  const resetPrioritizationMutation = trpc.orders.resetPrioritizationSettings.useMutation();
  const completeChangesReportInput = React.useMemo(() => ({
    shipTo: reportShipTo.trim() || undefined,
    startDate: reportStartDate || undefined,
    endDate: reportEndDate || undefined,
  }), [reportShipTo, reportStartDate, reportEndDate]);
  const completeChangesReportQuery = trpc.orders.getCompleteChangesReport.useQuery(completeChangesReportInput);
  const completeChangesReport = completeChangesReportQuery.data ?? [];
  const changedItemsInReport = completeChangesReport.length;
  const changeEventsInReport = React.useMemo(
    () => completeChangesReport.reduce((total, row) => total + row.changesInPeriod, 0),
    [completeChangesReport],
  );
  const lifecycleAnalysisInput = React.useMemo(() => ({ ...completeChangesReportInput, scope: "active" as const }), [completeChangesReportInput]);
  const historicalLifecycleInput = React.useMemo(() => ({ ...completeChangesReportInput, scope: "all" as const }), [completeChangesReportInput]);
  const lifecycleAnalysisQuery = trpc.orders.getOrderLifecycleAnalysis.useQuery(lifecycleAnalysisInput);
  const lifecycleAnalysis = lifecycleAnalysisQuery.data ?? { referenceDate: new Date(), summary: { openedOrders: 0, closedSameMonth: 0, openOrders: 0, averageLifeDays: null, withoutCreationDate: 0 }, monthly: [] };
  const historicalLifecycleQuery = trpc.orders.getOrderLifecycleAnalysis.useQuery(historicalLifecycleInput);
  const historicalLifecycle = historicalLifecycleQuery.data ?? { referenceDate: new Date(), summary: { openedOrders: 0, closedSameMonth: 0, openOrders: 0, averageLifeDays: null, withoutCreationDate: 0 }, monthly: [] };
  const historicalAssessmentQuery = trpc.orders.getHistoricalAssessment.useQuery(completeChangesReportInput);
  const historicalAssessment = historicalAssessmentQuery.data ?? { summary: { uploads: 0, itemsRecorded: 0, branches: 0, changeEvents: 0, deliveredItems: 0, averagePlannedLeadDays: null, averageDeliveryLeadDays: null }, uploads: [], branches: [] };
  const reportUploads = React.useMemo(() => {
    const startTimestamp = reportStartDate ? Date.parse(`${reportStartDate}T00:00:00.000Z`) : null;
    const endTimestamp = reportEndDate ? Date.parse(`${reportEndDate}T23:59:59.999Z`) : null;

    return (uploadsQuery.data ?? []).filter((upload) => {
      const uploadTimestamp = new Date(upload.uploadDate).getTime();
      if (!Number.isFinite(uploadTimestamp)) return false;
      if (startTimestamp !== null && uploadTimestamp < startTimestamp) return false;
      if (endTimestamp !== null && uploadTimestamp > endTimestamp) return false;
      return true;
    });
  }, [uploadsQuery.data, reportStartDate, reportEndDate]);
  const reportReferenceDate = React.useMemo(() => {
    if (reportEndDate) return new Date(`${reportEndDate}T00:00:00.000Z`);
    const latestUpload = reportUploads.reduce<typeof reportUploads[number] | null>((latest, upload) => {
      if (!latest) return upload;
      return new Date(upload.uploadDate).getTime() > new Date(latest.uploadDate).getTime() ? upload : latest;
    }, null);
    return latestUpload ? new Date(latestUpload.uploadDate) : new Date();
  }, [reportEndDate, reportUploads]);
  const pendingAging = React.useMemo(
    () => getPendingAgingSummary(completeChangesReport, reportReferenceDate),
    [completeChangesReport, reportReferenceDate],
  );
  const changeEventsByItem = React.useMemo(() => {
    const eventCounts = new Map<number, number>();
    completeChangesReport.forEach((row) => {
      eventCounts.set(row.orderItemId, row.changesInPeriod);
    });
    return eventCounts;
  }, [completeChangesReport]);
  const pendingAgingChartData = React.useMemo(() => [
    { range: "Até 30", items: pendingAging.upTo30, fill: "#047857" },
    { range: "31–60", items: pendingAging.from31To60, fill: "#b45309" },
    { range: "61–90", items: pendingAging.from61To90, fill: "#c2410c" },
    { range: "> 90", items: pendingAging.above90, fill: "#dc2626" },
  ], [pendingAging]);
  const lifecycleChartData = React.useMemo(() => lifecycleAnalysis.monthly.map((month) => ({
    month: month.label,
    abertos: month.openedOrders,
    finalizados: month.closedSameMonth,
    pendentes: month.openOrders,
  })), [lifecycleAnalysis.monthly]);
  const historicalLifecycleChartData = React.useMemo(() => historicalLifecycle.monthly.map((month) => ({
    month: month.label,
    abertos: month.openedOrders,
    finalizados: month.closedSameMonth,
    pendentes: month.openOrders,
  })), [historicalLifecycle.monthly]);
  const historicalChartData = React.useMemo(() => historicalAssessment.uploads.map((upload) => ({
    carga: formatDate(upload.uploadDate),
    itens: upload.itemsRecorded,
    alteracoes: upload.changeEvents,
    entregues: upload.deliveredItems,
  })), [historicalAssessment.uploads]);
  const utils = trpc.useUtils();
  const handleOpenCompleteChangesReport = () => setActiveTab("report");
  const clearShipToFilter = React.useCallback(() => {
    setFilterShipTo("");
    void Promise.all([
      utils.orders.getStats.invalidate(),
      utils.orders.listItems.invalidate(),
      utils.orders.getAlerts.invalidate(),
      utils.orders.getAlertsTrend.invalidate(),
    ]);
  }, [utils]);
  const isAdmin = user?.role === "admin";
  const prioritizationWeights = React.useMemo<PrioritizationWeights>(() => {
    const settings = prioritizationSettingsQuery.data;
    return {
      predictionChangeWeight: Number(settings?.predictionChangeWeight ?? DEFAULT_PRIORITIZATION_WEIGHTS.predictionChangeWeight),
      noSupplierWeight: Number(settings?.noSupplierWeight ?? DEFAULT_PRIORITIZATION_WEIGHTS.noSupplierWeight),
      overdueWeight: Number(settings?.overdueWeight ?? DEFAULT_PRIORITIZATION_WEIGHTS.overdueWeight),
      highPriorityWeight: Number(settings?.highPriorityWeight ?? DEFAULT_PRIORITIZATION_WEIGHTS.highPriorityWeight),
      financialImpactWeight: Number(settings?.financialImpactWeight ?? DEFAULT_PRIORITIZATION_WEIGHTS.financialImpactWeight),
      agingWeight: Number(settings?.agingWeight ?? DEFAULT_PRIORITIZATION_WEIGHTS.agingWeight),
    };
  }, [prioritizationSettingsQuery.data]);

  React.useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode((current) => {
      const next = !current;
      window.localStorage.setItem("open-order-dark-mode", String(next));
      return next;
    });
  };

  const applyAlertThreshold = () => {
    const parsed = Number(alertThresholdDraft);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 3650) {
      toast.error("Informe um limiar inteiro entre 1 e 3650 dias.");
      return;
    }
    setAlertThresholdDays(parsed);
    window.localStorage.setItem("open-order-alert-threshold-days", String(parsed));
    toast.success(`Alertas configurados acima de ${parsed} dias.`);
  };

  React.useEffect(() => {
    if (!pdfMode) return;

    const previousTitle = document.title;
    const previousTab = activeTab;
    document.body.dataset.pdfMode = pdfMode;
    document.title = pdfMode === "detailed"
      ? "Open Order Control - Relatório Detalhado"
      : "Open Order Control - Relatório Executivo";

    // O relatório completo deve sempre incluir o dashboard gerencial, mesmo que a aba de entregues esteja aberta.
    if (pdfMode === "detailed" && activeTab !== "active") {
      setActiveTab("active");
    }

    const printTimer = window.setTimeout(() => {
      window.print();
      window.setTimeout(() => {
        document.title = previousTitle;
        delete document.body.dataset.pdfMode;
        setPdfMode(null);
        setActiveTab(previousTab);
      }, 350);
    }, 80);

    return () => window.clearTimeout(printTimer);
  }, [pdfMode]);

  const handleExportPdf = (mode: "executive" | "detailed" = "executive") => {
    setPdfMode(mode);
  };

  const handleExportOperationalBase = async (onlyChanged = false) => {
    const exportItems = onlyChanged
      ? filterOperationalItemsWithChanges(items)
      : items;

    if (exportItems.length === 0) {
      toast.info(onlyChanged
        ? "Nenhum item com alteração de previsão foi encontrado nos filtros atuais."
        : "Não há itens para exportar com os filtros atuais.");
      return;
    }

    try {
      const exportItemIds = exportItems
        .map((item) => item.id)
        .filter((id): id is number => typeof id === "number");
      const history = await utils.orders.listPredictionHistory.fetch({ orderItemIds: exportItemIds });
      const workbook = generateProfessionalOperationalWorkbook(exportItems, {
        branch: selectedShipTo || "Todas as filiais",
        search: [search, filterItem, filterPo, filterPrediction].filter(Boolean).join(" | ") || undefined,
        scope: onlyChanged ? "Somente itens com alteração de previsão" : "Todos os itens filtrados",
      }, history);
      XLSX.writeFile(workbook, buildOperationalExportFileName());
      const changeCount = history.filter((record) => record.changed).length;
      toast.success(`${exportItems.length} item(ns) exportado(s) com ${changeCount} data(s) de alteração e histórico completo.`);
    } catch (error) {
      console.error("Falha ao carregar o histórico para exportação:", error);
      toast.error("Não foi possível carregar todas as datas de alteração para o Excel.");
    }
  };

  const handleExportCompleteChangesReport = () => {
    if (completeChangesReport.length === 0) {
      toast.info("Nenhuma alteração de previsão foi encontrada para os filtros do Relatório Completo.");
      return;
    }

    const rows = completeChangesReport.map((row) => ({
      "Data da alteração": formatDate(row.changedAt),
      "Hora do registro": formatDateTime(row.changedAt),
      "Filial solicitante": row.shipTo,
      "Item": row.item,
      "Descrição do item": row.itemDescription || "",
      "Customer PO": row.customerPo || "",
      "Previsão anterior": formatPrediction(row.previousPrediction),
      "Previsão alterada": formatPrediction(row.currentPredictionAtChange),
      "Variação (dias)": row.differenceDays ?? "Sem comparação entre datas",
      "Direção": row.direction,
      "Prioridade de embarque": row.shipmentPriority || "",
      "Data de criação": formatPrediction(row.orderCreationDate),
      "Quantidade": row.quantity ?? "",
      "Reserva programada": row.scheduledReserved ?? "",
      "Preço unitário": Number(row.unitSellingPrice || 0),
      "Valor total": Number(row.extendedPrice || 0),
      "Previsão atual do item": formatPrediction(row.currentPrediction),
      "Alterações acumuladas": row.predictionChangesCount,
      "Última alteração do item": formatDate(row.lastPredictionChangeDate),
      "Status atual": row.status,
      "Arquivo de origem": row.fileName,
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = Array.from({ length: 21 }, (_, index) => ({ wch: [15, 19, 24, 18, 42, 18, 18, 18, 20, 18, 22, 16, 12, 18, 16, 18, 20, 20, 19, 14, 30][index] }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Alterações completas");
    const period = reportStartDate || reportEndDate ? `${reportStartDate || "inicio"}_a_${reportEndDate || "hoje"}` : "todo-periodo";
    XLSX.writeFile(workbook, `relatorio-completo-alteracoes_${period}.xlsx`);
    toast.success(`${completeChangesReport.length} alteração(ões) exportada(s) para Excel.`);
  };

  const handleAdminLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await localLoginMutation.mutateAsync({ username: adminUsername, password: adminPassword });
      await utils.auth.me.invalidate();
      setAdminPassword("");
      setLoginOpen(false);
      toast.success("Acesso ADM autorizado.");
    } catch (err: any) {
      toast.error(err.message || "Não foi possível autenticar o administrador.");
    }
  };

  const handleResetImports = async () => {
    try {
      const result = await resetMutation.mutateAsync();
      setResetConfirmation("");
      setSelectedItemId(null);
      toast.success(`Importações resetadas: ${result.deletedUploads} uploads, ${result.deletedItems} itens e ${result.deletedHistory} registros históricos removidos.`);
      await Promise.all([
        statsQuery.refetch(),
        itemsQuery.refetch(),
        uploadsQuery.refetch(),
        shipToQuery.refetch(),
        branchSummaryQuery.refetch(),
        alertsQuery.refetch(),
        alertsTrendQuery.refetch(),
        deliveredItemsQuery.refetch(),
        completeChangesReportQuery.refetch(),
        lifecycleAnalysisQuery.refetch(),
        historicalLifecycleQuery.refetch(),
        historicalAssessmentQuery.refetch(),
      ]);
    } catch (err: any) {
      toast.error(err.message || "Não foi possível resetar as importações.");
    }
  };

  const handleSavePrioritizationSettings = async (weights: PrioritizationWeights) => {
    try {
      await updatePrioritizationMutation.mutateAsync(weights);
      await Promise.all([
        prioritizationSettingsQuery.refetch(),
        statsQuery.refetch(),
      ]);
      toast.success("Pesos de priorização atualizados e aplicados à Fila de Ação.");
      setPrioritizationOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Não foi possível atualizar os pesos de priorização.");
    }
  };

  const handleResetPrioritizationSettings = async () => {
    try {
      await resetPrioritizationMutation.mutateAsync();
      await Promise.all([
        utils.orders.getPrioritizationSettings.invalidate(),
        utils.orders.getStats.invalidate(),
      ]);
      toast.success("Pesos de priorização restaurados ao padrão.");
    } catch (err: any) {
      toast.error(err.message || "Não foi possível restaurar os pesos de priorização.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      toast.error("Por favor, envie um arquivo Excel (.xlsx ou .xls)");
      return;
    }
    setIsUploading(true);
    setUploadStatus("reading");
    const reader = new FileReader();
    reader.onload = async (uploadEvent) => {
      try {
        setUploadStatus("processing");
        const dataUrl = String(uploadEvent.target?.result || "");
        const fileBase64 = dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
        const result = await utils.client.orders.uploadExcel.mutate({ fileName: file.name, fileBase64 });
        const rejectionSummary = result.rejectionReasons?.length
          ? ` Motivos: ${result.rejectionReasons.map((entry: { reason: string; count: number }) => `${entry.reason} (${entry.count})`).join(", ")}.`
          : "";
        toast.success(
          `Upload concluído: ${result.acceptedRows} de ${result.totalRows} linhas aceitas; ${result.duplicateRows} duplicidade(s) preservada(s); ${result.rejectedRows} rejeitada(s); ${result.changedRowsCount} alteração(ões).${rejectionSummary}`,
        );
        setUploadStatus("refreshing");
        setIsUploading(false);
        void Promise.all([
          utils.orders.getStats.invalidate(statsInput),
          utils.orders.listItems.invalidate(itemsInput),
          utils.orders.listUploads.invalidate(),
          utils.orders.listShipTo.invalidate(),
          utils.orders.getBranchSummary.invalidate(),
          utils.orders.getAlerts.invalidate(alertsInput),
          utils.orders.getAlertsTrend.invalidate(alertsInput),
          utils.orders.listDeliveredItems.invalidate(deliveredInput),
          utils.orders.getCompleteChangesReport.invalidate(completeChangesReportInput),
        ]).finally(() => setUploadStatus("idle"));
      } catch (err: any) {
        toast.error(err.message || "Erro ao processar o upload do arquivo.");
        setUploadStatus("idle");
        setIsUploading(false);
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsDataURL(file);
  };

  const rawStats = statsQuery.data || {
    totalItems: 0, changedLastUpload: 0, noSupplier: 0, mostChanged: [], totalOrderValue: 0,
    valueAtRisk: 0, changedItems: 0, stableItems: 0, highPriorityItems: 0, overdueItems: 0,
    obsoleteItems: 0, noDeadlineItems: 0, withDeadlineItems: 0,
    stabilityRate: 0, riskRate: 0, latestChangeRate: 0, latestStabilityRate: null, trend: [], actionQueue: [], latestUpload: null,
  };
  const stats = {
    ...rawStats,
    actionQueue: rawStats.actionQueue.map((item) => ({ ...item, currentPrediction: formatPrediction(item.currentPrediction) })),
    mostChanged: rawStats.mostChanged.map((item) => ({ ...item, currentPrediction: formatPrediction(item.currentPrediction) })),
  };
  const items = (itemsQuery.data || []).map((item) => ({
    ...item,
    previousPrediction: formatPrediction(item.previousPrediction),
    currentPrediction: formatPrediction(item.currentPrediction),
  }));
  const uploadsList = uploadsQuery.data || [];
  const shipToOptions = shipToQuery.data || [];
  const branchSummary = branchSummaryQuery.data || [];
  const alertsData = alertsQuery.data || { alerts: [], summary: { totalAlerts: 0, criticalCount: 0, attentionCount: 0, criticalRatio: 0, attentionRatio: 0 } };
  const alerts = alertsData.alerts.map((alert) => ({
    ...alert,
    previousPrediction: formatPrediction(alert.previousPrediction),
    currentPrediction: formatPrediction(alert.currentPrediction),
  }));
  const alertSummary = alertsData.summary;
  const changedItems = items.filter((item) => item.predictionChangesCount > 0);
  const hasActivePortfolio = Number(stats.totalItems || 0) > 0;
  const stabilityRate = hasActivePortfolio ? (stats.latestStabilityRate ?? stats.stabilityRate ?? 0) : null;
  const stabilityValue = stabilityRate === null ? "—" : `${stabilityRate}%`;
  const stabilityDetail = hasActivePortfolio
    ? `${stats.changedLastUpload} itens alterados no último upload`
    : "Sem itens importados";
  const maxTrendChanges = Math.max(...stats.trend.map((entry) => entry.changedRowsCount), 1);
  const strategic = React.useMemo(() => {
    const total = Number(stats.totalItems || 0);
    const rate = (value: number) => total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0;
    const changeRate = Number(stats.latestChangeRate ?? stats.riskRate ?? 0);
    const overdueRate = rate(Number(stats.overdueItems || 0));
    const supplierRate = rate(Number(stats.noSupplier || 0));
    const priorityRate = rate(Number(stats.highPriorityItems || 0));
    const financialExposureRate = Number(stats.totalOrderValue || 0) > 0
      ? Number(((Number(stats.valueAtRisk || 0) / Number(stats.totalOrderValue || 0)) * 100).toFixed(1))
      : 0;
    const executiveRiskIndex = Math.min(100, Number((changeRate * 0.35 + overdueRate * 0.25 + supplierRate * 0.2 + priorityRate * 0.1 + financialExposureRate * 0.1).toFixed(1)));
    const riskLevel = executiveRiskIndex >= 50 ? "CRÍTICO" : executiveRiskIndex >= 25 ? "ATENÇÃO" : "CONTROLADO";
    const focus = Number(stats.overdueItems || 0) > 0
      ? "Atacar previsões vencidas"
      : Number(stats.changedLastUpload || 0) > 0
        ? "Conter alterações do último ciclo"
        : Number(stats.noSupplier || 0) > 0
          ? "Regularizar itens sem fornecedor"
          : "Manter a cadência de acompanhamento";
    const focusNote = Number(stats.overdueItems || 0) > 0
      ? `${stats.overdueItems} item(ns) exigem confirmação imediata de entrega.`
      : Number(stats.changedLastUpload || 0) > 0
        ? `${stats.changedLastUpload} item(ns) mudaram no upload mais recente.`
        : Number(stats.noSupplier || 0) > 0
          ? `${stats.noSupplier} item(ns) permanecem sem fornecedor definido.`
          : "A carteira não apresenta pressão operacional relevante nos indicadores atuais.";
    const branches = [...branchSummary]
      .filter((branch) => !selectedShipTo || branch.shipTo === selectedShipTo)
      .map((branch) => ({
        ...branch,
        pressureScore: branch.changedItems * 4 + branch.overdueItems * 3 + branch.noSupplier * 3 + branch.highPriorityItems * 2,
      }))
      .sort((a, b) => b.pressureScore - a.pressureScore || b.valueAtRisk - a.valueAtRisk || a.shipTo.localeCompare(b.shipTo, "pt-BR"))
      .slice(0, 4);
    return { executiveRiskIndex, riskLevel, changeRate, overdueRate, supplierRate, priorityRate, financialExposureRate, focus, focusNote, branches };
  }, [stats, branchSummary, selectedShipTo]);
  const uploadStatusLabel = uploadStatus === "reading" ? "Lendo arquivo..." : uploadStatus === "processing" ? "Gravando lotes..." : uploadStatus === "refreshing" ? "Atualizando painel..." : "Upload planilha semanal";

  return (
    <div className={`min-h-screen bg-white text-zinc-950 font-sans selection:bg-red-600 selection:text-white ${isDarkMode ? "dark-mode" : ""}`}>
      <header className="border-b-2 border-zinc-950 px-6 py-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white">
        <div>
          <div className="flex items-center gap-2"><span className="w-4 h-4 bg-red-600 inline-block" /><h1 className="text-2xl font-black uppercase tracking-tight">OPEN ORDER CONTROL</h1></div>
          <p className="text-xs font-mono uppercase tracking-widest text-zinc-500 mt-1">Dashboard gerencial de previsões de entrega</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={toggleDarkMode} className="no-print rounded-none border-zinc-950 text-zinc-950 hover:bg-zinc-950 hover:text-white px-3 py-2.5 text-xs font-mono uppercase tracking-wider h-auto" aria-label={isDarkMode ? "Ativar modo claro" : "Ativar modo noturno"} aria-pressed={isDarkMode}><span className="inline-flex items-center gap-2">{isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}<span className="hidden sm:inline">{isDarkMode ? "Modo claro" : "Modo noturno"}</span></span></Button>
          <Button variant="outline" onClick={() => handleExportPdf("executive")} className="no-print rounded-none border-zinc-950 text-zinc-950 hover:bg-zinc-950 hover:text-white px-4 py-2.5 text-xs font-mono uppercase tracking-wider h-auto" aria-label="Exportar relatório executivo em PDF"><Printer className="w-4 h-4 mr-2" />PDF executivo</Button>
          <Button variant="outline" onClick={() => handleExportPdf("detailed")} className="no-print rounded-none border-red-600 text-red-600 hover:bg-red-600 hover:text-white px-4 py-2.5 text-xs font-mono uppercase tracking-wider h-auto" aria-label="Exportar relatório detalhado completo em PDF"><Download className="w-4 h-4 mr-2" />PDF completo</Button>
          {isAdmin && <>
            <Button variant="outline" onClick={() => setPrioritizationOpen(true)} className="no-print rounded-none border-zinc-950 text-zinc-950 hover:bg-zinc-950 hover:text-white px-4 py-2.5 text-xs font-mono uppercase tracking-wider h-auto" aria-label="Configurar pesos da Fila de Ação"><SlidersHorizontal className="w-4 h-4 mr-2" />Configurações</Button>
            <label className="cursor-pointer bg-zinc-950 hover:bg-zinc-800 text-white px-5 py-2.5 text-xs font-mono uppercase tracking-wider flex items-center gap-2 transition-all"><Upload className="w-4 h-4" />{uploadStatusLabel}<input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} disabled={isUploading} /></label>
            <AlertDialog onOpenChange={(open) => { if (!open) setResetConfirmation(""); }}><AlertDialogTrigger asChild><Button variant="outline" className="rounded-none border-red-600 text-red-600 hover:bg-red-600 hover:text-white px-4 py-2.5 text-xs font-mono uppercase tracking-wider h-auto"><ShieldAlert className="w-4 h-4 mr-2" />Resetar importações</Button></AlertDialogTrigger><AlertDialogContent className="rounded-none border-2 border-red-600 bg-white"><AlertDialogHeader><AlertDialogTitle className="font-black uppercase tracking-tight text-red-700">Resetar todas as importações?</AlertDialogTitle><AlertDialogDescription className="font-mono text-xs leading-6 text-zinc-700">Esta ação excluirá permanentemente todos os uploads, itens cadastrados e o histórico de previsões da base de consulta. Não é possível desfazer esta operação.</AlertDialogDescription></AlertDialogHeader><div className="space-y-2"><label className="text-xs font-mono uppercase tracking-wider text-zinc-600">Digite RESETAR para confirmar</label><Input value={resetConfirmation} onChange={(event) => setResetConfirmation(event.target.value.toUpperCase())} placeholder="RESETAR" className="rounded-none border-zinc-900 font-mono" autoFocus /></div><AlertDialogFooter><AlertDialogCancel className="rounded-none border-zinc-900 font-mono text-xs uppercase">Cancelar</AlertDialogCancel><AlertDialogAction className="rounded-none bg-red-600 hover:bg-red-700 font-mono text-xs uppercase" disabled={resetConfirmation !== "RESETAR" || resetMutation.isPending} onClick={(event) => { event.preventDefault(); void handleResetImports(); }}>{resetMutation.isPending ? "Limpando..." : "Confirmar reset"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
          </>}
          {isAdmin ? <div className="flex items-center gap-3 border border-zinc-900 px-3 py-1.5 bg-zinc-50"><span className="text-xs font-mono"><strong>ADM</strong> · {user?.name || "giovani.martino"}</span><Button variant="ghost" size="sm" onClick={() => logout()} className="h-7 px-2 text-red-600 hover:bg-red-50"><LogOut className="w-3.5 h-3.5" /></Button></div> : <Dialog open={loginOpen} onOpenChange={setLoginOpen}><DialogTrigger asChild><Button variant="outline" size="sm" className="border-zinc-900 text-xs font-mono uppercase rounded-none">Entrar</Button></DialogTrigger><DialogContent className="rounded-none border-2 border-zinc-900 bg-white"><DialogHeader><DialogTitle className="font-black uppercase tracking-tight">Acesso administrativo</DialogTitle></DialogHeader><form onSubmit={handleAdminLogin} className="space-y-4"><div><label className="text-xs font-mono uppercase tracking-wider text-zinc-600">Usuário</label><Input value={adminUsername} onChange={(event) => setAdminUsername(event.target.value)} autoComplete="username" className="rounded-none border-zinc-900 font-mono mt-1" /></div><div><label className="text-xs font-mono uppercase tracking-wider text-zinc-600">Senha</label><Input value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} type="password" autoComplete="current-password" className="rounded-none border-zinc-900 font-mono mt-1" /></div><Button type="submit" disabled={localLoginMutation.isPending} className="w-full rounded-none bg-zinc-950 hover:bg-zinc-800 font-mono uppercase text-xs">{localLoginMutation.isPending ? "Validando..." : "Entrar como ADM"}</Button></form></DialogContent></Dialog>}

        </div>
      </header>
      {isAdmin && <PrioritizationSettingsDialog
        open={prioritizationOpen}
        onOpenChange={setPrioritizationOpen}
        weights={prioritizationWeights}
        isLoading={prioritizationSettingsQuery.isLoading}
        isSaving={updatePrioritizationMutation.isPending}
        isResetting={resetPrioritizationMutation.isPending}
        onSave={handleSavePrioritizationSettings}
        onReset={handleResetPrioritizationSettings}
      />}
      <Dialog open={selectedItemId !== null} onOpenChange={(open) => { if (!open) setSelectedItemId(null); }}>
        <ItemHistoryDialog detail={itemDetailQuery.data} isLoading={itemDetailQuery.isLoading} />
      </Dialog>

      <div className="sticky top-0 z-50 border-b border-zinc-900 bg-zinc-950 px-4 py-3 text-white shadow-lg shadow-zinc-950/20 no-print sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <nav aria-label="Navegação principal do controle de pedidos" className="flex max-w-full items-center gap-4 overflow-x-auto whitespace-nowrap text-xs font-mono uppercase tracking-wider md:gap-6">
            <button type="button" onClick={() => setActiveTab("active")} aria-current={activeTab === "active" ? "page" : undefined} className={`shrink-0 pb-1 border-b-2 transition-all ${activeTab === "active" ? "border-red-600 text-white font-bold" : "border-transparent text-zinc-400 hover:text-white"}`}>Dashboard Ativo</button>
            <button type="button" onClick={() => setActiveTab("delivered")} aria-current={activeTab === "delivered" ? "page" : undefined} className={`shrink-0 pb-1 border-b-2 transition-all ${activeTab === "delivered" ? "border-red-600 text-white font-bold" : "border-transparent text-zinc-400 hover:text-white"}`}>Itens Entregues ({deliveredItems.length})</button>
            <button type="button" onClick={handleOpenCompleteChangesReport} aria-current={activeTab === "report" ? "page" : undefined} className={`shrink-0 pb-1 border-b-2 transition-all ${activeTab === "report" ? "border-red-600 text-white font-bold" : "border-transparent text-zinc-400 hover:text-white"}`}>Relatório Gerencial</button>
            <button type="button" onClick={() => setActiveTab("historical")} aria-current={activeTab === "historical" ? "page" : undefined} className={`shrink-0 pb-1 border-b-2 transition-all ${activeTab === "historical" ? "border-red-600 text-white font-bold" : "border-transparent text-zinc-400 hover:text-white"}`}>Avaliação Histórica</button>
          </nav>
          <span className="hidden shrink-0 text-[10px] font-mono text-zinc-400 xl:block">Regra: Desaparecidos no upload mais recente são considerados entregues</span>
        </div>
      </div>

      <main className="print-report p-6 md:p-10 max-w-[1500px] mx-auto space-y-12">
        <div className="print-only-report">
          <div className="print-summary-header">
            <div>
              <p className="print-kicker">OPEN ORDER CONTROL / RELATÓRIO EXECUTIVO</p>
              <h2>Controle de previsões e exposição operacional</h2>
              <p className="print-summary-subtitle">Resumo para decisão baseado no último upload disponível e nos filtros aplicados.</p>
            </div>
            <div className="print-summary-meta">Base atualizada<br /><strong>{stats.latestUpload ? formatDateTime(stats.latestUpload.uploadDate) : "Sem upload"}</strong><br />Filial: <strong>{selectedShipTo || "Todas"}</strong></div>
          </div>

          <div className="print-kpi-grid">
            <div className="print-kpi"><span>Itens ativos</span><strong>{stats.totalItems}</strong><small>{stats.stableItems} sem alteração acumulada</small></div>
            <div className="print-kpi"><span>Estabilidade último ciclo</span><strong>{stabilityValue}</strong><small>{hasActivePortfolio ? `${stats.changedLastUpload} alterado(s) no último upload` : "Sem itens importados"}</small></div>
            <div className="print-kpi"><span>Valor total dos pedidos</span><strong>{formatCurrency(stats.totalOrderValue)}</strong><small>{stats.highPriorityItems} item(ns) com prioridade alta</small></div>
            <div className="print-kpi print-kpi-risk"><span>Índice de risco executivo</span><strong>{strategic.executiveRiskIndex}/100</strong><small>{strategic.riskLevel} · {formatCurrency(stats.valueAtRisk)} sob risco</small></div>
          </div>

          <div className="print-summary-grid">
            <section className="print-summary-panel print-summary-panel-dark">
              <p className="print-panel-kicker">CENTRO DE COMANDO</p>
              <div className="print-risk-row"><strong>{strategic.executiveRiskIndex}</strong><span>/100 · {strategic.riskLevel}</span></div>
              <div className="print-risk-track"><i style={{ width: `${Math.max(0, Math.min(100, strategic.executiveRiskIndex))}%` }} /></div>
              <p className="print-panel-note">Foco recomendado: <strong>{strategic.focus}</strong>. {strategic.focusNote}</p>
            </section>
            <section className="print-summary-panel">
              <p className="print-panel-kicker">SINAIS PARA DECISÃO</p>
              <div className="print-signal-row"><span>Alterações no último ciclo</span><strong>{stats.changedLastUpload} · {strategic.changeRate}%</strong></div>
              <div className="print-signal-row"><span>Previsões vencidas</span><strong>{stats.overdueItems} · {strategic.overdueRate}%</strong></div>
              <div className="print-signal-row"><span>Itens sem fornecedor</span><strong>{stats.noSupplier} · {strategic.supplierRate}%</strong></div>
              <div className="print-signal-row"><span>Alertas críticos / atenção</span><strong>{alertSummary.criticalCount} / {alertSummary.attentionCount}</strong></div>
            </section>
          </div>

          <section className="print-summary-panel print-summary-panel-table">
            <div className="print-section-heading"><div><p className="print-panel-kicker">PRESSÃO POR FILIAL</p><h3>Praças que concentram atenção</h3></div><span>{strategic.branches.length} filial(is) prioritária(s)</span></div>
            <table><thead><tr><th>Filial</th><th>Itens</th><th>Alterados</th><th>Vencidos</th><th>Sem fornecedor</th><th>Valor sob risco</th><th>Pressão</th></tr></thead><tbody>{strategic.branches.length === 0 ? <tr><td colSpan={7}>Nenhuma filial encontrada nos filtros atuais.</td></tr> : strategic.branches.map((branch) => <tr key={`print-branch-${branch.shipTo}`}><td><strong>{branch.shipTo}</strong></td><td>{branch.totalItems}</td><td>{branch.changedItems}</td><td>{branch.overdueItems}</td><td>{branch.noSupplier}</td><td>{formatCurrency(branch.valueAtRisk)}</td><td><strong>{branch.pressureScore}</strong></td></tr>)}</tbody></table>
          </section>

          <div className="print-summary-grid">
            <section className="print-summary-panel print-summary-panel-table">
              <div className="print-section-heading"><div><p className="print-panel-kicker">FILA DE AÇÃO</p><h3>Prioridades imediatas</h3></div><span>{stats.actionQueue.length} item(ns)</span></div>
              <table><thead><tr><th>Item / descrição</th><th>Previsão</th><th>Valor</th><th>Score</th></tr></thead><tbody>{stats.actionQueue.slice(0, 5).map((item) => <tr key={`print-action-${item.id}`}><td><strong>{item.item}</strong><br /><small>{item.itemDescription || "Sem descrição"}</small></td><td>{item.currentPrediction || "—"}</td><td>{formatCurrency(item.extendedPrice)}</td><td><strong>{item.riskScore}</strong></td></tr>)}</tbody></table>
            </section>
            <section className="print-summary-panel print-summary-panel-table">
              <div className="print-section-heading"><div><p className="print-panel-kicker">INSTABILIDADE</p><h3>Itens com mais alterações</h3></div><span>{changedItems.length} item(ns)</span></div>
              <table><thead><tr><th>Item / descrição</th><th>PO</th><th>Alterações</th></tr></thead><tbody>{changedItems.slice(0, 5).map((item) => <tr key={`print-change-${item.id}`}><td><strong>{item.item}</strong><br /><small>{item.itemDescription || "Sem descrição"}</small></td><td>{item.customerPo || "—"}</td><td><strong>{item.predictionChangesCount}x</strong></td></tr>)}</tbody></table>
            </section>
          </div>

          <div className="print-summary-footer"><span>Relatório executivo gerado pelo Open Order Control</span><span>Detalhamento operacional disponível na tela e no Excel</span></div>
        </div>
        <div className="screen-dashboard">
        {activeTab === "delivered" ? (
          <section className="space-y-6">
            <div className="border-b border-zinc-900 pb-4 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
              <div>
                <h2 className="text-sm font-mono uppercase tracking-wider text-zinc-500">Histórico de entrega</h2>
                <h3 className="text-2xl font-black tracking-tight mt-1">Itens entregues por ausência em upload recente</h3>
                <p className="text-xs font-mono text-zinc-500 mt-1">Itens que existiam no histórico e deixaram de figurar nas planilhas semanais mais recentes.</p>
              </div>
              <div className="w-full md:w-80 relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-zinc-400" />
                <Input placeholder="Buscar item entregue..." value={deliveredSearch} onChange={(e) => setDeliveredSearch(e.target.value)} className="pl-9 rounded-none border-zinc-900 font-mono text-xs bg-white" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 border border-zinc-900 bg-zinc-50">
              <div>
                <label className="text-xs font-mono uppercase text-zinc-500 block mb-1">Filial / Ship To</label>
                <select value={deliveredShipTo} onChange={(e) => setDeliveredShipTo(e.target.value)} className="h-10 w-full rounded-none border border-zinc-900 bg-white px-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-red-600">
                  <option value="">Todas as filiais</option>
                  {shipToOptions.map((st) => <option key={st} value={st}>{st}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-mono uppercase text-zinc-500 block mb-1">Item</label>
                <Input placeholder="Ex.: 0102-1543" value={deliveredItemFilter} onChange={(e) => setDeliveredItemFilter(e.target.value)} className="rounded-none border-zinc-900 font-mono text-xs bg-white" />
              </div>
              <div>
                <label className="text-xs font-mono uppercase text-zinc-500 block mb-1">Customer PO</label>
                <Input placeholder="Ex.: 133923E" value={deliveredPoFilter} onChange={(e) => setDeliveredPoFilter(e.target.value)} className="rounded-none border-zinc-900 font-mono text-xs bg-white" />
              </div>
            </div>

            <div className="border border-zinc-900 bg-white overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1300px]">
                <thead>
                  <tr className="border-b border-zinc-900 bg-zinc-50 text-xs font-mono uppercase tracking-wider">
                    <th className="p-4 border-r border-zinc-900">Filial solicitante</th>
                    <th className="p-4 border-r border-zinc-900">Item / descrição</th>
                    <th className="p-4 border-r border-zinc-900">Customer PO</th>
                    <th className="p-4 border-r border-zinc-900">Última previsão</th>
                    <th className="p-4 border-r border-zinc-900">Data de entrega</th>
                    <th className="p-4 border-r border-zinc-900 text-center">Quantidade</th>
                    <th className="p-4 border-r border-zinc-900 text-right">Valor estendido</th>
                    <th className="p-4 text-center">Histórico</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 text-sm font-mono">
                  {deliveredItems.length === 0 ? (
                    <tr><td colSpan={8} className="p-16 text-center text-zinc-500">Nenhum item entregue registrado com os filtros atuais.</td></tr>
                  ) : (
                    deliveredItems.map((row) => (
                      <tr key={row.id} className="hover:bg-zinc-50 align-top">
                        <td className="p-4 border-r border-zinc-200 font-bold text-xs">{row.shipTo}</td>
                        <td className="p-4 border-r border-zinc-200"><p className="font-bold">{row.item}</p><p className="text-xs text-zinc-500 mt-1 max-w-[260px]">{row.itemDescription || "Sem descrição"}</p></td>
                        <td className="p-4 border-r border-zinc-200">{row.customerPo || "—"}</td>
                        <td className="p-4 border-r border-zinc-200 text-zinc-600">{row.currentPrediction || "—"}</td>
                        <td className="p-4 border-r border-zinc-200 font-bold text-emerald-700">{row.deliveredAt ? formatDate(row.deliveredAt) : "—"}</td>
                        <td className="p-4 border-r border-zinc-200 text-center">{Number(row.quantity || 0).toLocaleString("pt-BR")}</td>
                        <td className="p-4 border-r border-zinc-200 text-right font-bold">{formatCurrency(row.extendedPrice)}</td>
                        <td className="p-4 text-center">
                          <Button variant="outline" size="sm" className="rounded-none border-zinc-900 text-xs font-mono h-8 hover:bg-zinc-950 hover:text-white" onClick={() => setSelectedItemId(row.id)}><History className="w-3.5 h-3.5 mr-1" /> Linha do tempo</Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <>
            {activeTab === "active" && <>
            <section>
            <div className="border-b border-zinc-900 pb-2 mb-6 flex justify-between items-end"><div><h2 className="text-sm font-mono uppercase tracking-wider text-zinc-500">01 / Visão executiva</h2><h3 className="text-2xl font-black tracking-tight mt-1">Onde a gestão deve concentrar atenção</h3></div><span className="text-xs font-mono text-zinc-400">Base atualizada: {stats.latestUpload ? formatDateTime(stats.latestUpload.uploadDate) : "sem upload"}</span></div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <MetricCard label="Itens ativos" value={String(stats.totalItems)} detail={`${stats.stableItems} sem alteração acumulada`} icon={<Package className="w-4 h-4" />} accent="red" />
              <MetricCard label="Estabilidade do último ciclo" value={stabilityValue} detail={stabilityDetail} icon={<Target className="w-4 h-4" />} accent="black" />
              <MetricCard label="Valor total dos pedidos" value={formatCurrency(stats.totalOrderValue)} detail={`${stats.highPriorityItems} itens com prioridade alta`} icon={<CircleDollarSign className="w-4 h-4" />} accent="black" />
              <MetricCard label="Valor sob risco acumulado" value={formatCurrency(stats.valueAtRisk)} detail={`${stats.riskRate}% dos itens tiveram alguma mudança`} icon={<ShieldAlert className="w-4 h-4" />} accent="red" />
            </div>
            <div className="mt-4">
              <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-2">Classificação da previsão atual · somente datas válidas entram em “Com prazo”</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MiniMetric label="Sem fornecedor" value={String(stats.noSupplier)} tone="amber" />
                <MiniMetric label="Obsoletos" value={String(stats.obsoleteItems)} tone="red" />
                <MiniMetric label="Sem prazo" value={String(stats.noDeadlineItems)} tone="amber" />
                <MiniMetric label="Com prazo" value={String(stats.withDeadlineItems)} tone="emerald" />
              </div>
            </div>
          </section>

        <section className="space-y-4">
          <div className="border-b border-zinc-900 pb-2 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
              <h2 className="text-sm font-mono uppercase tracking-wider text-zinc-500">01A / Centro de comando estratégico</h2>
              <h3 className="text-xl font-black tracking-tight mt-1">O que merece decisão nesta semana</h3>
              <p className="text-xs font-mono text-zinc-500 mt-1 leading-5">Índice composto por instabilidade, vencimento, disponibilidade de fornecedor, prioridade e exposição financeira. <span className="text-zinc-700 dark-mode:text-zinc-300">Fórmula:<br />min(100, 35% × instabilidade + 25% × vencimento + 20% × sem fornecedor + 10% × prioridade + 10% × exposição financeira).</span></p>
            </div>
            <Badge className={`rounded-none font-mono ${strategic.riskLevel === "CRÍTICO" ? "bg-red-600 text-white" : strategic.riskLevel === "ATENÇÃO" ? "bg-amber-500 text-zinc-950" : "bg-zinc-950 text-white"}`}>{strategic.riskLevel} · {strategic.executiveRiskIndex}/100</Badge>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[0.8fr_1.2fr_1fr] gap-4">
            <div className="border-2 border-zinc-950 bg-zinc-950 text-white p-6 flex flex-col justify-between min-h-[220px]">
              <div className="flex justify-between items-start"><div><span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">Índice de risco executivo</span><p className="text-xs font-mono text-zinc-400 mt-2">0 = controlado · 100 = crítico</p></div><ShieldAlert className="w-5 h-5 text-red-500" /></div>
              <div><div className="flex items-end gap-2"><span className="text-6xl font-black tracking-tighter text-red-500">{strategic.executiveRiskIndex}</span><span className="text-sm font-mono text-zinc-400 pb-2">/100</span></div><div className="h-3 bg-zinc-800 mt-4 overflow-hidden"><div className="h-full bg-red-600 transition-all" style={{ width: `${Math.max(strategic.executiveRiskIndex, 3)}%` }} /></div><p className="text-xs font-mono text-zinc-300 mt-3">{strategic.riskLevel === "CONTROLADO" ? "A carteira pode seguir em acompanhamento regular." : "A carteira requer pauta executiva e responsável definido."}</p></div>
            </div>

            <div className="border border-zinc-900 bg-white p-6 flex flex-col justify-between min-h-[220px]">
              <div className="flex justify-between items-start"><div><span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Decisão recomendada</span><h4 className="text-2xl font-black tracking-tight mt-2">{strategic.focus}</h4></div><Target className="w-5 h-5 text-red-600" /></div>
              <div><p className="text-sm font-mono text-zinc-700 leading-6 border-l-4 border-red-600 pl-4">{strategic.focusNote}</p><div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-5"><MiniMetric label="Alteração" value={`${strategic.changeRate}%`} tone="red" /><MiniMetric label="Vencido" value={`${strategic.overdueRate}%`} tone="amber" /><MiniMetric label="Fornecedor" value={`${strategic.supplierRate}%`} tone="amber" /><MiniMetric label="Exposição" value={`${strategic.financialExposureRate}%`} tone="black" /></div></div>
            </div>

            <div className="border border-zinc-900 bg-zinc-50 p-6 min-h-[220px]">
              <div className="flex justify-between items-start mb-5"><div><span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Prazos críticos por filial</span><h4 className="text-xl font-bold tracking-tight mt-1">Vencimentos e desvios</h4></div><AlertTriangle className="w-5 h-5 text-red-600" /></div>
              {strategic.branches.length === 0 ? <p className="text-xs font-mono text-zinc-500 py-10 text-center">Nenhuma filial disponível para análise.</p> : <div className="space-y-3">{strategic.branches.map((branch) => <div key={`crit-${branch.shipTo}`} className="p-3 bg-white border border-zinc-200"><div className="flex justify-between items-center text-xs font-mono mb-1"><span className="font-bold truncate max-w-[160px]" title={branch.shipTo}>{branch.shipTo}</span><Badge className="rounded-none bg-red-600 text-white font-mono text-[9px]">{branch.overdueItems} vencidos</Badge></div><div className="flex justify-between text-[10px] font-mono text-zinc-600"><span>{branch.changedItems} alterados</span><span className="font-bold text-red-700">{formatCurrency(branch.valueAtRisk)} sob risco</span></div></div>)}</div>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-zinc-900 bg-white p-6">
              <div className="flex justify-between items-start mb-4"><div><span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Projeção de impacto financeiro</span><h4 className="text-lg font-bold tracking-tight mt-1">Exposição monetária de prazos</h4></div><CircleDollarSign className="w-5 h-5 text-red-600" /></div>
              <div className="grid grid-cols-2 gap-4 my-4">
                <div className="border border-zinc-200 p-4 bg-zinc-50"><span className="text-[10px] font-mono uppercase text-zinc-500 block">Valor total</span><p className="text-xl font-black mt-1">{formatCurrency(stats.totalOrderValue)}</p></div>
                <div className="border border-red-200 p-4 bg-red-50/50"><span className="text-[10px] font-mono uppercase text-red-700 block">Valor sob risco</span><p className="text-xl font-black text-red-600 mt-1">{formatCurrency(stats.valueAtRisk)}</p></div>
              </div>
              <p className="text-xs font-mono text-zinc-600">Representa <b>{strategic.financialExposureRate}%</b> do valor total da carteira em itens que sofreram alterações de previsão de entrega.</p>
            </div>

            <div className="border border-zinc-900 bg-white p-6">
              <div className="flex justify-between items-start mb-4"><div><span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Resumo de pressão operacional</span><h4 className="text-lg font-bold tracking-tight mt-1">Distribuição de filiais críticas</h4></div><Target className="w-5 h-5 text-red-600" /></div>
              {strategic.branches.length === 0 ? <p className="text-xs font-mono text-zinc-500 py-6 text-center">Nenhuma filial para consolidar.</p> : <div className="space-y-3">{strategic.branches.map((branch) => { const maxPressure = Math.max(...strategic.branches.map((entry) => entry.pressureScore), 1); return <div key={`press-${branch.shipTo}`}><div className="flex justify-between gap-3 text-xs font-mono mb-1"><span className="font-bold truncate" title={branch.shipTo}>{branch.shipTo}</span><span className="text-red-600 font-black shrink-0">{branch.pressureScore} pts</span></div><div className="h-2 bg-zinc-100 border border-zinc-300 overflow-hidden"><div className="h-full bg-red-600" style={{ width: `${Math.max((branch.pressureScore / maxPressure) * 100, branch.pressureScore > 0 ? 8 : 2)}%` }} /></div><div className="flex justify-between text-[10px] font-mono text-zinc-500 mt-1"><span>{branch.totalItems} itens · {branch.changeRate}% alterados</span><span>{formatCurrency(branch.valueAtRisk)}</span></div></div>; })}</div>}
            </div>
          </div>
        </section>

        <section className="border-2 border-red-600 bg-red-50/30 p-6 space-y-5">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 border-b border-red-200 pb-4">
            <div>
              <h2 className="text-sm font-mono uppercase tracking-wider text-red-700">01A / Alertas de variação</h2>
              <h3 className="text-xl font-black tracking-tight mt-1">Itens que exigem revisão de prazo</h3>
              <p className="text-xs font-mono text-zinc-600 mt-1">O alerta é acionado quando a previsão muda acima do limite configurado, para mais ou para menos.</p>
            </div>
            <div className="flex items-end gap-2">
              <div>
                <label htmlFor="alert-threshold" className="block text-[10px] font-mono uppercase tracking-wider text-zinc-600 mb-1">Alertar acima de (dias)</label>
                <Input id="alert-threshold" type="number" min={1} max={3650} value={alertThresholdDraft} onChange={(event) => setAlertThresholdDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") applyAlertThreshold(); }} className="w-32 rounded-none border-zinc-900 bg-white font-mono" />
              </div>
              <Button type="button" onClick={applyAlertThreshold} className="rounded-none bg-zinc-950 text-white hover:bg-zinc-800 font-mono text-xs uppercase h-10">Aplicar</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-zinc-900 bg-white p-4 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Total de alertas</span>
                <p className="text-2xl font-black tracking-tight mt-1">{alertSummary.totalAlerts}</p>
              </div>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-100">
                <Badge className="rounded-none bg-red-600 text-white font-mono text-[10px]">{alertSummary.totalAlerts} ativos</Badge>
                {selectedShipTo && <span className="text-[10px] font-mono text-zinc-500 truncate" title={selectedShipTo}>Filial: {selectedShipTo}</span>}
              </div>
            </div>

            <div className="border border-zinc-900 bg-white p-4 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-red-700 font-bold">Críticos (&ge; {alertThresholdDays * 2}d)</span>
                  <span className="text-xs font-mono font-bold text-red-700">{alertSummary.criticalRatio}%</span>
                </div>
                <p className="text-2xl font-black tracking-tight mt-1 text-red-600">{alertSummary.criticalCount}</p>
              </div>
              <div className="w-full bg-zinc-100 h-2 mt-3 overflow-hidden">
                <div className="bg-red-600 h-full transition-all" style={{ width: `${alertSummary.criticalRatio}%` }} />
              </div>
            </div>

            <div className="border border-zinc-900 bg-white p-4 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-amber-700 font-bold">Atenção (&gt; {alertThresholdDays}d)</span>
                  <span className="text-xs font-mono font-bold text-amber-700">{alertSummary.attentionRatio}%</span>
                </div>
                <p className="text-2xl font-black tracking-tight mt-1 text-amber-600">{alertSummary.attentionCount}</p>
              </div>
              <div className="w-full bg-zinc-100 h-2 mt-3 overflow-hidden">
                <div className="bg-amber-500 h-full transition-all" style={{ width: `${alertSummary.attentionRatio}%` }} />
              </div>
            </div>
          </div>

          <div className="border border-zinc-900 bg-white p-4 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Proporção visual de severidade (Limiar: &gt; {alertThresholdDays} dias)</span>
              <span className="text-[10px] font-mono text-zinc-500">{alertSummary.totalAlerts === 0 ? "Nenhum alerta" : `${alertSummary.criticalCount} críticos / ${alertSummary.attentionCount} atenção`}</span>
            </div>
            {alertSummary.totalAlerts === 0 ? (
              <div className="h-6 bg-zinc-100 flex items-center justify-center text-[10px] font-mono text-zinc-500">
                Nenhum alerta ativo para o limiar atual
              </div>
            ) : (
              <div className="h-6 w-full flex border border-zinc-900 overflow-hidden">
                {alertSummary.criticalCount > 0 && (
                  <div className="bg-red-600 text-white text-[10px] font-mono font-bold flex items-center justify-center transition-all" style={{ width: `${Math.max(alertSummary.criticalRatio, 10)}%` }} title={`Críticos: ${alertSummary.criticalCount} (${alertSummary.criticalRatio}%)`}>
                    {alertSummary.criticalRatio}% Crítico
                  </div>
                )}
                {alertSummary.attentionCount > 0 && (
                  <div className="bg-amber-500 text-zinc-950 text-[10px] font-mono font-bold flex items-center justify-center transition-all" style={{ width: `${Math.max(alertSummary.attentionRatio, 10)}%` }} title={`Atenção: ${alertSummary.attentionCount} (${alertSummary.attentionRatio}%)`}>
                    {alertSummary.attentionRatio}% Atenção
                  </div>
                )}
              </div>
            )}

            <div className="pt-3 border-t border-zinc-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-600 font-bold">Tendência histórica de alertas críticos (&ge; {alertThresholdDays * 2} dias)</span>
                <span className="text-[10px] font-mono text-zinc-500">Por upload semanal</span>
              </div>
              {(() => {
                const trendData = alertsTrendQuery.data || [];
                const maxCritical = Math.max(...trendData.map(d => d.criticalCount), 1);
                return trendData.length === 0 ? (
                  <div className="h-28 bg-zinc-50 flex items-center justify-center text-[10px] font-mono text-zinc-500 border border-dashed border-zinc-300">
                    Nenhum histórico de upload disponível para tendência
                  </div>
                ) : (
                  <div className="flex items-end gap-3 h-32 bg-zinc-50 p-3 border border-zinc-900">
                    {trendData.map((entry) => {
                      const heightPct = Math.max((entry.criticalCount / maxCritical) * 80, entry.criticalCount > 0 ? 12 : 6);
                      return (
                        <div key={entry.uploadId} className="flex-1 h-full flex flex-col justify-end items-center gap-1 min-w-0" title={`Upload #${entry.uploadId} (${entry.fileName}): ${entry.criticalCount} críticos, ${entry.attentionCount} atenção`}>
                          <span className="text-[10px] font-mono font-bold text-red-600">{entry.criticalCount}</span>
                          <div className="w-full max-w-10 bg-red-600 transition-all" style={{ height: `${heightPct}%` }} />
                          <span className="text-[9px] font-mono text-zinc-600 truncate w-full text-center">{entry.uploadDate}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3"><Badge className="rounded-none bg-red-600 text-white font-mono">{alerts.length} alertas visíveis</Badge><span className="text-xs font-mono text-zinc-600">Limiar atual: &gt; {alertThresholdDays} dias</span>{selectedShipTo && <Badge className="rounded-none bg-zinc-950 text-white font-mono">Filial: {selectedShipTo}</Badge>}</div><div className="border border-zinc-900 bg-white overflow-x-auto"><table className="w-full min-w-[1050px] text-left border-collapse"><thead><tr className="border-b border-zinc-900 bg-zinc-950 text-white text-[10px] font-mono uppercase tracking-wider"><th className="p-3">Severidade</th><th className="p-3">Item / descrição</th><th className="p-3">Filial solicitante</th><th className="p-3">Customer PO</th><th className="p-3">Previsão anterior</th><th className="p-3">Previsão atual</th><th className="p-3 text-right">Variação</th><th className="p-3 text-center">Ação</th></tr></thead><tbody className="divide-y divide-zinc-200 text-xs font-mono">{alerts.length === 0 ? <tr><td colSpan={8} className="p-10 text-center text-zinc-500">Nenhum item ultrapassou o limiar de {alertThresholdDays} dias nesta filial.</td></tr> : (pdfMode === "detailed" ? alerts : alerts.slice(0, 20)).map((alert) => <tr key={alert.id} className={alert.severity === "CRÍTICO" ? "bg-red-50" : "bg-white hover:bg-amber-50"}><td className="p-3"><span className={`inline-flex px-2 py-1 text-[10px] font-bold ${riskClass(alert.severity)}`}>{alert.severity}</span><p className="text-[10px] text-zinc-500 mt-1">{alert.direction}</p></td><td className="p-3"><p className="font-bold">{alert.item}</p><p className="text-[10px] text-zinc-500 max-w-[190px] truncate" title={alert.itemDescription || ""}>{alert.itemDescription || "—"}</p></td><td className="p-3 max-w-[180px] truncate" title={alert.shipTo}>{alert.shipTo}</td><td className="p-3">{alert.customerPo || "—"}</td><td className="p-3 text-zinc-600">{alert.previousPrediction || "—"}</td><td className="p-3 font-bold text-red-700">{alert.currentPrediction || "—"}</td><td className="p-3 text-right font-black text-red-700">{alert.differenceDays > 0 ? "+" : ""}{alert.differenceDays} dias</td><td className="p-3 text-center"><Button type="button" variant="outline" size="sm" onClick={() => setSelectedItemId(alert.id)} className="rounded-none border-zinc-900 text-[10px] font-mono uppercase h-8">Ver histórico</Button></td></tr>)}</tbody></table></div>{alerts.length > 20 && <p className="text-[10px] font-mono text-zinc-600">Exibindo os 20 alertas de maior variação. Ajuste a filial ou o limiar para refinar a lista.</p>}</section>

        <section className="space-y-4"><div className="border-b border-zinc-900 pb-2 flex flex-col md:flex-row justify-between items-start md:items-end gap-4"><div><h2 className="text-sm font-mono uppercase tracking-wider text-zinc-500">01B / Consolidação por filial</h2><h3 className="text-xl font-bold tracking-tight">Filiais solicitantes e pressão operacional</h3><p className="text-xs font-mono text-zinc-500 mt-1">Cada linha do upload é consolidada pelo Endereço (Ship To). Clique em uma filial para segmentar todo o dashboard.</p></div><Badge className="rounded-none bg-zinc-950 text-white font-mono">{branchSummary.length} filiais</Badge></div><div className="border border-zinc-900 overflow-x-auto"><table className="w-full text-left border-collapse min-w-[980px]"><thead><tr className="border-b border-zinc-900 bg-zinc-50 text-xs font-mono uppercase tracking-wider"><th className="p-4">Filial solicitante / Endereço</th><th className="p-4 text-right">Itens</th><th className="p-4 text-right">Alterados</th><th className="p-4 text-right">Taxa de alteração</th><th className="p-4 text-right">Vencidos</th><th className="p-4 text-right">Sem fornecedor</th><th className="p-4 text-right">Valor sob risco</th><th className="p-4 text-center">Ação</th></tr></thead><tbody className="divide-y divide-zinc-200 text-sm font-mono">{branchSummary.length === 0 ? <tr><td colSpan={8} className="p-10 text-center text-zinc-500">Nenhuma filial identificada. Faça um upload para iniciar a consolidação.</td></tr> : branchSummary.map((branch) => <tr key={branch.shipTo} className={selectedShipTo === branch.shipTo ? "bg-red-50" : "hover:bg-zinc-50"}><td className="p-4 font-bold max-w-[300px] truncate" title={branch.shipTo}>{branch.shipTo}</td><td className="p-4 text-right">{branch.totalItems}</td><td className={`p-4 text-right font-bold ${branch.changedItems > 0 ? "text-red-600" : "text-zinc-500"}`}>{branch.changedItems}</td><td className="p-4 text-right">{branch.changeRate}%</td><td className={`p-4 text-right ${branch.overdueItems > 0 ? "text-red-600 font-bold" : "text-zinc-500"}`}>{branch.overdueItems}</td><td className={`p-4 text-right ${branch.noSupplier > 0 ? "text-amber-700 font-bold" : "text-zinc-500"}`}>{branch.noSupplier}</td><td className="p-4 text-right">{formatCurrency(branch.valueAtRisk)}</td><td className="p-4 text-center"><Button variant="outline" size="sm" className="rounded-none border-zinc-900 text-[10px] font-mono uppercase h-8" onClick={() => selectedShipTo === branch.shipTo ? clearShipToFilter() : setFilterShipTo(branch.shipTo)}>{selectedShipTo === branch.shipTo ? "Limpar" : "Filtrar"}</Button></td></tr>)}</tbody></table></div></section>

        <section className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-6">
          <div className="border border-zinc-900 p-6">
            <div className="flex justify-between items-start mb-6"><div><h2 className="text-sm font-mono uppercase tracking-wider text-zinc-500">02 / Tendência operacional</h2><h3 className="text-xl font-bold mt-1">Alterações detectadas por upload</h3></div><TrendingUp className="w-5 h-5 text-red-600" /></div>
            <div className="flex items-end gap-3 h-52 border-b border-zinc-900 pb-1">
              {stats.trend.length === 0 ? <p className="text-xs font-mono text-zinc-500 self-center">A tendência será formada após os uploads semanais.</p> : stats.trend.map((entry) => <div key={entry.id} className="flex-1 h-full flex flex-col justify-end items-center gap-2 min-w-0"><span className="text-[10px] font-mono text-red-600">{entry.changedRowsCount}</span><div className="w-full max-w-12 bg-red-600" style={{ height: `${Math.max((entry.changedRowsCount / maxTrendChanges) * 75, entry.changedRowsCount > 0 ? 8 : 2)}%` }} /><span className="text-[9px] font-mono text-zinc-500 truncate w-full text-center">{formatDate(entry.uploadDate)}</span></div>)}
            </div>
            <div className="flex justify-between mt-4 text-[10px] font-mono uppercase text-zinc-500"><span>Menor pressão</span><span>Maior pressão</span></div>
          </div>
          <div className="border border-zinc-900 p-6 bg-zinc-950 text-white">
            <div className="flex justify-between items-start mb-6"><div><h2 className="text-sm font-mono uppercase tracking-wider text-zinc-400">03 / Leitura gerencial</h2><h3 className="text-xl font-bold mt-1">Sinais para decisão</h3></div><Clock3 className="w-5 h-5 text-red-500" /></div>
            <div className="space-y-5 text-sm font-mono"><DecisionLine label="Estabilidade último upload" value={stabilityValue} note={hasActivePortfolio ? (stabilityRate !== null && stabilityRate >= 80 ? "controle" : "acompanhar") : "aguardando upload"} positive={hasActivePortfolio ? stabilityRate !== null && stabilityRate >= 80 : undefined} /><DecisionLine label="Itens vencidos" value={String(stats.overdueItems)} note={stats.overdueItems > 0 ? "ação imediata" : "sem ocorrência"} positive={stats.overdueItems === 0} /><DecisionLine label="Sem fornecedor" value={String(stats.noSupplier)} note={stats.noSupplier > 0 ? "cobrar abastecimento" : "regular"} positive={stats.noSupplier === 0} /><DecisionLine label="Alterações recentes" value={String(stats.changedLastUpload)} note={stats.changedLastUpload > 0 ? "revisar impacto" : "sem mudança"} positive={stats.changedLastUpload === 0} /></div>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
          <div className="border border-zinc-900 overflow-hidden">
            <div className="p-6 border-b border-zinc-900 flex justify-between items-end"><div><h2 className="text-sm font-mono uppercase tracking-wider text-zinc-500">04 / Fila de ação</h2><h3 className="text-xl font-bold mt-1">Prioridades para a próxima reunião</h3><p className="text-xs font-mono text-zinc-500 mt-1">Ordenada por instabilidade, vencimento, fornecedor, prioridade e impacto financeiro.</p></div><AlertTriangle className="w-5 h-5 text-red-600" /></div>
            <div className="px-6 pt-4"><ActionScoreHelp weights={prioritizationWeights} /></div>
            <div className="divide-y divide-zinc-200">{stats.actionQueue.length === 0 ? <p className="p-8 text-center text-xs font-mono text-zinc-500">Nenhum item requer ação imediata.</p> : (pdfMode === "detailed" ? stats.actionQueue : stats.actionQueue.slice(0, 7)).map((item) => <div key={item.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between hover:bg-red-50"><div className="min-w-0"><div className="flex items-center gap-2"><span className="font-bold font-mono">{item.item}</span><span className={`px-2 py-0.5 text-[10px] font-mono font-bold ${riskClass(item.riskLevel)}`}>{item.riskLevel}</span></div><p className="text-xs text-zinc-500 truncate max-w-[430px]">{item.itemDescription || "Sem descrição"} · PO {item.customerPo || "—"}</p><p className="text-[10px] font-mono text-red-700 mt-1">{item.reasons.join(" • ")}</p></div><div className="flex items-center gap-5 shrink-0 text-xs font-mono"><div><span className="text-zinc-500 block">Previsão</span><b>{item.currentPrediction || "—"}</b></div><div><span className="text-zinc-500 block">Valor</span><b>{formatCurrency(item.extendedPrice)}</b></div><div className="text-right"><span className="text-zinc-500 block">Score</span><b className="text-red-600">{item.riskScore}</b></div></div></div>)}</div>
          </div>
          <div className="border border-zinc-900 overflow-hidden">
            <div className="p-6 border-b border-zinc-900"><h2 className="text-sm font-mono uppercase tracking-wider text-zinc-500">05 / Instabilidade</h2><h3 className="text-xl font-bold mt-1">Top 10 itens ativos com mais alterações</h3><p className="text-xs font-mono text-zinc-500 mt-1">Empates na quantidade de alterações são ordenados pelo maior valor financeiro.</p></div>
            <div className="divide-y divide-zinc-200">{stats.mostChanged.length === 0 ? <p className="p-8 text-center text-xs font-mono text-zinc-500">Ainda não há itens ativos com alterações registradas.</p> : stats.mostChanged.map((item, index) => <div key={item.id} className="p-4 flex items-center gap-3"><span className="w-7 h-7 bg-zinc-950 text-white flex items-center justify-center text-xs font-bold">{String(index + 1).padStart(2, "0")}</span><div className="min-w-0 flex-1"><p className="font-bold font-mono truncate">{item.item}</p><p className="text-xs text-zinc-500 truncate">{item.customerPo || "Sem PO"} · {item.currentPrediction || "Sem previsão"}</p></div><div className="text-right"><p className="font-black text-red-600">{item.predictionChangesCount}x</p><p className="text-[10px] font-mono text-zinc-500">{formatCurrency(item.extendedPrice)}</p></div></div>)}</div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="border-b border-zinc-900 pb-2 flex flex-col md:flex-row justify-between items-start md:items-end gap-4"><div><h2 className="text-sm font-mono uppercase tracking-wider text-zinc-500">06 / Base operacional</h2><h3 className="text-xl font-bold tracking-tight">Itens, previsões e respectivas alterações</h3><p className="text-xs font-mono text-zinc-500 mt-1">Use os filtros para investigar a fila de ação e abrir o histórico completo.</p></div><div className="w-full md:w-auto flex flex-col sm:flex-row gap-2"><Button type="button" variant="outline" onClick={() => void handleExportOperationalBase(false)} className="rounded-none border-zinc-900 text-xs font-mono uppercase h-10 whitespace-nowrap"><Download className="w-4 h-4 mr-2" />Exportar Excel</Button><Button type="button" variant="outline" onClick={() => void handleExportOperationalBase(true)} className="rounded-none border-red-600 text-red-600 text-xs font-mono uppercase h-10 whitespace-nowrap hover:bg-red-600 hover:text-white"><Download className="w-4 h-4 mr-2" />Exportar alterados</Button><div className="w-full sm:w-80 relative"><Search className="absolute left-3 top-3 w-4 h-4 text-zinc-400" /><Input placeholder="Busca geral..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 rounded-none border-zinc-900 font-mono text-xs bg-white" /></div></div></div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 p-4 border border-zinc-900 bg-zinc-50"><div><label className="text-xs font-mono uppercase text-zinc-500 block mb-1">Filial solicitante / Ship To</label><select value={selectedShipTo} onChange={(e) => { const value = e.target.value.trim(); if (value) setFilterShipTo(value); else clearShipToFilter(); }} className="h-10 w-full rounded-none border border-zinc-900 bg-white px-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-red-600"><option value="">Todas as filiais</option>{shipToOptions.map((shipTo) => <option key={shipTo} value={shipTo}>{shipTo}</option>)}</select><div className="flex items-center justify-between gap-2 mt-2 min-h-5">{selectedShipTo ? <span className="text-[10px] font-mono text-zinc-500 truncate" title={selectedShipTo}>Filtro ativo: {selectedShipTo}</span> : <span className="text-[10px] font-mono text-zinc-400">Nenhuma filial selecionada</span>}{selectedShipTo && <button type="button" onClick={clearShipToFilter} className="text-[10px] font-mono uppercase text-red-600 hover:underline shrink-0">Limpar</button>}</div></div><div><label className="text-xs font-mono uppercase text-zinc-500 block mb-1">Item</label><Input placeholder="Ex.: 0102-1543" value={filterItem} onChange={(e) => setFilterItem(e.target.value)} className="rounded-none border-zinc-900 font-mono text-xs bg-white" /></div><div><label className="text-xs font-mono uppercase text-zinc-500 block mb-1">Customer PO</label><Input placeholder="Ex.: 133923E" value={filterPo} onChange={(e) => setFilterPo(e.target.value)} className="rounded-none border-zinc-900 font-mono text-xs bg-white" /></div><div><label className="text-xs font-mono uppercase text-zinc-500 block mb-1">Previsão atual</label><Input placeholder="Ex.: 2025-06" value={filterPrediction} onChange={(e) => setFilterPrediction(e.target.value)} className="rounded-none border-zinc-900 font-mono text-xs bg-white" /></div></div>
          <div className="border border-zinc-900 bg-white overflow-x-auto"><table className="w-full text-left border-collapse min-w-[1420px]"><thead><tr className="border-b border-zinc-900 bg-zinc-50 text-xs font-mono uppercase tracking-wider"><th className="p-4 border-r border-zinc-900">Filial solicitante</th><th className="p-4 border-r border-zinc-900">Item / descrição</th><th className="p-4 border-r border-zinc-900">Customer PO</th><th className="p-4 border-r border-zinc-900">Previsão anterior</th><th className="p-4 border-r border-zinc-900">Previsão atual</th><th className="p-4 border-r border-zinc-900">Último upload</th><th className="p-4 border-r border-zinc-900">Resumo de alterações</th><th className="p-4 border-r border-zinc-900">Última alteração</th><th className="p-4 border-r border-zinc-900 text-center">Total alterações</th><th className="p-4 text-center">Detalhes</th></tr></thead><tbody className="divide-y divide-zinc-200 text-sm font-mono">{items.length === 0 ? <tr><td colSpan={10} className="p-12 text-center text-zinc-500">Nenhum item encontrado.</td></tr> : items.map((row) => <tr key={row.id} className="hover:bg-zinc-50 align-top"><td className="p-4 border-r border-zinc-200"><p className="font-bold text-xs truncate max-w-[220px]" title={row.shipTo || "Sem filial informada"}>{row.shipTo || "Sem filial informada"}</p></td><td className="p-4 border-r border-zinc-200"><p className="font-bold">{row.item}</p><p className="text-xs text-zinc-500 mt-1 max-w-[240px]">{row.itemDescription || "Sem descrição"}</p></td><td className="p-4 border-r border-zinc-200">{row.customerPo || "—"}</td><td className="p-4 border-r border-zinc-200 text-zinc-500">{row.previousPrediction || "Primeiro registro"}</td><td className="p-4 border-r border-zinc-200"><span className="font-bold text-red-600">{row.currentPrediction || "Sem previsão"}</span></td><td className="p-4 border-r border-zinc-200"><p>{formatDate(row.lastUploadDate)}</p><p className="text-[10px] text-zinc-500 mt-1 truncate max-w-[180px]" title={row.lastUploadFileName || "Sem arquivo"}>{row.lastUploadFileName || "Sem arquivo"}</p></td><td className="p-4 border-r border-zinc-200"><p className={`font-bold ${row.predictionChangesCount > 0 ? "text-red-600" : "text-zinc-500"}`}>{row.predictionChangesCount > 0 ? `${row.predictionChangesCount} alteração(ões) acumulada(s)` : "Sem alteração registrada"}</p><p className="text-[10px] text-zinc-500 mt-1">Anterior: {row.previousPrediction || "Primeiro registro"}</p></td><td className="p-4 border-r border-zinc-200"><p>{row.predictionChangesCount > 0 ? formatDate(row.lastPredictionChangeDate) : "Sem alteração"}</p><p className="text-[10px] text-zinc-500 mt-1">Registro: {formatDate(row.updatedAt)}</p></td><td className="p-4 border-r border-zinc-200 text-center"><span className={`inline-block px-3 py-1 text-xs font-bold border ${row.predictionChangesCount > 0 ? "bg-red-100 text-red-700 border-red-200" : "bg-zinc-100 text-zinc-700 border-zinc-200"}`}>{row.predictionChangesCount}x</span></td><td className="p-4 text-center"><Button variant="outline" size="sm" className="rounded-none border-zinc-900 text-xs font-mono h-8 hover:bg-zinc-950 hover:text-white" onClick={() => setSelectedItemId(row.id)}><History className="w-3.5 h-3.5 mr-1" /> Ver histórico</Button></td></tr>)}</tbody></table></div>
        </section>
            </>}

        {activeTab === "report" && <section id="relatorio-gerencial" className="space-y-4 scroll-mt-6">
          <div className="border-b border-zinc-900 pb-2 flex flex-col md:flex-row justify-between items-start md:items-end gap-4"><div><h2 className="text-sm font-mono uppercase tracking-wider text-zinc-500">Relatório gerencial</h2><h3 className="text-xl font-bold tracking-tight">Alterações por filial e período</h3><p className="text-xs font-mono text-zinc-500 mt-1">Audite cada mudança de previsão com datas, variação, origem e informações completas do item.</p></div><Button type="button" variant="outline" onClick={handleExportCompleteChangesReport} className="rounded-none border-zinc-900 text-xs font-mono uppercase h-10 whitespace-nowrap"><Download className="w-4 h-4 mr-2" />Exportar relatório</Button></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 border border-zinc-900 bg-zinc-50 p-4"><div><label className="text-xs font-mono uppercase text-zinc-500 block mb-1">Filial solicitante</label><select value={reportShipTo} onChange={(event) => setReportShipTo(event.target.value)} className="h-10 w-full rounded-none border border-zinc-900 bg-white px-3 text-xs font-mono"><option value="">Todas as filiais</option>{shipToOptions.map((shipTo) => <option key={`report-${shipTo}`} value={shipTo}>{shipTo}</option>)}</select></div><div><label className="text-xs font-mono uppercase text-zinc-500 block mb-1">Data inicial da alteração</label><Input type="date" value={reportStartDate} onChange={(event) => setReportStartDate(event.target.value)} className="rounded-none border-zinc-900 font-mono text-xs bg-white" /></div><div><label className="text-xs font-mono uppercase text-zinc-500 block mb-1">Data final da alteração</label><Input type="date" value={reportEndDate} onChange={(event) => setReportEndDate(event.target.value)} className="rounded-none border-zinc-900 font-mono text-xs bg-white" /></div><div className="flex items-end"><Button type="button" variant="outline" onClick={() => { setReportShipTo(""); setReportStartDate(""); setReportEndDate(""); }} className="w-full rounded-none border-zinc-900 text-xs font-mono uppercase h-10">Limpar filtros</Button></div></div>
          <div className={`border p-4 ${lifecycleTheme.panel}`}>
            <div className={`flex flex-col gap-3 border-b pb-3 mb-4 md:flex-row md:items-end md:justify-between ${lifecycleTheme.divider}`}>
              <div><p className={`text-[10px] font-mono uppercase tracking-widest ${lifecycleTheme.subdued}`}>Ciclo de vida dos pedidos</p><h4 className="text-lg font-bold tracking-tight">Abertura, finalização e pedidos em aberto por mês</h4><p className={`text-[10px] font-mono mt-1 ${lifecycleTheme.subdued}`}>A Data de criação representa a entrada do pedido no sistema. O fechamento é identificado quando o item deixa de constar em uma carga posterior.</p></div>
              <p className={`text-[10px] font-mono ${lifecycleTheme.subdued}`}>Referência de vida: {formatDate(lifecycleAnalysis.referenceDate)}</p>
            </div>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <div className={`border p-3 ${lifecycleTheme.neutralCard}`}><p className={`text-[10px] font-mono uppercase ${lifecycleTheme.subdued}`}>Itens alterados</p><p className="text-2xl font-black mt-1">{changedItemsInReport}</p><p className={`text-[10px] font-mono mt-1 ${lifecycleTheme.subdued}`}>Pedidos únicos exibidos na tabela final</p></div>
              <div className={`border p-3 ${lifecycleTheme.successCard}`}><p className={`text-[10px] font-mono uppercase ${lifecycleTheme.successText}`}>Finalizados no mês</p><p className={`text-2xl font-black mt-1 ${lifecycleTheme.successText}`}>{lifecycleAnalysis.summary.closedSameMonth}</p><p className={`text-[10px] font-mono mt-1 ${lifecycleTheme.successDetail}`}>Encerrados no mês de abertura</p></div>
              <div className={`border p-3 ${lifecycleTheme.riskCard}`}><p className={`text-[10px] font-mono uppercase ${lifecycleTheme.riskText}`}>Pedidos em aberto</p><p className={`text-2xl font-black mt-1 ${lifecycleTheme.riskText}`}>{lifecycleAnalysis.summary.openOrders}</p><p className={`text-[10px] font-mono mt-1 ${lifecycleTheme.riskDetail}`}>Ainda sem encerramento</p></div>
              <div className={`border p-3 ${lifecycleTheme.agingCard}`}><p className={`text-[10px] font-mono uppercase ${lifecycleTheme.agingText}`}>Vida média</p><p className={`text-2xl font-black mt-1 ${lifecycleTheme.agingText}`}>{lifecycleAnalysis.summary.averageLifeDays === null ? "—" : `${lifecycleAnalysis.summary.averageLifeDays}d`}</p><p className={`text-[10px] font-mono mt-1 ${lifecycleTheme.agingDetail}`}>Até fechamento ou referência</p></div>
            </div>
            <div className={`mt-5 border-t pt-4 ${lifecycleTheme.divider}`}>
              <div className="flex items-baseline justify-between gap-3 mb-3"><div><p className={`text-[10px] font-mono uppercase tracking-widest ${lifecycleTheme.subdued}`}>Evolução mensal</p><h5 className="text-sm font-bold">Pedidos por mês de entrada</h5></div><span className={`text-[10px] font-mono ${lifecycleTheme.subdued}`}>Quantidade de pedidos</span></div>
              {lifecycleChartData.length === 0 ? <p className={`h-[220px] flex items-center justify-center text-xs font-mono ${lifecycleTheme.subdued}`}>Nenhum pedido com Data de criação válida para o intervalo selecionado.</p> : <ChartContainer aria-label="Gráfico mensal de abertura e finalização de pedidos" config={lifecycleChartConfig} className="h-[220px] w-full aspect-auto"><BarChart data={lifecycleChartData} margin={{ top: 20, right: 12, left: -12, bottom: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 3" stroke={lifecycleTheme.gridStroke} /><XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} className={`${lifecycleTheme.axisClass} font-mono text-[10px]`} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} width={30} className={`${lifecycleTheme.axisClass} font-mono text-[10px]`} /><ChartTooltip cursor={{ fill: lifecycleTheme.tooltipCursor }} content={<ChartTooltipContent />} /><Bar dataKey="abertos" fill="var(--color-abertos)" radius={[2, 2, 0, 0]} maxBarSize={42} /><Bar dataKey="finalizados" fill="var(--color-finalizados)" radius={[2, 2, 0, 0]} maxBarSize={42} /><Bar dataKey="pendentes" fill="var(--color-pendentes)" radius={[2, 2, 0, 0]} maxBarSize={42} /></BarChart></ChartContainer>}
            </div>
            {lifecycleAnalysis.summary.withoutCreationDate > 0 && <p className={`mt-3 text-[10px] font-mono ${lifecycleTheme.subdued}`}>{lifecycleAnalysis.summary.withoutCreationDate} pedido(s) não entrou(ram) na análise por não possuir(em) Data de criação válida.</p>}
          </div>
          <div className="border border-zinc-900 bg-white p-4">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2 border-b border-zinc-200 pb-3 mb-3">
              <div><p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Envelhecimento das pendências</p><h4 className="text-base font-bold tracking-tight">Pendências ativas com alteração no período</h4></div>
              <div className="border border-zinc-900 bg-white px-3 py-2 text-right"><p className="text-[9px] font-mono uppercase tracking-wider text-zinc-500">Tempo médio de vida</p><p className="text-lg leading-none font-black text-zinc-950 mt-1">{pendingAging.averageAgeInDays === null ? "—" : `${pendingAging.averageAgeInDays} dias`}</p><p className="text-[9px] font-mono text-zinc-500 mt-1">Referência: {formatDate(reportReferenceDate)} · {pendingAging.itemsWithCreationDate} item(ns) com data válida</p></div>
            </div>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="border border-emerald-200 bg-emerald-50 p-3"><p className="text-[10px] font-mono uppercase text-emerald-800">Até 30 dias</p><p className="text-2xl font-black text-emerald-700 mt-1">{pendingAging.upTo30}</p><p className="text-[10px] font-mono text-emerald-800 mt-1">Pendências recentes</p></div>
              <div className="border border-amber-200 bg-amber-50 p-3"><p className="text-[10px] font-mono uppercase text-amber-800">31–60 dias</p><p className="text-2xl font-black text-amber-700 mt-1">{pendingAging.from31To60}</p><p className="text-[10px] font-mono text-amber-800 mt-1">Acompanhamento</p></div>
              <div className="border border-orange-200 bg-orange-50 p-3"><p className="text-[10px] font-mono uppercase text-orange-800">61–90 dias</p><p className="text-2xl font-black text-orange-700 mt-1">{pendingAging.from61To90}</p><p className="text-[10px] font-mono text-orange-800 mt-1">Atenção reforçada</p></div>
              <div className="border border-red-300 bg-red-50 p-3"><p className="text-[10px] font-mono uppercase text-red-800">Acima de 90 dias</p><p className="text-2xl font-black text-red-700 mt-1">{pendingAging.above90}</p><p className="text-[10px] font-mono text-red-800 mt-1">Pendências críticas</p></div>
            </div>
            <div className="mt-5 border-t border-zinc-200 pt-4">
              <div className="flex items-baseline justify-between gap-3 mb-3"><div><p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Distribuição por faixa</p><h5 className="text-sm font-bold">Dias pendentes por item ativo</h5></div><span className="text-[10px] font-mono text-zinc-500">Quantidade de itens</span></div>
              <ChartContainer aria-label="Gráfico de colunas da distribuição de dias pendentes" config={pendingAgingChartConfig} className="h-[220px] w-full aspect-auto">
                <BarChart data={pendingAgingChartData} margin={{ top: 20, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="range" tickLine={false} axisLine={false} tickMargin={10} className="font-mono text-[10px]" />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={30} className="font-mono text-[10px]" />
                  <ChartTooltip cursor={{ fill: "rgba(24, 24, 27, 0.06)" }} content={<ChartTooltipContent hideLabel />} />
                  <Bar dataKey="items" radius={[2, 2, 0, 0]} maxBarSize={68}>
                    <LabelList dataKey="items" position="top" className="fill-zinc-700 font-mono text-[10px]" />
                    {pendingAgingChartData.map((entry) => <Cell key={entry.range} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </div>
            {pendingAging.withoutCreationDate > 0 && <p className="text-[10px] font-mono text-zinc-500 mt-3">{pendingAging.withoutCreationDate} item(ns) não entrou(ram) nas faixas por não possuir(em) Data de criação válida.</p>}
          </div>
          <div className="flex flex-wrap items-center gap-3"><Badge className="rounded-none bg-zinc-950 text-white font-mono">{completeChangesReport.length} item(ns) alterado(s)</Badge><Badge variant="outline" className="rounded-none border-red-600 text-red-700 font-mono">{changeEventsInReport} alteração(ões) histórica(s)</Badge>{reportShipTo && <Badge className="rounded-none bg-red-600 text-white font-mono">Filial: {reportShipTo}</Badge>}{(reportStartDate || reportEndDate) && <span className="text-[10px] font-mono text-zinc-500">Período: {formatDate(reportStartDate)} até {formatDate(reportEndDate)}</span>}</div>
          <div className="border border-zinc-900 bg-white">
            <table aria-label="Itens alterados do relatório gerencial" className="w-full table-fixed text-left border-collapse">
              <colgroup>
                <col className="w-[9%]" />
                <col className="w-[10%]" />
                <col className="w-[16%]" />
                <col className="w-[9%]" />
                <col className="w-[9%]" />
                <col className="w-[9%]" />
                <col className="w-[9%]" />
                <col className="w-[10%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[11%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-zinc-900 bg-zinc-950 text-white text-[10px] font-mono uppercase tracking-wider">
                  <th className="p-2">Última alteração</th>
                  <th className="p-2">Filial</th>
                  <th className="p-2">Item / descrição</th>
                  <th className="p-2">PO</th>
                  <th className="p-2">De</th>
                  <th className="p-2">Para</th>
                  <th className="p-2 text-right">Variação</th>
                  <th className="p-2">Direção</th>
                  <th className="p-2 text-right">Quantidade</th>
                  <th className="p-2 text-right">Valor total</th>
                  <th className="p-2 text-center">Histórico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-xs font-mono">
                {completeChangesReportQuery.isLoading ? (
                  <tr><td colSpan={11} className="p-10 text-center text-zinc-500">Carregando alterações...</td></tr>
                ) : completeChangesReport.length === 0 ? (
                  <tr><td colSpan={11} className="p-10 text-center text-zinc-500">Nenhuma alteração de previsão encontrada para os filtros selecionados.</td></tr>
                ) : completeChangesReport.map((row) => (
                  <tr key={row.historyId} className="hover:bg-red-50 align-top">
                    <td className="p-2 whitespace-nowrap"><p className="font-bold">{formatDate(row.changedAt)}</p><p className="text-[10px] text-zinc-500">{formatDateTime(row.changedAt).split(", ")[1] || ""}</p></td>
                    <td className="p-2 truncate" title={row.shipTo}>{row.shipTo}</td>
                    <td className="p-2"><p className="font-bold truncate">{row.item}</p><p className="text-[10px] text-zinc-500 truncate" title={row.itemDescription || ""}>{row.itemDescription || "Sem descrição"}</p><p className="text-[9px] font-bold text-red-700 mt-1">{row.changesInPeriod ?? changeEventsByItem.get(row.orderItemId) ?? 0} {(row.changesInPeriod ?? changeEventsByItem.get(row.orderItemId) ?? 0) === 1 ? "alteração no período" : "alterações no período"}</p></td>
                    <td className="p-2 truncate" title={row.customerPo || ""}>{row.customerPo || "—"}</td>
                    <td className="p-2 truncate text-zinc-600" title={formatPrediction(row.previousPrediction)}>{formatPrediction(row.previousPrediction)}</td>
                    <td className="p-2 truncate font-bold text-red-700" title={formatPrediction(row.currentPredictionAtChange)}>{formatPrediction(row.currentPredictionAtChange)}</td>
                    <td className={`p-2 text-right font-bold whitespace-nowrap ${row.differenceDays !== null && row.differenceDays > 0 ? "text-red-700" : "text-zinc-700"}`}>{row.differenceDays === null ? "—" : `${row.differenceDays > 0 ? "+" : ""}${row.differenceDays}d`}</td>
                    <td className="p-2"><Badge className={`rounded-none text-[9px] ${row.direction === "ADIAMENTO" ? "bg-red-600 text-white" : row.direction === "ANTECIPAÇÃO" ? "bg-emerald-600 text-white" : "bg-zinc-200 text-zinc-800"}`}>{row.direction}</Badge></td>
                    <td className="p-2 text-right truncate">{row.quantity ?? "—"}</td>
                    <td className="p-2 text-right whitespace-nowrap">{formatCurrency(row.extendedPrice)}</td>
                    <td className="p-2 text-center"><Button variant="outline" size="sm" onClick={() => setSelectedItemId(row.orderItemId)} className="rounded-none border-zinc-900 text-[9px] font-mono h-7 px-2">Histórico</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>}

        {activeTab === "historical" && <section id="avaliacao-historica" className="space-y-4 scroll-mt-6">
          <div className="border-b border-zinc-900 pb-2 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div><h2 className="text-sm font-mono uppercase tracking-wider text-zinc-500">Avaliação histórica</h2><h3 className="text-xl font-bold tracking-tight">Comportamento temporal das cargas</h3><p className="text-xs font-mono text-zinc-500 mt-1">A Data de criação representa a abertura do pedido. A ausência na carga seguinte registra a entrega na data desse upload.</p></div>
            <Badge className="rounded-none bg-zinc-950 text-white font-mono">{historicalAssessment.summary.uploads} carga(s) no período</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 border border-zinc-900 bg-zinc-50 p-4">
            <div><label className="text-xs font-mono uppercase text-zinc-500 block mb-1">Filial solicitante</label><select value={reportShipTo} onChange={(event) => setReportShipTo(event.target.value)} className="h-10 w-full rounded-none border border-zinc-900 bg-white px-3 text-xs font-mono"><option value="">Todas as filiais</option>{shipToOptions.map((shipTo) => <option key={`historical-${shipTo}`} value={shipTo}>{shipTo}</option>)}</select></div>
            <div><label className="text-xs font-mono uppercase text-zinc-500 block mb-1">Data inicial da carga</label><Input type="date" value={reportStartDate} onChange={(event) => setReportStartDate(event.target.value)} className="rounded-none border-zinc-900 font-mono text-xs bg-white" /></div>
            <div><label className="text-xs font-mono uppercase text-zinc-500 block mb-1">Data final da carga</label><Input type="date" value={reportEndDate} onChange={(event) => setReportEndDate(event.target.value)} className="rounded-none border-zinc-900 font-mono text-xs bg-white" /></div>
            <div className="flex items-end"><Button type="button" variant="outline" onClick={() => { setReportShipTo(""); setReportStartDate(""); setReportEndDate(""); }} className="w-full rounded-none border-zinc-900 text-xs font-mono uppercase h-10">Limpar filtros</Button></div>
          </div>
          <div className="grid grid-cols-2 xl:grid-cols-6 gap-3">
            <div className="border border-zinc-900 bg-zinc-950 text-white p-4"><p className="text-[10px] font-mono uppercase text-zinc-400">Cargas</p><p className="text-3xl font-black mt-1">{historicalAssessment.summary.uploads}</p><p className="text-[10px] font-mono text-zinc-400 mt-1">Uploads realizados</p></div>
            <div className="border border-zinc-200 bg-white p-4"><p className="text-[10px] font-mono uppercase text-zinc-500">Filiais</p><p className="text-3xl font-black mt-1">{historicalAssessment.summary.branches}</p><p className="text-[10px] font-mono text-zinc-500 mt-1">Com registros no período</p></div>
            <div className="border border-zinc-200 bg-white p-4"><p className="text-[10px] font-mono uppercase text-zinc-500">Pedidos únicos</p><p className="text-3xl font-black mt-1">{historicalAssessment.summary.itemsRecorded}</p><p className="text-[10px] font-mono text-zinc-500 mt-1">Contados na primeira carga</p></div>
            <div className="border border-red-200 bg-red-50 p-4"><p className="text-[10px] font-mono uppercase text-red-700">Alterações</p><p className="text-3xl font-black mt-1 text-red-700">{historicalAssessment.summary.changeEvents}</p><p className="text-[10px] font-mono text-red-700 mt-1">Mudanças de previsão</p></div>
            <div className="border border-emerald-200 bg-emerald-50 p-4"><p className="text-[10px] font-mono uppercase text-emerald-800">Entregues</p><p className="text-3xl font-black mt-1 text-emerald-800">{historicalAssessment.summary.deliveredItems}</p><p className="text-[10px] font-mono text-emerald-800 mt-1">Ausentes na carga seguinte</p></div>
            <div className="border border-amber-200 bg-amber-50 p-4"><p className="text-[10px] font-mono uppercase text-amber-800">Tempo efetivo médio</p><p className="text-3xl font-black mt-1 text-amber-800">{historicalAssessment.summary.averageDeliveryLeadDays === null ? "—" : `${historicalAssessment.summary.averageDeliveryLeadDays}d`}</p><p className="text-[10px] font-mono text-amber-800 mt-1">Criação até entrega identificada</p></div>
          </div>
          <div className={`border p-4 ${lifecycleTheme.panel}`}>
            <div className={`flex flex-col gap-3 border-b pb-3 mb-4 md:flex-row md:items-end md:justify-between ${lifecycleTheme.divider}`}>
              <div><p className={`text-[10px] font-mono uppercase tracking-widest ${lifecycleTheme.subdued}`}>Ciclo de vida completo</p><h4 className="text-lg font-bold tracking-tight">Abertura, finalização e pedidos em aberto por mês</h4><p className={`text-[10px] font-mono mt-1 ${lifecycleTheme.subdued}`}>Inclui todos os itens que passaram pelo sistema, tanto os ativos quanto os já entregues.</p></div>
              <p className={`text-[10px] font-mono ${lifecycleTheme.subdued}`}>Referência de vida: {formatDate(historicalLifecycle.referenceDate)}</p>
            </div>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <div className={`border p-3 ${lifecycleTheme.neutralCard}`}><p className={`text-[10px] font-mono uppercase ${lifecycleTheme.subdued}`}>Pedidos efetuados</p><p className="text-2xl font-black mt-1">{historicalLifecycle.summary.openedOrders}</p><p className={`text-[10px] font-mono mt-1 ${lifecycleTheme.subdued}`}>Abertos no intervalo</p></div>
              <div className={`border p-3 ${lifecycleTheme.successCard}`}><p className={`text-[10px] font-mono uppercase ${lifecycleTheme.successText}`}>Finalizados no mês</p><p className={`text-2xl font-black mt-1 ${lifecycleTheme.successText}`}>{historicalLifecycle.summary.closedSameMonth}</p><p className={`text-[10px] font-mono mt-1 ${lifecycleTheme.successDetail}`}>Encerrados no mês de abertura</p></div>
              <div className={`border p-3 ${lifecycleTheme.riskCard}`}><p className={`text-[10px] font-mono uppercase ${lifecycleTheme.riskText}`}>Pedidos em aberto</p><p className={`text-2xl font-black mt-1 ${lifecycleTheme.riskText}`}>{historicalLifecycle.summary.openOrders}</p><p className={`text-[10px] font-mono mt-1 ${lifecycleTheme.riskDetail}`}>Ainda sem encerramento</p></div>
              <div className={`border p-3 ${lifecycleTheme.agingCard}`}><p className={`text-[10px] font-mono uppercase ${lifecycleTheme.agingText}`}>Vida média</p><p className={`text-2xl font-black mt-1 ${lifecycleTheme.agingText}`}>{historicalLifecycle.summary.averageLifeDays === null ? "—" : `${historicalLifecycle.summary.averageLifeDays}d`}</p><p className={`text-[10px] font-mono mt-1 ${lifecycleTheme.agingDetail}`}>Até fechamento ou referência</p></div>
            </div>
            <div className={`mt-5 border-t pt-4 ${lifecycleTheme.divider}`}>
              <div className="flex items-baseline justify-between gap-3 mb-3"><div><p className={`text-[10px] font-mono uppercase tracking-widest ${lifecycleTheme.subdued}`}>Evolução mensal</p><h5 className="text-sm font-bold">Pedidos por mês de entrada</h5></div><span className={`text-[10px] font-mono ${lifecycleTheme.subdued}`}>Quantidade de pedidos</span></div>
              {historicalLifecycleQuery.isLoading ? <p className={`h-[220px] flex items-center justify-center text-xs font-mono ${lifecycleTheme.subdued}`}>Carregando ciclo de vida histórico...</p> : historicalLifecycleChartData.length === 0 ? <p className={`h-[220px] flex items-center justify-center text-xs font-mono ${lifecycleTheme.subdued}`}>Nenhum pedido com Data de criação válida para o intervalo selecionado.</p> : <ChartContainer aria-label="Gráfico mensal completo de abertura e finalização de pedidos" config={lifecycleChartConfig} className="h-[220px] w-full aspect-auto"><BarChart data={historicalLifecycleChartData} margin={{ top: 20, right: 12, left: -12, bottom: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 3" stroke={lifecycleTheme.gridStroke} /><XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} className={`${lifecycleTheme.axisClass} font-mono text-[10px]`} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} width={30} className={`${lifecycleTheme.axisClass} font-mono text-[10px]`} /><ChartTooltip cursor={{ fill: lifecycleTheme.tooltipCursor }} content={<ChartTooltipContent />} /><Bar dataKey="abertos" fill="var(--color-abertos)" radius={[2, 2, 0, 0]} maxBarSize={42} /><Bar dataKey="finalizados" fill="var(--color-finalizados)" radius={[2, 2, 0, 0]} maxBarSize={42} /><Bar dataKey="pendentes" fill="var(--color-pendentes)" radius={[2, 2, 0, 0]} maxBarSize={42} /></BarChart></ChartContainer>}
            </div>
            {historicalLifecycle.summary.withoutCreationDate > 0 && <p className={`mt-3 text-[10px] font-mono ${lifecycleTheme.subdued}`}>{historicalLifecycle.summary.withoutCreationDate} pedido(s) não entrou(ram) na análise por não possuir(em) Data de criação válida.</p>}
          </div>
            <div className="border border-zinc-900 bg-white p-4">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2 border-b border-zinc-200 pb-3 mb-3"><div><p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Evolução das cargas</p><h4 className="text-base font-bold tracking-tight">Novos pedidos, entregas e alterações por upload</h4></div><span className="text-[10px] font-mono text-zinc-500">Pedidos entram apenas na primeira carga; entregas são ausências identificadas</span></div>
            {historicalAssessmentQuery.isLoading ? <p className="h-[240px] flex items-center justify-center text-xs font-mono text-zinc-500">Carregando avaliação histórica...</p> : historicalChartData.length === 0 ? <p className="h-[240px] flex items-center justify-center text-xs font-mono text-zinc-500">Nenhuma carga encontrada para os filtros selecionados.</p> : <ChartContainer aria-label="Gráfico temporal de itens, entregas e alterações por carga" config={historicalChartConfig} className="h-[240px] w-full aspect-auto"><BarChart data={historicalChartData} margin={{ top: 20, right: 12, left: -12, bottom: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="carga" tickLine={false} axisLine={false} tickMargin={10} className="font-mono text-[10px]" /><YAxis allowDecimals={false} tickLine={false} axisLine={false} width={30} className="font-mono text-[10px]" /><ChartTooltip cursor={{ fill: "rgba(24, 24, 27, 0.06)" }} content={<ChartTooltipContent />} /><Bar dataKey="itens" fill="var(--color-itens)" radius={[2, 2, 0, 0]} maxBarSize={44} /><Bar dataKey="entregues" fill="var(--color-entregues)" radius={[2, 2, 0, 0]} maxBarSize={44} /><Bar dataKey="alteracoes" fill="var(--color-alteracoes)" radius={[2, 2, 0, 0]} maxBarSize={44} /></BarChart></ChartContainer>}
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="border border-zinc-900 bg-white p-4"><div className="border-b border-zinc-200 pb-3 mb-3"><p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Cargas detalhadas</p><h4 className="text-base font-bold tracking-tight">Rastreabilidade por arquivo</h4></div><div className="space-y-2">{historicalAssessment.uploads.length === 0 ? <p className="py-4 text-center text-xs font-mono text-zinc-500">Nenhuma carga no período.</p> : historicalAssessment.uploads.map((upload) => <div key={upload.uploadId} className="border border-zinc-200 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-mono text-[10px] text-zinc-500">{formatDate(upload.uploadDate)}</p><p className="font-bold text-xs truncate mt-1" title={upload.fileName}>{upload.fileName}</p></div><Badge variant="outline" className="rounded-none border-zinc-900 font-mono text-[10px] shrink-0">{upload.itemsRecorded} itens</Badge></div><div className="grid grid-cols-4 gap-2 mt-3 text-[10px] font-mono"><div><p className="text-zinc-500">Filiais</p><p className="font-bold mt-1">{upload.branches}</p></div><div><p className="text-zinc-500">Alterações</p><p className="font-bold text-red-600 mt-1">{upload.changeEvents}</p></div><div><p className="text-zinc-500">Entregues</p><p className="font-bold text-emerald-700 mt-1">{upload.deliveredItems}</p></div><div><p className="text-zinc-500">Tempo efetivo</p><p className="font-bold text-amber-700 mt-1">{upload.averageDeliveryLeadDays === null ? "—" : `${upload.averageDeliveryLeadDays}d`}</p></div></div></div>)}</div></div>
            <div className="border border-zinc-900 bg-white p-4"><div className="border-b border-zinc-200 pb-3 mb-3"><p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Comportamento por filial</p><h4 className="text-base font-bold tracking-tight">Itens, entregas e alterações</h4></div><div className="space-y-2">{historicalAssessment.branches.length === 0 ? <p className="py-4 text-center text-xs font-mono text-zinc-500">Nenhuma filial no período.</p> : historicalAssessment.branches.map((branch) => <div key={`${branch.uploadId}-${branch.branch}`} className="border border-zinc-200 p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-sm">{branch.branch}</p><p className="text-[10px] font-mono text-zinc-500 mt-1">Carga: {formatDate(branch.uploadDate)}</p></div><Badge variant="outline" className="rounded-none border-zinc-900 font-mono text-[10px]">{branch.itemsRecorded} itens</Badge></div><div className="grid grid-cols-3 gap-2 mt-3 text-[10px] font-mono"><div><p className="text-zinc-500">Alterações</p><p className="font-bold text-red-600 mt-1">{branch.changeEvents}</p></div><div><p className="text-zinc-500">Entregues</p><p className="font-bold text-emerald-700 mt-1">{branch.deliveredItems}</p></div><div><p className="text-zinc-500">Tempo efetivo</p><p className="font-bold text-amber-700 mt-1">{branch.averageDeliveryLeadDays === null ? "—" : `${branch.averageDeliveryLeadDays}d`}</p></div></div></div>)}</div></div>
          </div>
        </section>}

        {activeTab === "active" && <section className="space-y-4"><div className="border-b border-zinc-900 pb-2"><h2 className="text-sm font-mono uppercase tracking-wider text-zinc-500">08 / Mapa de alterações</h2><h3 className="text-xl font-bold tracking-tight">Itens que tiveram a previsão modificada</h3></div><div className="border border-zinc-900 overflow-x-auto"><table className="w-full text-left border-collapse min-w-[900px]"><thead><tr className="border-b border-zinc-900 bg-zinc-950 text-white text-xs font-mono uppercase tracking-wider"><th className="p-4">Item / nome</th><th className="p-4">Customer PO</th><th className="p-4">De</th><th className="p-4">Para</th><th className="p-4">Data</th><th className="p-4 text-center">Ocorrências</th><th className="p-4">Ação</th></tr></thead><tbody className="divide-y divide-zinc-200 text-sm font-mono">{changedItems.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-zinc-500">Nenhuma alteração para os filtros atuais.</td></tr> : changedItems.map((row) => <tr key={`change-${row.id}`} className="hover:bg-red-50"><td className="p-4"><p className="font-bold">{row.item}</p><p className="text-xs text-zinc-500 mt-1 max-w-[280px]">{row.itemDescription || "Sem descrição"}</p></td><td className="p-4">{row.customerPo || "—"}</td><td className="p-4 text-zinc-500">{row.previousPrediction || "—"}</td><td className="p-4 text-red-600 font-bold">{row.currentPrediction || "—"}</td><td className="p-4">{formatDate(row.lastPredictionChangeDate)}</td><td className="p-4 text-center"><span className="px-2 py-1 bg-red-100 text-red-700 font-bold">{row.predictionChangesCount}x</span></td><td className="p-4"><Button variant="outline" size="sm" className="rounded-none border-zinc-900 text-xs font-mono" onClick={() => setSelectedItemId(row.id)}>Linha do tempo</Button></td></tr>)}</tbody></table></div></section>}
          </>
        )}
        </div>
      </main>
      <footer className="border-t-2 border-zinc-950 mt-20 py-8 px-6 text-center text-xs font-mono uppercase tracking-widest text-zinc-500 bg-zinc-50">Open Order Control • 2026 • Giovani Martino</footer>
    </div>
  );
}

function MetricCard({ label, value, detail, icon, accent }: { label: string; value: string; detail: string; icon: React.ReactNode; accent: "red" | "black" }) {
  return <div className="border border-zinc-900 p-6 relative bg-white"><div className={`absolute top-0 right-0 w-3 h-3 ${accent === "red" ? "bg-red-600" : "bg-zinc-950"}`} /><p className="text-xs font-mono uppercase tracking-widest text-zinc-500">{label}</p><p className="text-3xl font-black mt-3 tracking-tight">{value}</p><div className="mt-5 pt-4 border-t border-zinc-100 flex items-center justify-between gap-3 text-xs text-zinc-500 font-mono"><span>{detail}</span>{icon}</div></div>;
}

function PrioritizationSettingsDialog({
  open,
  onOpenChange,
  weights,
  isLoading,
  isSaving,
  isResetting,
  onSave,
  onReset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weights: PrioritizationWeights;
  isLoading: boolean;
  isSaving: boolean;
  isResetting: boolean;
  onSave: (weights: PrioritizationWeights) => Promise<void>;
  onReset: () => Promise<void>;
}) {
  const [draft, setDraft] = React.useState<PrioritizationWeights>(weights);

  React.useEffect(() => {
    if (open) setDraft(weights);
  }, [open, weights]);

  const updateWeight = (field: keyof PrioritizationWeights, value: string) => {
    const parsed = Number(value);
    setDraft((current) => ({ ...current, [field]: Number.isInteger(parsed) && parsed >= 0 ? parsed : 0 }));
  };

  const totalWeight = Object.values(draft).reduce((sum, value) => sum + value, 0);
  const isInvalid = totalWeight === 0 || Object.values(draft).some((value) => value > 100);
  const fields: Array<{ key: keyof PrioritizationWeights; label: string; description: string; multiplier?: boolean }> = [
    { key: "predictionChangeWeight", label: "Alteração de previsão", description: "Pontos por adiamento acumulado. Antecipações recebem somente 25% deste peso, arredondado para cima.", multiplier: true },
    { key: "noSupplierWeight", label: "Sem fornecedor", description: "Pontos quando a previsão informa ausência de fornecedor." },
    { key: "overdueWeight", label: "Previsão vencida", description: "Pontos quando a previsão está anterior à data atual." },
    { key: "highPriorityWeight", label: "Prioridade alta", description: "Pontos quando a prioridade de embarque é alta." },
    { key: "financialImpactWeight", label: "Impacto financeiro", description: "Pontuação máxima do item de maior valor; os demais recebem pontos proporcionais ao valor financeiro." },
    { key: "agingWeight", label: "Envelhecimento do pedido", description: "Pontuação proporcional ao tempo em aberto desde a Data de criação. O pedido mais antigo recebe o peso integral." },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-none sm:w-[calc(100vw-3rem)] sm:max-w-2xl rounded-none border-2 border-zinc-950 bg-white p-6">
        <DialogHeader className="border-b-2 border-zinc-950 pb-4">
          <DialogTitle className="flex items-center gap-3 font-black uppercase tracking-tight text-zinc-950"><SlidersHorizontal className="h-5 w-5 text-red-600" />Configurações de priorização</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          <div className="border-l-4 border-red-600 bg-zinc-50 p-4 text-sm leading-6 text-zinc-700">
            Ajuste os pesos usados para ordenar a Fila de Ação. A classificação permanece em <strong>Crítico: 8 ou mais</strong>, <strong>Atenção: 4 a 7</strong> e <strong>Monitorar: 1 a 3</strong>.
          </div>
          {isLoading ? (
            <div className="py-10 text-center text-xs font-mono uppercase tracking-widest text-zinc-500">Carregando pesos...</div>
          ) : (
            <div className="divide-y-2 divide-zinc-950 border-y-2 border-zinc-950">
              {fields.map((field) => (
                <div key={field.key} className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-[1fr_110px] sm:items-center">
                  <div>
                    <label htmlFor={field.key} className="text-xs font-black uppercase tracking-wider text-zinc-950">{field.label}</label>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">{field.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input id={field.key} type="number" min={0} max={100} step={1} value={draft[field.key]} onChange={(event) => updateWeight(field.key, event.target.value)} className="rounded-none border-zinc-950 text-right font-mono font-bold" aria-describedby={`${field.key}-hint`} />
                    <span id={`${field.key}-hint`} className="w-10 text-xs font-mono text-zinc-600">{field.multiplier ? "cada" : "pts"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-3 border border-zinc-950 bg-zinc-950 p-4 text-white sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">Simulação</p><p className="mt-1 text-sm font-bold">1 adiamento + sem fornecedor + vencido + prioridade alta + item de maior valor + pedido mais antigo = {draft.predictionChangeWeight + draft.noSupplierWeight + draft.overdueWeight + draft.highPriorityWeight + draft.financialImpactWeight + draft.agingWeight} pontos</p><p className="mt-1 text-[10px] font-mono text-emerald-200">Cada antecipação recebe {draft.predictionChangeWeight === 0 ? 0 : Math.max(1, Math.ceil(draft.predictionChangeWeight / 4))} ponto(s), equivalente a 25% do peso de adiamento.</p></div>
            <Badge className="w-fit rounded-none bg-red-600 text-white hover:bg-red-600">{totalWeight === 0 ? "CONFIGURAÇÃO INVÁLIDA" : "PESOS ATIVOS"}</Badge>
          </div>
          {isInvalid && <p className="text-xs font-mono text-red-600">Informe valores inteiros entre 0 e 100 e mantenha pelo menos um peso maior que zero.</p>}
          <div className="flex flex-col-reverse gap-3 border-t border-zinc-200 pt-5 sm:flex-row sm:justify-between">
            <Button type="button" variant="outline" onClick={() => void onReset()} disabled={isResetting || isSaving} className="rounded-none border-zinc-950 font-mono text-xs uppercase"><RotateCcw className="mr-2 h-4 w-4" />{isResetting ? "Restaurando..." : "Restaurar padrão"}</Button>
            <Button type="button" onClick={() => void onSave(draft)} disabled={isLoading || isInvalid || isSaving || isResetting} className="rounded-none bg-red-600 font-mono text-xs uppercase hover:bg-red-700"><Save className="mr-2 h-4 w-4" />{isSaving ? "Salvando..." : "Salvar pesos"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ActionScoreHelp({ weights }: { weights: PrioritizationWeights }) {
  const anticipationWeight = weights.predictionChangeWeight === 0 ? 0 : Math.max(1, Math.ceil(weights.predictionChangeWeight / 4));
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex items-center gap-2 border border-zinc-900 bg-white px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wide text-zinc-900 transition-colors hover:bg-zinc-950 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2" aria-label="Entenda como o score da fila de ação é calculado">
          <CircleHelp className="h-4 w-4" aria-hidden="true" />
          Como o score é calculado?
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start" sideOffset={8} className="w-[360px] rounded-none border border-zinc-900 bg-zinc-950 p-4 text-zinc-50 shadow-xl">
        <p className="text-[11px] font-bold uppercase tracking-wider text-white">Composição do score</p>
        <p className="mt-2 text-[11px] leading-relaxed text-zinc-200">Score = {weights.predictionChangeWeight} × adiamentos + {anticipationWeight} × antecipações + {weights.noSupplierWeight} sem fornecedor + {weights.overdueWeight} previsão vencida + {weights.highPriorityWeight} prioridade alta + até {weights.financialImpactWeight} por impacto financeiro + até {weights.agingWeight} pelo envelhecimento.</p>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-y border-zinc-700 py-3 text-[10px] text-zinc-200">
          <span>Adiamento</span><strong>+{weights.predictionChangeWeight} cada</strong>
          <span>Antecipação</span><strong>+{anticipationWeight} cada (25%)</strong>
          <span>Sem fornecedor</span><strong>+{weights.noSupplierWeight}</strong>
          <span>Previsão vencida</span><strong>+{weights.overdueWeight}</strong>
          <span>Prioridade alta</span><strong>+{weights.highPriorityWeight}</strong>
          <span>Impacto financeiro</span><strong>+1 a {weights.financialImpactWeight}</strong>
          <span>Envelhecimento</span><strong>+1 a {weights.agingWeight}</strong>
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-zinc-300">Antecipações são tratadas como favoráveis e recebem apenas 25% do peso configurado para um adiamento. O impacto financeiro é proporcional ao valor estendido, enquanto o envelhecimento é proporcional aos dias em aberto desde a Data de criação: o item de maior valor e o pedido mais antigo da carteira filtrada recebem os respectivos pesos máximos; os demais recebem parcelas arredondadas para cima. <strong className="text-red-300">Crítico:</strong> 8 ou mais · <strong className="text-amber-200">Atenção:</strong> 4 a 7 · <strong className="text-zinc-100">Monitorar:</strong> 1 a 3. A fila prioriza maior score, depois maior impacto financeiro e, por fim, mais alterações.</p>
      </TooltipContent>
    </Tooltip>
  );
}

function MiniMetric({ label, value, tone }: { label: string; value: string; tone: "red" | "amber" | "black" | "emerald" }) {
  const color = tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-700" : tone === "emerald" ? "text-emerald-700" : "text-zinc-950";
  return <div className="border border-zinc-200 p-4 bg-zinc-50"><p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">{label}</p><p className={`text-2xl font-black mt-2 ${color}`}>{value}</p></div>;
}

function DecisionLine({ label, value, note, positive }: { label: string; value: string; note: string; positive?: boolean }) {
  const tone = positive === undefined ? "text-zinc-400" : positive ? "text-emerald-400" : "text-red-400";
  return <div className="flex items-center justify-between border-b border-zinc-700 pb-3"><div><p className="text-zinc-300">{label}</p><p className={`text-[10px] mt-1 ${tone}`}>{note}</p></div><strong className={tone}>{value}</strong></div>;
}

function ItemHistoryDialog({ detail: rawDetail, isLoading }: { detail: any; isLoading: boolean }) {
  const detail = rawDetail ? {
    ...rawDetail,
    item: {
      ...rawDetail.item,
      previousPrediction: formatPrediction(rawDetail.item.previousPrediction),
      currentPrediction: formatPrediction(rawDetail.item.currentPrediction),
    },
    history: rawDetail.history.map((record: any) => ({
      ...record,
      previousPrediction: formatPrediction(record.previousPrediction),
      prediction: formatPrediction(record.prediction),
    })),
  } : rawDetail;

  return (
      <DialogContent className="w-[calc(100vw-2rem)] max-w-none sm:w-[calc(100vw-3rem)] sm:max-w-4xl max-h-[90vh] overflow-y-auto rounded-none border-2 border-zinc-950 bg-white p-6 font-mono text-xs">
        <DialogHeader className="border-b-2 border-zinc-950 pb-4 mb-4">
          <DialogTitle className="font-black text-xl uppercase tracking-tight text-zinc-950">
            Histórico completo — {detail?.item?.item || "Item"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Linha do tempo com todos os uploads e alterações de previsão do item selecionado.
          </DialogDescription>
        </DialogHeader>

      {isLoading ? (
        <div className="py-16 text-center font-mono text-xs text-zinc-500 uppercase tracking-widest">
          Carregando histórico...
        </div>
      ) : detail ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border border-zinc-900 bg-zinc-50">
            <div>
              <span className="text-[10px] uppercase text-zinc-500 block">Item</span>
              <p className="font-bold text-sm text-zinc-950 mt-0.5 truncate" title={detail.item.item}>{detail.item.item}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase text-zinc-500 block">Customer PO</span>
              <p className="font-bold text-sm text-zinc-950 mt-0.5 truncate" title={detail.item.customerPo || "—"}>{detail.item.customerPo || "—"}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase text-zinc-500 block">Previsão atual</span>
              <p className="font-bold text-sm text-red-600 mt-0.5">{detail.item.currentPrediction || "—"}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase text-zinc-500 block">Alterações</span>
              <p className="font-bold text-sm text-red-600 mt-0.5">{detail.item.predictionChangesCount}x</p>
            </div>
          </div>

          <div>
            <h4 className="font-bold uppercase tracking-wider text-zinc-900 mb-3 text-xs flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-red-600 inline-block" />
              Linha do tempo de uploads
            </h4>
            <div className="border border-zinc-900 overflow-x-auto max-h-[380px]">
              <table className="w-full min-w-[760px] text-left border-collapse">
                <thead className="sticky top-0 bg-zinc-950 text-white z-10">
                  <tr className="text-[10px] uppercase tracking-wider">
                    <th className="p-3 border-r border-zinc-800 w-12 text-center">#</th>
                    <th className="p-3 border-r border-zinc-800">Upload / arquivo</th>
                    <th className="p-3 border-r border-zinc-800">Data do upload</th>
                    <th className="p-3 border-r border-zinc-800">Previsão registrada</th>
                    <th className="p-3 border-r border-zinc-800">Alteração</th>
                    <th className="p-3">Diferença</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 text-xs">
                  {detail.history.map((h: any) => (
                    <tr key={h.id} className={h.changed ? "bg-red-50/60" : "bg-white hover:bg-zinc-50"}>
                      <td className="p-3 border-r border-zinc-200 text-zinc-400 text-center font-bold">{h.sequence}</td>
                      <td className="p-3 border-r border-zinc-200">
                        <p className="font-bold text-zinc-950 truncate max-w-[200px]" title={h.fileName}>{h.fileName}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">Upload #{h.uploadId}</p>
                      </td>
                      <td className="p-3 border-r border-zinc-200 whitespace-nowrap text-zinc-700">{formatDateTime(h.uploadDate)}</td>
                      <td className="p-3 border-r border-zinc-200 whitespace-nowrap font-bold text-red-600">{h.prediction}</td>
                      <td className="p-3 border-r border-zinc-200">
                        {h.changed ? (
                          <span className="inline-flex items-center gap-1.5 text-red-700 font-bold text-[11px] flex-wrap">
                            <ArrowRight className="w-3 h-3 text-red-600 shrink-0" />
                            <span>{h.previousPrediction}</span>
                            <span className="text-zinc-400">→</span>
                            <span className="text-red-700">{h.prediction}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-zinc-500">
                            <Minus className="w-3 h-3 shrink-0" />
                            <span>Sem mudança</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {h.differenceDays === null ? (
                          <span className="text-zinc-400">—</span>
                        ) : h.differenceDays > 0 ? (
                          <span className="text-red-700 font-bold bg-red-100 px-2 py-0.5 border border-red-200">+{h.differenceDays}d</span>
                        ) : h.differenceDays < 0 ? (
                          <span className="text-amber-800 font-bold bg-amber-100 px-2 py-0.5 border border-amber-200">{h.differenceDays}d</span>
                        ) : (
                          <span className="text-zinc-600">0 dias</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-16 text-center font-mono text-xs text-zinc-500">
          Não foi possível carregar este item.
        </div>
      )}
    </DialogContent>
  );
}
