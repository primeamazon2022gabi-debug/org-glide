import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCRMStore } from "@/hooks/useCRMStore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable,
} from "@dnd-kit/core";
import {
  Search, Settings2, Plus, MoreHorizontal, Kanban, List,
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Stage = Database["public"]["Tables"]["pipeline_stages"]["Row"];

const STAGE_COLORS = [
  "#94a3b8", // slate
  "#fbbf24", // amber
  "#60a5fa", // blue
  "#f87171", // red
  "#a78bfa", // violet
  "#34d399", // emerald
  "#fb923c", // orange
];

function fmtBRL(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
}

function initials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

/* Card */
function LeadCard({
  deal, contact, company, owner, onClick,
}: any) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id });
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50 }
    : undefined;

  const personName = contact ? `${contact.first_name || ""} ${contact.last_name || ""}`.trim() : (company?.name || "Lead");
  const tags: string[] = [];
  if (deal.service_type) tags.push(deal.service_type);
  if (deal.credit_line) tags.push(deal.credit_line);
  if (company?.industry) tags.push(company.industry);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`group relative cursor-pointer rounded-md border border-border bg-card px-3 py-2.5 shadow-sm transition-all hover:shadow-md hover:border-primary/40 ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      {/* top row: avatar + title */}
      <div className="flex items-start gap-2">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={owner?.avatar_url || ""} />
          <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
            {initials(personName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight text-foreground">
            {personName}
          </p>
          <p className="truncate text-[12px] text-muted-foreground leading-tight">
            {deal.title}
          </p>
        </div>
      </div>

      {/* value */}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[12px] font-semibold text-foreground">
          {fmtBRL(Number(deal.value) || 0)}
        </span>
        <span className="text-[10px] text-muted-foreground">1d</span>
      </div>

      {/* tags */}
      {tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {tags.slice(0, 3).map((t, i) => (
            <span
              key={i}
              className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* Column */
function StageColumn({
  stage, color, deals, contactsById, companiesById, profilesById, onCardClick, onAdd,
}: any) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const total = deals.reduce((s: number, d: any) => s + (Number(d.value) || 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={`flex w-[260px] shrink-0 flex-col rounded-md transition-colors ${
        isOver ? "bg-primary/5" : "bg-muted/30"
      }`}
    >
      {/* colored header bar */}
      <div
        className="rounded-t-md px-3 py-2"
        style={{ backgroundColor: color }}
      >
        <p className="text-[11px] font-bold uppercase tracking-wide text-white truncate">
          {stage.name}
        </p>
        <p className="text-[11px] text-white/90 mt-0.5">
          {deals.length} {deals.length === 1 ? "lead" : "leads"}: {fmtBRL(total)}
        </p>
      </div>

      <div className="flex flex-col gap-2 p-2 overflow-y-auto max-h-[calc(100vh-260px)]">
        {deals.map((d: any) => (
          <LeadCard
            key={d.id}
            deal={d}
            contact={contactsById.get(d.contact_id)}
            company={companiesById.get(d.company_id)}
            owner={profilesById.get(d.owner_id)}
            onClick={() => onCardClick(d.id)}
          />
        ))}
        <button
          onClick={() => onAdd(stage.id)}
          className="flex items-center justify-center gap-1 rounded-md border border-dashed border-border bg-background/50 py-2 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
        >
          <Plus className="h-3 w-3" /> Adicionar lead
        </button>
      </div>
    </div>
  );
}

/* Page */
export default function Pipeline() {
  const store = useCRMStore();
  const navigate = useNavigate();

  const pipelines = store.pipelines;
  const [selectedPipeline, setSelectedPipeline] = useState<string>(
    pipelines.find((p: any) => p.is_default)?.id || pipelines[0]?.id || ""
  );
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");

  const stages = useMemo(
    () =>
      (store.stages as Stage[])
        .filter((s) => s.pipeline_id === selectedPipeline)
        .sort((a, b) => a.order - b.order),
    [store.stages, selectedPipeline]
  );

  const contactsById = useMemo(() => new Map(store.contacts.map((c: any) => [c.id, c])), [store.contacts]);
  const companiesById = useMemo(() => new Map(store.companies.map((c: any) => [c.id, c])), [store.companies]);
  const profilesById = useMemo(() => new Map(store.profiles.map((p: any) => [p.id, p])), [store.profiles]);

  const openDeals = useMemo(
    () =>
      store.deals.filter((d: any) => {
        if (d.status !== "open") return false;
        if (!stages.some((s) => s.id === d.stage_id)) return false;
        if (search) {
          const c = contactsById.get(d.contact_id);
          const co = companiesById.get(d.company_id);
          const blob = `${d.title || ""} ${c?.first_name || ""} ${c?.last_name || ""} ${co?.name || ""}`.toLowerCase();
          if (!blob.includes(search.toLowerCase())) return false;
        }
        return true;
      }),
    [store.deals, stages, search, contactsById, companiesById]
  );

  const totalLeads = openDeals.length;
  const totalValue = openDeals.reduce((s: number, d: any) => s + (Number(d.value) || 0), 0);

  /* Task stats — based on activities linked to deals (no due_date filter available, just heuristic counters) */
  const today = new Date().toISOString().split("T")[0];
  const todayTasks = store.activities.filter((a: any) => !a.completed_at && a.due_date?.startsWith(today)).length;
  const unassignedTasks = store.activities.filter((a: any) => !a.completed_at && !a.assigned_to).length;
  const overdueTasks = store.activities.filter(
    (a: any) => !a.completed_at && a.due_date && a.due_date < today
  ).length;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    store.updateDeal(active.id as string, { stage_id: over.id as string });
  };

  const handleAdd = (stageId: string) => {
    navigate(`/deals?action=new&stage=${stageId}`);
  };

  return (
    <div className="-m-4 sm:-m-6 flex flex-col h-[calc(100vh-56px)] bg-background">
      {/* Top toolbar */}
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5">
        <h1 className="text-sm font-bold uppercase tracking-wider text-foreground">
          Funil de Vendas
        </h1>

        <div className="flex rounded-md border border-border bg-muted/50 p-0.5">
          <button
            onClick={() => setViewMode("kanban")}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
              viewMode === "kanban" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
            aria-label="Kanban"
          >
            <Kanban className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
              viewMode === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
            aria-label="Lista"
          >
            <List className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Busca e filtro"
            className="h-8 pl-8 text-xs"
          />
        </div>

        {pipelines.length > 1 && (
          <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
            <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {pipelines.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs font-medium text-foreground">
            {totalLeads} leads: <span className="font-semibold">{fmtBRL(totalValue)}</span>
          </span>
          <button className="text-muted-foreground hover:text-foreground" aria-label="Mais opções">
            <MoreHorizontal className="h-4 w-4" />
          </button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => navigate("/settings")}>
            <Settings2 className="h-3.5 w-3.5" /> Configurações
          </Button>
          <Button size="sm" className="h-8 gap-1.5" onClick={() => navigate("/deals?action=new")}>
            <Plus className="h-3.5 w-3.5" /> Novo Lead
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px border-b border-border bg-border">
        <div className="bg-card px-4 py-2.5">
          <p className="text-[11px] text-muted-foreground">Com tarefas para hoje:</p>
          <p className="text-lg font-bold text-foreground">{todayTasks}</p>
        </div>
        <div className="bg-card px-4 py-2.5">
          <p className="text-[11px] text-muted-foreground">Sem tarefas atribuídas:</p>
          <p className="text-lg font-bold text-primary">{unassignedTasks}</p>
        </div>
        <div className="bg-card px-4 py-2.5">
          <p className="text-[11px] text-muted-foreground">Com tarefas atrasadas:</p>
          <p className="text-lg font-bold text-destructive">{overdueTasks}</p>
        </div>
        <div className="bg-card px-4 py-2.5">
          <p className="text-[11px] text-muted-foreground">Novo hoje / ontem:</p>
          <p className="text-lg font-bold text-foreground">0 / 0</p>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-3">
        {viewMode === "kanban" ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className="flex gap-2 h-full">
              {stages.map((stage, idx) => {
                const stageDeals = openDeals.filter((d: any) => d.stage_id === stage.id);
                const color = stage.color || STAGE_COLORS[idx % STAGE_COLORS.length];
                return (
                  <StageColumn
                    key={stage.id}
                    stage={stage}
                    color={color}
                    deals={stageDeals}
                    contactsById={contactsById}
                    companiesById={companiesById}
                    profilesById={profilesById}
                    onCardClick={(id: string) => navigate(`/deals/${id}`)}
                    onAdd={handleAdd}
                  />
                );
              })}
            </div>
          </DndContext>
        ) : (
          <div className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
            Use o modo Kanban para visualizar o pipeline.
          </div>
        )}
      </div>
    </div>
  );
}
