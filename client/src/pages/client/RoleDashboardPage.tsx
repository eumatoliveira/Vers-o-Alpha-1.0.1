import { useMemo, useState, type FormEvent } from "react";
import { Redirect, useLocation } from "wouter";
import {
  Bell,
  ChevronRight,
  Database,
  BriefcaseBusiness,
  CalendarClock,
  CircleDollarSign,
  Filter,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  ShieldAlert,
  Target,
  TrendingUp,
  User,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import type { AlertEvent, ControlTowerFilterState } from "@shared/types";
import {
  calcLtvLiquido,
  calcNrr,
  calcPaybackCac,
  getPlanBusinessRulebook,
  getPlanDashboardSidebarLabels,
  getPlanDashboardNarrative,
  isPlanAtLeast,
  normalizePlanTier,
} from "@shared/controlTowerRules";
import { useAuth } from "@/_core/hooks/useAuth";
import type { Language } from "@/i18n";
import { useLanguage } from "@/contexts/LanguageContext";
import { getControlTowerLocale } from "@/lib/controlTowerLocale";
import {
  canAccessClientDomain,
  canAccessWarRoom,
  getDefaultDashboardPathByRole,
  resolveClientDashboardRole,
  type ClientDomainModule,
  type ClientDashboardRole,
} from "@/lib/clientDashboardRole";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClientDashboardTheme } from "@/contexts/ClientDashboardThemeContext";
import { ControlTowerFilterProvider } from "@/features/control-tower/state/ControlTowerFilterContext";
import { useGlobalFilters } from "@/features/control-tower/hooks/useGlobalFilters";
import { useAlertEngine } from "@/features/control-tower/hooks/useAlertEngine";
import { exportDashboard } from "@/features/control-tower/utils/exportService";
import { formatCurrency, formatPercent } from "@/features/control-tower/utils/formatters";
import WarRoom from "@/features/control-tower/components/WarRoom";
import AgendaNoShowOverviewBoard from "@/features/control-tower/components/AgendaNoShowOverviewBoard";
import { MetricCard, Panel } from "@/features/control-tower/components/shared";

type RoleDashboardView = "ceo" | "gestor" | "operacional" | "warroom";

type RoleCopy = {
  shellTitle: Record<RoleDashboardView, string>;
  shellSubtitle: Record<RoleDashboardView, string>;
  nav: {
    dashboard: string;
    warroom: string;
    financial: string;
    growth: string;
    integrations: string;
    production: string;
    operationalFinancial: string;
    teamPerformance: string;
    operationalAlerts: string;
    myAgenda: string;
    myGoals: string;
    myPerformance: string;
  };
  ceo: {
    totalRevenue: string;
    netMargin: string;
    opportunityCost: string;
    revenuePerUnit: string;
    monthlyGrowth: string;
    cac: string;
    payback: string;
    ltv: string;
    oee: string;
    occupancy: string;
    revenueHour: string;
  };
  manager: {
    proceduresByType: string;
    averageTicket: string;
    conversion: string;
    scheduleByProfessional: string;
    chairOccupancy: string;
    rework: string;
    revenueByProfessional: string;
    marginByProcedure: string;
    waste: string;
    blockAlerts: string;
    impact: string;
  };
  operational: {
    blockAgenda: string;
    blockGoals: string;
    blockPerformance: string;
    patients: string;
    procedure: string;
    estimatedTime: string;
    status: string;
    revenueGoal: string;
    proceduresGoal: string;
    conversionGoal: string;
    conversionPersonal: string;
    ticketAverage: string;
    npsPersonal: string;
  };
  common: {
    noData: string;
    all: string;
    refresh: string;
    refreshing: string;
    exportCsv: string;
    exportPdf: string;
    logout: string;
    role: string;
    plan: string;
    live: string;
    searchPlaceholder: string;
  };
};

interface SideNavItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  anchor?: string;
}

type PlanCrmActionCopy = {
  label: string;
  helper: string;
  disabled?: boolean;
};

function buildPlanCrmActionCopy(params: {
  plan: ReturnType<typeof normalizePlanTier>;
  language: Language;
  canOpenIntegrations: boolean;
  role: ClientDashboardRole;
}) : PlanCrmActionCopy {
  const { plan, language, canOpenIntegrations, role } = params;
  const rulebook = getPlanBusinessRulebook(plan);

  if (!canOpenIntegrations) {
    return {
      label:
        language === "en"
          ? "Request CRM Access"
          : language === "es"
            ? "Solicitar acceso CRM"
            : "Solicitar acesso ao CRM",
      helper:
        language === "en"
          ? `Current role (${role}) does not have direct CRM/Integrations access.`
          : language === "es"
            ? `El perfil actual (${role}) no tiene acceso directo a CRM/Integraciones.`
            : `O perfil atual (${role}) nao possui acesso direto ao CRM/Integracoes.`,
      disabled: true,
    };
  }

  if (rulebook.plan === "enterprise") {
    return {
      label:
        language === "en"
          ? "Open CRM Governance"
          : language === "es"
            ? "Abrir gobernanza CRM"
            : "Abrir governanca de CRM",
      helper:
        language === "en"
          ? "RBAC, audit trail, DSH and BI external API layer."
          : language === "es"
            ? "RBAC, auditoria, DSH y capa de API BI externa."
            : "RBAC, auditoria, DSH e camada de API BI externa.",
    };
  }

  if (rulebook.plan === "pro") {
    return {
      label:
        language === "en"
          ? "Open CRM + Anomalies"
          : language === "es"
            ? "Abrir CRM + Anomalias"
            : "Abrir CRM + Anomalias",
      helper:
        language === "en"
          ? "Bidirectional CRM, source quality score and ML anomaly support."
          : language === "es"
            ? "CRM bidireccional, score de calidad de fuente y soporte de anomalias."
            : "CRM bidirecional, score de qualidade da fonte e suporte a anomalias.",
    };
  }

  const sla = rulebook.dataGovernance.integrationSlaHoursMax;
  return {
    label:
      language === "en"
        ? "Connect CRM (DSH)"
        : language === "es"
          ? "Conectar CRM (DSH)"
          : "Conectar CRM (DSH)",
    helper:
      language === "en"
        ? `Integrations/DSH included in plan with SLA up to ${sla ?? 4}h.`
        : language === "es"
          ? `Integraciones/DSH incluidas con SLA de hasta ${sla ?? 4}h.`
          : `Integracoes/DSH inclusas no plano com SLA de ate ${sla ?? 4}h.`,
  };
}

function dayKey(timestamp: string): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function safePercent(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return 0;
  return (numerator / denominator) * 100;
}

