import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  controlTowerCrmCredentials,
  controlTowerRca,
  type InsertControlTowerCrmCredential,
  type InsertControlTowerRca,
} from "../drizzle/schema";
import { enterprise } from "@shared/controlTowerRules";
import type { ControlTowerFact, ControlTowerFilterState, IngestionParsedRow, RcaRecord } from "@shared/types";
import { getDb } from "./db";
import { protectedProcedure, router } from "./_core/trpc";
import {
  commitControlTowerIngestionBatch,
  loadControlTowerFacts,
  loadControlTowerIngestions,
  resetControlTowerDataStore,
  type ControlTowerStoredIngestion,
} from "./domain/controlTowerDataStore";
import { syncLocalAiPayloadToUser } from "./domain/localAiDashboardSync";
import { kommoFullSyncUseCase } from "./application/useCases/kommoFullSyncUseCase";
import { asaasFullSyncUseCase } from "./application/useCases/asaasFullSyncUseCase";

const filterSchema = z.object({
  period: z.enum(["7d", "30d", "90d", "12m", "custom"]).default("30d"),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  channel: z.string().optional(),
  professional: z.string().optional(),
  procedure: z.string().optional(),
  status: z.string().optional(),
  pipeline: z.string().optional(),
  unit: z.string().optional(),
  alertSeverity: z.enum(["P1", "P2", "P3", "all"]).optional(),
});

const rowSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().min(1),
  channel: z.string().min(1),
  professional: z.string().min(1),
  procedure: z.string().min(1),
  status: z.enum(["agendado", "realizado", "cancelado", "noshow"]),
  pipeline: z.string().optional(),
  unit: z.string().optional(),
  entries: z.number().finite(),
  exits: z.number().finite(),
  slotsAvailable: z.number().int().min(0),
  slotsEmpty: z.number().int().min(0),
  ticketMedio: z.number().finite().min(0),
  custoVariavel: z.number().finite().min(0),
  durationMinutes: z.number().int().min(0),
  materialList: z.array(z.string()).default([]),
  waitMinutes: z.number().int().min(0),
  npsScore: z.number().int().min(-100).max(100),
  baseOldRevenueCurrent: z.number().finite().min(0),
  baseOldRevenuePrevious: z.number().finite().min(0),
  crmLeadId: z.string().optional(),
  sourceType: z.enum(["upload", "crm", "api", "webhook", "manual"]).optional(),
});

const commitSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.enum(["pdf", "csv", "xlsx", "api", "webhook", "manual", "crm"]),
  rows: z.array(rowSchema).min(1).max(5000),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const createRcaSchema = z.object({
  alertId: z.string().min(1),
  severity: z.enum(["P1", "P2", "P3"]),
  title: z.string().min(1),
  rootCause: z.string().min(3),
  actionPlan: z.string().min(3),
  owner: z.string().min(2),
  dueDate: z.string().min(1),
  status: z.enum(["open", "in_progress", "done"]).default("open"),
});

const updateRcaStatusSchema = z.object({
  id: z.number().int().positive(),
  status: z.enum(["open", "in_progress", "done"]),
  rootCause: z.string().optional(),
  actionPlan: z.string().optional(),
  owner: z.string().optional(),
  dueDate: z.string().optional(),
});

const listRcaSchema = z.object({
  severity: z.enum(["P1", "P2", "P3"]).optional(),
  status: z.enum(["open", "in_progress", "done"]).optional(),
});

const roleDashboardSchema = z.object({
  role: z.enum(["CEO", "MANAGER", "OPERATIONAL", "TECHNICAL"]),
  filters: filterSchema.optional(),
});

const moduleDashboardSchema = z.object({
  module: z.enum(["ceo", "warroom", "financeiro", "operacoes", "growth", "qualidade", "equipe", "ingestao"]),
  filters: filterSchema.optional(),
});

const ingestionHealthSchema = z.object({
  provider: z.enum(["kommo", "asaas"]).optional(),
});

const crmCredentialSchema = z.object({
  provider: z.enum(["kommo", "asaas"]).default("kommo"),
  accountDomain: z.string().min(3),
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.string().min(1),
  scope: z.string().optional(),
});

const inMemoryRca: Array<RcaRecord & { userId: number }> = [];
const inMemoryCrmCredentials = new Map<string, { userId: number; provider: "kommo" | "asaas"; accountDomain: string; expiresAt: string; scope?: string }>();
let inMemoryRcaId = 1;

export function __resetControlTowerMemory() {
  resetControlTowerDataStore();
  inMemoryRca.length = 0;
  inMemoryCrmCredentials.clear();
  inMemoryRcaId = 1;
}

