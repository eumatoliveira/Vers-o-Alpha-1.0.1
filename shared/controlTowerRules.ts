import type { AlertEvent, AlertSeverity, ControlTowerFact } from "./types";

export type PlanTier = "essencial" | "pro" | "enterprise";
export type SectionId =
  | "dashboard"
  | "realtime"
  | "agenda"
  | "equipe"
  | "sprints"
  | "funil"
  | "canais"
  | "integracoes"
  | "dados"
  | "relatorios"
  | "configuracoes"
  | "rede"
  | "benchmark_rede"
  | "valuation"
  | "investidor"
  | "governanca"
  | "api_bi"
  | "qbr";
export type AlertPriority = "P1" | "P2" | "P3";

export type AlertKpiKey =
  | "noShowRate"
  | "margemLiquida"
  | "nps"
  | "faturamentoGapPercent"
  | "fluxoCaixa"
  | "churnRate"
  | "ltvCacRatio"
  | "occupancyRate";

type ThresholdComparator = "greater_than" | "less_than";

interface AlertThreshold {
  comparator: ThresholdComparator;
  target: number;
  p3: number;
  p2: number;
  p1: number;
}

export interface PdfCadenceRule {
  cadence: "weekly" | "monthly";
  maxExports: number;
}

export interface PdfCadenceWindow {
  start: Date;
  end: Date;
  key: string;
  cadence: PdfCadenceRule["cadence"];
  maxExports: number;
}

export const PLAN_RANK: Record<PlanTier, number> = {
  essencial: 0,
  pro: 1,
  enterprise: 2,
};

export const PLAN_ACCESS: Record<PlanTier, SectionId[]> = {
  // Alinhado aos PDFs GLX_CT_01/02/03:
  // Essencial: 4 módulos executivos + saúde de dados + relatórios PDF
  essencial: ["dashboard", "agenda", "funil", "canais", "integracoes", "dados", "relatorios", "configuracoes"],
  // Pro: adiciona granularidade tática (realtime, equipe, sprints)
  pro: ["dashboard", "realtime", "agenda", "equipe", "sprints", "funil", "canais", "integracoes", "dados", "relatorios", "configuracoes"],
  // Enterprise: mesma base + camada enterprise (implementada no cliente por features/camadas extras, não por SectionId legado)
  enterprise: [
    "dashboard",
    "realtime",
    "agenda",
    "equipe",
    "sprints",
    "funil",
    "canais",
    "integracoes",
    "dados",
    "relatorios",
    "configuracoes",
    "rede",
    "benchmark_rede",
    "valuation",
    "investidor",
    "governanca",
    "api_bi",
    "qbr",
  ],
};

export const MIN_PLAN_BY_SECTION: Record<SectionId, PlanTier> = {
  dashboard: "essencial",
  realtime: "pro",
  agenda: "essencial",
  equipe: "pro",
  sprints: "pro",
  funil: "essencial",
  canais: "essencial",
  integracoes: "essencial",
  dados: "essencial",
  relatorios: "essencial",
  configuracoes: "essencial",
  rede: "enterprise",
  benchmark_rede: "enterprise",
  valuation: "enterprise",
  investidor: "enterprise",
  governanca: "enterprise",
  api_bi: "enterprise",
  qbr: "enterprise",
};

const PRO_ALERT_THRESHOLDS: Record<AlertKpiKey, AlertThreshold> = {
  noShowRate: { comparator: "greater_than", target: 8, p3: 8, p2: 12, p1: 20 },
  margemLiquida: { comparator: "less_than", target: 18, p3: 18, p2: 15, p1: 12 },
  nps: { comparator: "less_than", target: 8, p3: 8, p2: 7.8, p1: 7.5 },
  faturamentoGapPercent: { comparator: "less_than", target: 0, p3: -10, p2: -15, p1: -30 },
  fluxoCaixa: { comparator: "less_than", target: 0, p3: 50_000, p2: 10_000, p1: 0 },
  churnRate: { comparator: "greater_than", target: 5, p3: 5, p2: 8, p1: 12 },
  ltvCacRatio: { comparator: "less_than", target: 3, p3: 3, p2: 2.5, p1: 2 },
  occupancyRate: { comparator: "less_than", target: 80, p3: 80, p2: 70, p1: 55 },
};

export const ALERT_THRESHOLDS: Record<PlanTier, Record<AlertKpiKey, AlertThreshold>> = {
  essencial: {
    noShowRate: { comparator: "greater_than", target: 10, p3: 8, p2: 10, p1: 15 },
    margemLiquida: { comparator: "less_than", target: 18, p3: 18, p2: 15, p1: 12 },
    nps: { comparator: "less_than", target: 8, p3: 8, p2: 7.8, p1: 7.5 },
    faturamentoGapPercent: { comparator: "less_than", target: 0, p3: -5, p2: -15, p1: -20 },
    fluxoCaixa: { comparator: "less_than", target: 0, p3: 50_000, p2: 10_000, p1: 0 },
    churnRate: { comparator: "greater_than", target: 5, p3: 5, p2: 8, p1: 12 },
    ltvCacRatio: { comparator: "less_than", target: 3, p3: 3, p2: 2.5, p1: 2 },
    occupancyRate: { comparator: "less_than", target: 75, p3: 75, p2: 70, p1: 60 },
  },
  pro: PRO_ALERT_THRESHOLDS,
  enterprise: PRO_ALERT_THRESHOLDS,
};

