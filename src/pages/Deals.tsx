import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCRMStore } from "@/hooks/useCRMStore";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Kanban, List, TrendingUp, Plus, Filter, Settings2, Trash2, GripVertical, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DealsKanban } from "@/components/crm/DealsKanban";

import { DealsList } from "@/components/crm/DealsList";
import { DealsForecast } from "@/components/crm/DealsForecast";
import { DealsFilters, type DealFilters } from "@/components/crm/DealsFilters";
import { SERVICE_TYPES, CREDIT_LINES } from "@/lib/financialServices";
import type { Database } from "@/integrations/supabase/types";

type Deal = Database["public"]["Tables"]["deals"]["Row"];
type Stage = Database["public"]["Tables"]["pipeline_stages"]["Row"];
type Pipeline = Database["public"]["Tables"]["pipelines"]["Row"];
type Contact = Database["public"]["Tables"]["contacts"]["Row"];
type Company = Database["public"]["Tables"]["companies"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type DealStatus = Database["public"]["Enums"]["deal_status"];

export type DealWithRelations = Deal & {
  contact?: Contact | null;
  company?: Company | null;
  owner?: Profile | null;
};

type ViewMode = "kanban" | "list" | "forecast";

export default function Deals() {
  const store = useCRMStore();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const enrichedDeals = useMemo<DealWithRelations[]>(() => {
    return store.deals.map((d: any) => ({
      ...d,
      contact: store.contacts.find((c: any) => c.id === d.contact_id) || null,
      company: store.companies.find((c: any) => c.id === d.company_id) || null,
      owner: store.profiles.find((m: any) => m.id === d.owner_id) || null,
    }));
  }, [store.deals, store.contacts, store.companies, store.profiles]);

  const stages = store.stages as Stage[];
  const pipelines = store.pipelines as Pipeline[];
  const contacts = store.contacts as Contact[];
  const companies = store.companies as Company[];
  const members = store.profiles as Profile[];
  const [selectedPipeline, setSelectedPipeline] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const shouldOpenNew = searchParams.get("action") === "new";
  const [form, setForm] = useState<Partial<Deal>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<DealFilters>({});
  const [presetStageId, setPresetStageId] = useState<string | null>(null);

  const [lossModalOpen, setLossModalOpen] = useState(false);
  const [lossDealId, setLossDealId] = useState<string | null>(null);
  const [lossReason, setLossReason] = useState("");
  const [lossNote, setLossNote] = useState("");
  const [selectedDeals, setSelectedDeals] = useState<Set<string>>(new Set());
  const [pipelineDialogOpen, setPipelineDialogOpen] = useState(false);
  const [editingStages, setEditingStages] = useState<{ id?: string; name: string; color: string; win_probability: number; order: number }[]>([]);
  const [savingPipeline, setSavingPipeline] = useState(false);

  const openPipelineEditor = () => {
    const current = stages
      .filter((s) => s.pipeline_id === selectedPipeline)
      .sort((a, b) => a.order - b.order)
      .map((s) => ({ id: s.id, name: s.name, color: s.color || "#94a3b8", win_probability: Number(s.win_probability) || 0, order: s.order }));
    setEditingStages(current.length > 0 ? current : [{ name: "", color: "#94a3b8", win_probability: 50, order: 0 }]);
    setPipelineDialogOpen(true);
  };

  const addEditStage = () => {
    setEditingStages([...editingStages, { name: "", color: "#94a3b8", win_probability: 50, order: editingStages.length }]);
  };

  const removeEditStage = (idx: number) => {
    setEditingStages(editingStages.filter((_, i) => i !== idx));
  };

  const updateEditStage = (idx: number, field: string, value: any) => {
    setEditingStages(editingStages.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const savePipelineStages = () => {
    if (!selectedPipeline) return;
    setSavingPipeline(true);
    const existingIds = editingStages.filter((s) => s.id).map((s) => s.id!);
    const currentStageIds = stages.filter((s) => s.pipeline_id === selectedPipeline).map((s) => s.id);
    currentStageIds.filter((id) => !existingIds.includes(id)).forEach((id) => store.deleteStage(id));
    for (let i = 0; i < editingStages.length; i++) {
      const s = editingStages[i];
      const payload = { name: s.name, color: s.color, win_probability: s.win_probability, order: i, pipeline_id: selectedPipeline, org_id: store.orgId };
      if (s.id) store.updateStage(s.id, payload);
      else store.addStage(payload);
    }
    setSavingPipeline(false);
    setPipelineDialogOpen(false);
    toast({ title: "Pipeline atualizado!" });
  };

  const fetchData = useCallback(() => { store.refreshData(); }, [store]);

  useEffect(() => {
    if (pipelines.length > 0 && !selectedPipeline) {
      const def = pipelines.find((p) => p.is_default) || pipelines[0];
      setSelectedPipeline(def.id);
    }
  }, [pipelines, selectedPipeline]);

  const pipelineStages = stages.filter((s) => s.pipeline_id === selectedPipeline);

  const filteredDeals = enrichedDeals.filter((d: any) => {
    if (filters.ownerId && d.owner_id !== filters.ownerId) return false;
    if (filters.minValue && (Number(d.value) || 0) < filters.minValue) return false;
    if (filters.maxValue && (Number(d.value) || 0) > filters.maxValue) return false;
    if (filters.closeDateFrom && d.close_date && d.close_date < filters.closeDateFrom) return false;
    if (filters.closeDateTo && d.close_date && d.close_date > filters.closeDateTo) return false;
    if (filters.serviceType && d.service_type !== filters.serviceType) return false;
    if (viewMode === "kanban") {
      const stageIds = pipelineStages.map((s) => s.id);
      if (d.stage_id && !stageIds.includes(d.stage_id) && d.status === "open") return false;
    }
    return true;
  });

  const handleDragEnd = (dealId: string, newStageId: string) => {
    store.updateDeal(dealId, { stage_id: newStageId });
  };

  const openNew = (stageId?: string) => {
    setEditing(null);
    setPresetStageId(stageId || null);
    setForm({ title: "", value: 0, currency: "BRL", stage_id: stageId || pipelineStages[0]?.id, status: "open", probability: 0 });
    setSheetOpen(true);
  };

  useEffect(() => {
    if (shouldOpenNew && pipelineStages.length > 0) {
      openNew();
      searchParams.delete("action");
      setSearchParams(searchParams, { replace: true });
    }
  }, [shouldOpenNew, pipelineStages]);

  const openEdit = (deal: Deal) => { setEditing(deal); setPresetStageId(null); setForm(deal); setSheetOpen(true); };

  // Auto-fill stage when modal opens or stages load
  useEffect(() => {
    if (sheetOpen && !editing && !form.stage_id && pipelineStages.length > 0) {
      setForm((f) => ({ ...f, stage_id: presetStageId || pipelineStages[0].id }));
    }
  }, [sheetOpen, editing, form.stage_id, pipelineStages, presetStageId]);

  const handleSave = () => {
    if (!form.title) {
      toast({ title: "Informe o título do negócio", variant: "destructive" });
      return;
    }
    if (!form.stage_id) {
      toast({ title: "Selecione um estágio", variant: "destructive" });
      return;
    }
    const financialFields = {
      service_type: (form as any).service_type || null,
      requested_amount: (form as any).requested_amount ? Number((form as any).requested_amount) : null,
      credit_line: (form as any).credit_line || null,
      interest_rate: (form as any).interest_rate ? Number((form as any).interest_rate) : null,
      term_months: (form as any).term_months ? Number((form as any).term_months) : null,
      operating_bank: (form as any).operating_bank || null,
    };
    if (editing) {
      store.updateDeal(editing.id, {
        title: form.title, value: Number(form.value) || 0, currency: form.currency,
        stage_id: form.stage_id, probability: Number(form.probability) || 0,
        close_date: form.close_date, contact_id: form.contact_id || null,
        company_id: form.company_id || null, owner_id: form.owner_id || null,
        ...financialFields,
      });
    } else {
      store.addDeal({
        title: form.title!, value: Number(form.value) || 0,
        currency: form.currency || "BRL", stage_id: form.stage_id,
        probability: Number(form.probability) || 0, close_date: form.close_date,
        status: "open", owner_id: form.owner_id || user?.id,
        contact_id: form.contact_id || null, company_id: form.company_id || null,
        ...financialFields,
      });
    }
    setSheetOpen(false);
    toast({ title: editing ? "Negócio atualizado" : "Negócio criado" });
  };

  const markAsWon = (dealId: string) => { store.updateDeal(dealId, { status: "won" }); toast({ title: "Negócio marcado como ganho! 🎉" }); };

  const openLossModal = (dealId: string) => { setLossDealId(dealId); setLossReason(""); setLossNote(""); setLossModalOpen(true); };

  const confirmLoss = () => {
    if (!lossDealId) return;
    store.updateDeal(lossDealId, { status: "lost", loss_reason: lossNote ? `${lossReason}: ${lossNote}` : lossReason });
    setLossModalOpen(false);
    toast({ title: "Negócio marcado como perdido" });
  };

  const handleBatchAction = (action: "won" | "lost" | "delete") => {
    const ids = Array.from(selectedDeals);
    if (action === "delete") { ids.forEach((id) => store.deleteDeal(id)); toast({ title: `${ids.length} negócios excluídos` }); }
    else if (action === "won") { ids.forEach((id) => store.updateDeal(id, { status: "won" })); toast({ title: `${ids.length} negócios marcados como ganhos` }); }
    else { ids.forEach((id) => store.updateDeal(id, { status: "lost" })); toast({ title: `${ids.length} negócios marcados como perdidos` }); }
    setSelectedDeals(new Set());
  };

  const openDeals = filteredDeals.filter((d) => d.status === "open");
  const wonDeals = filteredDeals.filter((d) => d.status === "won");
  const lostDeals = filteredDeals.filter((d) => d.status === "lost");

  return (
    <div className="space-y-3">
      {/* Header — Pipedrive-inspired */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight">Negócios</h1>

          {/* View mode toggle */}
          <div className="flex rounded-md border border-border bg-muted/50 p-0.5">
            {[
              { mode: "kanban" as const, icon: Kanban, label: "Kanban" },
              { mode: "list" as const, icon: List, label: "Lista" },
              { mode: "forecast" as const, icon: TrendingUp, label: "Previsão" },
            ].map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                aria-label={`Visualização ${label}`}
                className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                  viewMode === mode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" /><span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          <Button onClick={() => openNew()} size="sm" className="gap-1">
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Negócio</span>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {filteredDeals.length} {filteredDeals.length === 1 ? "negócio" : "negócios"}
          </span>

          {pipelines.length > 0 && (
            <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
              <SelectTrigger className="h-8 w-40 text-xs border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          <Button variant="outline" size="icon" className="h-8 w-8" onClick={openPipelineEditor} aria-label="Personalizar pipeline">
            <Settings2 className="h-3.5 w-3.5" />
          </Button>

          <Button variant="outline" size="sm" className="h-8" onClick={() => setShowFilters(!showFilters)} aria-label="Alternar filtros">
            <Filter className="mr-1 h-3 w-3" /><span className="hidden sm:inline">Filtro</span>
          </Button>
        </div>
      </div>

      {showFilters && (
        <DealsFilters filters={filters} onFiltersChange={setFilters} members={members} />
      )}

      {viewMode === "kanban" && (
        <DealsKanban
          deals={openDeals}
          wonDeals={wonDeals}
          lostDeals={lostDeals}
          stages={pipelineStages}
          onDragEnd={handleDragEnd}
          onDealClick={(d) => navigate(`/deals/${d.id}`)}
          onAddDeal={openNew}
          onMarkWon={markAsWon}
          onMarkLost={openLossModal}
        />
      )}

      {viewMode === "list" && (
        <DealsList
          deals={filteredDeals}
          stages={stages}
          selectedDeals={selectedDeals}
          onSelectionChange={setSelectedDeals}
          onDealClick={(d) => navigate(`/deals/${d.id}`)}
          onBatchAction={handleBatchAction}
        />
      )}

      {viewMode === "forecast" && (
        <DealsForecast deals={openDeals} stages={pipelineStages} />
      )}

      {/* Create/Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? "Editar Negócio" : "Novo Negócio"}</SheetTitle>
            <SheetDescription>{editing ? "Atualize os dados do negócio" : "Preencha os dados do novo negócio"}</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Nome do negócio" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input type="number" value={form.value ?? ""} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Moeda</Label>
                <Select value={form.currency || "BRL"} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BRL">BRL (R$)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Estágio</Label>
              <Select value={form.stage_id || ""} onValueChange={(v) => setForm({ ...form, stage_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {pipelineStages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Contato</Label>
              <Select value={form.contact_id || "none"} onValueChange={(v) => setForm({ ...form, contact_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar contato" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select value={form.company_id || "none"} onValueChange={(v) => setForm({ ...form, company_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar empresa" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select value={form.owner_id || "none"} onValueChange={(v) => setForm({ ...form, owner_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar responsável" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name || m.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Probabilidade (%)</Label>
                <Input type="number" min={0} max={100} value={form.probability ?? ""} onChange={(e) => setForm({ ...form, probability: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Fechamento</Label>
                <Input type="date" value={form.close_date || ""} onChange={(e) => setForm({ ...form, close_date: e.target.value })} />
              </div>
            </div>

            {/* Detalhes da Operação Financeira */}
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Detalhes da operação</p>
              <div className="space-y-2">
                <Label>Tipo de serviço *</Label>
                <Select
                  value={(form as any).service_type || ""}
                  onValueChange={(v) => setForm({ ...form, ...(v ? { service_type: v } : {}) } as any)}
                >
                  <SelectTrigger><SelectValue placeholder="Selecionar tipo" /></SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Valor solicitado (R$)</Label>
                  <Input type="number" value={(form as any).requested_amount ?? ""}
                    onChange={(e) => setForm({ ...form, requested_amount: e.target.value ? Number(e.target.value) : null } as any)} />
                </div>
                <div className="space-y-2">
                  <Label>Linha de crédito</Label>
                  <Select
                    value={(form as any).credit_line || ""}
                    onValueChange={(v) => setForm({ ...form, credit_line: v } as any)}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      {CREDIT_LINES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Taxa (% a.m.)</Label>
                  <Input type="number" step="0.01" value={(form as any).interest_rate ?? ""}
                    onChange={(e) => setForm({ ...form, interest_rate: e.target.value ? Number(e.target.value) : null } as any)} />
                </div>
                <div className="space-y-2">
                  <Label>Prazo (meses)</Label>
                  <Input type="number" value={(form as any).term_months ?? ""}
                    onChange={(e) => setForm({ ...form, term_months: e.target.value ? Number(e.target.value) : null } as any)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Banco operador</Label>
                <Input value={(form as any).operating_bank || ""}
                  onChange={(e) => setForm({ ...form, operating_bank: e.target.value } as any)}
                  placeholder="Ex.: Banco do Brasil, Caixa, Sicoob..." />
              </div>
            </div>

            <Button onClick={handleSave} className="w-full">{editing ? "Salvar" : "Criar Negócio"}</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Loss Reason Modal */}
      <Dialog open={lossModalOpen} onOpenChange={setLossModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Motivo da Perda</DialogTitle>
            <DialogDescription>Por que este negócio foi perdido?</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Select value={lossReason} onValueChange={setLossReason}>
                <SelectTrigger><SelectValue placeholder="Selecionar motivo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Preço">Preço muito alto</SelectItem>
                  <SelectItem value="Concorrência">Perdeu para concorrência</SelectItem>
                  <SelectItem value="Timing">Timing inadequado</SelectItem>
                  <SelectItem value="Budget">Sem orçamento</SelectItem>
                  <SelectItem value="Fit">Produto não atende</SelectItem>
                  <SelectItem value="Sem resposta">Sem resposta do cliente</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observação (opcional)</Label>
              <Textarea value={lossNote} onChange={(e) => setLossNote(e.target.value)} placeholder="Detalhes adicionais..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLossModalOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmLoss} disabled={!lossReason}>Confirmar Perda</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pipeline Customization Dialog */}
      <Dialog open={pipelineDialogOpen} onOpenChange={setPipelineDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Personalizar Pipeline</DialogTitle>
            <DialogDescription>Edite os estágios do seu pipeline de vendas</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {editingStages.map((stage, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="color"
                  value={stage.color}
                  onChange={(e) => updateEditStage(idx, "color", e.target.value)}
                  className="h-8 w-8 cursor-pointer rounded border-0 shrink-0"
                  aria-label={`Cor do estágio ${idx + 1}`}
                />
                <Input
                  value={stage.name}
                  onChange={(e) => updateEditStage(idx, "name", e.target.value)}
                  placeholder={`Estágio ${idx + 1}`}
                  className="flex-1"
                />
                <div className="flex items-center gap-1 shrink-0">
                  <Input
                    type="number" min={0} max={100}
                    value={stage.win_probability}
                    onChange={(e) => updateEditStage(idx, "win_probability", Number(e.target.value))}
                    className="w-16 text-xs text-center"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
                {editingStages.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeEditStage(idx)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addEditStage}>
              <Plus className="mr-1 h-3.5 w-3.5" />Adicionar estágio
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPipelineDialogOpen(false)}>Cancelar</Button>
            <Button onClick={savePipelineStages} disabled={savingPipeline || editingStages.some((s) => !s.name.trim())}>
              {savingPipeline && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