const ROLE_COPY: Record<Language, RoleCopy> = {
  pt: {
    shellTitle: {
      ceo: "CEO Dashboard",
      gestor: "Gestor Dashboard",
      operacional: "Operacional Dashboard",
      warroom: "War Room Executivo",
    },
    shellSubtitle: {
      ceo: "Decisao estrategica com foco em resultado consolidado",
      gestor: "Otimizacao tatica da operacao clinica",
      operacional: "Execucao diaria com metas e produtividade pessoal",
      warroom: "Riscos criticos e impacto financeiro em tempo real",
    },
    nav: {
      dashboard: "Dashboard",
      warroom: "Warroom",
      financial: "Financeiro",
      growth: "Growth",
      integrations: "Integracoes",
      production: "Producao",
      operationalFinancial: "Financeiro Operacional",
      teamPerformance: "Performance Equipe",
      operationalAlerts: "Alertas Operacionais",
      myAgenda: "Minha Agenda",
      myGoals: "Minhas Metas",
      myPerformance: "Minha Performance",
    },
    ceo: {
      totalRevenue: "Receita Total",
      netMargin: "Margem Liquida",
      opportunityCost: "Custo de Oportunidade",
      revenuePerUnit: "Receita por Unidade",
      monthlyGrowth: "Crescimento Mensal",
      cac: "CAC",
      payback: "Payback",
      ltv: "LTV Liquido",
      oee: "OEE Consolidado",
      occupancy: "Ocupacao Global",
      revenueHour: "Receita por Hora",
    },
    manager: {
      proceduresByType: "Procedimentos por Tipo",
      averageTicket: "Ticket Medio",
      conversion: "Conversao",
      scheduleByProfessional: "Agenda por Profissional",
      chairOccupancy: "Ocupacao por Cadeira",
      rework: "Retrabalho",
      revenueByProfessional: "Receita por Profissional",
      marginByProcedure: "Margem por Procedimento",
      waste: "Desperdicio",
      blockAlerts: "Alertas Operacionais",
      impact: "Impacto",
    },
    operational: {
      blockAgenda: "Agenda do Dia",
      blockGoals: "Metas Diarias",
      blockPerformance: "Performance Pessoal",
      patients: "Pacientes",
      procedure: "Procedimento",
      estimatedTime: "Tempo Estimado",
      status: "Status",
      revenueGoal: "Meta de Receita",
      proceduresGoal: "Meta de Procedimentos",
      conversionGoal: "Meta de Conversao",
      conversionPersonal: "Conversao Individual",
      ticketAverage: "Ticket Medio",
      npsPersonal: "NPS Pessoal",
    },
    common: {
      noData: "Sem dados para os filtros atuais.",
      all: "Todos",
      refresh: "Atualizar dados",
      refreshing: "Atualizando...",
      exportCsv: "Exportar CSV",
      exportPdf: "Exportar PDF",
      logout: "Sair",
      role: "Perfil",
      plan: "Plano",
      live: "Dados ao vivo",
      searchPlaceholder: "Buscar profissional, procedimento ou canal...",
    },
  },
  en: {
    shellTitle: {
      ceo: "CEO Dashboard",
      gestor: "Manager Dashboard",
      operacional: "Operational Dashboard",
      warroom: "Executive War Room",
    },
    shellSubtitle: {
      ceo: "Strategic decision-making with consolidated outcomes",
      gestor: "Tactical optimization for clinical operations",
      operacional: "Daily execution with goals and personal productivity",
      warroom: "Critical risks and real-time financial impact",
    },
    nav: {
      dashboard: "Dashboard",
      warroom: "Warroom",
      financial: "Financial",
      growth: "Growth",
      integrations: "Integrations",
      production: "Production",
      operationalFinancial: "Operational Financial",
      teamPerformance: "Team Performance",
      operationalAlerts: "Operational Alerts",
      myAgenda: "My Schedule",
      myGoals: "My Goals",
      myPerformance: "My Performance",
    },
    ceo: {
      totalRevenue: "Total Revenue",
      netMargin: "Net Margin",
      opportunityCost: "Opportunity Cost",
      revenuePerUnit: "Revenue per Unit",
      monthlyGrowth: "Monthly Growth",
      cac: "CAC",
      payback: "Payback",
      ltv: "Net LTV",
      oee: "Consolidated OEE",
      occupancy: "Global Occupancy",
      revenueHour: "Revenue per Hour",
    },
    manager: {
      proceduresByType: "Procedures by Type",
      averageTicket: "Average Ticket",
      conversion: "Conversion",
      scheduleByProfessional: "Schedule by Professional",
      chairOccupancy: "Chair Occupancy",
      rework: "Rework",
      revenueByProfessional: "Revenue by Professional",
      marginByProcedure: "Margin by Procedure",
      waste: "Waste",
      blockAlerts: "Operational Alerts",
      impact: "Impact",
    },
    operational: {
      blockAgenda: "Today's Schedule",
      blockGoals: "Daily Goals",
      blockPerformance: "Personal Performance",
      patients: "Patients",
      procedure: "Procedure",
      estimatedTime: "Estimated Time",
      status: "Status",
      revenueGoal: "Revenue Goal",
      proceduresGoal: "Procedure Goal",
      conversionGoal: "Conversion Goal",
      conversionPersonal: "Individual Conversion",
      ticketAverage: "Average Ticket",
      npsPersonal: "Personal NPS",
    },
    common: {
      noData: "No data for current filters.",
      all: "All",
      refresh: "Refresh data",
      refreshing: "Refreshing...",
      exportCsv: "Export CSV",
      exportPdf: "Export PDF",
      logout: "Logout",
      role: "Role",
      plan: "Plan",
      live: "Live data",
      searchPlaceholder: "Search professional, procedure or channel...",
    },
  },
  es: {
    shellTitle: {
      ceo: "Dashboard CEO",
      gestor: "Dashboard Gestor",
      operacional: "Dashboard Operacional",
      warroom: "War Room Ejecutivo",
    },
    shellSubtitle: {
      ceo: "Decision estrategica con foco en resultado consolidado",
      gestor: "Optimizacion tactica de la operacion clinica",
      operacional: "Ejecucion diaria con metas y productividad personal",
      warroom: "Riesgos criticos e impacto financiero en tiempo real",
    },
    nav: {
      dashboard: "Dashboard",
      warroom: "Warroom",
      financial: "Finanzas",
      growth: "Growth",
      integrations: "Integraciones",
      production: "Produccion",
      operationalFinancial: "Finanzas Operativas",
      teamPerformance: "Performance de Equipo",
      operationalAlerts: "Alertas Operativas",
      myAgenda: "Mi Agenda",
      myGoals: "Mis Metas",
      myPerformance: "Mi Performance",
    },
    ceo: {
      totalRevenue: "Ingresos Totales",
      netMargin: "Margen Neto",
      opportunityCost: "Costo de Oportunidad",
      revenuePerUnit: "Ingreso por Unidad",
      monthlyGrowth: "Crecimiento Mensual",
      cac: "CAC",
      payback: "Payback",
      ltv: "LTV Neto",
      oee: "OEE Consolidado",
      occupancy: "Ocupacion Global",
      revenueHour: "Ingreso por Hora",
    },
    manager: {
      proceduresByType: "Procedimientos por Tipo",
      averageTicket: "Ticket Medio",
      conversion: "Conversion",
      scheduleByProfessional: "Agenda por Profesional",
      chairOccupancy: "Ocupacion por Silla",
      rework: "Retrabajo",
      revenueByProfessional: "Ingreso por Profesional",
      marginByProcedure: "Margen por Procedimiento",
      waste: "Desperdicio",
      blockAlerts: "Alertas Operativas",
      impact: "Impacto",
    },
    operational: {
      blockAgenda: "Agenda del Dia",
      blockGoals: "Metas Diarias",
      blockPerformance: "Performance Personal",
      patients: "Pacientes",
      procedure: "Procedimiento",
      estimatedTime: "Tiempo Estimado",
      status: "Estado",
      revenueGoal: "Meta de Ingreso",
      proceduresGoal: "Meta de Procedimientos",
      conversionGoal: "Meta de Conversion",
      conversionPersonal: "Conversion Individual",
      ticketAverage: "Ticket Medio",
      npsPersonal: "NPS Personal",
    },
    common: {
      noData: "Sin datos para los filtros actuales.",
      all: "Todos",
      refresh: "Actualizar datos",
      refreshing: "Actualizando...",
      exportCsv: "Exportar CSV",
      exportPdf: "Exportar PDF",
      logout: "Salir",
      role: "Perfil",
      plan: "Plan",
      live: "Datos en vivo",
      searchPlaceholder: "Buscar profesional, procedimiento o canal...",
    },
  },
};