export const PDF_CADENCE_POLICY: Record<PlanTier, PdfCadenceRule> = {
  essencial: { cadence: "monthly", maxExports: 1 },
  pro: { cadence: "monthly", maxExports: 1 },
  enterprise: { cadence: "monthly", maxExports: 1 },
};

export type PlanBusinessModuleId =
  | "agenda"
  | "financeiro"
  | "marketing"
  | "operacao"
  | "enterprise_layer"
  | "valuation_expansao";

export type PlanAlertTaxonomyLevel = "P1" | "P2" | "P3" | "S1" | "S2" | "S3";

export interface PlanBusinessModuleRule {
  id: PlanBusinessModuleId;
  label: string;
  layer: "core" | "advanced" | "overlay" | "strategic";
  logicMode: "executive" | "granular" | "network_overlay" | "investor_network";
  kpiCount?: number;
  notes: string[];
}

export interface PlanDashboardNarrative {
  title: string;
  description: string;
  graphPack: string;
}

export interface PlanBusinessRulebook {
  plan: PlanTier;
  commercialLabel: string;
  aliases: string[];
  inherits?: PlanTier;
  dashboardMode: "start_executive" | "pro_optimization" | "enterprise_network";
  narrative: PlanDashboardNarrative;
  modules: PlanBusinessModuleRule[];
  operationalAlerts: {
    enabled: true;
    levels: ["P1", "P2", "P3"];
    p1Action: string;
    p2Action: string;
    p3Action: string;
  };
  structuralAlerts?: {
    enabled: true;
    levels: ["S1", "S2", "S3"];
    separationFromOperationalAlerts: true;
    s1Action: string;
    s2Action: string;
    s3Action: string;
  };
  dataGovernance: {
    dshIncluded: boolean;
    integrationSlaHoursMax?: number;
    nearRealtimeWebhook?: boolean;
    sourceCompletenessScore?: boolean;
    auditTrail?: boolean;
    rbacRoles?: number;
    ssoMfaForCriticalRoles?: boolean;
  };
  exports: {
    executivePdf: {
      cadence: "monthly" | "weekly";
      automatic?: boolean;
      scheduleHint?: string;
    };
    investorPdfOneClick?: boolean;
    qbrQuarterlyAuto?: boolean;
    valuationMonthlyUpdate?: boolean;
  };
  uiLogic: {
    filterScopes: string[];
    periodOptions: string[];
    defaultEntryRouteHint: string;
    views: string[];
  };
  capabilities: {
    benchmarkBySpecialty?: boolean;
    granularByProfessional?: boolean;
    granularByService?: boolean;
    granularByChannel?: boolean;
    simulators?: string[];
    forecastBandsP10P50P90?: boolean;
    anomalyDetectionMl?: boolean;
    bidirectionalCrm?: boolean;
    multiUnitConsolidation?: boolean;
    networkScore?: boolean;
    internalBenchmark?: boolean;
    valuationSuite?: boolean;
    investorView?: boolean;
    enterpriseBiApi?: boolean;
    playbookReplication?: boolean;
  };
}

