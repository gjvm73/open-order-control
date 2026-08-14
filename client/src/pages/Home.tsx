import React, { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Upload, 
  TrendingUp, 
  AlertTriangle, 
  Package, 
  History, 
  Search, 
  FileSpreadsheet, 
  ArrowUpRight, 
  CheckCircle2, 
  Calendar,
  LogOut,
  RefreshCw,
  Eye
} from "lucide-react";
import { toast } from "sonner";

export default function Home() {
  const { user, isAuthenticated, logout } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Queries tRPC
  const statsQuery = trpc.orders.getStats.useQuery();
  const itemsQuery = trpc.orders.listItems.useQuery({ search });
  const uploadsQuery = trpc.orders.listUploads.useQuery();
  const itemDetailQuery = trpc.orders.getItemDetail.useQuery(
    { id: selectedItemId! },
    { enabled: selectedItemId !== null }
  );

  const utils = trpc.useUtils();

  // Manipular upload de arquivo Excel
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error("Por favor, envie um arquivo Excel (.xlsx ou .xls)");
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (uploadEvent) => {
      try {
        const buffer = uploadEvent.target?.result as ArrayBuffer;
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        const result = await utils.client.orders.uploadExcel.mutate({
          fileName: file.name,
          fileBase64: base64,
        });

        toast.success(`Planilha processada com sucesso! ${result.totalRows} linhas lidas, ${result.changedRowsCount} alterações de previsão identificadas.`);
        statsQuery.refetch();
        itemsQuery.refetch();
        uploadsQuery.refetch();
      } catch (err: any) {
        toast.error(err.message || "Erro ao processar o upload do arquivo.");
      } finally {
        setIsUploading(false);
        e.target.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const stats = statsQuery.data || { totalItems: 0, changedLastUpload: 0, noSupplier: 0, mostChanged: [] };
  const items = itemsQuery.data || [];
  const uploadsList = uploadsQuery.data || [];

  return (
    <div className="min-h-screen bg-white text-zinc-950 font-sans selection:bg-red-600 selection:text-white">
      {/* Top Swiss Style Header Bar */}
      <header className="border-b-2 border-zinc-950 px-6 py-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 bg-red-600 inline-block"></span>
            <h1 className="text-2xl font-black uppercase tracking-tight">OPEN ORDER CONTROL</h1>
          </div>
          <p className="text-xs font-mono uppercase tracking-widest text-zinc-500 mt-1">
            Sistema de Rastreamento e Histórico de Previsões de Entrega
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <label className="cursor-pointer bg-zinc-950 hover:bg-zinc-800 text-white px-5 py-2.5 text-xs font-mono uppercase tracking-wider flex items-center gap-2 transition-all">
              <Upload className="w-4 h-4" />
              {isUploading ? "Processando..." : "Upload Planilha Semanal"}
              <input 
                type="file" 
                accept=".xlsx, .xls" 
                className="hidden" 
                onChange={handleFileUpload} 
                disabled={isUploading}
              />
            </label>
          </div>

          {isAuthenticated ? (
            <div className="flex items-center gap-3 border border-zinc-900 px-3 py-1.5 bg-zinc-50">
              <span className="text-xs font-mono">{user?.name || user?.email}</span>
              <Button variant="ghost" size="sm" onClick={() => logout()} className="h-7 px-2 text-red-600 hover:bg-red-50">
                <LogOut className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="border-zinc-900 text-xs font-mono uppercase rounded-none" onClick={() => window.location.href = "/api/oauth/login"}>
              Entrar
            </Button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="p-6 md:p-10 max-w-7xl mx-auto space-y-12">
        
        {/* Dashboard Indicators (Swiss Style Grid) */}
        <section>
          <div className="border-b border-zinc-900 pb-2 mb-6 flex justify-between items-end">
            <h2 className="text-sm font-mono uppercase tracking-wider text-zinc-500">01 / Indicadores de Desempenho</h2>
            <span className="text-xs font-mono text-zinc-400">Atualização em Tempo Real</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="border border-zinc-900 p-6 bg-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-3 h-3 bg-red-600"></div>
              <p className="text-xs font-mono uppercase tracking-widest text-zinc-500">Total de Itens Ativos</p>
              <p className="text-4xl font-black mt-2 tracking-tight">{stats.totalItems}</p>
              <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500 font-mono">
                <span>Base cadastrada</span>
                <Package className="w-4 h-4 text-zinc-400" />
              </div>
            </div>

            <div className="border border-zinc-900 p-6 bg-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-3 h-3 bg-red-600"></div>
              <p className="text-xs font-mono uppercase tracking-widest text-zinc-500">Alterados no Último Upload</p>
              <p className="text-4xl font-black mt-2 tracking-tight text-red-600">{stats.changedLastUpload}</p>
              <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500 font-mono">
                <span>Mudança de Previsão</span>
                <TrendingUp className="w-4 h-4 text-red-600" />
              </div>
            </div>

            <div className="border border-zinc-900 p-6 bg-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-3 h-3 bg-zinc-950"></div>
              <p className="text-xs font-mono uppercase tracking-widest text-zinc-500">Itens Sem Fornecedor</p>
              <p className="text-4xl font-black mt-2 tracking-tight">{stats.noSupplier}</p>
              <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500 font-mono">
                <span>Atenção necessária</span>
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </div>
            </div>

            <div className="border border-zinc-900 p-6 bg-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-3 h-3 bg-zinc-950"></div>
              <p className="text-xs font-mono uppercase tracking-widest text-zinc-500">Uploads Realizados</p>
              <p className="text-4xl font-black mt-2 tracking-tight">{uploadsList.length}</p>
              <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500 font-mono">
                <span>Ciclos semanais</span>
                <FileSpreadsheet className="w-4 h-4 text-zinc-400" />
              </div>
            </div>
          </div>
        </section>

        {/* Upload History & Status Banner */}
        {uploadsList.length > 0 && (
          <section className="border border-zinc-900 p-6 bg-zinc-50">
            <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-4">Último Ciclo de Upload Registrado</h3>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <p className="font-bold text-lg">{uploadsList[0].fileName}</p>
                <p className="text-xs font-mono text-zinc-500">
                  Enviado em: {new Date(uploadsList[0].uploadDate).toLocaleString()} | Total de linhas: {uploadsList[0].totalRows}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="rounded-none border-zinc-900 px-3 py-1 font-mono text-xs bg-white">
                  {uploadsList[0].changedRowsCount} alterações detectadas
                </Badge>
              </div>
            </div>
          </section>
        )}

        {/* Main Table Section */}
        <section className="space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-zinc-900 pb-2">
            <div>
              <h2 className="text-sm font-mono uppercase tracking-wider text-zinc-500">02 / Tabela Principal de Pedidos</h2>
              <h3 className="text-xl font-bold tracking-tight">Rastreamento de Itens e Alterações de Previsão</h3>
            </div>

            <div className="w-full md:w-72 relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-zinc-400" />
              <Input
                placeholder="Buscar por Item, PO ou Descrição..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 rounded-none border-zinc-900 font-mono text-xs bg-white"
              />
            </div>
          </div>

          <div className="border border-zinc-900 bg-white overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-900 bg-zinc-50 text-xs font-mono uppercase tracking-wider">
                  <th className="p-4 border-r border-zinc-900">Item</th>
                  <th className="p-4 border-r border-zinc-900">Customer PO</th>
                  <th className="p-4 border-r border-zinc-900">Descrição</th>
                  <th className="p-4 border-r border-zinc-900">Previsão Atual</th>
                  <th className="p-4 border-r border-zinc-900">Previsão Anterior</th>
                  <th className="p-4 border-r border-zinc-900 text-center">Nº Alterações</th>
                  <th className="p-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-sm font-mono">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-zinc-500">
                      Nenhum item cadastrado ou encontrado. Faça o upload de uma planilha Excel acima para começar.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr key={row.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="p-4 border-r border-zinc-200 font-bold">{row.item}</td>
                      <td className="p-4 border-r border-zinc-200">{row.customerPo || "-"}</td>
                      <td className="p-4 border-r border-zinc-200 text-xs text-zinc-600 max-w-xs truncate">{row.itemDescription || "-"}</td>
                      <td className="p-4 border-r border-zinc-200 font-semibold text-red-600">{row.currentPrediction || "-"}</td>
                      <td className="p-4 border-r border-zinc-200 text-xs text-zinc-500">{row.previousPrediction || "Nenhuma"}</td>
                      <td className="p-4 border-r border-zinc-200 text-center">
                        <span className={`inline-block px-2.5 py-0.5 text-xs font-bold ${row.predictionChangesCount > 0 ? 'bg-red-100 text-red-700' : 'bg-zinc-100 text-zinc-700'}`}>
                          {row.predictionChangesCount}x
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="rounded-none border-zinc-900 text-xs font-mono h-8 hover:bg-zinc-950 hover:text-white"
                              onClick={() => setSelectedItemId(row.id)}
                            >
                              <History className="w-3.5 h-3.5 mr-1" /> Histórico
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl rounded-none border-2 border-zinc-950 bg-white">
                            <DialogHeader className="border-b border-zinc-900 pb-4">
                              <DialogTitle className="font-black text-lg uppercase tracking-tight">
                                Histórico de Alterações — Item: {itemDetailQuery.data?.item.item}
                              </DialogTitle>
                            </DialogHeader>

                            {itemDetailQuery.isLoading ? (
                              <div className="py-12 text-center font-mono text-xs">Carregando histórico...</div>
                            ) : (
                              <div className="space-y-6 pt-4 font-mono text-xs">
                                <div className="grid grid-cols-2 gap-4 p-4 border border-zinc-900 bg-zinc-50">
                                  <div>
                                    <p className="text-zinc-500 uppercase">Customer PO:</p>
                                    <p className="font-bold text-sm">{itemDetailQuery.data?.item.customerPo}</p>
                                  </div>
                                  <div>
                                    <p className="text-zinc-500 uppercase">Total de Modificações:</p>
                                    <p className="font-bold text-sm text-red-600">{itemDetailQuery.data?.item.predictionChangesCount} vezes</p>
                                  </div>
                                  <div className="col-span-2">
                                    <p className="text-zinc-500 uppercase">Descrição:</p>
                                    <p className="font-bold">{itemDetailQuery.data?.item.itemDescription}</p>
                                  </div>
                                </div>

                                <div>
                                  <h4 className="font-bold uppercase tracking-wider text-zinc-700 mb-3">Linha do Tempo de Previsões</h4>
                                  <div className="border border-zinc-900 divide-y divide-zinc-200 max-h-64 overflow-y-auto">
                                    {itemDetailQuery.data?.history.map((h, idx) => (
                                      <div key={h.id} className="p-3 flex justify-between items-center bg-white hover:bg-zinc-50">
                                        <div className="flex items-center gap-3">
                                          <span className="font-bold text-zinc-400">#{idx + 1}</span>
                                          <span className="font-semibold text-red-600">{h.prediction}</span>
                                        </div>
                                        <span className="text-zinc-500">{new Date(h.recordedAt).toLocaleString()}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

      </main>

      {/* Footer Swiss Style */}
      <footer className="border-t-2 border-zinc-950 mt-20 py-8 px-6 text-center text-xs font-mono uppercase tracking-widest text-zinc-500 bg-zinc-50">
        Open Order Control • Swiss Style Precision Architecture • 2026
      </footer>
    </div>
  );
}
