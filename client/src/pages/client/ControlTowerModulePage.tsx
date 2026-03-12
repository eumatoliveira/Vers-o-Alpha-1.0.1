import { useMemo, useRef, useState } from "react";
import { Redirect } from "wouter";
import { AnimatePresence, m } from "framer-motion";
import { useAuth } from "@/_core/hooks/useAuth";
import { getPlanBusinessRulebook, normalizePlanTier } from "@shared/controlTowerRules";
import type { AlertEvent, ControlTowerFact, ControlTowerFilterState } from "@shared/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { getControlTowerLocale } from "@/lib/controlTowerLocale";
import { trpc } from "@/lib/trpc";
import {
  canAccessClientDomain,
  getDefaultDashboardPathByRole,
  resolveClientDashboardRole,
  type ClientDomainModule,
} from "@/lib/clientDashboardRole";
import { ControlTowerFilterProvider } from "@/features/control-tower/state/ControlTowerFilterContext";
import { useGlobalFilters } from "@/features/control-tower/hooks/useGlobalFilters";
import { useAlertEngine } from "@/features/control-tower/hooks/useAlertEngine";
import { exportDashboard } from "@/features/control-tower/utils/exportService";
import { formatCurrency, formatPercent } from "@/features/control-tower/utils/formatters";
import DataIngestion from "@/features/control-tower/components/DataIngestion";
import WarRoom from "@/features/control-tower/components/WarRoom";
import PainelEquipe from "@/features/control-tower/components/PainelEquipe";
import PainelFinanceiro from "@/features/control-tower/components/PainelFinanceiro";
import PainelGrowth from "@/features/control-tower/components/PainelGrowth";
import PainelOperacoes from "@/features/control-tower/components/PainelOperacoes";
import PainelQualidade from "@/features/control-tower/components/PainelQualidade";
import { MetricCard, Panel } from "@/features/control-tower/components/shared";
import AgendaNoShowOverviewBoard from "@/features/control-tower/components/AgendaNoShowOverviewBoard";
import ControlTowerClientLayout from "@/components/client/ControlTowerClientLayout";
import PriorityAlertBar from "@/animation/components/PriorityAlertBar";
import { cardEntranceStagger, pageTransitions, pulseP1, shimmerOnce } from "@/animation/config/motionPresets";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useClientDashboardTheme } from "@/contexts/ClientDashboardThemeContext";

export type DomainPageModule =
  | "financeiro"
  | "operacoes"
  | "growth"
  | "qualidade"
  | "equipe"
  | "ingestao"
  | "warroom";

function moduleLabels(locale: ReturnType<typeof getControlTowerLocale>, module: DomainPageModule) {
  const map = {
    financeiro: { title: locale.financial.title, subtitle: "Controle profundo de margem e fluxo." },
    operacoes: { title: locale.operations.title, subtitle: "Eficiencia operacional e capacidade." },
    growth: { title: locale.growth.title, subtitle: "Funil, CAC, LTV e ROI por canal." },
    qualidade: { title: locale.quality.title, subtitle: "Experiencia do paciente e NPS." },
    equipe: { title: locale.team.title, subtitle: "Performance por area e profissional." },
    ingestao: { title: locale.parser.title, subtitle: "Data Control Layer: integracoes, qualidade e commit." },
    warroom: { title: locale.warRoom.title, subtitle: locale.warRoom.subtitle },
  } satisfies Record<DomainPageModule, { title: string; subtitle: string }>;
  return map[module];
}

const ESSENCIAL_GAPS_V2 = [
  "Alertas por WhatsApp/e-mail incluidos por padrao",
  "Periodo 7 dias no modulo financeiro para visibilidade de caixa",
  "DSH (saude da fonte de dados) com alerta de dados incompletos/atrasados",
  "SLA de integracao definido: atualizacao maxima a cada 4h (ou near-realtime via webhook)",
  "Onboarding guiado em 5 dias com checklist de ativacao",
  "Benchmarks setoriais por especialidade embutidos",
  "Exportacao em PDF executivo mensal automatica no dia 1 de cada mes",
];

const ESSENCIAL_VALUE_DELIVERED = [
  "Painel unificado com 4 modulos: Agenda, Financeiro, Marketing e Operacao",
  "Alertas P1/P2/P3 automaticos via dashboard + notificacao push",
  "Benchmark por especialidade embutido",
  "Exportacao mensal automatica em PDF para reunioes com socios",
  "Onboarding em 5 dias com suporte GLX incluso",
  "Identificacao media de R$ 15K-40K/mes em receita nao capturada em clinicas do perfil",
];