export const PLAN_BUSINESS_RULEBOOK: Record<PlanTier, PlanBusinessRulebook> = {
  essencial: {
    plan: "essencial",
    commercialLabel: "Essencial",
    aliases: ["essencial", "start", "starter", "essential"],
    dashboardMode: "start_executive",
    narrative: {
      title: "Plano Essencial",
      description:
        "Dashboard executivo para clinicas em estruturacao com 4 modulos (Agenda, Financeiro, Marketing e Operacao), alertas P1/P2/P3, DSH, benchmark por especialidade e export PDF mensal automatico.",
      graphPack: "No-show / Ocupacao / Funil / Caixa / NPS / SLA",
    },
    modules: [
      {
        id: "agenda",
        label: "Agenda & No-show (Visao Executiva)",
        layer: "core",
        logicMode: "executive",
        kpiCount: 7,
        notes: [
          "No-show, ocupacao, confirmacoes, cancelamentos, canal, consultas/semana e lead time de agendamento",
          "Alertas P1/P2/P3 por threshold + drill-down por canal de origem no no-show",
        ],
      },
      {
        id: "financeiro",
        label: "Financeiro Executivo",
        layer: "core",
        logicMode: "executive",
        kpiCount: 7,
        notes: [
          "Inclui D20 rule no faturamento bruto, projecao de caixa 15d e benchmark setorial",
          "Periodo 7d habilitado no modulo financeiro para visibilidade de caixa imediata",
        ],
      },
      {
        id: "marketing",
        label: "Marketing & Captacao",
        layer: "core",
        logicMode: "executive",
        kpiCount: 5,
        notes: [
          "Volume, conversao, no-show por canal, CPL e ROI por canal",
          "Metas por canal definidas no setup + integracao Meta Ads/Google Ads via API",
        ],
      },
      {
        id: "operacao",
        label: "Operacao & Experiencia",
        layer: "core",
        logicMode: "executive",
        kpiCount: 4,
        notes: [
          "NPS, espera, retorno/fidelizacao e SLA de resposta ao lead",
          "SLA por funcionario da recepcao como regra de responsabilizacao + coleta automatica de NPS",
        ],
      },
    ],
    operationalAlerts: {
      enabled: true,
      levels: ["P1", "P2", "P3"],
      p1Action: "acao em 24h",
      p2Action: "acao em 7 dias",
      p3Action: "monitorar",
    },
    dataGovernance: {
      dshIncluded: true,
      integrationSlaHoursMax: 4,
      nearRealtimeWebhook: true,
      sourceCompletenessScore: true,
    },
    exports: {
      executivePdf: {
        cadence: "monthly",
        automatic: true,
        scheduleHint: "dia 1 de cada mes",
      },
    },
    uiLogic: {
      filterScopes: ["periodo", "unidade", "funcionario", "canal (drill-down contextual)"],
      periodOptions: ["7d", "15d", "1m", "3m", "6m", "1 ano"],
      defaultEntryRouteHint: "/operacoes (agenda/no-show executive board)",
      views: ["visao executiva por unidade/consolidado simples"],
    },
    capabilities: {
      benchmarkBySpecialty: true,
    },
  },
  pro: {
    plan: "pro",
    commercialLabel: "Pro",
    aliases: ["pro"],
    inherits: "essencial",
    dashboardMode: "pro_optimization",
    narrative: {
      title: "Plano Pro",
      description:
        "Sistema de otimizacao inteligente para clinicas em escala: margem granular, forecast preciso, simuladores e decisao sem ruido com IA.",
      graphPack: "Margem granular / Forecast / Heatmaps / CAC-LTV-ROI / Simuladores",
    },
    modules: [
      {
        id: "agenda",
        label: "Agenda & Otimizacao de Capacidade (Pro)",
        layer: "advanced",
        logicMode: "granular",
        kpiCount: 6,
        notes: [
          "No-show segmentado, ocupacao por slot, heatmap dia x hora x profissional, lead time, cancelamentos por motivo e overbooking",
          "Drill-down por medico/horario/canal e alerta estrutural por motivo > 40%",
        ],
      },
      {
        id: "financeiro",
        label: "Financeiro Avancado (DRE + Margem + Forecast)",
        layer: "advanced",
        logicMode: "granular",
        kpiCount: 8,
        notes: [
          "DRE semanal por centro de custo, margem por servico/profissional, forecast IA P10/P50/P90, aging e caixa 8 semanas",
          "Waterfall da variacao de receita: Volume x Preco x Mix x No-show x Retencao",
        ],
      },
      {
        id: "marketing",
        label: "Marketing & Unidade Economica Completa",
        layer: "advanced",
        logicMode: "granular",
        kpiCount: 7,
        notes: [
          "Volume por canal, CAC, conversao, LTV:CAC, ROI, lead time e waterfall de variacao de receita",
          "CAC ponderado por ticket e decisao baseada em ROI real por canal",
        ],
      },
      {
        id: "operacao",
        label: "Operacao & Experiencia por Area",
        layer: "advanced",
        logicMode: "granular",
        kpiCount: 7,
        notes: [
          "NPS por profissional, espera por medico, retorno 90d, SLA lead, produtividade por area, cancelamentos com motivo e checklist/rotinas",
          "RCA estruturada em NPS < 7.5, ranking da recepcao e checklists configuraveis por papel",
        ],
      },
    ],
    operationalAlerts: {
      enabled: true,
      levels: ["P1", "P2", "P3"],
      p1Action: "acao em 24h",
      p2Action: "acao em 7 dias",
      p3Action: "monitorar",
    },
    dataGovernance: {
      dshIncluded: true,
      sourceCompletenessScore: true,
      integrationSlaHoursMax: 4,
      nearRealtimeWebhook: true,
    },
    exports: {
      executivePdf: {
        cadence: "monthly",
        automatic: true,
        scheduleHint: "mensal + relatorio por modulo sob demanda",
      },
    },
    uiLogic: {
      filterScopes: ["periodo", "unidade", "profissional", "canal", "servico", "horario/slot"],
      periodOptions: ["7d", "15d", "1m", "3m", "6m", "1 ano"],
      defaultEntryRouteHint: "/operacoes + drill-downs por modulo",
      views: ["visao consolidado simples", "visao unidade", "visao granular por profissional/servico/canal"],
    },
    capabilities: {
      benchmarkBySpecialty: true,
      granularByProfessional: true,
      granularByService: true,
      granularByChannel: true,
      simulators: ["overbooking", "forecast", "break-even", "mix de servicos"],
      forecastBandsP10P50P90: true,
      anomalyDetectionMl: true,
      bidirectionalCrm: true,
      internalBenchmark: true,
    },
  },
  enterprise: {
    plan: "enterprise",
    commercialLabel: "Enterprise",
    aliases: ["enterprise", "entreprise"],
    inherits: "pro",
    dashboardMode: "enterprise_network",
    narrative: {
      title: "Plano Enterprise",
      description:
        "Camada de inteligencia estrategica para grupos, redes e investidores: inclui tudo do Pro em cada unidade, mais consolidacao de rede, benchmark interno, score da rede, valuation automatico e dashboard para investidores.",
      graphPack: "Consolidacao de rede / Percentis / Score da rede / Valuation / M&A / Investor PDF / S1-S2-S3",
    },
    modules: [
      {
        id: "enterprise_layer",
        label: "Enterprise Layer (sobre todos os modulos Pro)",
        layer: "overlay",
        logicMode: "network_overlay",
        kpiCount: 5,
        notes: [
          "Consolidacao multi-unidade ponderada por receita/N + score da rede, benchmark interno, outliers e governance/RBAC",
          "S1/S2/S3 separados de P1/P2/P3 para nao misturar risco estrutural com urgencia operacional",
        ],
      },
      {
        id: "agenda",
        label: "Agenda/Otimizacao (Pro + Enterprise overlay)",
        layer: "advanced",
        logicMode: "network_overlay",
        notes: [
          "Overlay de ranking de unidades, outliers e benchmark da rede",
          "Playbook do top 10% replicado na pior unidade",
        ],
      },
      {
        id: "financeiro",
        label: "Financeiro Avancado (Pro + Enterprise overlay)",
        layer: "advanced",
        logicMode: "network_overlay",
        notes: [
          "EBITDA por unidade e consolidado, benchmark, risco estrutural",
        ],
      },
      {
        id: "marketing",
        label: "Marketing/Unit Economics (Pro + Enterprise overlay)",
        layer: "advanced",
        logicMode: "network_overlay",
        notes: [
          "Comparacao unidade vs rede, percentis e outliers por canal/ROI",
        ],
      },
      {
        id: "operacao",
        label: "Operacao & Experiencia (Pro + Enterprise overlay)",
        layer: "advanced",
        logicMode: "network_overlay",
        notes: [
          "Ranking por NPS/SLA/Retorno e biblioteca de RCA padronizada",
        ],
      },
      {
        id: "valuation_expansao",
        label: "Valuation & Expansao da Rede",
        layer: "strategic",
        logicMode: "investor_network",
        kpiCount: 6,
        notes: [
          "Multiplo EBITDA dinamico ajustado por risco, projecao 3-5 anos, M&A engine, investor dashboard, valuation automatico e risco estrutural",
          "Investor view com export PDF institucional LGPD + QBR trimestral automatico",
        ],
      },
    ],
    operationalAlerts: {
      enabled: true,
      levels: ["P1", "P2", "P3"],
      p1Action: "acao operacional em 24h",
      p2Action: "acao em 7 dias",
      p3Action: "monitorar",
    },
    structuralAlerts: {
      enabled: true,
      levels: ["S1", "S2", "S3"],
      separationFromOperationalAlerts: true,
      s1Action: "acao em 7 dias",
      s2Action: "acao em 30 dias",
      s3Action: "observacao e acompanhamento",
    },
    dataGovernance: {
      dshIncluded: true,
      sourceCompletenessScore: true,
      integrationSlaHoursMax: 4,
      auditTrail: true,
      rbacRoles: 8,
      ssoMfaForCriticalRoles: true,
      nearRealtimeWebhook: true,
    },
    exports: {
      executivePdf: {
        cadence: "monthly",
        automatic: true,
        scheduleHint: "mensal + relatorio por modulo sob demanda (herdado do Pro por unidade)",
      },
      investorPdfOneClick: true,
      qbrQuarterlyAuto: true,
      valuationMonthlyUpdate: true,
    },
    uiLogic: {
      filterScopes: [
        "rede",
        "regiao",
        "unidade",
        "profissional",
        "canal",
        "servico",
        "comparacao unidade vs rede",
        "benchmark (top 25%)",
      ],
      periodOptions: ["7d", "15d", "1m", "3m", "6m", "1 ano"],
      defaultEntryRouteHint: "/network/overview (score da rede + KPIs consolidados + alertas S1)",
      views: [
        "/network/overview",
        "/network/benchmark",
        "/network/units",
        "/:unitId/agenda|finance|marketing|ops",
        "/valuation/overview",
        "/valuation/projection",
        "/valuation/mna",
        "/valuation/investor",
        "/settings/audit-logs",
      ],
    },
    capabilities: {
      benchmarkBySpecialty: true,
      granularByProfessional: true,
      granularByService: true,
      granularByChannel: true,
      simulators: ["overbooking", "forecast", "break-even", "mix de servicos", "M&A engine"],
      forecastBandsP10P50P90: true,
      anomalyDetectionMl: true,
      bidirectionalCrm: true,
      multiUnitConsolidation: true,
      networkScore: true,
      internalBenchmark: true,
      valuationSuite: true,
      investorView: true,
      enterpriseBiApi: true,
      playbookReplication: true,
    },
  },
};

