import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCRMStore } from "@/hooks/useCRMStore";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { FileText, AlertTriangle, TrendingUp, Users, DollarSign } from "lucide-react";
import { SERVICE_TYPES, serviceLabel, serviceColor } from "@/lib/financialServices";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

export function FinancialDashboardWidgets() {
  const store = useCRMStore();
  const navigate = useNavigate();

  const deals = (store.deals as any[]) || [];
  const companies = (store.companies as any[]) || [];
  const activities = (store.activities as any[]) || [];
  const stages = (store.stages as any[]) || [];

  // 1) Negócios por tipo de serviço
  const dealsByService = useMemo(() => {
    return SERVICE_TYPES.map((s) => ({
      name: s.label,
      value: deals.filter((d) => d.service_type === s.value && d.status === "open").length,
      color: s.color,
    })).filter((d) => d.value > 0);
  }, [deals]);

  // 2) Capital em análise (negócios em estágio "Análise Bancária")
  const capitalInAnalysis = useMemo(() => {
    const analysisStageIds = stages
      .filter((s) => s.name?.toLowerCase().includes("análise") || s.name?.toLowerCase().includes("analise"))
      .map((s) => s.id);
    return deals
      .filter((d) => analysisStageIds.includes(d.stage_id) && d.status === "open")
      .reduce((sum, d) => sum + (Number(d.requested_amount) || Number(d.value) || 0), 0);
  }, [deals, stages]);

  // 3) Certificados vencendo
  const certs = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const buckets = { d30: [] as any[], d60: [] as any[], d90: [] as any[], expired: [] as any[] };
    companies.forEach((c) => {
      if (!c.certificate_expiry) return;
      const exp = new Date(c.certificate_expiry);
      const days = Math.ceil((exp.getTime() - today.getTime()) / 86400000);
      if (days < 0) buckets.expired.push(c);
      else if (days <= 30) buckets.d30.push(c);
      else if (days <= 60) buckets.d60.push(c);
      else if (days <= 90) buckets.d90.push(c);
    });
    return buckets;
  }, [companies]);

  // 4) Clientes inativos
  const inactiveCustomers = useMemo(() => {
    const now = Date.now();
    const activityByCompany = new Map<string, number>();
    activities.forEach((a) => {
      if (!a.company_id) return;
      const t = new Date(a.created_at || a.due_date || 0).getTime();
      activityByCompany.set(a.company_id, Math.max(activityByCompany.get(a.company_id) || 0, t));
    });

    let inactive60 = 0;
    let inactive120 = 0;
    companies.forEach((c) => {
      const last = activityByCompany.get(c.id) || new Date(c.created_at || 0).getTime();
      const days = Math.floor((now - last) / 86400000);
      if (days >= 120) inactive120++;
      else if (days >= 60) inactive60++;
    });
    return { inactive60, inactive120 };
  }, [companies, activities]);

  // 5) Conversão por tipo de serviço
  const conversionByService = useMemo(() => {
    return SERVICE_TYPES.map((s) => {
      const all = deals.filter((d) => d.service_type === s.value && (d.status === "won" || d.status === "lost"));
      const won = all.filter((d) => d.status === "won").length;
      const rate = all.length > 0 ? Math.round((won / all.length) * 100) : 0;
      return { name: s.label, total: all.length, won, rate, color: s.color };
    }).filter((s) => s.total > 0);
  }, [deals]);

  return (
    <div className="space-y-3">
      {/* Top metrics row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/deals")}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <Badge variant="secondary" className="text-[10px]">Em análise</Badge>
            </div>
            <p className="text-lg font-bold mt-2">{fmt(capitalInAnalysis)}</p>
            <p className="text-[11px] text-muted-foreground">Capital em análise bancária</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/companies")}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <FileText className="h-4 w-4 text-amber-500" />
              <Badge variant="secondary" className="text-[10px]">30 dias</Badge>
            </div>
            <p className="text-lg font-bold mt-2 text-amber-600">{certs.d30.length + certs.expired.length}</p>
            <p className="text-[11px] text-muted-foreground">
              Certificados vencendo {certs.expired.length > 0 && `(${certs.expired.length} vencidos)`}
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/companies")}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <Users className="h-4 w-4 text-muted-foreground" />
              <Badge variant="secondary" className="text-[10px]">60+ dias</Badge>
            </div>
            <p className="text-lg font-bold mt-2">{inactiveCustomers.inactive60}</p>
            <p className="text-[11px] text-muted-foreground">Clientes inativos</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/companies")}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <Badge variant="destructive" className="text-[10px]">120+ dias</Badge>
            </div>
            <p className="text-lg font-bold mt-2 text-destructive">{inactiveCustomers.inactive120}</p>
            <p className="text-[11px] text-muted-foreground">Em risco crítico</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Negócios abertos por tipo de serviço
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {dealsByService.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Nenhum negócio com tipo de serviço definido ainda.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dealsByService} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={0} angle={-15} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)", fontSize: 11,
                    }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {dealsByService.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Taxa de conversão por serviço
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {conversionByService.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Sem negócios fechados ainda para calcular conversão.</p>
            ) : (
              <div className="space-y-2 pt-2">
                {conversionByService.map((s) => (
                  <div key={s.name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-muted-foreground">{s.won}/{s.total} • <strong style={{ color: s.color }}>{s.rate}%</strong></span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${s.rate}%`, backgroundColor: s.color }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