function toDate(value: string): Date {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function normalizeFilterValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed === "all") return undefined;
  return trimmed;
}

function periodToDays(period: ControlTowerFilterState["period"]): number {
  if (period === "7d") return 7;
  if (period === "30d") return 30;
  if (period === "90d") return 90;
  if (period === "12m") return 365;
  return 30;
}

function applyFilters(rows: ControlTowerFact[], filters: ControlTowerFilterState): ControlTowerFact[] {
  const now = Date.now();
  const channel = normalizeFilterValue(filters.channel);
  const professional = normalizeFilterValue(filters.professional);
  const procedure = normalizeFilterValue(filters.procedure);
  const status = normalizeFilterValue(filters.status);
  const pipeline = normalizeFilterValue(filters.pipeline);
  const unit = normalizeFilterValue(filters.unit);

  const dateFromMs =
    filters.period === "custom" && filters.dateFrom
      ? new Date(`${filters.dateFrom}T00:00:00`).getTime()
      : now - (periodToDays(filters.period) * 86_400_000);
  const dateToMs =
    filters.period === "custom" && filters.dateTo
      ? new Date(`${filters.dateTo}T23:59:59`).getTime()
      : now;

  return rows.filter(row => {
    const timestamp = new Date(row.timestamp).getTime();
    if (Number.isFinite(dateFromMs) && timestamp < dateFromMs) return false;
    if (Number.isFinite(dateToMs) && timestamp > dateToMs) return false;
    if (channel && row.channel.toLowerCase() !== channel) return false;
    if (professional && row.professional.toLowerCase() !== professional) return false;
    if (procedure && row.procedure.toLowerCase() !== procedure) return false;
    if (status && row.status.toLowerCase() !== status) return false;
    if (pipeline && (row.pipeline ?? "").toLowerCase() !== pipeline) return false;
    if (unit && (row.unit ?? "").toLowerCase() !== unit) return false;
    return true;
  });
}

async function loadUserFacts(userId: number): Promise<ControlTowerFact[]> {
  return loadControlTowerFacts(userId);
}

async function loadUserIngestions(userId: number): Promise<ControlTowerStoredIngestion[]> {
  return loadControlTowerIngestions(userId);
}