export function getPlanBusinessRulebook(plan: string | null | undefined): PlanBusinessRulebook {
  return PLAN_BUSINESS_RULEBOOK[normalizePlanTier(plan)];
}

export function getPlanDashboardNarrative(plan: string | null | undefined): PlanDashboardNarrative {
  return getPlanBusinessRulebook(plan).narrative;
}

function getRulebookModuleLabel(
  plan: string | null | undefined,
  moduleId: Extract<PlanBusinessModuleId, "agenda" | "financeiro" | "marketing" | "operacao">,
): string | undefined {
  return getPlanBusinessRulebook(plan).modules.find(moduleRule => moduleRule.id === moduleId)?.label;
}

function normalizeModuleMenuLabel(label: string | undefined, fallback: string): string {
  if (!label) return fallback;
  return label
    .replace(/\s*\(Pro\s*\+\s*Enterprise overlay\)\s*$/i, "")
    .replace(/\s*\(Pro\)\s*$/i, "")
    .replace(/\s*\(Visao Executiva\)\s*$/i, "")
    .replace(/\s+Executivo$/i, "")
    .trim();
}

type UiLanguage = "pt" | "en" | "es";

function localizeSidebarMenuLabel(label: string, language: UiLanguage): string {
  if (language === "pt") return label;

  const normalized = label.toLowerCase();
  const translations: Array<{ match: RegExp; en: string; es: string }> = [
    { match: /agenda\s*&\s*no-show/, en: "Agenda & No-Show", es: "Agenda y No-Show" },
    { match: /agenda\s*&\s*otimizacao de capacidade/, en: "Agenda & Capacity Optimization", es: "Agenda y Optimizacion de Capacidad" },
    { match: /financeiro avancado/i, en: "Advanced Finance - P&L, Margin & Forecast", es: "Finanzas Avanzadas - DRE, Margen y Forecast" },
    { match: /^financeiro$/, en: "Finance", es: "Finanzas" },
    { match: /marketing\s*&\s*unidade economica completa/, en: "Marketing & Full Unit Economics", es: "Marketing y Economia Unitaria Completa" },
    { match: /marketing\s*&\s*captacao/, en: "Marketing & Acquisition", es: "Marketing y Captacion" },
    { match: /operacao\s*&\s*experiencia por area/, en: "Operations & Experience by Area", es: "Operacion y Experiencia por Area" },
    { match: /operacao\s*&\s*experiencia/, en: "Operations & Experience", es: "Operacion y Experiencia" },
  ];

  const row = translations.find(item => item.match.test(normalized));
  return row ? (language === "en" ? row.en : row.es) : label;
}