const ESSENCIAL_ONBOARDING_STEPS = [
  { day: "Dia 1", activity: "Kickoff + mapeamento das fontes de dados", owner: "GLX + Cliente", deliverable: "Mapa de integracoes" },
  { day: "Dias 2-3", activity: "Configuracao de conexoes (CRM, agenda, financeiro)", owner: "GLX Ops", deliverable: "Dados fluindo" },
  { day: "Dias 3-4", activity: "Setup de metas e thresholds por KPI", owner: "GLX + Gestor", deliverable: "Painel calibrado" },
  { day: "Dia 5", activity: "Treinamento do time + go-live", owner: "GLX", deliverable: "Dashboard ativo + rotina semanal" },
  { day: "+30d", activity: "Revisao de calibragem (metas, alertas)", owner: "GLX", deliverable: "Painel ajustado a realidade" },
];

const PRO_GAPS_V2 = [
  "Simulador de overbooking com analise de sensibilidade (NPS x Receita)",
  "DRE semanal com detalhamento por centro de custo",
  "Forecast com bandas de confianca P10/P50/P90 baseadas em IA",
  "Modulo de Saude dos Dados: score de completude por fonte (agenda/CRM/financeiro)",
  "Decomposicao Waterfall de variacao de receita: Volume x Preco x Mix x No-show x Retencao",
  "Alertas inteligentes: machine learning detecta anomalias fora de padrao historico",
  "Integracao bidirecional com CRM (Doctoralia, iClinic, Clinicorp, MedX)",
  "Score de eficiencia por profissional com benchmark interno",
];

const PRO_VALUE_DELIVERED = [
  "Tudo do Start + 4 modulos avancados com granularidade por profissional/servico",
  "Simuladores interativos: overbooking, forecast, break-even e mix de servicos",
  "Margem real por procedimento - identifica quais servicos destroem e quais criam valor",
  "LTV e CAC completo por canal - decisao de marketing baseada em ROI real",
  "Score de eficiencia por profissional com benchmark interno",
  "Forecast de caixa 8 semanas com bandas de confianca por IA",
  "Identificacao media de R$ 40K-120K/mes em margem recuperavel em clinicas Pro",
];

const PRO_COMPARISON_ROWS = [
  { label: "Granularidade", essencial: "Consolidado / unidade", pro: "Por profissional, servico e canal" },
  { label: "Modulo financeiro", essencial: "Visibilidade (6 KPIs)", pro: "Otimizacao + Forecast IA (8 KPIs)" },
  { label: "Simuladores", essencial: "Nao incluso", pro: "Overbooking, Break-even, Mix de servicos" },
  { label: "Margem", essencial: "Margem liquida geral", pro: "Margem por servico e por profissional" },
  { label: "LTV/CAC/ROI", essencial: "CPL basico", pro: "LTV, CAC, ROI e Waterfall completos" },
  { label: "Forecast", essencial: "Projecao 15 dias", pro: "Forecast 8 semanas com IA (P10/P50/P90)" },
  { label: "Alertas", essencial: "P1/P2/P3 por threshold", pro: "P1/P2/P3 + anomaly detection por ML" },
  { label: "Exportacao", essencial: "PDF mensal automatico", pro: "PDF mensal + relatorio por modulo sob demanda" },
  { label: "MRR recomendado", essencial: "R$ 3.500-4.000/mes", pro: "R$ 6.000/mes" },
];

const ENTERPRISE_GAPS_V2 = [
  "Valuation automatico agora usa multiplos dinamicos ajustados por risco (nao multiplo fixo)",
  "Alertas estruturais separados dos operacionais (S1/S2/S3 vs P1/P2/P3)",
  "Investor Dashboard com LGPD compliance (sem dados sensiveis)",
  "Score da rede (0-100) com decomposicao por crescimento, margem, ops e risco",
  "Simulador M&A com analise de sinergia configuravel",
  "Governanca multiusuario: RBAC com 8 roles + trilha de auditoria completa",
  "API Enterprise para Power BI / Looker / Tableau",
  "Playbook automatico: unidade top 10% da rede - GLX replica o que funciona na pior unidade",
  "QBR automatizado com relatorio trimestral",
];

const ENTERPRISE_VALUE_DELIVERED = [
  "Tudo do Pro em cada unidade + camada de rede com benchmark e consolidacao real",
  "Valuation automatico atualizado mensalmente - EBITDA normalizado x multiplo de risco",
  "Dashboard de investidor exportavel: linguagem, densidade e privacidade adequados",
  "Simulador M&A: payback, ROI e EBITDA consolidado pos-aquisicao",
  "Score da rede com ranking de unidades e playbook automatico",
  "Governanca enterprise: RBAC, auditoria, permissoes por unidade e SSO",
  "API para BI externo - dados limpos e estruturados para Power BI / Looker",
  "QBR automatizado - relatorio trimestral sem esforco manual da gestao",
];

