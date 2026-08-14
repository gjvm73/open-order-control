import React, { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import {
  Upload, Printer, TrendingUp, AlertTriangle, Package, History, Search, LogOut,
  ArrowRight, Minus, ShieldAlert, Clock3, CircleDollarSign, Target,
} from "lucide-react";
import { toast } from "sonner";

function formatDate(value: unknown) {
  if (!value) return "—";
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("pt-BR");
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
  const [alertThresholdDays, setAlertThresholdDays] = useState(7);
  const [alertThresholdDraft, setAlertThresholdDraft] = useState("7");

  React.useEffect(() => {
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
  const utils = trpc.useUtils();
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

  const handleExportPdf = () => {
    const previousTitle = document.title;
    document.title = "Open Order Control - Dashboard Gerencial";
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => { document.title = previousTitle; }, 250);
    }, 0);
  };

  const handleResetImports = async () => {
    try {
      const result = await resetMutation.mutateAsync();
      setResetConfirmation("");
      setSelectedItemId(null);
      toast.success(`Importações resetadas: ${result.deletedUploads} uploads, ${result.deletedItems} itens e ${result.deletedHistory} registros históricos removidos.`);
      await Promise.all([statsQuery.refetch(), itemsQuery.refetch(), uploadsQuery.refetch(), shipToQuery.refetch(), branchSummaryQuery.refetch(), alertsQuery.refetch(), alertsTrendQuery.refetch()]);
    } catch (err: any) {
      toast.error(err.message || "Não foi possível resetar as importações.");
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
        toast.success(`${result.totalRows} linhas processadas; ${result.changedRowsCount} alterações identificadas.`);
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

  const stats = statsQuery.data || {
    totalItems: 0, changedLastUpload: 0, noSupplier: 0, mostChanged: [], totalOrderValue: 0,
    valueAtRisk: 0, changedItems: 0, stableItems: 0, highPriorityItems: 0, overdueItems: 0,
    stabilityRate: 0, riskRate: 0, latestChangeRate: 0, latestStabilityRate: 0, trend: [], actionQueue: [], latestUpload: null,
  };
  const items = itemsQuery.data || [];
  const uploadsList = uploadsQuery.data || [];
  const shipToOptions = shipToQuery.data || [];
  const branchSummary = branchSummaryQuery.data || [];
  const alertsData = alertsQuery.data || { alerts: [], summary: { totalAlerts: 0, criticalCount: 0, attentionCount: 0, criticalRatio: 0, attentionRatio: 0 } };
  const alerts = alertsData.alerts;
  const alertSummary = alertsData.summary;
  const changedItems = items.filter((item) => item.predictionChangesCount > 0);
  const stabilityRate = stats.latestStabilityRate ?? stats.stabilityRate ?? 0;
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
    <div className="min-h-screen bg-white text-zinc-950 font-sans selection:bg-red-600 selection:text-white">
      <header className="border-b-2 border-zinc-950 px-6 py-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white">
        <div>
          <div className="flex items-center gap-2"><span className="w-4 h-4 bg-red-600 inline-block" /><h1 className="text-2xl font-black uppercase tracking-tight">OPEN ORDER CONTROL</h1></div>
          <p className="text-xs font-mono uppercase tracking-widest text-zinc-500 mt-1">Dashboard gerencial de previsões de entrega</p>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={handleExportPdf} className="no-print rounded-none border-zinc-950 text-zinc-950 hover:bg-zinc-950 hover:text-white px-4 py-2.5 text-xs font-mono uppercase tracking-wider h-auto" aria-label="Exportar dashboard em PDF"><Printer className="w-4 h-4 mr-2" />Exportar PDF</Button>
          <label className="cursor-pointer bg-zinc-950 hover:bg-zinc-800 text-white px-5 py-2.5 text-xs font-mono uppercase tracking-wider flex items-center gap-2 transition-all"><Upload className="w-4 h-4" />{uploadStatusLabel}<input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} disabled={isUploading} /></label>
          <AlertDialog onOpenChange={(open) => { if (!open) setResetConfirmation(""); }}><AlertDialogTrigger asChild><Button variant="outline" className="rounded-none border-red-600 text-red-600 hover:bg-red-600 hover:text-white px-4 py-2.5 text-xs font-mono uppercase tracking-wider h-auto"><ShieldAlert className="w-4 h-4 mr-2" />Resetar importações</Button></AlertDialogTrigger><AlertDialogContent className="rounded-none border-2 border-red-600 bg-white"><AlertDialogHeader><AlertDialogTitle className="font-black uppercase tracking-tight text-red-700">Resetar todas as importações?</AlertDialogTitle><AlertDialogDescription className="font-mono text-xs leading-6 text-zinc-700">Esta ação excluirá permanentemente todos os uploads, itens cadastrados e o histórico de previsões da base de consulta. Não é possível desfazer esta operação.</AlertDialogDescription></AlertDialogHeader><div className="space-y-2"><label className="text-xs font-mono uppercase tracking-wider text-zinc-600">Digite RESETAR para confirmar</label><Input value={resetConfirmation} onChange={(event) => setResetConfirmation(event.target.value.toUpperCase())} placeholder="RESETAR" className="rounded-none border-zinc-900 font-mono" autoFocus /></div><AlertDialogFooter><AlertDialogCancel className="rounded-none border-zinc-900 font-mono text-xs uppercase">Cancelar</AlertDialogCancel><AlertDialogAction className="rounded-none bg-red-600 hover:bg-red-700 font-mono text-xs uppercase" disabled={resetConfirmation !== "RESETAR" || resetMutation.isPending} onClick={(event) => { event.preventDefault(); void handleResetImports(); }}>{resetMutation.isPending ? "Limpando..." : "Confirmar reset"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
          {isAuthenticated ? <div className="flex items-center gap-3 border border-zinc-900 px-3 py-1.5 bg-zinc-50"><span className="text-xs font-mono">{user?.name || user?.email}</span><Button variant="ghost" size="sm" onClick={() => logout()} className="h-7 px-2 text-red-600 hover:bg-red-50"><LogOut className="w-3.5 h-3.5" /></Button></div> : <Button variant="outline" size="sm" className="border-zinc-900 text-xs font-mono uppercase rounded-none" onClick={() => (window.location.href = "/api/oauth/login")}>Entrar</Button>}
        </div>
      </header>

      <main className="p-6 md:p-10 max-w-[1500px] mx-auto space-y-12">
        <section>
          <div className="border-b border-zinc-900 pb-2 mb-6 flex justify-between items-end"><div><h2 className="text-sm font-mono uppercase tracking-wider text-zinc-500">01 / Visão executiva</h2><h3 className="text-2xl font-black tracking-tight mt-1">Onde a gestão deve concentrar atenção</h3></div><span className="text-xs font-mono text-zinc-400">Base atualizada: {stats.latestUpload ? formatDateTime(stats.latestUpload.uploadDate) : "sem upload"}</span></div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard label="Itens ativos" value={String(stats.totalItems)} detail={`${stats.stableItems} sem alteração acumulada`} icon={<Package className="w-4 h-4" />} accent="red" />
            <MetricCard label="Estabilidade do último ciclo" value={`${stats.latestStabilityRate ?? stats.stabilityRate}%`} detail={`${stats.changedLastUpload} itens alterados no último upload`} icon={<Target className="w-4 h-4" />} accent="black" />
            <MetricCard label="Valor total dos pedidos" value={formatCurrency(stats.totalOrderValue)} detail={`${stats.highPriorityItems} itens com prioridade alta`} icon={<CircleDollarSign className="w-4 h-4" />} accent="black" />
            <MetricCard label="Valor sob risco acumulado" value={formatCurrency(stats.valueAtRisk)} detail={`${stats.riskRate}% dos itens tiveram alguma mudança`} icon={<ShieldAlert className="w-4 h-4" />} accent="red" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <MiniMetric label="Mudaram no último upload" value={String(stats.changedLastUpload)} tone="red" />
            <MiniMetric label="Previsões vencidas" value={String(stats.overdueItems)} tone="amber" />
            <MiniMetric label="Sem fornecedor" value={String(stats.noSupplier)} tone="amber" />
            <MiniMetric label="Prioridade alta" value={String(stats.highPriorityItems)} tone="black" />
          </div>
        </section>

        <section className="space-y-4">
          <div className="border-b border-zinc-900 pb-2 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
              <h2 className="text-sm font-mono uppercase tracking-wider text-zinc-500">01A / Centro de comando estratégico</h2>
              <h3 className="text-xl font-black tracking-tight mt-1">O que merece decisão nesta semana</h3>
              <p className="text-xs font-mono text-zinc-500 mt-1">Índice composto por instabilidade, vencimento, disponibilidade de fornecedor, prioridade e exposição financeira.</p>
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

          <div className="flex flex-wrap items-center gap-3"><Badge className="rounded-none bg-red-600 text-white font-mono">{alerts.length} alertas visíveis</Badge><span className="text-xs font-mono text-zinc-600">Limiar atual: &gt; {alertThresholdDays} dias</span>{selectedShipTo && <Badge className="rounded-none bg-zinc-950 text-white font-mono">Filial: {selectedShipTo}</Badge>}</div><div className="border border-zinc-900 bg-white overflow-x-auto"><table className="w-full min-w-[1050px] text-left border-collapse"><thead><tr className="border-b border-zinc-900 bg-zinc-950 text-white text-[10px] font-mono uppercase tracking-wider"><th className="p-3">Severidade</th><th className="p-3">Item / descrição</th><th className="p-3">Filial solicitante</th><th className="p-3">Customer PO</th><th className="p-3">Previsão anterior</th><th className="p-3">Previsão atual</th><th className="p-3 text-right">Variação</th><th className="p-3 text-center">Ação</th></tr></thead><tbody className="divide-y divide-zinc-200 text-xs font-mono">{alerts.length === 0 ? <tr><td colSpan={8} className="p-10 text-center text-zinc-500">Nenhum item ultrapassou o limiar de {alertThresholdDays} dias nesta filial.</td></tr> : alerts.slice(0, 20).map((alert) => <tr key={alert.id} className={alert.severity === "CRÍTICO" ? "bg-red-50" : "bg-white hover:bg-amber-50"}><td className="p-3"><span className={`inline-flex px-2 py-1 text-[10px] font-bold ${riskClass(alert.severity)}`}>{alert.severity}</span><p className="text-[10px] text-zinc-500 mt-1">{alert.direction}</p></td><td className="p-3"><p className="font-bold">{alert.item}</p><p className="text-[10px] text-zinc-500 max-w-[190px] truncate" title={alert.itemDescription || ""}>{alert.itemDescription || "—"}</p></td><td className="p-3 max-w-[180px] truncate" title={alert.shipTo}>{alert.shipTo}</td><td className="p-3">{alert.customerPo || "—"}</td><td className="p-3 text-zinc-600">{alert.previousPrediction || "—"}</td><td className="p-3 font-bold text-red-700">{alert.currentPrediction || "—"}</td><td className="p-3 text-right font-black text-red-700">{alert.differenceDays > 0 ? "+" : ""}{alert.differenceDays} dias</td><td className="p-3 text-center"><Button type="button" variant="outline" size="sm" onClick={() => setSelectedItemId(alert.id)} className="rounded-none border-zinc-900 text-[10px] font-mono uppercase h-8">Ver histórico</Button></td></tr>)}</tbody></table></div>{alerts.length > 20 && <p className="text-[10px] font-mono text-zinc-600">Exibindo os 20 alertas de maior variação. Ajuste a filial ou o limiar para refinar a lista.</p>}</section>

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
            <div className="space-y-5 text-sm font-mono"><DecisionLine label="Estabilidade último upload" value={`${stabilityRate}%`} note={stabilityRate >= 80 ? "controle" : "acompanhar"} positive={stabilityRate >= 80} /><DecisionLine label="Itens vencidos" value={String(stats.overdueItems)} note={stats.overdueItems > 0 ? "ação imediata" : "sem ocorrência"} positive={stats.overdueItems === 0} /><DecisionLine label="Sem fornecedor" value={String(stats.noSupplier)} note={stats.noSupplier > 0 ? "cobrar abastecimento" : "regular"} positive={stats.noSupplier === 0} /><DecisionLine label="Alterações recentes" value={String(stats.changedLastUpload)} note={stats.changedLastUpload > 0 ? "revisar impacto" : "sem mudança"} positive={stats.changedLastUpload === 0} /></div>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
          <div className="border border-zinc-900 overflow-hidden">
            <div className="p-6 border-b border-zinc-900 flex justify-between items-end"><div><h2 className="text-sm font-mono uppercase tracking-wider text-zinc-500">04 / Fila de ação</h2><h3 className="text-xl font-bold mt-1">Prioridades para a próxima reunião</h3><p className="text-xs font-mono text-zinc-500 mt-1">Ordenada por instabilidade, vencimento, fornecedor e prioridade.</p></div><AlertTriangle className="w-5 h-5 text-red-600" /></div>
            <div className="divide-y divide-zinc-200">{stats.actionQueue.length === 0 ? <p className="p-8 text-center text-xs font-mono text-zinc-500">Nenhum item requer ação imediata.</p> : stats.actionQueue.slice(0, 7).map((item) => <div key={item.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between hover:bg-red-50"><div className="min-w-0"><div className="flex items-center gap-2"><span className="font-bold font-mono">{item.item}</span><span className={`px-2 py-0.5 text-[10px] font-mono font-bold ${riskClass(item.riskLevel)}`}>{item.riskLevel}</span></div><p className="text-xs text-zinc-500 truncate max-w-[430px]">{item.itemDescription || "Sem descrição"} · PO {item.customerPo || "—"}</p><p className="text-[10px] font-mono text-red-700 mt-1">{item.reasons.join(" • ")}</p></div><div className="flex items-center gap-5 shrink-0 text-xs font-mono"><div><span className="text-zinc-500 block">Previsão</span><b>{item.currentPrediction || "—"}</b></div><div><span className="text-zinc-500 block">Valor</span><b>{formatCurrency(item.extendedPrice)}</b></div><div className="text-right"><span className="text-zinc-500 block">Score</span><b className="text-red-600">{item.riskScore}</b></div></div></div>)}</div>
          </div>
          <div className="border border-zinc-900 overflow-hidden">
            <div className="p-6 border-b border-zinc-900"><h2 className="text-sm font-mono uppercase tracking-wider text-zinc-500">05 / Instabilidade</h2><h3 className="text-xl font-bold mt-1">Itens com mais alterações</h3></div>
            <div className="divide-y divide-zinc-200">{stats.mostChanged.length === 0 ? <p className="p-8 text-center text-xs font-mono text-zinc-500">Ainda não há histórico suficiente.</p> : stats.mostChanged.slice(0, 6).map((item, index) => <div key={item.id} className="p-4 flex items-center gap-3"><span className="w-7 h-7 bg-zinc-950 text-white flex items-center justify-center text-xs font-bold">{String(index + 1).padStart(2, "0")}</span><div className="min-w-0 flex-1"><p className="font-bold font-mono truncate">{item.item}</p><p className="text-xs text-zinc-500 truncate">{item.customerPo || "Sem PO"} · {item.currentPrediction || "Sem previsão"}</p></div><div className="text-right"><p className="font-black text-red-600">{item.predictionChangesCount}x</p><p className="text-[10px] font-mono text-zinc-500">{formatCurrency(item.extendedPrice)}</p></div></div>)}</div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="border-b border-zinc-900 pb-2 flex flex-col md:flex-row justify-between items-start md:items-end gap-4"><div><h2 className="text-sm font-mono uppercase tracking-wider text-zinc-500">06 / Base operacional</h2><h3 className="text-xl font-bold tracking-tight">Itens, previsões e respectivas alterações</h3><p className="text-xs font-mono text-zinc-500 mt-1">Use os filtros para investigar a fila de ação e abrir o histórico completo.</p></div><div className="w-full md:w-80 relative"><Search className="absolute left-3 top-3 w-4 h-4 text-zinc-400" /><Input placeholder="Busca geral..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 rounded-none border-zinc-900 font-mono text-xs bg-white" /></div></div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 p-4 border border-zinc-900 bg-zinc-50"><div><label className="text-xs font-mono uppercase text-zinc-500 block mb-1">Filial solicitante / Ship To</label><select value={selectedShipTo} onChange={(e) => { const value = e.target.value.trim(); if (value) setFilterShipTo(value); else clearShipToFilter(); }} className="h-10 w-full rounded-none border border-zinc-900 bg-white px-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-red-600"><option value="">Todas as filiais</option>{shipToOptions.map((shipTo) => <option key={shipTo} value={shipTo}>{shipTo}</option>)}</select><div className="flex items-center justify-between gap-2 mt-2 min-h-5">{selectedShipTo ? <span className="text-[10px] font-mono text-zinc-500 truncate" title={selectedShipTo}>Filtro ativo: {selectedShipTo}</span> : <span className="text-[10px] font-mono text-zinc-400">Nenhuma filial selecionada</span>}{selectedShipTo && <button type="button" onClick={clearShipToFilter} className="text-[10px] font-mono uppercase text-red-600 hover:underline shrink-0">Limpar</button>}</div></div><div><label className="text-xs font-mono uppercase text-zinc-500 block mb-1">Item</label><Input placeholder="Ex.: 0102-1543" value={filterItem} onChange={(e) => setFilterItem(e.target.value)} className="rounded-none border-zinc-900 font-mono text-xs bg-white" /></div><div><label className="text-xs font-mono uppercase text-zinc-500 block mb-1">Customer PO</label><Input placeholder="Ex.: 133923E" value={filterPo} onChange={(e) => setFilterPo(e.target.value)} className="rounded-none border-zinc-900 font-mono text-xs bg-white" /></div><div><label className="text-xs font-mono uppercase text-zinc-500 block mb-1">Previsão atual</label><Input placeholder="Ex.: 2025-06" value={filterPrediction} onChange={(e) => setFilterPrediction(e.target.value)} className="rounded-none border-zinc-900 font-mono text-xs bg-white" /></div></div>
          <div className="border border-zinc-900 bg-white overflow-x-auto"><table className="w-full text-left border-collapse min-w-[1420px]"><thead><tr className="border-b border-zinc-900 bg-zinc-50 text-xs font-mono uppercase tracking-wider"><th className="p-4 border-r border-zinc-900">Filial solicitante</th><th className="p-4 border-r border-zinc-900">Item / descrição</th><th className="p-4 border-r border-zinc-900">Customer PO</th><th className="p-4 border-r border-zinc-900">Previsão anterior</th><th className="p-4 border-r border-zinc-900">Previsão atual</th><th className="p-4 border-r border-zinc-900">Último upload</th><th className="p-4 border-r border-zinc-900">Resumo de alterações</th><th className="p-4 border-r border-zinc-900">Última alteração</th><th className="p-4 border-r border-zinc-900 text-center">Total alterações</th><th className="p-4 text-center">Detalhes</th></tr></thead><tbody className="divide-y divide-zinc-200 text-sm font-mono">{items.length === 0 ? <tr><td colSpan={10} className="p-12 text-center text-zinc-500">Nenhum item encontrado.</td></tr> : items.map((row) => <tr key={row.id} className="hover:bg-zinc-50 align-top"><td className="p-4 border-r border-zinc-200"><p className="font-bold text-xs truncate max-w-[220px]" title={row.shipTo || "Sem filial informada"}>{row.shipTo || "Sem filial informada"}</p></td><td className="p-4 border-r border-zinc-200"><p className="font-bold">{row.item}</p><p className="text-xs text-zinc-500 mt-1 max-w-[240px]">{row.itemDescription || "Sem descrição"}</p></td><td className="p-4 border-r border-zinc-200">{row.customerPo || "—"}</td><td className="p-4 border-r border-zinc-200 text-zinc-500">{row.previousPrediction || "Primeiro registro"}</td><td className="p-4 border-r border-zinc-200"><span className="font-bold text-red-600">{row.currentPrediction || "Sem previsão"}</span></td><td className="p-4 border-r border-zinc-200"><p>{formatDate(row.lastUploadDate)}</p><p className="text-[10px] text-zinc-500 mt-1 truncate max-w-[180px]" title={row.lastUploadFileName || "Sem arquivo"}>{row.lastUploadFileName || "Sem arquivo"}</p></td><td className="p-4 border-r border-zinc-200"><p className={`font-bold ${row.predictionChangesCount > 0 ? "text-red-600" : "text-zinc-500"}`}>{row.predictionChangesCount > 0 ? `${row.predictionChangesCount} alteração(ões) acumulada(s)` : "Sem alteração registrada"}</p><p className="text-[10px] text-zinc-500 mt-1">Anterior: {row.previousPrediction || "Primeiro registro"}</p></td><td className="p-4 border-r border-zinc-200"><p>{row.predictionChangesCount > 0 ? formatDate(row.lastPredictionChangeDate) : "Sem alteração"}</p><p className="text-[10px] text-zinc-500 mt-1">Registro: {formatDate(row.updatedAt)}</p></td><td className="p-4 border-r border-zinc-200 text-center"><span className={`inline-block px-3 py-1 text-xs font-bold border ${row.predictionChangesCount > 0 ? "bg-red-100 text-red-700 border-red-200" : "bg-zinc-100 text-zinc-700 border-zinc-200"}`}>{row.predictionChangesCount}x</span></td><td className="p-4 text-center"><Dialog><DialogTrigger asChild><Button variant="outline" size="sm" className="rounded-none border-zinc-900 text-xs font-mono h-8 hover:bg-zinc-950 hover:text-white" onClick={() => setSelectedItemId(row.id)}><History className="w-3.5 h-3.5 mr-1" /> Ver histórico</Button></DialogTrigger><ItemHistoryDialog detail={itemDetailQuery.data} isLoading={itemDetailQuery.isLoading} /></Dialog></td></tr>)}</tbody></table></div>
        </section>

        <section className="space-y-4"><div className="border-b border-zinc-900 pb-2"><h2 className="text-sm font-mono uppercase tracking-wider text-zinc-500">07 / Mapa de alterações</h2><h3 className="text-xl font-bold tracking-tight">Itens que tiveram a previsão modificada</h3></div><div className="border border-zinc-900 overflow-x-auto"><table className="w-full text-left border-collapse min-w-[900px]"><thead><tr className="border-b border-zinc-900 bg-zinc-950 text-white text-xs font-mono uppercase tracking-wider"><th className="p-4">Item / nome</th><th className="p-4">Customer PO</th><th className="p-4">De</th><th className="p-4">Para</th><th className="p-4">Data</th><th className="p-4 text-center">Ocorrências</th><th className="p-4">Ação</th></tr></thead><tbody className="divide-y divide-zinc-200 text-sm font-mono">{changedItems.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-zinc-500">Nenhuma alteração para os filtros atuais.</td></tr> : changedItems.map((row) => <tr key={`change-${row.id}`} className="hover:bg-red-50"><td className="p-4"><p className="font-bold">{row.item}</p><p className="text-xs text-zinc-500 mt-1 max-w-[280px]">{row.itemDescription || "Sem descrição"}</p></td><td className="p-4">{row.customerPo || "—"}</td><td className="p-4 text-zinc-500">{row.previousPrediction || "—"}</td><td className="p-4 text-red-600 font-bold">{row.currentPrediction || "—"}</td><td className="p-4">{formatDate(row.lastPredictionChangeDate)}</td><td className="p-4 text-center"><span className="px-2 py-1 bg-red-100 text-red-700 font-bold">{row.predictionChangesCount}x</span></td><td className="p-4"><Dialog><DialogTrigger asChild><Button variant="outline" size="sm" className="rounded-none border-zinc-900 text-xs font-mono" onClick={() => setSelectedItemId(row.id)}>Linha do tempo</Button></DialogTrigger><ItemHistoryDialog detail={itemDetailQuery.data} isLoading={itemDetailQuery.isLoading} /></Dialog></td></tr>)}</tbody></table></div></section>
      </main>
      <footer className="border-t-2 border-zinc-950 mt-20 py-8 px-6 text-center text-xs font-mono uppercase tracking-widest text-zinc-500 bg-zinc-50">Open Order Control • Swiss Style Precision Architecture • 2026</footer>
    </div>
  );
}

function MetricCard({ label, value, detail, icon, accent }: { label: string; value: string; detail: string; icon: React.ReactNode; accent: "red" | "black" }) {
  return <div className="border border-zinc-900 p-6 relative bg-white"><div className={`absolute top-0 right-0 w-3 h-3 ${accent === "red" ? "bg-red-600" : "bg-zinc-950"}`} /><p className="text-xs font-mono uppercase tracking-widest text-zinc-500">{label}</p><p className="text-3xl font-black mt-3 tracking-tight">{value}</p><div className="mt-5 pt-4 border-t border-zinc-100 flex items-center justify-between gap-3 text-xs text-zinc-500 font-mono"><span>{detail}</span>{icon}</div></div>;
}

function MiniMetric({ label, value, tone }: { label: string; value: string; tone: "red" | "amber" | "black" }) {
  const color = tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-700" : "text-zinc-950";
  return <div className="border border-zinc-200 p-4 bg-zinc-50"><p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">{label}</p><p className={`text-2xl font-black mt-2 ${color}`}>{value}</p></div>;
}

function DecisionLine({ label, value, note, positive }: { label: string; value: string; note: string; positive: boolean }) {
  return <div className="flex items-center justify-between border-b border-zinc-700 pb-3"><div><p className="text-zinc-300">{label}</p><p className={`text-[10px] mt-1 ${positive ? "text-emerald-400" : "text-red-400"}`}>{note}</p></div><strong className={positive ? "text-emerald-400" : "text-red-400"}>{value}</strong></div>;
}

function ItemHistoryDialog({ detail, isLoading }: { detail: any; isLoading: boolean }) {
  return (
    <DialogContent className="w-[calc(100vw-2rem)] max-w-none sm:w-[calc(100vw-3rem)] sm:max-w-4xl max-h-[90vh] overflow-y-auto rounded-none border-2 border-zinc-950 bg-white p-6 font-mono text-xs">
      <DialogHeader className="border-b-2 border-zinc-950 pb-4 mb-4">
        <DialogTitle className="font-black text-xl uppercase tracking-tight text-zinc-950">
          Histórico completo — {detail?.item?.item || "Item"}
        </DialogTitle>
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