export function getPlanDashboardSidebarLabels(plan: string | null | undefined, language: UiLanguage = "pt") {
  const normalizedPlan = normalizePlanTier(plan);
  const isProPlus = normalizedPlan === "pro" || normalizedPlan === "enterprise";
  // Enterprise herda a taxonomia de menu do Pro para os 4 modulos centrais.
  const labelSourcePlan: PlanTier = normalizedPlan === "enterprise" ? "pro" : normalizedPlan;

  const fallbackByLanguage = {
    pt: {
      agenda: isProPlus ? "Agenda & Otimizacao de Capacidade" : "Agenda & No-show",
      financeiro: isProPlus ? "Financeiro Avancado - DRE, Margem e Forecast" : "Financeiro",
      marketing: "Marketing & Captacao",
      operacao: isProPlus ? "Operacao & Experiencia por Area" : "Operacao & Experiencia",
    },
    en: {
      agenda: isProPlus ? "Agenda & Capacity Optimization" : "Agenda & No-Show",
      financeiro: isProPlus ? "Advanced Finance - P&L, Margin & Forecast" : "Finance",
      marketing: "Marketing & Acquisition",
      operacao: isProPlus ? "Operations & Experience by Area" : "Operations & Experience",
    },
    es: {
      agenda: isProPlus ? "Agenda y Optimizacion de Capacidad" : "Agenda y No-Show",
      financeiro: isProPlus ? "Finanzas Avanzadas - DRE, Margen y Forecast" : "Finanzas",
      marketing: "Marketing y Captacion",
      operacao: isProPlus ? "Operacion y Experiencia por Area" : "Operacion y Experiencia",
    },
  } satisfies Record<UiLanguage, { agenda: string; financeiro: string; marketing: string; operacao: string }>;
  const fallback = fallbackByLanguage[language];

  const rawLabels = {
    agenda: normalizeModuleMenuLabel(
      getRulebookModuleLabel(labelSourcePlan, "agenda"),
      fallback.agenda,
    ),
    financeiro: normalizeModuleMenuLabel(
      getRulebookModuleLabel(labelSourcePlan, "financeiro"),
      fallback.financeiro,
    ),
    marketing: normalizeModuleMenuLabel(
      getRulebookModuleLabel(labelSourcePlan, "marketing"),
      fallback.marketing,
    ),
    operacao: normalizeModuleMenuLabel(
      getRulebookModuleLabel(labelSourcePlan, "operacao"),
      fallback.operacao,
    ),
  };

  return {
    agenda: localizeSidebarMenuLabel(rawLabels.agenda, language),
    financeiro: localizeSidebarMenuLabel(rawLabels.financeiro, language),
    marketing: localizeSidebarMenuLabel(rawLabels.marketing, language),
    operacao: localizeSidebarMenuLabel(rawLabels.operacao, language),
  };
}

export function getPlanCommercialLabel(plan: string | null | undefined): string {
  return getPlanBusinessRulebook(plan).commercialLabel;
}

export function hasEnterpriseStructuralAlerts(plan: string | null | undefined): boolean {
  return Boolean(getPlanBusinessRulebook(plan).structuralAlerts?.enabled);
}