const ENTERPRISE_ALERT_ARCH_ROWS = [
  { type: "Operacional (Pro)", frequency: "Diario/semanal", severity: "P1 / P2 / P3", example: "No-show > 20% hoje", cta: "Abrir RCA" },
  { type: "Estrutural (Enterprise)", frequency: "Semanal/mensal", severity: "S1 / S2 / S3", example: "Unidade C abaixo P25 por 3 meses", cta: "Ver Playbook da Unidade A" },
  { type: "Anomalia (ML)", frequency: "Tempo real", severity: "A1 / A2", example: "Conversao caiu 3? em 48h", cta: "Investigar causa" },
  { type: "Governance", frequency: "Evento", severity: "G1 (critico)", example: "Acesso indevido a dados financeiros", cta: "Bloquear usuario" },
];

const ENTERPRISE_ROLE_ROWS = [
  { role: "NETWORK_OWNER", access: "Total: leitura, escrita, config, export, M&A, usuarios", restrictions: "Nenhuma" },
  { role: "NETWORK_EXEC", access: "Tudo leitura + export + valuation (sem config)", restrictions: "Nao gerencia usuarios" },
  { role: "UNIT_MANAGER", access: "Sua unidade: leitura + acoes operacionais", restrictions: "Sem acesso a outras unidades" },
  { role: "FINANCE_LEAD", access: "Financeiro + valuation - leitura + export", restrictions: "Sem modulos de ops/marketing" },
  { role: "MARKETING_LEAD", access: "Marketing + funil - leitura + export", restrictions: "Sem financeiro / valuation" },
  { role: "OPS_LEAD", access: "Operacao + SLA + checklists", restrictions: "Sem financeiro / valuation" },
  { role: "INVESTOR_VIEW", access: "Investor Dashboard + export PDF (somente)", restrictions: "Sem nomes / dados sensiveis" },
  { role: "AUDITOR", access: "Leitura completa + logs de auditoria", restrictions: "Sem escrita / configuracao" },
];

const ENTERPRISE_TECH_ROWS = [
  { system: "Doctoralia / iClinic / Clinicorp", type: "API REST bidirecional", latency: "< 4h (webhook: real-time)", data: "Agenda, CRM, paciente" },
  { system: "Meta Ads / Google Ads", type: "API OAuth 2.0", latency: "< 6h", data: "Leads, gasto, conversao" },
  { system: "Sistemas financeiros (Omie, Sienge)", type: "API REST", latency: "< 12h", data: "DRE, caixa, recebiveis" },
  { system: "WhatsApp Business (Evolution API)", type: "Webhook", latency: "Real-time", data: "Confirmacoes, NPS, leads" },
  { system: "Power BI / Looker / Tableau", type: "API Enterprise GLX", latency: "Real-time via streaming", data: "Todos os KPIs normalizados" },
  { system: "ERP hospitalar (Tasy, MV)", type: "Conector customizado", latency: "< 24h", data: "Producao, faturamento" },
];

const ENTERPRISE_INFRA_GAPS_V2 = [
  "SLA de uptime: 99,5% garantido por contrato com SLA financeiro (desconto em MRR se violado)",
  "Backups diarios automaticos + retencao de dados historicos por 5 anos",
  "LGPD compliance certificado: dados de paciente nunca expostos no Investor View",
  "Suporte enterprise: canal dedicado no Slack com resposta em ate 2h em dias uteis",
  "QBR automatico: relatorio trimestral gerado e enviado pelo sistema sem esforco manual",
];

function summary(facts: ControlTowerFact[]) {
  const gross = facts.reduce((a, r) => a + r.entries, 0);
  const exits = facts.reduce((a, r) => a + r.exits, 0);
  const net = gross - exits;
  const slots = facts.reduce((a, r) => a + r.slotsAvailable, 0);
  const empty = facts.reduce((a, r) => a + r.slotsEmpty, 0);
  const occupancy = slots > 0 ? ((slots - empty) / slots) * 100 : 0;
  const noShow = facts.length > 0 ? (facts.filter(r => r.status === "noshow").length / facts.length) * 100 : 0;
  return { gross, net, occupancy, noShow };
}

