import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, decimal, json, uniqueIndex } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  /** Hashed password for email/password authentication */
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  /** Subscription plan: essencial, pro, enterprise */
  plan: mysqlEnum("plan", ["essencial", "pro", "enterprise"]).default("essencial").notNull(),
  preferredCurrency: mysqlEnum("preferredCurrency", ["BRL", "USD", "ARS", "CLP", "COP", "MXN", "PEN", "UYU"]).default("BRL").notNull(),
  mfaEnabled: boolean("mfaEnabled").default(false).notNull(),
  /** Whether the account is active */
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Audit logs for tracking all system changes
 */
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(),
  entity: varchar("entity", { length: 100 }).notNull(),
  entityId: varchar("entityId", { length: 100 }),
  oldValue: json("oldValue"),
  newValue: json("newValue"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

/**
 * System metrics for monitoring health
 */
export const systemMetrics = mysqlTable("system_metrics", {
  id: int("id").autoincrement().primaryKey(),
  metricType: mysqlEnum("metricType", ["cpu", "memory", "storage", "latency", "error_rate", "api_calls"]).notNull(),
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  metadata: json("metadata"),
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
});

export type SystemMetric = typeof systemMetrics.$inferSelect;
export type InsertSystemMetric = typeof systemMetrics.$inferInsert;

/**
 * Feature flags for God Mode
 */
export const featureFlags = mysqlTable("feature_flags", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  enabled: boolean("enabled").default(false).notNull(),
  targetUsers: json("targetUsers"), // Array of user IDs or "all"
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FeatureFlag = typeof featureFlags.$inferSelect;
export type InsertFeatureFlag = typeof featureFlags.$inferInsert;

/**
 * Subscriptions for financial tracking
 */
export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id).notNull(),
  plan: mysqlEnum("plan", ["essentials", "pro", "enterprise"]).notNull(),
  status: mysqlEnum("status", ["active", "canceled", "past_due", "trialing"]).default("active").notNull(),
  monthlyValue: decimal("monthlyValue", { precision: 10, scale: 2 }).notNull(),
  startDate: timestamp("startDate").defaultNow().notNull(),
  endDate: timestamp("endDate"),
  canceledAt: timestamp("canceledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

/**
 * Payment history for tracking revenue
 */
export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  subscriptionId: int("subscriptionId").references(() => subscriptions.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["paid", "pending", "failed", "refunded"]).default("pending").notNull(),
  paymentMethod: varchar("paymentMethod", { length: 50 }),
  transactionId: varchar("transactionId", { length: 100 }),
  paidAt: timestamp("paidAt"),
  dueDate: timestamp("dueDate").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

/**
 * Error logs for monitoring
 */
export const errorLogs = mysqlTable("error_logs", {
  id: int("id").autoincrement().primaryKey(),
  errorType: mysqlEnum("errorType", ["4xx", "5xx", "timeout", "other"]).notNull(),
  statusCode: int("statusCode"),
  message: text("message").notNull(),
  stackTrace: text("stackTrace"),
  endpoint: varchar("endpoint", { length: 255 }),
  userId: int("userId").references(() => users.id),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ErrorLog = typeof errorLogs.$inferSelect;
export type InsertErrorLog = typeof errorLogs.$inferInsert;

/**
 * Service status for health monitoring
 */
export const serviceStatus = mysqlTable("service_status", {
  id: int("id").autoincrement().primaryKey(),
  serviceName: varchar("serviceName", { length: 50 }).notNull().unique(),
  status: mysqlEnum("status", ["operational", "degraded", "down"]).default("operational").notNull(),
  lastCheckedAt: timestamp("lastCheckedAt").defaultNow().notNull(),
  responseTime: int("responseTime"), // in milliseconds
  metadata: json("metadata"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ServiceStatus = typeof serviceStatus.$inferSelect;
export type InsertServiceStatus = typeof serviceStatus.$inferInsert;


/**
 * =====================================================
 * DASHBOARD CLIENTE - MÉTRICAS E DADOS
 * =====================================================
 */

/**
 * Clientes/Empresas que usam o dashboard
 */
export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  logo: text("logo"),
  industry: varchar("industry", { length: 100 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

/**
 * Métricas do CEO Scorecard
 */
export const ceoMetrics = mysqlTable("ceo_metrics", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").references(() => clients.id).notNull(),
  period: varchar("period", { length: 20 }).notNull(), // "2026-01", "2026-Q1", etc.
  
  // KPIs principais
  faturamento: decimal("faturamento", { precision: 15, scale: 2 }),
  faturamentoVariacao: decimal("faturamentoVariacao", { precision: 5, scale: 2 }),
  ebitda: decimal("ebitda", { precision: 15, scale: 2 }),
  ebitdaVariacao: decimal("ebitdaVariacao", { precision: 5, scale: 2 }),
  npsScore: int("npsScore"),
  npsVariacao: decimal("npsVariacao", { precision: 5, scale: 2 }),
  ocupacao: decimal("ocupacao", { precision: 5, scale: 2 }),
  ocupacaoVariacao: decimal("ocupacaoVariacao", { precision: 5, scale: 2 }),
  
  // Dados de forecast (JSON array)
  forecastData: json("forecastData"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CeoMetric = typeof ceoMetrics.$inferSelect;
export type InsertCeoMetric = typeof ceoMetrics.$inferInsert;

/**
 * Alertas Andon
 */
export const andonAlerts = mysqlTable("andon_alerts", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").references(() => clients.id).notNull(),
  severity: mysqlEnum("severity", ["critical", "warning", "info", "success"]).default("warning").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  actionLabel: varchar("actionLabel", { length: 100 }),
  actionUrl: varchar("actionUrl", { length: 255 }),
  isResolved: boolean("isResolved").default(false).notNull(),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AndonAlert = typeof andonAlerts.$inferSelect;
export type InsertAndonAlert = typeof andonAlerts.$inferInsert;

/**
 * Dados Financeiros
 */
export const financialData = mysqlTable("financial_data", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").references(() => clients.id).notNull(),
  period: varchar("period", { length: 20 }).notNull(),
  
  // Receita
  receitaBruta: decimal("receitaBruta", { precision: 15, scale: 2 }),
  impostos: decimal("impostos", { precision: 15, scale: 2 }),
  receitaLiquida: decimal("receitaLiquida", { precision: 15, scale: 2 }),
  
  // Custos
  custosPessoal: decimal("custosPessoal", { precision: 15, scale: 2 }),
  custosInsumos: decimal("custosInsumos", { precision: 15, scale: 2 }),
  custosOperacionais: decimal("custosOperacionais", { precision: 15, scale: 2 }),
  custosMarketing: decimal("custosMarketing", { precision: 15, scale: 2 }),
  
  // Margens
  margemBruta: decimal("margemBruta", { precision: 5, scale: 2 }),
  margemOperacional: decimal("margemOperacional", { precision: 5, scale: 2 }),
  margemLiquida: decimal("margemLiquida", { precision: 5, scale: 2 }),
  
  // Caixa
  saldoCaixa: decimal("saldoCaixa", { precision: 15, scale: 2 }),
  fluxoCaixaOperacional: decimal("fluxoCaixaOperacional", { precision: 15, scale: 2 }),
  
  // Margem por hora clínica (JSON array)
  margemPorHoraData: json("margemPorHoraData"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FinancialData = typeof financialData.$inferSelect;
export type InsertFinancialData = typeof financialData.$inferInsert;

/**
 * Dados Operacionais
 */
export const operationsData = mysqlTable("operations_data", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").references(() => clients.id).notNull(),
  period: varchar("period", { length: 20 }).notNull(),
  
  // OEE
  oeeGeral: decimal("oeeGeral", { precision: 5, scale: 2 }),
  disponibilidade: decimal("disponibilidade", { precision: 5, scale: 2 }),
  performance: decimal("performance", { precision: 5, scale: 2 }),
  qualidade: decimal("qualidade", { precision: 5, scale: 2 }),
  
  // Ocupação
  taxaOcupacao: decimal("taxaOcupacao", { precision: 5, scale: 2 }),
  tempoMedioEspera: int("tempoMedioEspera"), // em minutos
  atendimentosDia: int("atendimentosDia"),
  
  // Takt Time vs Cycle Time (JSON array)
  taktCycleData: json("taktCycleData"),
  
  // Ocupação das salas (JSON array)
  ocupacaoSalasData: json("ocupacaoSalasData"),
  
  // Gargalos (JSON array)
  gargalosData: json("gargalosData"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OperationsData = typeof operationsData.$inferSelect;
export type InsertOperationsData = typeof operationsData.$inferInsert;

/**
 * Dados de No-show e Waste
 */
export const wasteData = mysqlTable("waste_data", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").references(() => clients.id).notNull(),
  period: varchar("period", { length: 20 }).notNull(),
  
  // KPIs
  noShowRate: decimal("noShowRate", { precision: 5, scale: 2 }),
  noShowVariacao: decimal("noShowVariacao", { precision: 5, scale: 2 }),
  financialLoss: decimal("financialLoss", { precision: 15, scale: 2 }),
  idleCapacityHours: int("idleCapacityHours"),
  efficiencyScore: int("efficiencyScore"),
  
  // Heatmap de no-shows (JSON array)
  heatmapData: json("heatmapData"),
  
  // Waste breakdown (JSON array)
  wasteBreakdownData: json("wasteBreakdownData"),
  
  // Department impact (JSON array)
  departmentImpactData: json("departmentImpactData"),
  
  // Recovery actions (JSON array)
  recoveryActionsData: json("recoveryActionsData"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WasteData = typeof wasteData.$inferSelect;
export type InsertWasteData = typeof wasteData.$inferInsert;

/**
 * Dados de Marketing e Growth
 */
export const marketingData = mysqlTable("marketing_data", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").references(() => clients.id).notNull(),
  period: varchar("period", { length: 20 }).notNull(),
  
  // KPIs de Marketing
  totalSpend: decimal("totalSpend", { precision: 15, scale: 2 }),
  spendVariacao: decimal("spendVariacao", { precision: 5, scale: 2 }),
  costPerLead: decimal("costPerLead", { precision: 10, scale: 2 }),
  cplVariacao: decimal("cplVariacao", { precision: 5, scale: 2 }),
  acquisitionCost: decimal("acquisitionCost", { precision: 10, scale: 2 }),
  cacVariacao: decimal("cacVariacao", { precision: 5, scale: 2 }),
  marketingRoi: decimal("marketingRoi", { precision: 7, scale: 2 }),
  roiVariacao: decimal("roiVariacao", { precision: 5, scale: 2 }),
  
  // Funil comercial (JSON array)
  funnelData: json("funnelData"),
  
  // ROI forecast vs actual (JSON array)
  roiForecastData: json("roiForecastData"),
  
  // Channel performance (JSON array)
  channelPerformanceData: json("channelPerformanceData"),
  
  // Insights
  bestChannel: varchar("bestChannel", { length: 100 }),
  bestChannelRoi: decimal("bestChannelRoi", { precision: 5, scale: 2 }),
  channelToOptimize: varchar("channelToOptimize", { length: 100 }),
  optimizeReason: text("optimizeReason"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MarketingData = typeof marketingData.$inferSelect;
export type InsertMarketingData = typeof marketingData.$inferInsert;

/**
 * Dados de Qualidade e NPS
 */
export const qualityData = mysqlTable("quality_data", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").references(() => clients.id).notNull(),
  period: varchar("period", { length: 20 }).notNull(),
  
  // NPS
  npsScore: int("npsScore"),
  npsRespostas: int("npsRespostas"),
  promotores: decimal("promotores", { precision: 5, scale: 2 }),
  passivos: decimal("passivos", { precision: 5, scale: 2 }),
  detratores: decimal("detratores", { precision: 5, scale: 2 }),
  
  // Lean Six Sigma
  dpmo: int("dpmo"),
  sigmaLevel: decimal("sigmaLevel", { precision: 3, scale: 1 }),
  cp: decimal("cp", { precision: 4, scale: 2 }),
  cpk: decimal("cpk", { precision: 4, scale: 2 }),
  firstPassYield: decimal("firstPassYield", { precision: 5, scale: 2 }),
  
  // Gráfico de controle (JSON array)
  controlChartData: json("controlChartData"),
  
  // Feedback recente (JSON array)
  feedbackData: json("feedbackData"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type QualityData = typeof qualityData.$inferSelect;
export type InsertQualityData = typeof qualityData.$inferInsert;

/**
 * Dados de People/RH
 */
export const peopleData = mysqlTable("people_data", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").references(() => clients.id).notNull(),
  period: varchar("period", { length: 20 }).notNull(),
  
  // KPIs
  headcount: int("headcount"),
  headcountVariacao: decimal("headcountVariacao", { precision: 5, scale: 2 }),
  turnover: decimal("turnover", { precision: 5, scale: 2 }),
  turnoverVariacao: decimal("turnoverVariacao", { precision: 5, scale: 2 }),
  absenteismo: decimal("absenteismo", { precision: 5, scale: 2 }),
  absenteismoVariacao: decimal("absenteismoVariacao", { precision: 5, scale: 2 }),
  revenuePerFte: decimal("revenuePerFte", { precision: 15, scale: 2 }),
  revenueFteVariacao: decimal("revenueFteVariacao", { precision: 5, scale: 2 }),
  
  // Produtividade por mês (JSON array)
  produtividadeData: json("produtividadeData"),
  
  // Turnover e absenteísmo por mês (JSON array)
  turnoverAbsenteismoData: json("turnoverAbsenteismoData"),
  
  // Performance da equipe (JSON array)
  teamPerformanceData: json("teamPerformanceData"),
  
  // Treinamento
  certificacoes: int("certificacoes"),
  horasTreinamento: int("horasTreinamento"),
  metaAtingida: decimal("metaAtingida", { precision: 5, scale: 2 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PeopleData = typeof peopleData.$inferSelect;
export type InsertPeopleData = typeof peopleData.$inferInsert;

/**
 * Dados de Data Governance
 */
export const dataGovernanceData = mysqlTable("data_governance_data", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").references(() => clients.id).notNull(),
  period: varchar("period", { length: 20 }).notNull(),
  
  // KPIs
  registrosTotais: int("registrosTotais"),
  dataQualityScore: int("dataQualityScore"),
  lgpdCompliance: int("lgpdCompliance"),
  issuesPendentes: int("issuesPendentes"),
  
  // Dimensões de qualidade
  completude: int("completude"),
  precisao: int("precisao"),
  consistencia: int("consistencia"),
  atualidade: int("atualidade"),
  validade: int("validade"),
  
  // Integrações (JSON array)
  integracoesData: json("integracoesData"),
  
  // Problemas de dados (JSON array)
  problemasData: json("problemasData"),
  
  // Segurança
  criptografia: int("criptografia"),
  auditTrailEvents: int("auditTrailEvents"),
  backupStatus: varchar("backupStatus", { length: 50 }),
  lastBackup: timestamp("lastBackup"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DataGovernanceData = typeof dataGovernanceData.$inferSelect;
export type InsertDataGovernanceData = typeof dataGovernanceData.$inferInsert;

/**
 * Histórico de importações de dados
 */
export const dataImports = mysqlTable("data_imports", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").references(() => clients.id).notNull(),
  userId: int("userId").references(() => users.id).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileType: mysqlEnum("fileType", ["excel", "csv", "json", "manual", "ai"]).notNull(),
  fileUrl: text("fileUrl"),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  recordsImported: int("recordsImported"),
  errorMessage: text("errorMessage"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type DataImport = typeof dataImports.$inferSelect;
export type InsertDataImport = typeof dataImports.$inferInsert;


/**
 * Integrações configuradas pelo cliente (tokens, APIs, etc.)
 */
export const integrations = mysqlTable("integrations", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").references(() => clients.id).notNull(),
  userId: int("userId").references(() => users.id).notNull(),
  type: mysqlEnum("type", [
    "kommo", "asaas",
    "google_sheets", "gtm", "meta_pixel", "meta_capi",
    "google_ads", "google_ads_enhanced", "excel_graph_api",
    "power_bi", "crm_hubspot", "crm_rd_station", "server_side_gtm"
  ]).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  token: text("token"),
  apiUrl: text("apiUrl"),
  config: json("config"), // extra config like version, container ID, etc.
  status: mysqlEnum("status", ["active", "inactive", "error", "pending"]).default("pending").notNull(),
  lastSyncAt: timestamp("lastSyncAt"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Integration = typeof integrations.$inferSelect;
export type InsertIntegration = typeof integrations.$inferInsert;

/**
 * Lançamentos manuais do cliente (Financeiro + Atendimento)
 * Esses registros alimentam o dashboard do cliente.
 */
export const manualEntries = mysqlTable("manual_entries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id).notNull(),
  category: mysqlEnum("category", ["financial", "attendance"]).notNull(),
  /** Tipo do lançamento: receita, custo_fixo, custo_variavel, investimento, consulta, retorno, procedimento, cancelamento, no_show */
  entryType: varchar("entryType", { length: 100 }).notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  value: decimal("value", { precision: 15, scale: 2 }),
  detail: text("detail"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ManualEntry = typeof manualEntries.$inferSelect;
export type InsertManualEntry = typeof manualEntries.$inferInsert;

/**
 * =====================================================
 * CONTROL TOWER ENTERPRISE BI
 * =====================================================
 */

export const controlTowerIngestions = mysqlTable("control_tower_ingestions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileType: mysqlEnum("fileType", ["pdf", "csv", "xlsx", "api", "webhook", "manual", "crm"]).notNull(),
  status: mysqlEnum("status", ["pending", "committed", "failed"]).default("pending").notNull(),
  parsedRows: int("parsedRows").default(0).notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ControlTowerIngestion = typeof controlTowerIngestions.$inferSelect;
export type InsertControlTowerIngestion = typeof controlTowerIngestions.$inferInsert;

export const controlTowerFacts = mysqlTable("control_tower_facts", {
  id: int("id").autoincrement().primaryKey(),
  ingestionId: int("ingestionId").references(() => controlTowerIngestions.id).notNull(),
  userId: int("userId").references(() => users.id).notNull(),
  eventAt: timestamp("eventAt").notNull(),
  channel: varchar("channel", { length: 120 }).notNull(),
  professional: varchar("professional", { length: 120 }).notNull(),
  procedureName: varchar("procedureName", { length: 120 }).notNull(),
  status: mysqlEnum("status", ["agendado", "realizado", "cancelado", "noshow"]).default("agendado").notNull(),
  pipeline: varchar("pipeline", { length: 120 }),
  unit: varchar("unit", { length: 120 }),
  entries: decimal("entries", { precision: 15, scale: 2 }).default("0").notNull(),
  exits: decimal("exits", { precision: 15, scale: 2 }).default("0").notNull(),
  revenueValue: decimal("revenueValue", { precision: 15, scale: 2 }).default("0").notNull(),
  slotsAvailable: int("slotsAvailable").default(0).notNull(),
  slotsEmpty: int("slotsEmpty").default(0).notNull(),
  ticketMedio: decimal("ticketMedio", { precision: 15, scale: 2 }).default("0").notNull(),
  custoVariavel: decimal("custoVariavel", { precision: 15, scale: 2 }).default("0").notNull(),
  durationMinutes: int("durationMinutes").default(0).notNull(),
  materialList: json("materialList"),
  waitMinutes: int("waitMinutes").default(0).notNull(),
  npsScore: int("npsScore").default(0).notNull(),
  baseOldRevenueCurrent: decimal("baseOldRevenueCurrent", { precision: 15, scale: 2 }).default("0").notNull(),
  baseOldRevenuePrevious: decimal("baseOldRevenuePrevious", { precision: 15, scale: 2 }).default("0").notNull(),
  crmLeadId: varchar("crmLeadId", { length: 120 }),
  sourceType: mysqlEnum("sourceType", ["upload", "crm", "api", "webhook", "manual"]).default("upload").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ControlTowerFactRecord = typeof controlTowerFacts.$inferSelect;
export type InsertControlTowerFactRecord = typeof controlTowerFacts.$inferInsert;

export const controlTowerRca = mysqlTable("control_tower_rca", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id).notNull(),
  alertId: varchar("alertId", { length: 64 }).notNull(),
  severity: mysqlEnum("severity", ["P1", "P2", "P3"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  rootCause: text("rootCause").notNull(),
  actionPlan: text("actionPlan").notNull(),
  owner: varchar("owner", { length: 120 }).notNull(),
  dueDate: timestamp("dueDate").notNull(),
  status: mysqlEnum("status", ["open", "in_progress", "done"]).default("open").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ControlTowerRca = typeof controlTowerRca.$inferSelect;
export type InsertControlTowerRca = typeof controlTowerRca.$inferInsert;

export const controlTowerCrmCredentials = mysqlTable(
  "control_tower_crm_credentials",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").references(() => users.id).notNull(),
    provider: mysqlEnum("provider", ["kommo", "asaas"]).default("kommo").notNull(),
    accountDomain: varchar("accountDomain", { length: 255 }).notNull(),
    accessToken: text("accessToken").notNull(),
    refreshToken: text("refreshToken").notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    scope: varchar("scope", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    userProviderUnique: uniqueIndex("ct_crm_credentials_user_provider_uq").on(table.userId, table.provider),
  }),
);

export type ControlTowerCrmCredential = typeof controlTowerCrmCredentials.$inferSelect;
export type InsertControlTowerCrmCredential = typeof controlTowerCrmCredentials.$inferInsert;

export const controlTowerCrmLeads = mysqlTable(
  "control_tower_crm_leads",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").references(() => users.id).notNull(),
    provider: mysqlEnum("provider", ["kommo", "asaas"]).default("kommo").notNull(),
    externalLeadId: varchar("externalLeadId", { length: 120 }).notNull(),
    pipeline: varchar("pipeline", { length: 120 }),
    status: varchar("status", { length: 120 }),
    channel: varchar("channel", { length: 120 }),
    responsible: varchar("responsible", { length: 120 }),
    procedureName: varchar("procedureName", { length: 120 }),
    valueAmount: decimal("valueAmount", { precision: 15, scale: 2 }).default("0").notNull(),
    createdAtCrm: timestamp("createdAtCrm").notNull(),
    updatedAtCrm: timestamp("updatedAtCrm"),
    rawPayload: json("rawPayload"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    userProviderExternalUnique: uniqueIndex("ct_crm_leads_user_provider_external_uq").on(table.userId, table.provider, table.externalLeadId),
  }),
);

export type ControlTowerCrmLead = typeof controlTowerCrmLeads.$inferSelect;
export type InsertControlTowerCrmLead = typeof controlTowerCrmLeads.$inferInsert;

export const controlTowerWebhookEvents = mysqlTable(
  "control_tower_webhook_events",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").references(() => users.id),
    provider: mysqlEnum("provider", ["kommo", "asaas"]).default("kommo").notNull(),
    eventId: varchar("eventId", { length: 160 }).notNull(),
    signature: varchar("signature", { length: 255 }),
    payload: json("payload").notNull(),
    receivedAt: timestamp("receivedAt").defaultNow().notNull(),
    processedAt: timestamp("processedAt"),
    status: mysqlEnum("status", ["accepted", "processed", "ignored", "failed"]).default("accepted").notNull(),
  },
  (table) => ({
    providerEventUnique: uniqueIndex("ct_webhook_provider_event_uq").on(table.provider, table.eventId),
  }),
);

export type ControlTowerWebhookEvent = typeof controlTowerWebhookEvents.$inferSelect;
export type InsertControlTowerWebhookEvent = typeof controlTowerWebhookEvents.$inferInsert;

export const controlTowerSyncState = mysqlTable(
  "control_tower_sync_state",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").references(() => users.id).notNull(),
    provider: mysqlEnum("provider", ["kommo", "asaas"]).default("kommo").notNull(),
    lastCursor: text("lastCursor"),
    lastSuccessAt: timestamp("lastSuccessAt"),
    lastErrorAt: timestamp("lastErrorAt"),
    lastErrorMessage: text("lastErrorMessage"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    userProviderUnique: uniqueIndex("ct_sync_state_user_provider_uq").on(table.userId, table.provider),
  }),
);

export type ControlTowerSyncState = typeof controlTowerSyncState.$inferSelect;
export type InsertControlTowerSyncState = typeof controlTowerSyncState.$inferInsert;

/**
 * Developer API keys for programmatic dashboard access
 */
export const apiKeys = mysqlTable("api_keys", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  keyHash: varchar("keyHash", { length: 64 }).notNull().unique(), // SHA-256 hex
  keyPrefix: varchar("keyPrefix", { length: 16 }).notNull(),     // e.g. "glx_live_Ab3x"
  mode: mysqlEnum("mode", ["live", "sandbox"]).default("live").notNull(),
  scopes: json("scopes").$type<string[]>().default([]),           // ["kpis","appointments","finance","nps"]
  lastUsedAt: timestamp("lastUsedAt"),
  expiresAt: timestamp("expiresAt"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;

// ═══════════════════════════════════════════════════════════════
//  MULTI-TENANT AI CHAT — GLX Insights
//  Cada registro é estritamente escopado por userId.
//  Nunca consultar sem WHERE userId = ctx.user.id
// ═══════════════════════════════════════════════════════════════

/**
 * Projetos de IA por usuário (RAG / contexto persistente)
 */
export const aiProjects = mysqlTable("ai_projects", {
  id: int("id").autoincrement().primaryKey(),
  /** Dono do projeto — never queryable without this */
  userId: int("userId").references(() => users.id).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  /** Prompt de sistema específico do projeto (opcional) */
  systemPrompt: text("systemPrompt"),
  archived: boolean("archived").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AiProject = typeof aiProjects.$inferSelect;
export type InsertAiProject = typeof aiProjects.$inferInsert;

/**
 * Conversas de IA — cada conversa pertence a um único usuário
 */
export const aiConversations = mysqlTable("ai_conversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id).notNull(),
  /** Null = conversa livre; preenchido = conversa dentro de um projeto */
  projectId: int("projectId").references(() => aiProjects.id),
  title: varchar("title", { length: 160 }).notNull().default("Nova conversa"),
  status: mysqlEnum("status", ["active", "archived"]).default("active").notNull(),
  /** Acumulado de tokens enviados nesta conversa */
  tokensSent: int("tokensSent").default(0).notNull(),
  /** Acumulado de tokens recebidos nesta conversa */
  tokensReceived: int("tokensReceived").default(0).notNull(),
  /** Custo estimado acumulado em USD */
  estimatedCostUsd: decimal("estimatedCostUsd", { precision: 10, scale: 6 }).default("0").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AiConversation = typeof aiConversations.$inferSelect;
export type InsertAiConversation = typeof aiConversations.$inferInsert;

/**
 * Mensagens — vinculadas sempre ao userId para garantir isolamento mesmo em queries diretas
 */
export const aiMessages = mysqlTable("ai_messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").references(() => aiConversations.id).notNull(),
  /** Denormalizado para permitir row-level security sem JOIN */
  userId: int("userId").references(() => users.id).notNull(),
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: text("content").notNull(),
  /** Tokens reais contados após a chamada ao modelo */
  tokensIn: int("tokensIn").default(0).notNull(),
  tokensOut: int("tokensOut").default(0).notNull(),
  /** Modelo usado nesta mensagem */
  modelUsed: varchar("modelUsed", { length: 60 }),
  /** Classificação da tarefa para o router de modelo */
  requestType: mysqlEnum("requestType", ["simple", "standard", "complex", "summary"]),
  estimatedCostUsd: decimal("estimatedCostUsd", { precision: 10, scale: 6 }).default("0").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AiMessage = typeof aiMessages.$inferSelect;
export type InsertAiMessage = typeof aiMessages.$inferInsert;

/**
 * Resumos automáticos de contexto — substitui histórico antigo para reduzir tokens
 */
export const aiContextSummaries = mysqlTable("ai_context_summaries", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").references(() => aiConversations.id).notNull(),
  userId: int("userId").references(() => users.id).notNull(),
  summaryText: text("summaryText").notNull(),
  /** ID da última mensagem coberta por este resumo */
  upToMessageId: int("upToMessageId").references(() => aiMessages.id).notNull(),
  tokensUsed: int("tokensUsed").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AiContextSummary = typeof aiContextSummaries.$inferSelect;
export type InsertAiContextSummary = typeof aiContextSummaries.$inferInsert;

/**
 * Log de uso por requisição — billing e observabilidade por usuário
 */
export const aiUsageLogs = mysqlTable("ai_usage_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id).notNull(),
  conversationId: int("conversationId").references(() => aiConversations.id),
  projectId: int("projectId").references(() => aiProjects.id),
  tokensIn: int("tokensIn").notNull(),
  tokensOut: int("tokensOut").notNull(),
  totalTokens: int("totalTokens").notNull(),
  estimatedCostUsd: decimal("estimatedCostUsd", { precision: 10, scale: 6 }).notNull(),
  modelUsed: varchar("modelUsed", { length: 60 }).notNull(),
  requestType: mysqlEnum("requestType", ["simple", "standard", "complex", "summary"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AiUsageLog = typeof aiUsageLogs.$inferSelect;
export type InsertAiUsageLog = typeof aiUsageLogs.$inferInsert;

/**
 * Limites e orçamento de IA por usuário
 */
export const aiUserLimits = mysqlTable("ai_user_limits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id).notNull().unique(),
  /** Orçamento diário em USD (null = sem limite) */
  dailyBudgetUsd: decimal("dailyBudgetUsd", { precision: 8, scale: 4 }),
  /** Orçamento mensal em USD (null = sem limite) */
  monthlyBudgetUsd: decimal("monthlyBudgetUsd", { precision: 8, scale: 4 }),
  /** Percentual de uso que dispara alerta (ex: 80 = 80%) */
  alertAtPercent: int("alertAtPercent").default(80).notNull(),
  isBlocked: boolean("isBlocked").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AiUserLimit = typeof aiUserLimits.$inferSelect;
export type InsertAiUserLimit = typeof aiUserLimits.$inferInsert;

/**
 * API usage log for rate limiting and analytics
 */
export const apiUsageLogs = mysqlTable("api_usage_logs", {
  id: int("id").autoincrement().primaryKey(),
  apiKeyId: int("apiKeyId").references(() => apiKeys.id).notNull(),
  endpoint: varchar("endpoint", { length: 100 }).notNull(),
  method: varchar("method", { length: 10 }).notNull(),
  statusCode: int("statusCode").notNull(),
  responseTimeMs: int("responseTimeMs"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