export function normalizePlanTier(plan: string | null | undefined): PlanTier {
  if (typeof plan === "string") {
    const normalized = plan.trim().toLowerCase();
    if (normalized === "pro") return "pro";
    if (normalized === "enterprise" || normalized === "entreprise") return "enterprise";
    if (normalized === "essencial" || normalized === "start" || normalized === "starter" || normalized === "essential") {
      return "essencial";
    }
  }
  return "essencial";
}

export function isPlanAtLeast(plan: string | null | undefined, minimum: PlanTier): boolean {
  const normalizedPlan = normalizePlanTier(plan);
  return PLAN_RANK[normalizedPlan] >= PLAN_RANK[minimum];
}

export function canAccessSection(plan: string | null | undefined, section: SectionId): boolean {
  const normalizedPlan = normalizePlanTier(plan);
  return PLAN_ACCESS[normalizedPlan].includes(section);
}

export function getMinPlanForSection(section: SectionId): PlanTier {
  return MIN_PLAN_BY_SECTION[section];
}

export function classifyAlertPriority(kpi: AlertKpiKey, value: number, plan: string | null | undefined): AlertPriority | null {
  const normalizedPlan = normalizePlanTier(plan);
  const threshold = ALERT_THRESHOLDS[normalizedPlan][kpi];

  if (threshold.comparator === "greater_than") {
    if (value > threshold.p1) return "P1";
    if (value > threshold.p2) return "P2";
    if (value > threshold.p3) return "P3";
    return null;
  }

  if (value < threshold.p1) return "P1";
  if (value < threshold.p2) return "P2";
  if (value < threshold.p3) return "P3";
  return null;
}