function trend12Weeks(facts: ControlTowerFact[]) {
  const map = new Map<string, number>();
  for (const row of facts) {
    const d = new Date(row.timestamp);
    const year = d.getUTCFullYear();
    const week = Math.ceil(
      ((Date.UTC(year, d.getUTCMonth(), d.getUTCDate()) - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7,
    );
    const key = `${year}-W${String(week).padStart(2, "0")}`;
    map.set(key, (map.get(key) ?? 0) + row.revenueValue);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12);
}

function FilterBar({
  facts,
  filters,
  setFilter,
  clearFilters,
}: {
  facts: ControlTowerFact[];
  filters: ControlTowerFilterState;
  setFilter: <K extends keyof ControlTowerFilterState>(key: K, value: ControlTowerFilterState[K]) => void;
  clearFilters: () => void;
}) {
  const { isDark } = useClientDashboardTheme();
  const list = (getter: (f: ControlTowerFact) => string | undefined) =>
    Array.from(new Set(facts.map(getter).filter(Boolean) as string[])).sort();
  const channels = useMemo(() => list(f => f.channel), [facts]);
  const pros = useMemo(() => list(f => f.professional), [facts]);
  const procedures = useMemo(() => list(f => f.procedure), [facts]);
  const pipelines = useMemo(() => list(f => f.pipeline), [facts]);
  const units = useMemo(() => list(f => f.unit), [facts]);
  const opts = (items: string[]) => items.map(v => <option key={v} value={v}>{v}</option>);
  const selectClass =
    cn(
      "rounded-md border px-2 py-2 text-xs supports-[backdrop-filter]:backdrop-blur-lg",
      isDark
        ? "border-white/10 bg-[#1b1511]/70 text-slate-100"
        : "border-gray-200 bg-white text-gray-900 shadow-sm",
    );

  return (
    <Panel title="Filtros globais" metricKey="funnel_matematico" language="pt">
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-9">
        <select className={selectClass} value={filters.period} onChange={e => setFilter("period", e.target.value as any)}>
          <option value="7d">7d</option>
          <option value="30d">30d</option>
          <option value="90d">90d</option>
          <option value="12m">12m</option>
          <option value="custom">custom</option>
        </select>
        <select className={selectClass} value={filters.channel ?? "all"} onChange={e => setFilter("channel", (e.target.value === "all" ? undefined : e.target.value) as any)}>
          <option value="all">Canal</option>{opts(channels)}
        </select>
        <select className={selectClass} value={filters.professional ?? "all"} onChange={e => setFilter("professional", (e.target.value === "all" ? undefined : e.target.value) as any)}>
          <option value="all">Profissional</option>{opts(pros)}
        </select>
        <select className={selectClass} value={filters.procedure ?? "all"} onChange={e => setFilter("procedure", (e.target.value === "all" ? undefined : e.target.value) as any)}>
          <option value="all">Procedimento</option>{opts(procedures)}
        </select>
        <select className={selectClass} value={filters.status ?? "all"} onChange={e => setFilter("status", (e.target.value === "all" ? undefined : e.target.value) as any)}>
          <option value="all">Status</option>
          <option value="agendado">Agendado</option>
          <option value="realizado">Realizado</option>
          <option value="cancelado">Cancelado</option>
          <option value="noshow">No-show</option>
        </select>
        <select className={selectClass} value={filters.pipeline ?? "all"} onChange={e => setFilter("pipeline", (e.target.value === "all" ? undefined : e.target.value) as any)}>
          <option value="all">Pipeline</option>{opts(pipelines)}
        </select>
        <select className={selectClass} value={filters.unit ?? "all"} onChange={e => setFilter("unit", (e.target.value === "all" ? undefined : e.target.value) as any)}>
          <option value="all">Unidade</option>{opts(units)}
        </select>
        <select className={selectClass} value={filters.alertSeverity ?? "all"} onChange={e => setFilter("alertSeverity", e.target.value as any)}>
          <option value="all">Severidade</option>
          <option value="P1">P1</option>
          <option value="P2">P2</option>
          <option value="P3">P3</option>
        </select>
        <Button
          variant="outline"
          className={cn(
            "border-white/15 hover:border-[#e67e22]",
            isDark ? "bg-transparent text-white" : "border-gray-300 bg-white text-gray-900 hover:bg-gray-50",
          )}
          onClick={clearFilters}
        >
          Limpar
        </Button>
      </div>
    </Panel>
  );
}

function renderAlertRows(alerts: AlertEvent[]) {
  if (alerts.length === 0) return <p className="text-xs text-slate-400">Sem alertas ativos.</p>;

  return (
    <div className="space-y-2">
      {alerts.slice(0, 8).map(alert => {
        const p1 = alert.severity === "P1";
        const p2 = alert.severity === "P2";
        return (
          <m.div
            key={alert.id}
            className={cn(
              "relative rounded-lg border p-3 supports-[backdrop-filter]:backdrop-blur-md",
              p1 ? "border-red-400/25 bg-red-500/10" : p2 ? "border-orange-400/20 bg-orange-500/5" : "border-white/10 bg-white/5",
            )}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            animate={p1 ? pulseP1 : undefined}
          >
            {p2 ? (
              <m.div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-lg"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.35 }}
                variants={shimmerOnce}
                style={{
                  backgroundImage: "linear-gradient(110deg, transparent 0%, rgba(251,191,36,0.10) 40%, transparent 70%)",
                  backgroundSize: "220% 100%",
                }}
              />
            ) : null}
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-slate-100">{alert.title}</p>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  p1 ? "bg-red-500/20 text-red-200" : p2 ? "bg-orange-500/20 text-orange-200" : "bg-blue-500/20 text-blue-200",
                )}
              >
                {alert.severity}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">{alert.description}</p>
          </m.div>
        );
      })}
    </div>
  );
}