function buildNavItems(
  role: ClientDashboardRole,
  copy: RoleCopy,
  plan: ReturnType<typeof normalizePlanTier>,
): SideNavItem[] {
  const planLabels = getPlanDashboardSidebarLabels(plan);
  const byRole: SideNavItem[] =
    role === "CEO"
      ? [
      { id: "ceo-dashboard", label: copy.nav.dashboard, path: "/ceo", icon: LayoutDashboard },
      { id: "ceo-warroom", label: copy.nav.warroom, path: "/warroom", icon: ShieldAlert },
      { id: "ceo-financial", label: planLabels.financeiro, path: "/financeiro", icon: CircleDollarSign },
      { id: "ceo-growth", label: planLabels.marketing, path: "/growth", icon: TrendingUp },
      { id: "ceo-integrations", label: copy.nav.integrations, path: "/integracoes", icon: Database },
        ]
      : role === "MANAGER"
        ? [
      { id: "manager-production", label: planLabels.operacao, path: "/gestor", icon: BriefcaseBusiness },
      { id: "manager-financial", label: planLabels.financeiro, path: "/financeiro", icon: CircleDollarSign },
      { id: "manager-team", label: copy.nav.teamPerformance, path: "/equipe", icon: Users },
      { id: "manager-alerts", label: copy.nav.operationalAlerts, path: "/warroom", icon: ShieldAlert },
      { id: "manager-integrations", label: copy.nav.integrations, path: "/integracoes", icon: Database },
          ]
        : [
            { id: "ops-agenda", label: copy.nav.myAgenda, path: "/operacional", anchor: "section-ops-agenda", icon: CalendarClock },
            { id: "ops-goals", label: copy.nav.myGoals, path: "/operacional", anchor: "section-ops-goals", icon: Target },
            { id: "ops-performance", label: copy.nav.myPerformance, path: "/operacional", anchor: "section-ops-performance", icon: User },
          ];

  const routeToModule: Partial<Record<string, ClientDomainModule>> = {
    "/ceo": "ceo",
    "/warroom": "warroom",
    "/financeiro": "financeiro",
    "/growth": "growth",
    "/equipe": "equipe",
    "/integracoes": "ingestao",
  };

  return byRole.filter(item => {
    const module = routeToModule[item.path];
    if (!module) return true;
    return canAccessClientDomain(role, module, plan);
  });
}

function GlobalFilterBar({
  filters,
  setFilter,
  clearFilters,
  channelOptions,
  professionalOptions,
  procedureOptions,
  locale,
  copy,
  language,
}: {
  filters: ControlTowerFilterState;
  setFilter: <K extends keyof ControlTowerFilterState>(key: K, value: ControlTowerFilterState[K]) => void;
  clearFilters: () => void;
  channelOptions: string[];
  professionalOptions: string[];
  procedureOptions: string[];
  locale: ReturnType<typeof getControlTowerLocale>;
  copy: RoleCopy;
  language: Language;
}) {
  const { isDark } = useClientDashboardTheme();

  return (
    <Panel title={locale.filters.title} metricKey="funnel_matematico" language={language}>
      <div className="grid gap-2 lg:grid-cols-6">
        <select
          value={filters.period}
          onChange={event => setFilter("period", event.target.value as ControlTowerFilterState["period"])}
          className={cn(
            "rounded-md border px-3 py-2 text-xs",
            isDark
              ? "border-white/10 bg-[#1b1511] text-slate-100"
              : "border-gray-200 bg-white text-gray-900",
          )}
        >
          <option value="7d">{locale.filters.periodOptions["7d"]}</option>
          <option value="30d">{locale.filters.periodOptions["30d"]}</option>
          <option value="90d">{locale.filters.periodOptions["90d"]}</option>
          <option value="12m">{locale.filters.periodOptions["12m"]}</option>
        </select>

        <select
          value={filters.channel ?? "all"}
          onChange={event => setFilter("channel", (event.target.value === "all" ? undefined : event.target.value) as ControlTowerFilterState["channel"])}
          className={cn(
            "rounded-md border px-3 py-2 text-xs",
            isDark
              ? "border-white/10 bg-[#1b1511] text-slate-100"
              : "border-gray-200 bg-white text-gray-900",
          )}
        >
          <option value="all">{locale.filters.channel}: {copy.common.all}</option>
          {channelOptions.map(option => <option key={option} value={option}>{option}</option>)}
        </select>

        <select
          value={filters.professional ?? "all"}
          onChange={event => setFilter("professional", (event.target.value === "all" ? undefined : event.target.value) as ControlTowerFilterState["professional"])}
          className={cn(
            "rounded-md border px-3 py-2 text-xs",
            isDark
              ? "border-white/10 bg-[#1b1511] text-slate-100"
              : "border-gray-200 bg-white text-gray-900",
          )}
        >
          <option value="all">{locale.filters.professional}: {copy.common.all}</option>
          {professionalOptions.map(option => <option key={option} value={option}>{option}</option>)}
        </select>

        <select
          value={filters.procedure ?? "all"}
          onChange={event => setFilter("procedure", (event.target.value === "all" ? undefined : event.target.value) as ControlTowerFilterState["procedure"])}
          className={cn(
            "rounded-md border px-3 py-2 text-xs",
            isDark
              ? "border-white/10 bg-[#1b1511] text-slate-100"
              : "border-gray-200 bg-white text-gray-900",
          )}
        >
          <option value="all">{locale.filters.procedure}: {copy.common.all}</option>
          {procedureOptions.map(option => <option key={option} value={option}>{option}</option>)}
        </select>

        <select
          value={filters.status ?? "all"}
          onChange={event => setFilter("status", (event.target.value === "all" ? undefined : event.target.value) as ControlTowerFilterState["status"])}
          className={cn(
            "rounded-md border px-3 py-2 text-xs",
            isDark
              ? "border-white/10 bg-[#1b1511] text-slate-100"
              : "border-gray-200 bg-white text-gray-900",
          )}
        >
          <option value="all">{locale.filters.status}: {copy.common.all}</option>
          <option value="agendado">{locale.status.agendado}</option>
          <option value="realizado">{locale.status.realizado}</option>
          <option value="cancelado">{locale.status.cancelado}</option>
          <option value="noshow">{locale.status.noshow}</option>
        </select>

        <Button
          variant="outline"
          onClick={clearFilters}
          className={cn(
            "border-white/20 bg-transparent hover:border-[#e67e22]",
            isDark ? "text-slate-100" : "border-gray-300 bg-white text-gray-900 hover:bg-gray-50",
          )}
        >
          <Filter className="mr-2 h-4 w-4" />
          {locale.actions.clearFilters}
        </Button>
      </div>
    </Panel>
  );
}