export function getPdfCadenceWindow(plan: string | null | undefined, referenceDate = new Date()): PdfCadenceWindow {
  const normalizedPlan = normalizePlanTier(plan);
  const rule = PDF_CADENCE_POLICY[normalizedPlan];
  const date = new Date(referenceDate);
  date.setMilliseconds(0);

  if (rule.cadence === "monthly") {
    const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0);
    const key = `m-${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
    return { start, end, key, cadence: rule.cadence, maxExports: rule.maxExports };
  }

  const start = new Date(date);
  const dayOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dayOffset);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const iso = getIsoWeekInfo(start);
  const key = `w-${iso.year}-${String(iso.week).padStart(2, "0")}`;
  return { start, end, key, cadence: rule.cadence, maxExports: rule.maxExports };
}

function getIsoWeekInfo(date: Date): { year: number; week: number } {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);

  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);

  return { year: utcDate.getUTCFullYear(), week };
}

export interface EnterpriseThresholdConfig {
  margemLiquidaP1: number;
  taxaNoshowP1: number;
  impactoFinanceiroP1: number;
  revpasDropP1: number;
}

export interface EnterpriseSnapshot {
  margemLiquida: number;
  taxaNoshow: number;
  impactoFinanceiro: number;
  revpasAtual: number;
  revpas7Dias: number;
  revpasDropPercent: number;
  slotsVazios: number;
  ticketMedio: number;
}

export const ENTERPRISE_THRESHOLDS: EnterpriseThresholdConfig = {
  margemLiquidaP1: 10,
  taxaNoshowP1: 25,
  impactoFinanceiroP1: 5000,
  revpasDropP1: 15,
};

function safeDivide(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return 0;
  return numerator / denominator;
}

export function calcFaturamentoLiquido(receitaBruta: number, cancelamentos: number, inadimplencia: number): number {
  return receitaBruta - cancelamentos - inadimplencia;
}

export function calcReceitaLiquida(
  receitaBruta: number,
  cancelamentos: number,
  inadimplencia: number,
  estornos: number,
): number {
  return receitaBruta - cancelamentos - inadimplencia - estornos;
}

export function calcEbitdaNormalizada(lucroOperacional: number, depreciacao: number, ajustesProLabore: number): number {
  return lucroOperacional + depreciacao + ajustesProLabore;
}

export function calcRevPas(receitaTotal: number, slotsDisponiveis: number): number {
  return safeDivide(receitaTotal, slotsDisponiveis);
}

export function calcBreakEven(custosFixos: number, ticketMedio: number, margemContribuicaoPercent = 100): number {
  const margemContribuicaoFracao = safeDivide(margemContribuicaoPercent, 100);
  const margemContribuicaoPorAtendimento = ticketMedio * margemContribuicaoFracao;
  return safeDivide(custosFixos, margemContribuicaoPorAtendimento);
}

export function calcTaxaOcupacao(realizadas: number, capacidadeDisponivel: number): number {
  return safeDivide(realizadas, capacidadeDisponivel) * 100;
}

export function calcTaxaConfirmacoes(confirmados: number, totalAgendados: number): number {
  return safeDivide(confirmados, totalAgendados) * 100;
}

export function calcPerdaCapacidadeNaoRecuperavel(noShows: number, cancelamentos24h: number, totalAgendados: number): number {
  return safeDivide(noShows + cancelamentos24h, totalAgendados) * 100;
}

export function calcCustoEstimadoNoShow(numeroNoShows: number, ticketMedioPeriodo: number): number {
  return numeroNoShows * ticketMedioPeriodo;
}

export function calcLeadTimeDias(totalDias: number, quantidadeLeadsConfirmados: number): number {
  return safeDivide(totalDias, quantidadeLeadsConfirmados);
}

export function calcInadimplenciaRate(valoresNaoPagos: number, faturado: number): number {
  return safeDivide(valoresNaoPagos, faturado) * 100;
}

export function calcDespesasFixasReceita(despesasFixas: number, receitaLiquida: number): number {
  return safeDivide(despesasFixas, receitaLiquida) * 100;
}

export function calcRoi(receitaAtribuida: number, investimento: number): number {
  return safeDivide(receitaAtribuida - investimento, investimento) * 100;
}

export function calcLtvCacRatio(ltv: number, cac: number): number {
  return safeDivide(ltv, cac);
}

export function calcCCC(prazoRecebimento: number, prazoEstoque: number, prazoPagamento: number): number {
  return prazoRecebimento + prazoEstoque - prazoPagamento;
}

export function calcCGN(contasReceber: number, estoque: number, contasPagar: number): number {
  return contasReceber + estoque - contasPagar;
}

export function calcCustoOportunidade(totalSlotsVazios: number, ticketMedioHistorico: number): number {
  return totalSlotsVazios * ticketMedioHistorico;
}

export function calcMargemPorMinuto(preco: number, custoVariavel: number, duracaoMinutos: number): number {
  return safeDivide(preco - custoVariavel, duracaoMinutos);
}

export function calcPaybackCac(cac: number, margemContribuicaoMedia: number): number {
  return safeDivide(cac, margemContribuicaoMedia);
}

export function calcLtvLiquido(
  ticketMedio: number,
  frequencia: number,
  retencao: number,
  custosVariaveis: number,
  cac: number,
): number {
  return (ticketMedio * frequencia * retencao) - (custosVariaveis + cac);
}

export function calcNrr(receitaMesAtualBaseAntiga: number, receitaMesPassadoBaseAntiga: number): number {
  return safeDivide(receitaMesAtualBaseAntiga, receitaMesPassadoBaseAntiga) * 100;
}

export function calcNps(promotores: number, detratores: number, total: number): number {
  return safeDivide(promotores - detratores, total) * 100;
}

export function calcImpactoFinanceiro(slotsVazios: number, ticketMedio: number): number {
  return slotsVazios * ticketMedio;
}

export function calcRevPasDropPercent(revpasAtual: number, revpas7DiasAtras: number): number {
  if (!Number.isFinite(revpasAtual) || !Number.isFinite(revpas7DiasAtras) || revpas7DiasAtras <= 0) return 0;
  return ((revpas7DiasAtras - revpasAtual) / revpas7DiasAtras) * 100;
}

export function detectRevPasDrop7d(revpasAtual: number, revpas7DiasAtras: number, threshold = ENTERPRISE_THRESHOLDS.revpasDropP1): boolean {
  return calcRevPasDropPercent(revpasAtual, revpas7DiasAtras) > threshold;
}

export function buildEnterpriseSnapshot(facts: ControlTowerFact[]): EnterpriseSnapshot {
  if (facts.length === 0) {
    return {
      margemLiquida: 0,
      taxaNoshow: 0,
      impactoFinanceiro: 0,
      revpasAtual: 0,
      revpas7Dias: 0,
      revpasDropPercent: 0,
      slotsVazios: 0,
      ticketMedio: 0,
    };
  }

  const receita = facts.reduce((acc, row) => acc + row.entries, 0);
  const custo = facts.reduce((acc, row) => acc + row.exits, 0);
  const margemLiquida = receita === 0 ? 0 : ((receita - custo) / receita) * 100;

  const totalRows = facts.length;
  const noshowRows = facts.filter(row => row.status === "noshow").length;
  const taxaNoshow = safeDivide(noshowRows, totalRows) * 100;

  const slotsVazios = facts.reduce((acc, row) => acc + row.slotsEmpty, 0);
  const ticketMedio = facts.reduce((acc, row) => acc + row.ticketMedio, 0) / totalRows;
  const impactoFinanceiro = calcImpactoFinanceiro(slotsVazios, ticketMedio);

  const ordered = [...facts].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const splitIndex = Math.max(1, ordered.length - 7);
  const currentWindow = ordered.slice(splitIndex);
  const previousWindow = ordered.slice(Math.max(0, splitIndex - 7), splitIndex);

  const revpasAtual = calcRevPas(
    currentWindow.reduce((acc, row) => acc + row.revenueValue, 0),
    currentWindow.reduce((acc, row) => acc + row.slotsAvailable, 0),
  );
  const revpas7Dias = calcRevPas(
    previousWindow.reduce((acc, row) => acc + row.revenueValue, 0),
    previousWindow.reduce((acc, row) => acc + row.slotsAvailable, 0),
  );
  const revpasDropPercent = calcRevPasDropPercent(revpasAtual, revpas7Dias);

  return {
    margemLiquida,
    taxaNoshow,
    impactoFinanceiro,
    revpasAtual,
    revpas7Dias,
    revpasDropPercent,
    slotsVazios,
    ticketMedio,
  };
}

function toSeverity(input: EnterpriseSnapshot): AlertSeverity | null {
  if (
    input.margemLiquida < ENTERPRISE_THRESHOLDS.margemLiquidaP1 ||
    input.taxaNoshow > ENTERPRISE_THRESHOLDS.taxaNoshowP1 ||
    input.impactoFinanceiro > ENTERPRISE_THRESHOLDS.impactoFinanceiroP1 ||
    input.revpasDropPercent > ENTERPRISE_THRESHOLDS.revpasDropP1
  ) {
    return "P1";
  }

  if (
    input.margemLiquida < 15 ||
    input.taxaNoshow > 18 ||
    input.impactoFinanceiro > 2500 ||
    input.revpasDropPercent > 8
  ) {
    return "P2";
  }

  if (
    input.margemLiquida < 18 ||
    input.taxaNoshow > 12 ||
    input.impactoFinanceiro > 1000 ||
    input.revpasDropPercent > 4
  ) {
    return "P3";
  }

  return null;
}

export function evaluateEnterpriseAlerts(snapshot: EnterpriseSnapshot): AlertEvent[] {
  const nowIso = new Date().toISOString();
  const alerts: AlertEvent[] = [];
  const severity = toSeverity(snapshot);

  if (snapshot.margemLiquida < ENTERPRISE_THRESHOLDS.margemLiquidaP1) {
    alerts.push({
      id: `margem-${nowIso}`,
      severity: "P1",
      title: "Margem Liquida Critica",
      description: "Margem liquida abaixo de 10%.",
      metricKey: "margem_ebitda_normalizada",
      financialImpact: Math.max(0, snapshot.impactoFinanceiro),
      triggeredAt: nowIso,
      context: { margemLiquida: snapshot.margemLiquida },
    });
  }

  if (snapshot.taxaNoshow > ENTERPRISE_THRESHOLDS.taxaNoshowP1) {
    alerts.push({
      id: `noshow-${nowIso}`,
      severity: "P1",
      title: "Taxa de No-Show Critica",
      description: "Taxa de no-show acima de 25%.",
      metricKey: "mapa_vazamentos_noshow",
      financialImpact: snapshot.impactoFinanceiro,
      triggeredAt: nowIso,
      context: { taxaNoshow: snapshot.taxaNoshow },
    });
  }

  if (snapshot.impactoFinanceiro > ENTERPRISE_THRESHOLDS.impactoFinanceiroP1) {
    alerts.push({
      id: `impacto-${nowIso}`,
      severity: "P1",
      title: "Impacto Financeiro Critico",
      description: "Impacto financeiro acima de R$ 5.000.",
      metricKey: "custo_oportunidade",
      financialImpact: snapshot.impactoFinanceiro,
      triggeredAt: nowIso,
      context: { impactoFinanceiro: snapshot.impactoFinanceiro },
    });
  }

  if (snapshot.revpasDropPercent > ENTERPRISE_THRESHOLDS.revpasDropP1) {
    alerts.push({
      id: `revpas-${nowIso}`,
      severity: "P1",
      title: "RevPAS em Queda Acelerada",
      description: "RevPAS caiu mais de 15% em 7 dias.",
      metricKey: "revpas",
      financialImpact: snapshot.impactoFinanceiro,
      triggeredAt: nowIso,
      context: {
        revpasAtual: snapshot.revpasAtual,
        revpas7Dias: snapshot.revpas7Dias,
        revpasDropPercent: snapshot.revpasDropPercent,
      },
    });
  }

  if (alerts.length === 0 && severity) {
    alerts.push({
      id: `monitor-${nowIso}`,
      severity,
      title: "Desvio em Monitoramento",
      description: "Indicadores fora da zona ideal.",
      metricKey: "faturamento_liquido",
      financialImpact: snapshot.impactoFinanceiro,
      triggeredAt: nowIso,
      context: snapshot as unknown as Record<string, unknown>,
    });
  }

  const priorityOrder: Record<AlertSeverity, number> = { P1: 0, P2: 1, P3: 2 };
  alerts.sort((a, b) => {
    const bySeverity = priorityOrder[a.severity] - priorityOrder[b.severity];
    if (bySeverity !== 0) return bySeverity;
    return b.financialImpact - a.financialImpact;
  });

  return alerts;
}

export const enterprise = {
  thresholds: ENTERPRISE_THRESHOLDS,
  formulas: {
    calcFaturamentoLiquido,
    calcReceitaLiquida,
    calcEbitdaNormalizada,
    calcRevPas,
    calcBreakEven,
    calcTaxaOcupacao,
    calcTaxaConfirmacoes,
    calcPerdaCapacidadeNaoRecuperavel,
    calcCustoEstimadoNoShow,
    calcLeadTimeDias,
    calcCCC,
    calcCGN,
    calcInadimplenciaRate,
    calcDespesasFixasReceita,
    calcCustoOportunidade,
    calcMargemPorMinuto,
    calcPaybackCac,
    calcLtvLiquido,
    calcLtvCacRatio,
    calcNrr,
    calcNps,
    calcRoi,
    calcImpactoFinanceiro,
  },
  calcRevPasDropPercent,
  detectRevPasDrop7d,
  buildSnapshot: buildEnterpriseSnapshot,
  evaluateAlerts: evaluateEnterpriseAlerts,
};