function deriveIngestionHealth(facts: ControlTowerFact[], ingestions: ControlTowerStoredIngestion[]) {
  const now = Date.now();
  const lastSyncAt = ingestions[0]?.createdAt ?? null;
  const recentIngestions = ingestions.filter(item => now - new Date(item.createdAt).getTime() <= 86_400_000);
  const rows24h = facts.filter(row => now - new Date(row.timestamp).getTime() <= 86_400_000);
  const hasSpreadsheetIngestion = recentIngestions.some(item => item.fileType === "csv" || item.fileType === "xlsx");
  const hasApiIngestion = recentIngestions.some(item => item.fileType === "api" || item.fileType === "webhook");
  const hasCrmIngestion = recentIngestions.some(item => item.fileType === "crm");
  const failedRecentIngestions = recentIngestions.filter(item => item.status === "failed").length;
  const anyRecentSync = recentIngestions.length > 0;
  const connectorStatus = (
    hasSignal: boolean,
    opts?: { allowDegraded?: boolean },
  ): "connected" | "degraded" | "disconnected" => {
    if (hasSignal) return "connected";
    if (opts?.allowDegraded && anyRecentSync && failedRecentIngestions > 0) return "degraded";
    return "disconnected";
  };

  const requiredTotal = rows24h.length * 6;
  const requiredFilled = rows24h.reduce((acc, row) => {
    const required = [row.timestamp, row.channel, row.professional, row.procedure, row.status, row.ticketMedio];
    return acc + required.filter(value => value !== undefined && value !== null && String(value) !== "").length;
  }, 0);

  return {
    integrations: [
      {
        key: "agenda",
        label: "Agenda",
        provider: "Clinicorp / iClinic / Omie",
        status: connectorStatus(rows24h.length > 0 || hasSpreadsheetIngestion || hasApiIngestion, { allowDegraded: true }),
        lastSyncAt,
        slaMinutes: anyRecentSync ? 15 : 0,
        failures24h: 0,
      },
      {
        key: "crm",
        label: "CRM",
        provider: "Kommo / Pipedrive / RD",
        status: connectorStatus(hasCrmIngestion, { allowDegraded: true }),
        lastSyncAt,
        slaMinutes: anyRecentSync ? 5 : 0,
        failures24h: failedRecentIngestions,
      },
      {
        key: "kommo",
        label: "Kommo CRM",
        provider: "OAuth + Webhook + REST Sync",
        status: connectorStatus(hasCrmIngestion, { allowDegraded: true }),
        lastSyncAt,
        slaMinutes: anyRecentSync ? 5 : 0,
        failures24h: failedRecentIngestions,
      },
      {
        key: "asaas",
        label: "Asaas Billing",
        provider: "Webhook + REST Sync",
        status: connectorStatus(hasApiIngestion, { allowDegraded: true }),
        lastSyncAt,
        slaMinutes: anyRecentSync ? 5 : 0,
        failures24h: failedRecentIngestions,
      },
      {
        key: "google-sheets",
        label: "Google Sheets",
        provider: "Sheets API / CSV bridge",
        status: connectorStatus(hasSpreadsheetIngestion, { allowDegraded: true }),
        lastSyncAt,
        slaMinutes: anyRecentSync ? 60 : 0,
        failures24h: 0,
      },
      {
        key: "crm-api",
        label: "Outros CRMs via API",
        provider: "Pipedrive / RD / HubSpot (adapter)",
        status: connectorStatus(hasApiIngestion, { allowDegraded: true }),
        lastSyncAt,
        slaMinutes: anyRecentSync ? 30 : 0,
        failures24h: failedRecentIngestions,
      },
      {
        key: "meta-ads",
        label: "Meta Ads",
        provider: "Marketing API",
        status: "disconnected",
        lastSyncAt,
        slaMinutes: 0,
        failures24h: 0,
      },
      {
        key: "google-ads",
        label: "Google Ads",
        provider: "Google Ads API",
        status: "disconnected",
        lastSyncAt,
        slaMinutes: 0,
        failures24h: 0,
      },
      {
        key: "google-tag-manager",
        label: "Google Tag Manager",
        provider: "GTM API / Data Layer",
        status: "disconnected",
        lastSyncAt,
        slaMinutes: 0,
        failures24h: 0,
      },
      {
        key: "financeiro",
        label: "Financeiro / ERP",
        provider: "ERP/API",
        status: connectorStatus(hasApiIngestion, { allowDegraded: true }),
        lastSyncAt,
        slaMinutes: anyRecentSync ? 60 : 0,
        failures24h: failedRecentIngestions,
      },
      {
        key: "nps",
        label: "NPS / Forms",
        provider: "Forms/API",
        status: "disconnected",
        lastSyncAt,
        slaMinutes: 0,
        failures24h: 0,
      },
    ] as Array<{
      key: string;
      label: string;
      provider: string;
      status: "connected" | "degraded" | "disconnected";
      lastSyncAt: string | null;
      slaMinutes: number;
      failures24h: number;
    }>,
    quality: {
      requiredFieldsPct: requiredTotal > 0 ? Number(((requiredFilled / requiredTotal) * 100).toFixed(2)) : 0,
      cancelamentosSemMotivo: rows24h.filter(row => row.status === "cancelado" && (!row.materialList || row.materialList.length === 0)).length,
      leadsSemCanal: rows24h.filter(row => !row.channel || row.channel.toLowerCase() === "unknown").length,
      inconsistentRows: rows24h.filter(row => row.entries < 0 || row.exits < 0 || row.slotsEmpty > row.slotsAvailable).length,
    },
    technical: {
      lastSyncAt,
      apiFailures24h: failedRecentIngestions,
      importErrors24h: recentIngestions.filter(item => item.status !== "committed").length,
      volumeRegistrosDia: rows24h.length,
      slaAtualizacaoMin: anyRecentSync ? 15 : 0,
    },
  };
}