function RoleDashboardPageContent({ view }: { view: RoleDashboardView }) {
  const { user, logout, loading, isAuthenticated } = useAuth();
  const { isDark } = useClientDashboardTheme();
  const { language } = useLanguage();
  const locale = getControlTowerLocale(language);
  const copy = ROLE_COPY[language];
  const plan = normalizePlanTier(user?.plan);
  const isProPlus = isPlanAtLeast(plan, "pro");
  const isEnterprise = isPlanAtLeast(plan, "enterprise");
  const planSummary = getPlanDashboardNarrative(plan);
  const [, setLocation] = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const { filters, setFilter, setFilters, clearFilters } = useGlobalFilters();
  const dashboardQuery = trpc.controlTower.getDashboardData.useQuery(filters, {
    refetchOnWindowFocus: false,
    staleTime: 20_000,
  });
  const facts = dashboardQuery.data?.facts ?? [];
  const localEngine = useAlertEngine(facts);
  const alerts = dashboardQuery.data ? (dashboardQuery.data.alerts ?? localEngine.alerts) : [];
  const snapshot = dashboardQuery.data?.snapshot ?? localEngine.snapshot;
  const userRole = resolveClientDashboardRole(user as any);
  const denied =
    (view === "ceo" && userRole !== "CEO") ||
    (view === "gestor" && userRole !== "MANAGER") ||
    (view === "operacional" && userRole !== "OPERATIONAL") ||
    (view === "warroom" && (!canAccessWarRoom(userRole) || !canAccessClientDomain(userRole, "warroom", plan)));

  const navItems = buildNavItems(userRole, copy, plan);
  const canOpenIntegrations = canAccessClientDomain(userRole, "ingestao", plan);
  const crmAction = buildPlanCrmActionCopy({
    plan,
    language,
    canOpenIntegrations,
    role: userRole,
  });
  const channelOptions = useMemo(() => Array.from(new Set(facts.map(row => row.channel))).sort(), [facts]);
  const professionalOptions = useMemo(() => Array.from(new Set(facts.map(row => row.professional))).sort(), [facts]);
  const procedureOptions = useMemo(() => Array.from(new Set(facts.map(row => row.procedure))).sort(), [facts]);

  const analytics = useMemo(() => {
    const totalRevenue = facts.reduce((sum, row) => sum + row.entries, 0);
    const totalCost = facts.reduce((sum, row) => sum + row.exits, 0);
    const netMargin = safePercent(totalRevenue - totalCost, totalRevenue);
    const revenuePerUnit = facts.length > 0 ? totalRevenue / facts.length : 0;

    const nowMs = Date.now();
    const dayMs = 86_400_000;
    const current30Revenue = facts
      .filter(row => nowMs - new Date(row.timestamp).getTime() <= 30 * dayMs)
      .reduce((sum, row) => sum + row.entries, 0);
    const previous30Revenue = facts
      .filter(row => {
        const age = nowMs - new Date(row.timestamp).getTime();
        return age > 30 * dayMs && age <= 60 * dayMs;
      })
      .reduce((sum, row) => sum + row.entries, 0);
    const monthlyGrowth = safePercent(current30Revenue - previous30Revenue, previous30Revenue || 1);

    const avgTicket = facts.length > 0 ? facts.reduce((sum, row) => sum + row.ticketMedio, 0) / facts.length : 0;
    const avgVariableCost = facts.length > 0 ? facts.reduce((sum, row) => sum + row.custoVariavel, 0) / facts.length : 0;
    const completedCount = facts.filter(row => row.status === "realizado").length;
    const cac = totalCost / Math.max(1, completedCount);
    const contribution = Math.max(1, avgTicket - avgVariableCost);
    const payback = calcPaybackCac(cac, contribution);
    const nrr = calcNrr(
      facts.reduce((sum, row) => sum + row.baseOldRevenueCurrent, 0),
      facts.reduce((sum, row) => sum + row.baseOldRevenuePrevious, 0),
    );
    const retention = Math.max(0.2, Math.min(2, nrr / 100));
    const frequency = Math.max(1, completedCount / Math.max(1, professionalOptions.length));
    const ltv = calcLtvLiquido(avgTicket, frequency, retention, avgVariableCost, cac);

    const totalSlots = facts.reduce((sum, row) => sum + row.slotsAvailable, 0);
    const occupiedSlots = facts.reduce((sum, row) => sum + Math.max(0, row.slotsAvailable - row.slotsEmpty), 0);
    const occupancy = safePercent(occupiedSlots, totalSlots || 1);
    const oee = facts.length === 0
      ? 0
      : facts.reduce((sum, row) => {
          const disponibilidade = row.slotsAvailable === 0 ? 0 : (row.slotsAvailable - row.slotsEmpty) / row.slotsAvailable;
          const performance = row.durationMinutes === 0 ? 0 : Math.min(1, 45 / row.durationMinutes);
          const qualidade = row.status === "realizado" ? 1 : 0.65;
          return sum + (disponibilidade * performance * qualidade);
        }, 0) / facts.length * 100;
    const totalDurationHours = facts.reduce((sum, row) => sum + row.durationMinutes, 0) / 60;
    const revenuePerHour = totalDurationHours > 0 ? totalRevenue / totalDurationHours : 0;

    const procedureStats = Array.from(
      facts.reduce((map, row) => {
        const current = map.get(row.procedure) ?? { procedure: row.procedure, volume: 0, revenue: 0, cost: 0 };
        current.volume += 1;
        current.revenue += row.entries;
        current.cost += row.exits;
        map.set(row.procedure, current);
        return map;
      }, new Map<string, { procedure: string; volume: number; revenue: number; cost: number }>()),
    ).map(([, item]) => ({
      ...item,
      marginPercent: safePercent(item.revenue - item.cost, item.revenue || 1),
    }));

    const professionalStats = Array.from(
      facts.reduce((map, row) => {
        const current = map.get(row.professional) ?? {
          professional: row.professional,
          total: 0,
          completed: 0,
          revenue: 0,
          ticketSum: 0,
          npsSum: 0,
          slots: 0,
          occupied: 0,
        };
        current.total += 1;
        current.completed += row.status === "realizado" ? 1 : 0;
        current.revenue += row.entries;
        current.ticketSum += row.ticketMedio;
        current.npsSum += row.npsScore;
        current.slots += row.slotsAvailable;
        current.occupied += Math.max(0, row.slotsAvailable - row.slotsEmpty);
        map.set(row.professional, current);
        return map;
      }, new Map<string, {
        professional: string;
        total: number;
        completed: number;
        revenue: number;
        ticketSum: number;
        npsSum: number;
        slots: number;
        occupied: number;
      }>()),
    ).map(([, item]) => ({
      professional: item.professional,
      conversion: safePercent(item.completed, item.total || 1),
      revenue: item.revenue,
      avgTicket: item.total > 0 ? item.ticketSum / item.total : 0,
      nps: item.total > 0 ? item.npsSum / item.total : 0,
      occupancy: safePercent(item.occupied, item.slots || 1),
    }));

    const totalAppointments = facts.length;
    const conversionRate = safePercent(completedCount, totalAppointments || 1);
    const reworkRate = safePercent(
      facts.filter(row => row.status === "cancelado" || row.status === "noshow").length,
      totalAppointments || 1,
    );

    const today = new Date().toISOString().slice(0, 10);
    const todayFacts = facts.filter(row => dayKey(row.timestamp) === today);
    const todayRevenue = todayFacts.reduce((sum, row) => sum + row.entries, 0);
    const todayCompleted = todayFacts.filter(row => row.status === "realizado").length;
    const todayConversion = safePercent(todayCompleted, todayFacts.length || 1);
    const distinctDays = new Set(facts.map(row => dayKey(row.timestamp))).size || 1;
    const goalRevenue = (totalRevenue / distinctDays) * 1.1;
    const goalProcedures = (completedCount / distinctDays) * 1.1;

    return {
      totalRevenue,
      netMargin,
      revenuePerUnit,
      monthlyGrowth,
      cac,
      payback,
      ltv,
      oee,
      occupancy,
      revenuePerHour,
      procedureStats,
      professionalStats,
      conversionRate,
      reworkRate,
      todayFacts,
      todayRevenue,
      todayCompleted,
      todayConversion,
      goalRevenue,
      goalProcedures,
    };
  }, [facts, professionalOptions.length]);

  const visibleAlerts = useMemo(() => {
    if (view === "ceo" || view === "warroom") return alerts;
    return alerts.filter(alert => alert.severity !== "P1" || userRole !== "OPERATIONAL");
  }, [alerts, view, userRole]);

  if (loading) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center", isDark ? "bg-[#0f0d0a]" : "bg-[#f3f4f6]")}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e67e22] border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Redirect to="/login" />;
  }

  if (denied) {
    return <Redirect to={getDefaultDashboardPathByRole(userRole)} />;
  }

  const onDrillDown = (partial: Partial<ControlTowerFilterState>) => {
    setFilters(prev => ({ ...prev, ...partial }));
  };

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    const query = searchTerm.trim().toLowerCase();
    if (!query) return;
    const channel = channelOptions.find(item => item.toLowerCase().includes(query));
    if (channel) {
      setFilter("channel", channel);
      return;
    }
    const professional = professionalOptions.find(item => item.toLowerCase().includes(query));
    if (professional) {
      setFilter("professional", professional);
      return;
    }
    const procedure = procedureOptions.find(item => item.toLowerCase().includes(query));
    if (procedure) {
      setFilter("procedure", procedure);
    }
  };

  const navigate = (item: SideNavItem) => {
    const search = typeof window === "undefined" ? "" : window.location.search;
    const samePath = typeof window !== "undefined" && window.location.pathname === item.path;

    if (!samePath) {
      setLocation(`${item.path}${search}`);
      if (item.anchor) {
        setTimeout(() => {
          document.getElementById(item.anchor!)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 120);
      }
      setSidebarOpen(false);
      return;
    }

    if (item.anchor) {
      document.getElementById(item.anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setSidebarOpen(false);
  };

  const exportScope = {
    margin: snapshot.margemLiquida,
    noShow: snapshot.taxaNoshow,
    impact: snapshot.impactoFinanceiro,
    revpas: snapshot.revpasAtual,
  };
  const planHeadline =
    plan === "enterprise"
      ? "Enterprise Plan"
      : plan === "pro"
        ? "Pro Plan"
        : "Start Plan";
  const sharedOperationalCharts = (
    <section id="section-shared-agenda-noshow">
      <AgendaNoShowOverviewBoard planLabel={planHeadline} appearance="dark" facts={facts} hideHeader />
    </section>
  );

  const renderCeoView = () => {
    const enterpriseNetworkScore = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          (analytics.netMargin * 0.25) +
            (analytics.occupancy * 0.35) +
            (Math.max(0, 100 - snapshot.taxaNoshow) * 0.2) +
            (Math.max(0, Math.min(100, analytics.monthlyGrowth + 50)) * 0.2),
        ),
      ),
    );
    const enterpriseValuationProxy = Math.max(
      0,
      analytics.totalRevenue *
        (analytics.netMargin / 100) *
        12 *
        (3 + (analytics.netMargin > 18 ? 1 : 0) + (analytics.monthlyGrowth > 0 ? 0.5 : 0)),
    );
    const enterpriseStructuralRisk = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          (snapshot.taxaNoshow * 1.8) +
            (analytics.reworkRate * 1.2) +
            (analytics.netMargin < 0 ? 40 : Math.max(0, 18 - analytics.netMargin)),
        ),
      ),
    );
    const enterpriseEbitdaMultiple = Math.max(
      2.5,
      Math.min(
        8.5,
        4 +
          (analytics.netMargin > 20 ? 1 : 0) +
          (analytics.monthlyGrowth > 10 ? 0.5 : 0) -
          (snapshot.taxaNoshow > 20 ? 0.5 : 0),
      ),
    );

    return (
      <div className="space-y-4">
        <section id="section-ceo-financial" className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label={copy.ceo.totalRevenue} value={formatCurrency(analytics.totalRevenue)} metricKey="faturamento_liquido" language={language} />
          <MetricCard label={copy.ceo.netMargin} value={formatPercent(analytics.netMargin)} metricKey="margem_ebitda_normalizada" language={language} />
          <MetricCard label={copy.ceo.opportunityCost} value={formatCurrency(snapshot.impactoFinanceiro)} metricKey="impacto_financeiro" language={language} />
          <MetricCard label={copy.ceo.revenuePerUnit} value={formatCurrency(analytics.revenuePerUnit)} metricKey="revpas" language={language} />
        </section>

        <section id="section-ceo-efficiency" className="grid gap-3 md:grid-cols-3">
          <MetricCard label={copy.ceo.oee} value={formatPercent(analytics.oee)} metricKey="mapa_vazamentos_ociosidade" language={language} />
          <MetricCard label={copy.ceo.occupancy} value={formatPercent(analytics.occupancy)} metricKey="heatmap_ocupacao" language={language} />
          <MetricCard label={copy.ceo.revenueHour} value={formatCurrency(analytics.revenuePerHour)} metricKey="margem_por_minuto" language={language} />
        </section>

        {isProPlus ? (
          <section id="section-ceo-growth" className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label={copy.ceo.monthlyGrowth} value={formatPercent(analytics.monthlyGrowth)} metricKey="nrr" language={language} />
            <MetricCard label={copy.ceo.cac} value={formatCurrency(analytics.cac)} metricKey="mapa_vazamentos_cac" language={language} />
            <MetricCard label={copy.ceo.payback} value={analytics.payback.toFixed(2)} metricKey="payback_cac" language={language} />
            <MetricCard label={copy.ceo.ltv} value={formatCurrency(analytics.ltv)} metricKey="ltv_liquido" language={language} />
          </section>
        ) : (
          <section id="section-ceo-growth">
            <Panel title="Graficos avancados (Pro/Enterprise)" metricKey="funnel_matematico" language={language}>
              <p className="text-sm text-slate-200">
                No plano Start ficam ativos os graficos executivos base (agenda, financeiro, marketing e operacao). No Pro/Enterprise entram CAC, LTV, Payback, forecast e granularidade por canal/profissional.
              </p>
            </Panel>
          </section>
        )}

        {isEnterprise ? (
          <section id="section-ceo-enterprise-layer" className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Score da Rede (0-100)"
              value={`${enterpriseNetworkScore}`}
              metricKey="funnel_matematico"
              language={language}
            />
            <MetricCard
              label="Valuation Estimado (proxy)"
              value={formatCurrency(enterpriseValuationProxy)}
              metricKey="margem_ebitda_normalizada"
              language={language}
            />
            <MetricCard
              label="Risco Estrutural (0-100)"
              value={`${enterpriseStructuralRisk}`}
              metricKey="mapa_vazamentos_noshow"
              language={language}
            />
            <MetricCard
              label="Multiplo EBITDA (proxy)"
              value={`${enterpriseEbitdaMultiple.toFixed(1)}x`}
              metricKey="margem_ebitda_normalizada"
              language={language}
            />
          </section>
        ) : null}

        {sharedOperationalCharts}

        <section id="section-ceo-alerts">
          <WarRoom language={language} locale={locale} alerts={visibleAlerts} generateRCA={localEngine.generateRCA} onSaved={() => dashboardQuery.refetch()} />
        </section>
      </div>
    );
  };

  const renderManagerView = () => (
    <div className="space-y-4">
      <section id="section-manager-production" className="grid gap-3 lg:grid-cols-2">
        <Panel title={copy.manager.proceduresByType} metricKey="multifatorial_equipe" language={language}>
          {analytics.procedureStats.length === 0 ? (
            <p className="text-xs text-slate-400">{copy.common.noData}</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400">
                  <th className="pb-2 text-left">{locale.labels.procedure}</th>
                  <th className="pb-2 text-right">{locale.labels.volume}</th>
                  <th className="pb-2 text-right">{locale.labels.marginPercent}</th>
                </tr>
              </thead>
              <tbody>
                {analytics.procedureStats.map(item => (
                  <tr key={item.procedure} className="border-t border-slate-800 text-slate-200">
                    <td className="py-2">{item.procedure}</td>
                    <td className="py-2 text-right">{item.volume}</td>
                    <td className="py-2 text-right">{formatPercent(item.marginPercent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <div className="grid gap-3 md:grid-cols-2">
          <MetricCard label={copy.manager.averageTicket} value={formatCurrency(analytics.revenuePerUnit)} metricKey="revpas" language={language} />
          <MetricCard label={copy.manager.conversion} value={formatPercent(analytics.conversionRate)} metricKey="funnel_matematico" language={language} />
          <MetricCard label={copy.manager.chairOccupancy} value={formatPercent(analytics.occupancy)} metricKey="heatmap_ocupacao" language={language} />
          <MetricCard label={copy.manager.rework} value={formatPercent(analytics.reworkRate)} metricKey="mapa_vazamentos_noshow" language={language} />
        </div>
      </section>

      {isProPlus ? (
        <>
          <section id="section-manager-financial" className="grid gap-3 lg:grid-cols-2">
            <Panel title={copy.manager.revenueByProfessional} metricKey="multifatorial_equipe" language={language}>
              {analytics.professionalStats.length === 0 ? (
                <p className="text-xs text-slate-400">{copy.common.noData}</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400">
                      <th className="pb-2 text-left">{locale.labels.professional}</th>
                      <th className="pb-2 text-right">{locale.labels.revenue}</th>
                      <th className="pb-2 text-right">{copy.manager.conversion}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.professionalStats.map(item => (
                      <tr key={item.professional} className="border-t border-slate-800 text-slate-200">
                        <td className="py-2">{item.professional}</td>
                        <td className="py-2 text-right">{formatCurrency(item.revenue)}</td>
                        <td className="py-2 text-right">{formatPercent(item.conversion)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>

            <div className="grid gap-3 md:grid-cols-2">
              <MetricCard label={copy.manager.marginByProcedure} value={formatPercent(analytics.netMargin)} metricKey="margem_ebitda_normalizada" language={language} />
              <MetricCard label={copy.manager.waste} value={formatCurrency(snapshot.impactoFinanceiro)} metricKey="custo_oportunidade" language={language} />
            </div>
          </section>

          <section id="section-manager-team">
            <Panel title={copy.manager.scheduleByProfessional} metricKey="ociosidade_profissional" language={language}>
              <div className="grid gap-2 md:grid-cols-2">
                {analytics.professionalStats.map(item => (
                  <button
                    key={item.professional}
                    type="button"
                    className="rounded-md border border-slate-800 bg-slate-900/70 p-3 text-left"
                    onClick={() => onDrillDown({ professional: item.professional })}
                  >
                    <p className="text-xs text-slate-400">{item.professional}</p>
                    <p className="mt-1 text-sm text-slate-200">{copy.manager.chairOccupancy}: {formatPercent(item.occupancy)}</p>
                  </button>
                ))}
              </div>
            </Panel>
          </section>
        </>
      ) : (
        <section id="section-manager-pro-upgrade">
          <Panel title="Funcoes e graficos do Plano Pro" metricKey="multifatorial_equipe" language={language}>
            <div className="space-y-2 text-sm text-slate-200">
              <p>Disponivel no Pro/Enterprise: margem por servico/procedimento, receita por profissional, heatmap dia x hora x profissional, score de eficiencia e simuladores.</p>
              <p className="text-xs text-slate-400">O plano ativo continua exibindo visao consolidada + alertas operacionais.</p>
            </div>
          </Panel>
        </section>
      )}

      {sharedOperationalCharts}

      <section id="section-manager-alerts">
        <Panel title={copy.manager.blockAlerts} metricKey="impacto_financeiro" language={language}>
          {visibleAlerts.length === 0 ? (
            <p className="text-xs text-slate-400">{copy.common.noData}</p>
          ) : (
            <div className="space-y-2">
              {visibleAlerts.map((alert: AlertEvent) => (
                <div key={alert.id} className="rounded-md border border-slate-800 bg-slate-900/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-slate-100">{alert.title}</p>
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      alert.severity === "P1" ? "bg-red-500/20 text-red-200" : alert.severity === "P2" ? "bg-orange-500/20 text-orange-200" : "bg-blue-500/20 text-blue-200",
                    )}>
                      {alert.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{alert.description}</p>
                  <p className="mt-2 text-xs text-slate-300">{copy.manager.impact}: {formatCurrency(alert.financialImpact)}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>
    </div>
  );

  const renderOperationalView = () => (
    <div className="space-y-4">
      <section id="section-ops-agenda">
        <Panel title={copy.operational.blockAgenda} metricKey="heatmap_ocupacao" language={language}>
          {analytics.todayFacts.length === 0 ? (
            <p className="text-xs text-slate-400">{copy.common.noData}</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400">
                  <th className="pb-2 text-left">{copy.operational.patients}</th>
                  <th className="pb-2 text-left">{copy.operational.procedure}</th>
                  <th className="pb-2 text-right">{copy.operational.estimatedTime}</th>
                  <th className="pb-2 text-right">{copy.operational.status}</th>
                </tr>
              </thead>
              <tbody>
                {analytics.todayFacts.slice(0, 14).map(row => (
                  <tr key={row.id} className="border-t border-slate-800 text-slate-200">
                    <td className="py-2">{`Paciente ${row.id.slice(0, 5)}`}</td>
                    <td className="py-2">{row.procedure}</td>
                    <td className="py-2 text-right">{row.durationMinutes} {locale.labels.minutes}</td>
                    <td className="py-2 text-right">{locale.status[row.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </section>

      <section id="section-ops-goals" className="grid gap-3 md:grid-cols-3">
        <MetricCard
          label={copy.operational.revenueGoal}
          value={`${formatCurrency(analytics.todayRevenue)} / ${formatCurrency(analytics.goalRevenue)}`}
          metricKey="faturamento_liquido"
          language={language}
          fillPercent={safePercent(analytics.todayRevenue, analytics.goalRevenue || 1)}
        />
        <MetricCard
          label={copy.operational.proceduresGoal}
          value={`${analytics.todayCompleted} / ${analytics.goalProcedures.toFixed(0)}`}
          metricKey="funnel_matematico"
          language={language}
          fillPercent={safePercent(analytics.todayCompleted, analytics.goalProcedures || 1)}
        />
        <MetricCard
          label={copy.operational.conversionGoal}
          value={formatPercent(analytics.todayConversion)}
          metricKey="funnel_matematico"
          language={language}
          fillPercent={analytics.todayConversion}
        />
      </section>

      {sharedOperationalCharts}

      <section id="section-ops-performance">
        <Panel title={copy.operational.blockPerformance} metricKey="multifatorial_equipe" language={language}>
          {analytics.professionalStats.length === 0 ? (
            <p className="text-xs text-slate-400">{copy.common.noData}</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400">
                  <th className="pb-2 text-left">{locale.labels.professional}</th>
                  <th className="pb-2 text-right">{copy.operational.conversionPersonal}</th>
                  <th className="pb-2 text-right">{copy.operational.ticketAverage}</th>
                  <th className="pb-2 text-right">{copy.operational.npsPersonal}</th>
                </tr>
              </thead>
              <tbody>
                {analytics.professionalStats.map(item => (
                  <tr
                    key={item.professional}
                    className="border-t border-slate-800 text-slate-200 cursor-pointer hover:bg-slate-900/70"
                    onClick={() => onDrillDown({ professional: item.professional })}
                  >
                    <td className="py-2">{item.professional}</td>
                    <td className="py-2 text-right">{formatPercent(item.conversion)}</td>
                    <td className="py-2 text-right">{formatCurrency(item.avgTicket)}</td>
                    <td className="py-2 text-right">{item.nps.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </section>
    </div>
  );

  const renderWarRoomOnly = () => (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-3">
        <MetricCard label={copy.ceo.netMargin} value={formatPercent(snapshot.margemLiquida)} metricKey="margem_ebitda_normalizada" language={language} />
        <MetricCard label="No-show" value={formatPercent(snapshot.taxaNoshow)} metricKey="mapa_vazamentos_noshow" language={language} />
        <MetricCard label={copy.ceo.opportunityCost} value={formatCurrency(snapshot.impactoFinanceiro)} metricKey="impacto_financeiro" language={language} />
      </section>
      {sharedOperationalCharts}
      <WarRoom language={language} locale={locale} alerts={visibleAlerts} generateRCA={localEngine.generateRCA} onSaved={() => dashboardQuery.refetch()} />
    </div>
  );

  const renderByView = () => {
    if (view === "ceo") return renderCeoView();
    if (view === "gestor") return renderManagerView();
    if (view === "operacional") return renderOperationalView();
    return renderWarRoomOnly();
  };

  const currentPath = typeof window === "undefined" ? "" : window.location.pathname;

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-[#1f2937] dark:bg-[#000000] dark:text-white">
      {sidebarOpen ? <div className="fixed inset-0 z-30 bg-black/55 lg:hidden" onClick={() => setSidebarOpen(false)} /> : null}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-72 border-r border-gray-200 bg-white transition-transform duration-300 lg:translate-x-0 dark:border-white/10 dark:bg-[#14110f]",
        sidebarOpen ? "translate-x-0" : "-translate-x-full",
      )}>
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4 dark:border-white/10">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded bg-[#e67e22] flex items-center justify-center text-sm font-bold text-white">GLX</div>
              <div className="leading-tight">
                <p className="text-sm font-semibold">PERFORMANCE</p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">CONTROL TOWER</p>
              </div>
            </div>
            <button className="rounded p-1 text-slate-500 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-white/10 lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <ul className="space-y-1">
              {navItems.map(item => {
                const active = currentPath === item.path;
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => navigate(item)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition",
                        active
                          ? "bg-[#e67e22] text-white"
                          : "text-slate-600 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="border-t border-gray-200 p-4 dark:border-white/10">
            <button
              type="button"
              onClick={() => setLocation("/planos")}
              className={cn(
                "group relative w-full overflow-hidden rounded-lg border px-3.5 py-3 text-left font-sans transition-all duration-200",
                "hover:-translate-y-0.5 active:translate-y-0",
                "border-gray-200 bg-white text-slate-700 shadow-sm hover:border-[#e67e22]/45 hover:shadow-[0_8px_20px_rgba(230,126,34,0.14)]",
                "dark:border-[#f6ab67]/40 dark:bg-[#16110f] dark:text-slate-100",
                "dark:hover:border-[#f6ab67]/60 dark:hover:shadow-[0_0_0_1px_rgba(230,126,34,0.16),0_12px_28px_rgba(230,126,34,0.22)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e67e22]/35",
              )}
              title="Gerenciar plano"
              aria-label="Gerenciar plano"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                style={{
                  background:
                    "radial-gradient(circle at 18% 18%, rgba(230,126,34,0.06), rgba(230,126,34,0) 58%)",
                }}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#f6ab67]/55 to-transparent opacity-80"
              />

              <div className="relative z-20 flex items-start justify-between gap-3">
                <div className="min-w-0 text-sm leading-5 [text-rendering:optimizeLegibility]">
                  <p className="truncate text-[12px] font-semibold text-slate-900 [text-shadow:0_1px_0_rgba(255,255,255,0.12)] dark:text-white dark:[text-shadow:0_1px_10px_rgba(255,255,255,0.08)]">
                    <span className="font-medium text-slate-600 dark:text-slate-300">{copy.common.role}: </span>
                    <span className="font-bold tracking-normal text-slate-900 dark:text-white">{userRole}</span>
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 truncate text-[12px] font-semibold text-slate-900 dark:text-white">
                    <span className="shrink-0 font-medium text-slate-600 dark:text-slate-300">{copy.common.plan}:</span>
                    <span className="inline-flex max-w-full items-center truncate rounded-md border border-orange-300/35 bg-orange-500/15 px-1.5 py-0.5 text-[12px] font-bold uppercase tracking-[0.04em] text-[#b95f12] shadow-[0_0_0_1px_rgba(230,126,34,0.08)_inset] dark:border-orange-300/45 dark:bg-orange-500/18 dark:text-orange-100">
                      {plan}
                    </span>
                  </p>
                </div>

                <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#f6ab67]/45 bg-[#e67e22]/18 text-[#c76b1a] shadow-[0_0_0_1px_rgba(230,126,34,0.08)_inset,0_0_14px_rgba(230,126,34,0.12)] transition-all duration-200 group-hover:border-[#f6ab67]/70 group-hover:bg-[#e67e22]/24 group-hover:text-[#e67e22] dark:text-orange-100">
                  <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </div>
              </div>
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 h-16 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-[#14110f]/95">
          <div className="flex h-full items-center gap-3 px-4 lg:px-6">
            <button className="rounded p-2 hover:bg-gray-100 dark:hover:bg-white/10 lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>

            <form onSubmit={handleSearch} className="max-w-xl flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  value={searchTerm}
                  onChange={event => setSearchTerm(event.target.value)}
                  placeholder={copy.common.searchPlaceholder}
                  className="border-gray-200 bg-white pl-10 text-gray-900 shadow-sm placeholder:text-slate-400 dark:border-white/15 dark:bg-white/5 dark:text-slate-100 dark:shadow-none"
                />
              </div>
            </form>

            <div className="hidden items-center gap-2 md:flex">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              <span className="text-xs text-slate-600 dark:text-slate-300">{copy.common.live}</span>
            </div>

            <Button variant="ghost" size="icon" className="text-slate-600 hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-white/10">
              <Bell className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <main className="space-y-4 px-4 py-4 lg:px-6">
          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#120f0d]/88 dark:shadow-none">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-orange-600 dark:text-orange-300">{copy.shellTitle[view]}</p>
                <h1 className="mt-1 text-2xl font-bold">{copy.shellSubtitle[view]}</h1>
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{locale.headerMeta.user}: {user.email ?? "n/a"}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[#e67e22]/30 bg-[#e67e22]/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-orange-700 dark:text-orange-200">
                    {planSummary.title}
                  </span>
                  <span className="text-xs text-slate-600 dark:text-slate-300">{planSummary.description}</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Graficos/funcoes ativos: {planSummary.graphPack}
                </p>
                <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                  Acesso por plano no dashboard segue a matriz centralizada de regra de negocio (alteracoes de plano impactam modulos liberados automaticamente).
                </p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{crmAction.helper}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  className={cn(
                    "border px-3 transition",
                    crmAction.disabled
                      ? "border-gray-200 bg-gray-100 text-gray-400 hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-500 dark:hover:bg-white/5"
                      : "relative overflow-hidden border-[#f6ab67]/25 bg-[linear-gradient(135deg,#e67e22_0%,#f08e36_58%,#cf6719_100%)] text-white shadow-[0_10px_24px_rgba(230,126,34,0.22)] hover:brightness-105",
                  )}
                  disabled={crmAction.disabled}
                  onClick={() => {
                    if (crmAction.disabled) return;
                    const search = typeof window === "undefined" ? "" : window.location.search;
                    setLocation(`/integracoes${search}`);
                    setSidebarOpen(false);
                  }}
                >
                  <Database className="mr-2 h-4 w-4" />
                  {crmAction.label}
                </Button>
                <Button
                  variant="outline"
                  className="border-gray-300 bg-white text-gray-900 hover:border-[#e67e22] hover:bg-gray-50 dark:border-white/20 dark:bg-transparent dark:text-slate-100"
                  onClick={() => dashboardQuery.refetch()}
                >
                  {dashboardQuery.isRefetching ? copy.common.refreshing : copy.common.refresh}
                </Button>
                <Button
                  variant="outline"
                  className="border-gray-300 bg-white text-gray-900 hover:border-[#e67e22] hover:bg-gray-50 dark:border-white/20 dark:bg-transparent dark:text-slate-100"
                  onClick={() => exportDashboard({ format: "csv", scope: view, plan, filters, data: facts, summary: exportScope })}
                >
                  {copy.common.exportCsv}
                </Button>
                <Button
                  className="relative overflow-hidden border border-[#f6ab67]/25 bg-[linear-gradient(135deg,#e67e22_0%,#f08e36_58%,#cf6719_100%)] text-white shadow-[0_10px_24px_rgba(230,126,34,0.28)] transition hover:brightness-105 hover:shadow-[0_12px_30px_rgba(34,211,238,0.16)] focus-visible:ring-2 focus-visible:ring-cyan-300/40"
                  onClick={() => exportDashboard({ format: "pdf", scope: view, plan, filters, data: facts, summary: exportScope })}
                >
                  {copy.common.exportPdf}
                </Button>
                <Button
                  variant="outline"
                  className="border-gray-300 bg-white text-gray-900 hover:border-red-400 hover:text-red-600 hover:bg-gray-50 dark:border-white/20 dark:bg-transparent dark:text-slate-100 dark:hover:text-slate-100"
                  onClick={async () => {
                    await logout({ redirectTo: "/login" });
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {copy.common.logout}
                </Button>
              </div>
            </div>
          </section>

          <GlobalFilterBar
            filters={filters}
            setFilter={setFilter}
            clearFilters={clearFilters}
            channelOptions={channelOptions}
            professionalOptions={professionalOptions}
            procedureOptions={procedureOptions}
            locale={locale}
            copy={copy}
            language={language}
          />

          {renderByView()}
        </main>
      </div>
    </div>
  );
}

export function RoleDashboardPage({ view }: { view: RoleDashboardView }) {
  return (
    <ControlTowerFilterProvider>
      <RoleDashboardPageContent view={view} />
    </ControlTowerFilterProvider>
  );
}

export function CeoDashboardPage() {
  return <RoleDashboardPage view="ceo" />;
}

export function GestorDashboardPage() {
  return <RoleDashboardPage view="gestor" />;
}

export function OperacionalDashboardPage() {
  return <RoleDashboardPage view="operacional" />;
}

export function WarRoomDashboardPage() {
  return <RoleDashboardPage view="warroom" />;
}