function DomainModulePageInner({ module }: { module: DomainPageModule }) {
  const { user, logout, loading, isAuthenticated } = useAuth();
  const { isDark } = useClientDashboardTheme();
  const { language } = useLanguage();
  const locale = getControlTowerLocale(language);
  const role = resolveClientDashboardRole(user as any);
  const canEditIngestion = role === "TECHNICAL";
  const plan = normalizePlanTier(user?.plan);
  const { filters, setFilter, clearFilters } = useGlobalFilters();
  const q = trpc.controlTower.getModuleData.useQuery({ module, filters }, { refetchOnWindowFocus: false, staleTime: 20_000 });
  const syncKommoNow = trpc.controlTower.syncKommoNow.useMutation({
    onSuccess: () => {
      toast.success("Sincronizacao Kommo executada");
      q.refetch();
    },
    onError: () => toast.error("Falha ao sincronizar Kommo"),
  });

  const facts = q.data?.facts ?? [];
  const localEngine = useAlertEngine(facts);
  const alerts = q.data ? (q.data.alerts ?? localEngine.alerts) : [];
  const snapshot = q.data?.snapshot ?? localEngine.snapshot;
  const exportSummary = {
    margemLiquida: snapshot.margemLiquida,
    taxaNoshow: snapshot.taxaNoshow,
    impactoFinanceiro: snapshot.impactoFinanceiro,
    revpasAtual: snapshot.revpasAtual,
    revpas7Dias: snapshot.revpas7Dias,
    revpasDropPercent: snapshot.revpasDropPercent,
    slotsVazios: snapshot.slotsVazios,
    ticketMedio: snapshot.ticketMedio,
  } satisfies Record<string, number>;
  const meta = moduleLabels(locale, module);
  const alertsPanelRef = useRef<HTMLDivElement | null>(null);
  const [alertPanelFocusPulseKey, setAlertPanelFocusPulseKey] = useState(0);

  if (loading) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center", isDark ? "bg-[#0f0d0a]" : "bg-[#f3f4f6]")}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e67e22] border-t-transparent" />
      </div>
    );
  }
  if (!isAuthenticated || !user) return <Redirect to="/login" />;
  if (!canAccessClientDomain(role, module as ClientDomainModule, user?.plan)) return <Redirect to={getDefaultDashboardPathByRole(role)} />;

  const isOperacoesModule = module === "operacoes";
  const planRulebook = getPlanBusinessRulebook(plan);
  const planHeadline =
    planRulebook.plan === "enterprise"
      ? "Plano Enterprise"
      : planRulebook.plan === "pro"
        ? "Plano Pro"
        : "Plano Start";
  if (isOperacoesModule) {
    return (
      <ControlTowerClientLayout
        title={`${planHeadline}: Agenda & No-Show Overview`}
        moduleKey={module as ClientDomainModule}
        variant="analytics-full-shell-light"
      >
        <AgendaNoShowOverviewBoard planLabel={planHeadline} appearance="dark" facts={facts} />
      </ControlTowerClientLayout>
    );
  }

  const s = summary(facts);
  const trend = trend12Weeks(facts);
  const onDrillDown = (partial: Partial<ControlTowerFilterState>) => {
    Object.entries(partial).forEach(([k, v]) => setFilter(k as any, v as any));
  };
  const focusAlertsPanel = () => {
    alertsPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setAlertPanelFocusPulseKey(current => current + 1);
  };
  const integrationCatalog = [
    { key: "kommo", label: "Kommo CRM", provider: "OAuth + Webhook + REST Sync", slaMinutes: 5 },
    { key: "google-sheets", label: "Google Sheets", provider: "Sheets API / CSV bridge", slaMinutes: 60 },
    { key: "crm-api", label: "Outros CRMs via API", provider: "Pipedrive / RD / HubSpot (adapter)", slaMinutes: 30 },
    { key: "meta-ads", label: "Meta Ads", provider: "Marketing API", slaMinutes: 60 },
    { key: "google-ads", label: "Google Ads", provider: "Google Ads API", slaMinutes: 60 },
    { key: "google-tag-manager", label: "Google Tag Manager", provider: "GTM API / Data Layer", slaMinutes: 60 },
  ];

  return (
    <ControlTowerClientLayout
      title={meta.title}
      subtitle={meta.subtitle}
      moduleKey={module as ClientDomainModule}
      variant="analytics-full-shell-light"
      actions={
        <>
          <Button
            variant="outline"
            className={cn(
              "hover:border-[#e67e22]",
              isDark ? "border-white/15 bg-transparent text-white" : "border-gray-300 bg-white text-gray-900 hover:bg-gray-50",
            )}
            onClick={() => q.refetch()}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", q.isRefetching && "animate-spin")} /> Atualizar
          </Button>
          <Button
            variant="outline"
            className={cn(
              "hover:border-cyan-400",
              isDark
                ? "border-white/15 bg-transparent text-white"
                : "border-gray-300 bg-white text-gray-900 hover:bg-gray-50",
            )}
            onClick={() => exportDashboard({ format: "csv", scope: module, plan, filters, data: facts, summary: exportSummary })}
          >
            Exportar CSV
          </Button>
          <Button
            className="relative overflow-hidden border border-[#f6ab67]/25 bg-[linear-gradient(135deg,#e67e22_0%,#f08e36_58%,#cf6719_100%)] text-white shadow-[0_10px_24px_rgba(230,126,34,0.28)] transition hover:brightness-105 hover:shadow-[0_12px_30px_rgba(34,211,238,0.16)] focus-visible:ring-2 focus-visible:ring-cyan-300/40"
            onClick={() => exportDashboard({ format: "pdf", scope: module, plan, filters, data: facts, summary: exportSummary })}
          >
            Exportar PDF
          </Button>
          <Button
            variant="outline"
            className={cn(
              "hover:border-red-400",
              isDark
                ? "border-white/15 bg-transparent text-white"
                : "border-gray-300 bg-white text-gray-900 hover:bg-gray-50",
            )}
            onClick={async () => {
              await logout({ redirectTo: "/login" });
            }}
          >
            Sair
          </Button>
        </>
      }
    >
      <PriorityAlertBar alerts={alerts} onOpenP1={focusAlertsPanel} />

      <m.div variants={pageTransitions.enter} initial="hidden" animate="visible" className="space-y-4">
        <m.div variants={cardEntranceStagger(0.05, 0.02)} initial="hidden" animate="visible" className="space-y-4">
          <m.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
            <FilterBar facts={facts} filters={filters} setFilter={setFilter} clearFilters={clearFilters} />
          </m.div>

          <m.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
            <Panel title="Overview" metricKey="faturamento_liquido" language={language}>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Faturamento Bruto"
                  value={formatCurrency(s.gross)}
                  metricKey="dre_waterfall"
                  language={language}
                  emphasis={s.gross > 0 ? "positive" : "neutral"}
                />
                <MetricCard
                  label="Receita Liquida"
                  value={formatCurrency(s.net)}
                  metricKey="faturamento_liquido"
                  language={language}
                  emphasis={snapshot.margemLiquida < 10 ? "critical" : "positive"}
                />
                <MetricCard
                  label="Ocupacao"
                  value={formatPercent(s.occupancy)}
                  metricKey="heatmap_ocupacao"
                  language={language}
                  emphasis={s.occupancy < 60 ? "warning" : "neutral"}
                />
                <MetricCard
                  label="No-show"
                  value={formatPercent(s.noShow)}
                  metricKey="mapa_vazamentos_noshow"
                  language={language}
                  emphasis={s.noShow > 25 ? "critical" : s.noShow > 18 ? "warning" : "neutral"}
                />
              </div>
            </Panel>
          </m.div>

          <m.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
            <AgendaNoShowOverviewBoard planLabel={planHeadline} appearance="dark" facts={facts} hideHeader />
          </m.div>

          <m.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
            <Panel
              title="Detalhamento"
              metricKey={
                module === "financeiro"
                  ? "dre_waterfall"
                  : module === "growth"
                      ? "funnel_matematico"
                      : module === "qualidade"
                        ? "nps_exato"
                        : module === "equipe"
                          ? "multifatorial_equipe"
                          : "faturamento_liquido"
              }
              language={language}
            >
              {module === "financeiro" && <PainelFinanceiro language={language} locale={locale} facts={facts} onDrillDown={onDrillDown} />}
              {module === "growth" && <PainelGrowth language={language} locale={locale} facts={facts} onDrillDown={onDrillDown} />}
              {module === "qualidade" && <PainelQualidade language={language} locale={locale} facts={facts} onDrillDown={onDrillDown} />}
              {module === "equipe" && <PainelEquipe language={language} locale={locale} facts={facts} onDrillDown={onDrillDown} />}
              {module === "warroom" && (
                <WarRoom language={language} locale={locale} alerts={alerts} generateRCA={localEngine.generateRCA} onSaved={() => q.refetch()} />
              )}
              {module === "ingestao" && (
                <div className="space-y-4">
                  <Panel title="Health Check Tecnico" metricKey="impacto_financeiro" language={language}>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <MetricCard
                        label="% campos obrigatorios"
                        value={`${q.data?.ingestionHealth?.quality?.requiredFieldsPct ?? 0}%`}
                        metricKey="faturamento_liquido"
                        language={language}
                        emphasis={(q.data?.ingestionHealth?.quality?.requiredFieldsPct ?? 0) > 0 ? "positive" : "neutral"}
                      />
                      <MetricCard
                        label="Falhas API 24h"
                        value={`${q.data?.ingestionHealth?.technical?.apiFailures24h ?? 0}`}
                        metricKey="impacto_financeiro"
                        language={language}
                        emphasis={(q.data?.ingestionHealth?.technical?.apiFailures24h ?? 0) > 0 ? "warning" : "neutral"}
                      />
                      <MetricCard
                        label="Leads sem canal"
                        value={`${q.data?.ingestionHealth?.quality?.leadsSemCanal ?? 0}`}
                        metricKey="funnel_matematico"
                        language={language}
                        emphasis={(q.data?.ingestionHealth?.quality?.leadsSemCanal ?? 0) > 0 ? "warning" : "neutral"}
                      />
                      <MetricCard
                        label="Registros / dia"
                        value={`${q.data?.ingestionHealth?.technical?.volumeRegistrosDia ?? facts.length}`}
                        metricKey="funnel_matematico"
                        language={language}
                      />
                    </div>
                  </Panel>

                  <Panel title="Status de Integracoes" metricKey="funnel_matematico" language={language}>
                    <div className="space-y-2">
                      {(() => {
                        const apiItems = (q.data?.ingestionHealth?.integrations ?? []) as any[];
                        const merged = new Map<string, any>(apiItems.map(item => [String(item.key), item]));
                        for (const connector of integrationCatalog) {
                          if (!merged.has(connector.key)) {
                            merged.set(connector.key, {
                              key: connector.key,
                              label: connector.label,
                              provider: connector.provider,
                              status: "disconnected",
                              lastSyncAt: q.data?.ingestionHealth?.technical?.lastSyncAt ?? null,
                              slaMinutes: connector.slaMinutes,
                              failures24h: 0,
                            });
                          }
                        }
                        return Array.from(merged.values());
                      })().map((item: any) => (
                        <div key={item.key} className="rounded-lg border border-white/10 bg-white/[0.03] p-3 supports-[backdrop-filter]:backdrop-blur-md">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm text-slate-100">{item.label}</p>
                              <p className="text-xs text-slate-400">{item.provider}</p>
                            </div>
                            <span
                              className={cn(
                                "rounded-full px-2 py-1 text-[10px] font-semibold",
                                item.status === "connected"
                                  ? "bg-emerald-500/20 text-emerald-200"
                                  : item.status === "degraded"
                                    ? "bg-amber-500/20 text-amber-200"
                                    : "bg-red-500/20 text-red-200",
                              )}
                            >
                              {item.status}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-slate-300">
                            Ultima sincronizacao: {item.lastSyncAt ? new Date(item.lastSyncAt).toLocaleString() : "n/a"} · SLA: {item.slaMinutes} min · Falhas 24h: {item.failures24h}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="outline" className="border-white/15 bg-transparent text-white hover:border-[#e67e22]" onClick={() => q.refetch()}>
                        Verificar novamente
                      </Button>
                      <Button variant="outline" className="border-white/15 bg-transparent text-white hover:border-cyan-400">
                        Webhook diagnostics
                      </Button>
                      <Button variant="outline" className="border-white/15 bg-transparent text-white hover:border-emerald-400">
                        API integration
                      </Button>
                      <Button variant="outline" className="border-white/15 bg-transparent text-white hover:border-lime-400">
                        Google Sheets
                      </Button>
                      <Button variant="outline" className="border-white/15 bg-transparent text-white hover:border-blue-400">
                        Meta Ads
                      </Button>
                      <Button variant="outline" className="border-white/15 bg-transparent text-white hover:border-yellow-400">
                        Google Ads
                      </Button>
                      <Button
                        variant="outline"
                        className="border-white/15 bg-transparent text-white hover:border-orange-400"
                        onClick={() => syncKommoNow.mutate({ provider: "kommo" })}
                        disabled={syncKommoNow.isPending || !canEditIngestion}
                      >
                        {!canEditIngestion ? "Kommo (somente BI/Tecnico)" : syncKommoNow.isPending ? "Sincronizando..." : "CRM connector (Kommo)"}
                      </Button>
                    </div>
                  </Panel>

                  {canEditIngestion ? (
                    <DataIngestion language={language} locale={locale} onCommitted={() => q.refetch()} />
                  ) : (
                    <Panel title="Ingestao de Dados (restrita)" metricKey="faturamento_liquido" language={language}>
                      <p className="text-sm text-slate-200">
                        Este perfil possui acesso de leitura ao painel de integracoes (Kommo, Google Sheets, CRMs via API,
                        Meta Ads e Google Ads). Upload, validacao em grid e commit manual permanecem restritos ao perfil BI/Tecnico.
                      </p>
                    </Panel>
                  )}
                </div>
              )}
            </Panel>
          </m.div>

          <m.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
            <Panel
              title="Tendencia 12 semanas"
              metricKey={module === "growth" ? "mapa_vazamentos_noshow" : "faturamento_liquido"}
              language={language}
            >
              {trend.length === 0 ? (
                <p className="text-xs text-slate-400">Sem dados suficientes para tendencia.</p>
              ) : (
                <div className="space-y-2">
                  {trend.map(([week, revenue]) => {
                    const max = Math.max(...trend.map(([, value]) => value), 1);
                    return (
                      <div key={week} className="grid grid-cols-[88px_1fr_100px] items-center gap-3">
                        <span className="text-xs text-slate-300">{week}</span>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                          <m.div
                            initial={{ scaleX: 0 }}
                            whileInView={{ scaleX: 1 }}
                            viewport={{ once: true, amount: 0.35 }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                            style={{ width: `${Math.max(4, (revenue / max) * 100)}%`, transformOrigin: "left center" }}
                            className="h-full rounded-full bg-gradient-to-r from-[#e67e22] to-cyan-400"
                          />
                        </div>
                        <span className="text-right text-xs text-slate-300">{formatCurrency(revenue)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          </m.div>

          <m.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }} className="grid gap-4 xl:grid-cols-2">
            <div ref={alertsPanelRef} className="relative">
              <AnimatePresence>
                {alertPanelFocusPulseKey > 0 ? (
                  <m.div
                    key={`alert-focus-${alertPanelFocusPulseKey}`}
                    aria-hidden="true"
                    className="pointer-events-none absolute -inset-1 z-10 rounded-2xl border border-orange-300/30"
                    initial={{ opacity: 0, scale: 0.985, boxShadow: "0 0 0 rgba(251,146,60,0)" }}
                    animate={{
                      opacity: [0, 1, 0],
                      scale: [0.985, 1.004, 1],
                      boxShadow: [
                        "0 0 0 rgba(251,146,60,0)",
                        "0 0 22px rgba(251,146,60,0.25)",
                        "0 0 0 rgba(251,146,60,0)",
                      ],
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.1, ease: "easeInOut" }}
                  />
                ) : null}
              </AnimatePresence>

              <Panel
                title="Alertas ativos"
                metricKey="impacto_financeiro"
                language={language}
                intent={alerts.some(a => a.severity === "P1") ? "critical" : alerts.some(a => a.severity === "P2") ? "warning" : "default"}
              >
                {renderAlertRows(alerts)}
              </Panel>
            </div>

            {plan === "essencial" ? (
              <Panel title="Plano Start ativo" metricKey="impacto_financeiro" language={language}>
                <div className="space-y-3">
                  <p className="text-sm text-slate-200">
                    {planRulebook.narrative.description}
                  </p>

                  <div className="grid gap-2">
                    {planRulebook.modules.map((moduleRule) => (
                      <div
                        key={moduleRule.id}
                        className="rounded-lg border border-white/10 bg-white/[0.03] p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium text-slate-100">{moduleRule.label}</p>
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-300">
                            {moduleRule.kpiCount ?? 0} KPIs
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{moduleRule.notes[0]}</p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">
                      Upgrade contextual (Pro/Enterprise)
                    </p>
                    <p className="mt-1 text-sm text-slate-200">
                      Para granularidade por profissional/servico/canal, simuladores e forecast com IA,
                      habilite Pro/Enterprise.
                    </p>
                  </div>
                </div>
              </Panel>
            ) : (
              <Panel title="Decisao recomendada" metricKey="impacto_financeiro" language={language}>
                <p className="text-sm text-slate-200">
                  {alerts.some(a => a.severity === "P1")
                    ? "Acione War Room e priorize RCA dos alertas P1 antes de otimizacoes incrementais."
                    : module === "growth"
                      ? "Otimize canais com menor no-show e maior conversao para reduzir CAC e aumentar ROI."
                        : "Mantenha rotina semanal de revisao e valide tendencia de 12 semanas."}
                </p>
              </Panel>
            )}
          </m.div>
        </m.div>
      </m.div>
    </ControlTowerClientLayout>
  );
}

export default function ControlTowerModulePage({ module }: { module: DomainPageModule }) {
  return (
    <ControlTowerFilterProvider>
      <DomainModulePageInner module={module} />
    </ControlTowerFilterProvider>
  );
}