async function loadUserRca(userId: number): Promise<RcaRecord[]> {
  const db = await getDb();
  if (!db) {
    return inMemoryRca.filter(record => record.userId === userId);
  }

  const rows = await db
    .select()
    .from(controlTowerRca)
    .where(eq(controlTowerRca.userId, userId))
    .orderBy(desc(controlTowerRca.createdAt));

  return rows.map(row => ({
    id: row.id,
    alertId: row.alertId,
    severity: row.severity,
    title: row.title,
    rootCause: row.rootCause,
    actionPlan: row.actionPlan,
    owner: row.owner,
    dueDate: row.dueDate.toISOString(),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

async function persistRca(userId: number, input: z.infer<typeof createRcaSchema>): Promise<RcaRecord> {
  const db = await getDb();
  if (!db) {
    const record: RcaRecord = {
      id: inMemoryRcaId++,
      alertId: input.alertId,
      severity: input.severity,
      title: input.title,
      rootCause: input.rootCause,
      actionPlan: input.actionPlan,
      owner: input.owner,
      dueDate: input.dueDate,
      status: input.status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    inMemoryRca.push({ ...record, userId });
    return record;
  }

  const payload: InsertControlTowerRca = {
    userId,
    alertId: input.alertId,
    severity: input.severity,
    title: input.title,
    rootCause: input.rootCause,
    actionPlan: input.actionPlan,
    owner: input.owner,
    dueDate: toDate(input.dueDate),
    status: input.status,
  };
  const result = await db.insert(controlTowerRca).values(payload as any);
  const id = result[0]?.insertId as number;
  return {
    id,
    alertId: input.alertId,
    severity: input.severity,
    title: input.title,
    rootCause: input.rootCause,
    actionPlan: input.actionPlan,
    owner: input.owner,
    dueDate: input.dueDate,
    status: input.status,
  };
}

export const controlTowerRouter = router({
  getDashboardData: protectedProcedure
    .input(filterSchema.optional())
    .query(async ({ ctx, input }) => {
      const filters = input ?? { period: "30d" as const };
      const facts = await loadUserFacts(ctx.user!.id);
      const filteredFacts = applyFilters(facts, filters);
      const snapshot = enterprise.buildSnapshot(filteredFacts);
      const alerts = (filteredFacts.length === 0 ? [] : enterprise.evaluateAlerts(snapshot))
        .filter(alert => (filters.alertSeverity && filters.alertSeverity !== "all" ? alert.severity === filters.alertSeverity : true));

      const rca = (await loadUserRca(ctx.user!.id)).filter(record => {
        if (filters.alertSeverity && filters.alertSeverity !== "all") {
          return record.severity === filters.alertSeverity;
        }
        return true;
      });

      return {
        filters,
        facts: filteredFacts,
        snapshot,
        alerts,
        rca,
      };
    }),

  getRoleDashboardData: protectedProcedure
    .input(roleDashboardSchema)
    .query(async ({ ctx, input }) => {
      const filters = input.filters ?? { period: "30d" as const };
      const facts = await loadUserFacts(ctx.user!.id);
      const filteredFacts = applyFilters(facts, filters);
      const snapshot = enterprise.buildSnapshot(filteredFacts);
      const alerts = filteredFacts.length === 0 ? [] : enterprise.evaluateAlerts(snapshot);
      return {
        role: input.role,
        filters,
        facts: filteredFacts,
        snapshot,
        alerts,
      };
    }),

  getModuleData: protectedProcedure
    .input(moduleDashboardSchema)
    .query(async ({ ctx, input }) => {
      const filters = input.filters ?? { period: "30d" as const };
      const facts = await loadUserFacts(ctx.user!.id);
      const filteredFacts = applyFilters(facts, filters);
      const snapshot = enterprise.buildSnapshot(filteredFacts);
      const alerts = filteredFacts.length === 0 ? [] : enterprise.evaluateAlerts(snapshot);
      const rca = await loadUserRca(ctx.user!.id);
      const ingestions = await loadUserIngestions(ctx.user!.id);
      const ingestionHealth = deriveIngestionHealth(filteredFacts, ingestions);

      return {
        module: input.module,
        filters,
        facts: filteredFacts,
        snapshot,
        alerts,
        rca,
        ingestionHealth,
      };
    }),

  commitIngestionBatch: protectedProcedure
    .input(commitSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await commitControlTowerIngestionBatch({
        userId: ctx.user!.id,
        fileName: input.fileName,
        fileType: input.fileType,
        rows: input.rows,
        metadata: input.metadata,
      });

      let adminSyncWarning: string | undefined;
      try {
        await syncLocalAiPayloadToUser({
          userId: ctx.user!.id,
          clientName: ctx.user?.name || ctx.user?.email || `Cliente ${ctx.user!.id}`,
          records: input.rows.map((row) => ({
            id: row.id,
            timestamp: row.timestamp,
            channel: row.channel,
            professional: row.professional,
            procedure: row.procedure,
            status: row.status,
            pipeline: row.pipeline,
            unit: row.unit,
            sourceType: row.sourceType,
            leadId: row.crmLeadId,
            revenueGross: row.entries,
            revenueNet: row.entries,
            directCost: row.custoVariavel,
            fixedCost: Math.max(0, row.exits - row.custoVariavel),
            ticketMedio: row.ticketMedio,
            slotsAvailable: row.slotsAvailable,
            slotsEmpty: row.slotsEmpty,
            durationMinutes: row.durationMinutes,
            waitMinutes: row.waitMinutes,
            npsScore: row.npsScore,
            materialList: row.materialList,
            baseOldRevenueCurrent: row.baseOldRevenueCurrent,
            baseOldRevenuePrevious: row.baseOldRevenuePrevious,
          })),
        });
      } catch (error) {
        adminSyncWarning = error instanceof Error ? error.message : String(error);
      }

      return {
        ...result,
        adminSyncWarning,
      };
    }),

  listRca: protectedProcedure
    .input(listRcaSchema.optional())
    .query(async ({ ctx, input }) => {
      const items = await loadUserRca(ctx.user!.id);
      return items.filter(item => {
        if (input?.severity && item.severity !== input.severity) return false;
        if (input?.status && item.status !== input.status) return false;
        return true;
      });
    }),

  createRca: protectedProcedure
    .input(createRcaSchema)
    .mutation(async ({ ctx, input }) => {
      const created = await persistRca(ctx.user!.id, input);
      return { success: true, record: created };
    }),

  updateRcaStatus: protectedProcedure
    .input(updateRcaStatusSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        const idx = inMemoryRca.findIndex(record => Number(record.id) === input.id && record.userId === ctx.user!.id);
        if (idx !== -1) {
          const previous = inMemoryRca[idx]!;
          inMemoryRca[idx] = {
            ...previous,
            status: input.status,
            rootCause: input.rootCause ?? previous.rootCause,
            actionPlan: input.actionPlan ?? previous.actionPlan,
            owner: input.owner ?? previous.owner,
            dueDate: input.dueDate ?? previous.dueDate,
            updatedAt: new Date().toISOString(),
          };
        }
        return { success: true };
      }

      const whereClause = and(eq(controlTowerRca.id, input.id), eq(controlTowerRca.userId, ctx.user!.id));
      await db.update(controlTowerRca).set({
        status: input.status,
        rootCause: input.rootCause,
        actionPlan: input.actionPlan,
        owner: input.owner,
        dueDate: input.dueDate ? toDate(input.dueDate) : undefined,
      } as any).where(whereClause);
      return { success: true };
    }),

  listIngestionHealth: protectedProcedure
    .input(ingestionHealthSchema.optional())
    .query(async ({ ctx }) => {
      const facts = await loadUserFacts(ctx.user!.id);
      const ingestions = await loadUserIngestions(ctx.user!.id);
      return deriveIngestionHealth(facts, ingestions);
    }),

  saveCrmCredentials: protectedProcedure
    .input(crmCredentialSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user!.id;
      const db = await getDb();
      const expiresAt = toDate(input.expiresAt);

      if (!db) {
        inMemoryCrmCredentials.set(`${userId}:${input.provider}`, {
          userId,
          provider: input.provider,
          accountDomain: input.accountDomain,
          expiresAt: expiresAt.toISOString(),
          scope: input.scope,
        });
        return { success: true };
      }

      const existing = await db
        .select()
        .from(controlTowerCrmCredentials)
        .where(and(eq(controlTowerCrmCredentials.userId, userId), eq(controlTowerCrmCredentials.provider, input.provider)))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(controlTowerCrmCredentials)
          .set({
            accountDomain: input.accountDomain,
            accessToken: input.accessToken,
            refreshToken: input.refreshToken,
            expiresAt,
            scope: input.scope,
          } as any)
          .where(and(eq(controlTowerCrmCredentials.userId, userId), eq(controlTowerCrmCredentials.provider, input.provider)));
      } else {
        const payload: InsertControlTowerCrmCredential = {
          userId,
          provider: input.provider,
          accountDomain: input.accountDomain,
          accessToken: input.accessToken,
          refreshToken: input.refreshToken,
          expiresAt,
          scope: input.scope,
        };
        await db.insert(controlTowerCrmCredentials).values(payload as any);
      }

      return { success: true };
    }),

  syncKommoNow: protectedProcedure
    .input(z.object({ provider: z.enum(["kommo", "asaas"]).default("kommo") }).optional())
    .mutation(async ({ ctx, input }) => {
      const { TRPCError } = await import("@trpc/server");
      const provider = input?.provider ?? "kommo";
      let result: { syncedAt: string };
      try {
        result =
          provider === "kommo"
            ? await kommoFullSyncUseCase({ userId: ctx.user!.id, provider: "kommo" })
            : await asaasFullSyncUseCase({ userId: ctx.user!.id });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "BAD_REQUEST", message });
      }
      const facts = await loadUserFacts(ctx.user!.id);
      const snapshot = enterprise.buildSnapshot(facts);
      return {
        success: true,
        provider,
        syncedAt: result.syncedAt,
        snapshot,
      };
    }),
});
