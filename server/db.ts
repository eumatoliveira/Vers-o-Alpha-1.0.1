import { eq, desc, sql, and, gte, lte, count, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users, 
  auditLogs, 
  InsertAuditLog,
  systemMetrics,
  InsertSystemMetric,
  featureFlags,
  InsertFeatureFlag,
  subscriptions,
  InsertSubscription,
  payments,
  InsertPayment,
  errorLogs,
  InsertErrorLog,
  serviceStatus,
  InsertServiceStatus,
  integrations,
  InsertIntegration,
  manualEntries,
  InsertManualEntry
} from "../drizzle/schema";
import { ENV } from './_core/env';
import type { IntegrationConfigRecord, IntegrationProvider, IntegrationPipelineSnapshot } from "@shared/integrationEvents";
import type { SupportedCurrency } from "@shared/currency";

let _db: ReturnType<typeof drizzle> | null = null;

// Named synchronous export used by routers (aiChatRouter, costTracker, etc).
// Operations throw at runtime when DATABASE_URL is not configured.
export const db: ReturnType<typeof drizzle> = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target: never, prop: string | symbol) {
    if (_db) return (_db as any)[prop];
    throw new Error(`[Database] No connection available. Configure DATABASE_URL to enable database features. (db.${String(prop)})`);
  },
});

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const databaseUrl = new URL(process.env.DATABASE_URL);
      if (!databaseUrl.searchParams.has("charset")) {
        databaseUrl.searchParams.set("charset", "utf8mb4");
      }

      _db = drizzle(databaseUrl.toString());
      await _db.execute(sql.raw("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"));
    } catch (error) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(`[Database] Failed to connect in production: ${error instanceof Error ? error.message : String(error)}`);
      }
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ==================== IN-MEMORY USER STORE (fallback when no DB) ====================

interface InMemoryUser {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  passwordHash: string | null;
  loginMethod: string | null;
  role: 'user' | 'admin';
  plan: 'essencial' | 'pro' | 'enterprise';
  preferredCurrency: SupportedCurrency;
  mfaEnabled: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
}

type IntegrationStatus = "active" | "inactive" | "error" | "pending";
type IntegrationType = NonNullable<InsertIntegration["type"]>;

interface InMemoryIntegrationRecord {
  id: number;
  clientId: number;
  userId: number;
  type: IntegrationType;
  name: string;
  token: string | null;
  apiUrl: string | null;
  config: Record<string, unknown> | null;
  status: IntegrationStatus;
  lastSyncAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

type InMemoryPipelineStats = IntegrationPipelineSnapshot & {
  provider: IntegrationProvider;
  userId: number;
};

const inMemoryUsers: InMemoryUser[] = [];
let inMemoryIdCounter = 1;
const inMemoryUserClientIds = new Map<number, number>();
const inMemoryIntegrations: InMemoryIntegrationRecord[] = [];
let inMemoryIntegrationIdCounter = 1;
let inMemorySyntheticClientIdCounter = 1;
const inMemoryPipelineStats = new Map<string, InMemoryPipelineStats>();

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    // In-memory fallback: update existing user or ignore
    const existing = inMemoryUsers.find(u => u.openId === user.openId);
    if (existing) {
      if (user.name !== undefined) existing.name = user.name ?? null;
      if (user.email !== undefined) existing.email = user.email ?? null;
      if (user.preferredCurrency !== undefined) existing.preferredCurrency = user.preferredCurrency as SupportedCurrency;
      if (user.lastSignedIn !== undefined) existing.lastSignedIn = user.lastSignedIn;
      existing.updatedAt = new Date();
    }
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (db) {
    const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  }

  // In-memory fallback
  const user = inMemoryUsers.find(u => u.openId === openId);
  return user || undefined;
}

// ==================== ADMIN DASHBOARD QUERIES ====================

// Users Management
export async function getAllUsers(limit = 100, offset = 0) {
  const db = await getDb();
  if (db) {
    return await db.select().from(users).limit(limit).offset(offset).orderBy(desc(users.createdAt));
  }
  
  // In-memory fallback
  return inMemoryUsers.slice(offset, offset + limit).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserRole(userId: number, role: 'user' | 'admin') {
  const db = await getDb();
  if (db) {
    await db.update(users).set({ role }).where(eq(users.id, userId));
    return;
  }
  // In-memory fallback
  const user = inMemoryUsers.find(u => u.id === userId);
  if (user) user.role = role;
}

export async function updateUserPlan(userId: number, plan: 'essencial' | 'pro' | 'enterprise') {
  const db = await getDb();
  if (db) {
    await (db.update(users) as any).set({ plan }).where(eq(users.id, userId));
    return;
  }
  // In-memory fallback
  const user = inMemoryUsers.find(u => u.id === userId);
  if (user) user.plan = plan;
}

export async function searchUsers(query: string) {
  const db = await getDb();
  const q = query.toLowerCase();
  if (db) {
    // Simple search using like patterns
    const allUsers = await db.select().from(users).limit(100);
    return allUsers.filter(u =>
      u.email?.toLowerCase().includes(q) ||
      u.name?.toLowerCase().includes(q)
    );
  }
  // In-memory fallback
  return inMemoryUsers.filter(u =>
    u.email?.toLowerCase().includes(q) ||
    u.name?.toLowerCase().includes(q)
  );
}

export async function getUsersCount() {
  const db = await getDb();
  if (db) {
    const result = await db.select({ count: count() }).from(users);
    return result[0]?.count ?? 0;
  }
  // In-memory fallback
  return inMemoryUsers.length;
}

export async function getMfaEnabledCount() {
  const db = await getDb();
  if (db) {
    const result = await db.select({ count: count() }).from(users).where(eq(users.mfaEnabled, true));
    return result[0]?.count ?? 0;
  }
  // In-memory fallback
  return inMemoryUsers.filter(u => u.mfaEnabled).length;
}

export type AdminProvisionedIntegrationInput = {
  type: IntegrationType;
  name?: string;
  token?: string;
  apiUrl?: string;
  identifier?: string;
  status?: IntegrationStatus;
  metadata?: Record<string, unknown>;
};

export type UserIntegrationSummary = {
  count: number;
  types: IntegrationType[];
};

export async function getIntegrationSummariesByUserIds(userIds: number[]) {
  const uniqueUserIds = Array.from(new Set(userIds.filter((id) => Number.isInteger(id) && id > 0)));
  const result = new Map<number, UserIntegrationSummary>();

  if (uniqueUserIds.length === 0) {
    return result;
  }

  const db = await getDb();
  if (db) {
    const rows = await db
      .select({
        userId: integrations.userId,
        type: integrations.type,
      })
      .from(integrations)
      .where(inArray(integrations.userId, uniqueUserIds));

    for (const row of rows) {
      const current = result.get(row.userId) ?? { count: 0, types: [] };
      current.count += 1;
      if (row.type && !current.types.includes(row.type as IntegrationType)) {
        current.types.push(row.type as IntegrationType);
      }
      result.set(row.userId, current);
    }

    return result;
  }

  for (const row of inMemoryIntegrations) {
    if (!uniqueUserIds.includes(row.userId)) continue;
    const current = result.get(row.userId) ?? { count: 0, types: [] };
    current.count += 1;
    if (!current.types.includes(row.type)) {
      current.types.push(row.type);
    }
    result.set(row.userId, current);
  }

  return result;
}

// Audit Logs
export async function createAuditLog(log: InsertAuditLog) {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(auditLogs).values(log);
}

export async function getAuditLogs(limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(auditLogs).limit(limit).offset(offset).orderBy(desc(auditLogs.createdAt));
}

// System Metrics
export async function createSystemMetric(metric: InsertSystemMetric) {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(systemMetrics).values(metric);
}

export async function getLatestMetrics() {
  const db = await getDb();
  if (!db) return [];
  
  // Get latest metric for each type
  const metricTypes = ['cpu', 'memory', 'storage', 'latency', 'error_rate', 'api_calls'] as const;
  const results = [];
  
  for (const type of metricTypes) {
    const result = await db.select()
      .from(systemMetrics)
      .where(eq(systemMetrics.metricType, type))
      .orderBy(desc(systemMetrics.recordedAt))
      .limit(1);
    if (result.length > 0) {
      results.push(result[0]);
    }
  }
  
  return results;
}

// Feature Flags
export async function getAllFeatureFlags() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(featureFlags).orderBy(featureFlags.name);
}

export async function createFeatureFlag(flag: InsertFeatureFlag) {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(featureFlags).values(flag);
}

export async function updateFeatureFlag(id: number, updates: Partial<InsertFeatureFlag>) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(featureFlags).set(updates).where(eq(featureFlags.id, id));
}

export async function deleteFeatureFlag(id: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.delete(featureFlags).where(eq(featureFlags.id, id));
}

// Subscriptions & Financial
export async function getAllSubscriptions() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(subscriptions).orderBy(desc(subscriptions.createdAt));
}

export async function getActiveSubscriptions() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(subscriptions).where(eq(subscriptions.status, 'active'));
}

export async function createSubscription(sub: InsertSubscription) {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(subscriptions).values(sub);
}

export async function calculateMRR() {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db.select({
    total: sql<string>`SUM(${subscriptions.monthlyValue})`
  }).from(subscriptions).where(eq(subscriptions.status, 'active'));
  
  return parseFloat(result[0]?.total ?? '0');
}

export async function getChurnRate(months = 1) {
  const db = await getDb();
  if (!db) return 0;
  
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  
  const canceled = await db.select({ count: count() })
    .from(subscriptions)
    .where(and(
      eq(subscriptions.status, 'canceled'),
      gte(subscriptions.canceledAt, startDate)
    ));
  
  const total = await db.select({ count: count() }).from(subscriptions);
  
  const canceledCount = canceled[0]?.count ?? 0;
  const totalCount = total[0]?.count ?? 1;
  
  return (canceledCount / totalCount) * 100;
}

// Payments
export async function getPayments(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(payments).limit(limit).orderBy(desc(payments.createdAt));
}

export async function getPendingPayments() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(payments).where(eq(payments.status, 'pending'));
}

export async function getFailedPayments() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(payments).where(eq(payments.status, 'failed'));
}

// Error Logs
export async function createErrorLog(log: InsertErrorLog) {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(errorLogs).values(log);
}

export async function getErrorLogs(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(errorLogs).limit(limit).orderBy(desc(errorLogs.createdAt));
}

export async function getErrorStats(hours = 24) {
  const db = await getDb();
  if (!db) return { total: 0, by4xx: 0, by5xx: 0 };
  
  const startDate = new Date();
  startDate.setHours(startDate.getHours() - hours);
  
  const total = await db.select({ count: count() })
    .from(errorLogs)
    .where(gte(errorLogs.createdAt, startDate));
  
  const by4xx = await db.select({ count: count() })
    .from(errorLogs)
    .where(and(
      gte(errorLogs.createdAt, startDate),
      eq(errorLogs.errorType, '4xx')
    ));
  
  const by5xx = await db.select({ count: count() })
    .from(errorLogs)
    .where(and(
      gte(errorLogs.createdAt, startDate),
      eq(errorLogs.errorType, '5xx')
    ));
  
  return {
    total: total[0]?.count ?? 0,
    by4xx: by4xx[0]?.count ?? 0,
    by5xx: by5xx[0]?.count ?? 0
  };
}

// Service Status
export async function getAllServiceStatus() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(serviceStatus).orderBy(serviceStatus.serviceName);
}

export async function upsertServiceStatus(status: InsertServiceStatus) {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(serviceStatus).values(status).onDuplicateKeyUpdate({
    set: {
      status: status.status,
      lastCheckedAt: new Date(),
      responseTime: status.responseTime,
      metadata: status.metadata
    }
  });
}



// ==================== EMAIL/PASSWORD AUTHENTICATION ====================

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (db) {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  }
  
  // In-memory fallback
  const user = inMemoryUsers.find(u => u.email === email);
  return user || undefined;
}

export async function createUserWithPassword(userData: {
  email: string;
  passwordHash: string;
  name?: string;
  role?: 'user' | 'admin';
}) {
  const db = await getDb();
  if (db) {
    // Generate a unique openId for email/password users
    const openId = `email_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    await db.insert(users).values({
      openId,
      email: userData.email,
      passwordHash: userData.passwordHash,
      name: userData.name || userData.email.split('@')[0],
      loginMethod: 'email',
      role: userData.role || 'user',
      preferredCurrency: "BRL",
      isActive: true,
      lastSignedIn: new Date(),
    });
    
    return await getUserByEmail(userData.email);
  }
  
  // In-memory fallback
  const openId = `email_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const now = new Date();
  const newUser: InMemoryUser = {
    id: inMemoryIdCounter++,
    openId,
    email: userData.email,
    passwordHash: userData.passwordHash,
    name: userData.name || userData.email.split('@')[0],
    loginMethod: 'email',
    role: userData.role || 'user',
    plan: 'essencial',
    preferredCurrency: "BRL",
    mfaEnabled: false,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
  inMemoryUsers.push(newUser);
  console.log(`[InMemory] User created: ${userData.email} (role: ${userData.role || 'user'})`);
  return newUser;
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (db) {
    await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
    return;
  }
  
  // In-memory fallback
  const user = inMemoryUsers.find(u => u.id === userId);
  if (user) user.passwordHash = passwordHash;
}

export async function updateUserStatus(userId: number, isActive: boolean) {
  const db = await getDb();
  if (db) {
    await db.update(users).set({ isActive }).where(eq(users.id, userId));
    return;
  }
  
  // In-memory fallback
  const user = inMemoryUsers.find(u => u.id === userId);
  if (user) user.isActive = isActive;
}

export async function updateUserLastSignIn(userId: number) {
  const db = await getDb();
  if (db) {
    await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
    return;
  }
  
  // In-memory fallback
  const user = inMemoryUsers.find(u => u.id === userId);
  if (user) user.lastSignedIn = new Date();
}

export async function deleteUser(userId: number) {
  const db = await getDb();
  if (db) {
    await db.delete(users).where(eq(users.id, userId));
    return;
  }
  
  // In-memory fallback
  const idx = inMemoryUsers.findIndex(u => u.id === userId);
  if (idx !== -1) inMemoryUsers.splice(idx, 1);
}

export async function updateUser(userId: number, updates: { name?: string; email?: string; role?: 'user' | 'admin'; isActive?: boolean; preferredCurrency?: SupportedCurrency }) {
  const db = await getDb();
  if (db) {
    await db.update(users).set(updates).where(eq(users.id, userId));
    return;
  }
  
  // In-memory fallback
  const user = inMemoryUsers.find(u => u.id === userId);
  if (user) {
    if (updates.name !== undefined) user.name = updates.name;
    if (updates.email !== undefined) user.email = updates.email;
    if (updates.role !== undefined) user.role = updates.role;
    if (updates.isActive !== undefined) user.isActive = updates.isActive;
    if (updates.preferredCurrency !== undefined) user.preferredCurrency = updates.preferredCurrency;
  }
}

export async function updateUserPreferredCurrency(userId: number, preferredCurrency: SupportedCurrency) {
  return updateUser(userId, { preferredCurrency });
}


// ==================== DASHBOARD CLIENTE - DATA ACCESS ====================


import {
  clients,
  InsertClient,
  ceoMetrics,
  InsertCeoMetric,
  andonAlerts,
  InsertAndonAlert,
  financialData,
  InsertFinancialData,
  operationsData,
  InsertOperationsData,
  wasteData,
  InsertWasteData,
  marketingData,
  InsertMarketingData,
  qualityData,
  InsertQualityData,
  peopleData,
  InsertPeopleData,
  dataGovernanceData,
  InsertDataGovernanceData,
  dataImports,
  InsertDataImport,
} from "../drizzle/schema";

type InMemoryClientRecord = InsertClient & {
  id: number;
  createdAt: Date;
  updatedAt: Date;
};

type InMemoryMetricRecord<T extends { clientId: number; period: string }> = T & {
  id: number;
  createdAt: Date;
  updatedAt: Date;
};

type InMemoryAndonAlertRecord = InsertAndonAlert & {
  id: number;
  isResolved: boolean;
  resolvedAt: Date | null;
  createdAt: Date;
};

type InMemoryDataImportRecord = InsertDataImport & {
  id: number;
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: Date;
  completedAt: Date | null;
};

const inMemoryClients: InMemoryClientRecord[] = [];
const inMemoryCeoMetrics: InMemoryMetricRecord<InsertCeoMetric>[] = [];
const inMemoryFinancialData: InMemoryMetricRecord<InsertFinancialData>[] = [];
const inMemoryOperationsData: InMemoryMetricRecord<InsertOperationsData>[] = [];
const inMemoryWasteData: InMemoryMetricRecord<InsertWasteData>[] = [];
const inMemoryMarketingData: InMemoryMetricRecord<InsertMarketingData>[] = [];
const inMemoryQualityData: InMemoryMetricRecord<InsertQualityData>[] = [];
const inMemoryPeopleData: InMemoryMetricRecord<InsertPeopleData>[] = [];
const inMemoryGovernanceData: InMemoryMetricRecord<InsertDataGovernanceData>[] = [];
const inMemoryAndonAlerts: InMemoryAndonAlertRecord[] = [];
const inMemoryDataImports: InMemoryDataImportRecord[] = [];
let inMemoryClientRecordIdCounter = 1;
let inMemoryDashboardRecordIdCounter = 1;
let inMemoryAndonAlertIdCounter = 1;
let inMemoryDataImportIdCounter = 1;

export function __resetDashboardDataMemory() {
  inMemoryUserClientIds.clear();
  inMemoryIntegrations.length = 0;
  inMemoryClients.length = 0;
  inMemoryCeoMetrics.length = 0;
  inMemoryFinancialData.length = 0;
  inMemoryOperationsData.length = 0;
  inMemoryWasteData.length = 0;
  inMemoryMarketingData.length = 0;
  inMemoryQualityData.length = 0;
  inMemoryPeopleData.length = 0;
  inMemoryGovernanceData.length = 0;
  inMemoryAndonAlerts.length = 0;
  inMemoryDataImports.length = 0;
  inMemoryClientRecordIdCounter = 1;
  inMemoryDashboardRecordIdCounter = 1;
  inMemoryAndonAlertIdCounter = 1;
  inMemoryDataImportIdCounter = 1;
  inMemoryIntegrationIdCounter = 1;
  inMemorySyntheticClientIdCounter = 1;
}

function getLatestByCreatedAt<T extends { createdAt: Date }>(rows: T[]) {
  return [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

function findLatestMetric<T extends { clientId: number; createdAt: Date }>(rows: T[], clientId: number) {
  return getLatestByCreatedAt(rows.filter((row) => row.clientId === clientId))[0];
}

function filterMetrics<T extends { clientId: number; period: string; createdAt: Date }>(rows: T[], clientId: number, period?: string) {
  return getLatestByCreatedAt(rows.filter((row) => row.clientId === clientId && (!period || row.period === period)));
}

function upsertMetricRecord<T extends { clientId: number; period: string }>(rows: InMemoryMetricRecord<T>[], data: T) {
  const now = new Date();
  const existing = rows.find((row) => row.clientId === data.clientId && row.period === data.period);
  if (existing) {
    Object.assign(existing, data, { updatedAt: now });
    return existing.id;
  }

  const created: InMemoryMetricRecord<T> = {
    ...data,
    id: inMemoryDashboardRecordIdCounter++,
    createdAt: now,
    updatedAt: now,
  };
  rows.push(created);
  return created.id;
}

// ==================== CLIENTS ====================

export async function getAllClients() {
  const db = await getDb();
  if (!db) {
    return [...inMemoryClients].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  }
  
  return await db.select().from(clients).orderBy(clients.name);
}

export async function getClientById(id: number) {
  const db = await getDb();
  if (!db) return inMemoryClients.find((client) => client.id === id);
  
  const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getClientBySlug(slug: string) {
  const db = await getDb();
  if (!db) return inMemoryClients.find((client) => client.slug === slug);
  
  const result = await db.select().from(clients).where(eq(clients.slug, slug)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createClient(client: InsertClient) {
  const db = await getDb();
  if (!db) {
    const now = new Date();
    const id = Math.max(inMemoryClientRecordIdCounter, inMemorySyntheticClientIdCounter);
    inMemoryClientRecordIdCounter = id + 1;
    inMemorySyntheticClientIdCounter = Math.max(inMemorySyntheticClientIdCounter, id + 1);
    const created: InMemoryClientRecord = {
      ...client,
      id,
      isActive: client.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    inMemoryClients.push(created);
    return [{ insertId: created.id }];
  }
  
  const result = await db.insert(clients).values(client);
  return result;
}

function integrationKey(userId: number, provider: IntegrationProvider) {
  return `${userId}:${provider}`;
}

function normalizeIntegrationConfigRecord(row: InMemoryIntegrationRecord): IntegrationConfigRecord {
  const config = (row.config ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    userId: row.userId,
    clientId: row.clientId,
    provider: row.type as IntegrationProvider,
    enabled: row.status === "active",
    accountDomain: typeof config.accountDomain === "string" ? config.accountDomain : undefined,
    apiBaseUrl: typeof config.apiBaseUrl === "string" ? config.apiBaseUrl : row.apiUrl ?? undefined,
    accessToken: row.token ?? undefined,
    refreshToken: typeof config.refreshToken === "string" ? config.refreshToken : undefined,
    webhookSecret: typeof config.webhookSecret === "string" ? config.webhookSecret : undefined,
    webhookToken: typeof config.webhookToken === "string" ? config.webhookToken : undefined,
    userAgent: typeof config.userAgent === "string" ? config.userAgent : undefined,
    environment:
      config.environment === "sandbox" || config.environment === "production"
        ? config.environment
        : undefined,
    metadata: config,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function upsertProviderIntegrationConfig(input: IntegrationConfigRecord) {
  const clientId =
    input.clientId ??
    (await ensureClientIdForUserIntegrations(input.userId, `Cliente ${input.userId}`));
  const db = await getDb();
  const now = new Date();
  const existingConfig =
    !db
      ? inMemoryIntegrations.find((row) => row.userId === input.userId && row.type === input.provider)
      : (
          await db
            .select()
            .from(integrations)
            .where(and(eq(integrations.userId, input.userId), eq(integrations.type, input.provider as any)))
            .limit(1)
        )[0];
  const existingConfigJson =
    ((existingConfig as { config?: Record<string, unknown> | null } | undefined)?.config ?? {}) as Record<string, unknown>;
  const config = {
    ...(input.metadata ?? {}),
    ...existingConfigJson,
    accountDomain: input.accountDomain ?? (typeof existingConfigJson.accountDomain === "string" ? existingConfigJson.accountDomain : ""),
    apiBaseUrl: input.apiBaseUrl ?? (typeof existingConfigJson.apiBaseUrl === "string" ? existingConfigJson.apiBaseUrl : ""),
    refreshToken: input.refreshToken ?? (typeof existingConfigJson.refreshToken === "string" ? existingConfigJson.refreshToken : ""),
    webhookSecret: input.webhookSecret ?? (typeof existingConfigJson.webhookSecret === "string" ? existingConfigJson.webhookSecret : ""),
    webhookToken: input.webhookToken ?? (typeof existingConfigJson.webhookToken === "string" ? existingConfigJson.webhookToken : ""),
    userAgent: input.userAgent ?? (typeof existingConfigJson.userAgent === "string" ? existingConfigJson.userAgent : ""),
    environment:
      input.environment ??
      (existingConfigJson.environment === "sandbox" || existingConfigJson.environment === "production"
        ? existingConfigJson.environment
        : "production"),
  };
  const resolvedAccessToken =
    input.accessToken ??
    ((existingConfig as { token?: string | null } | undefined)?.token ?? null);

  if (!db) {
    const existing = existingConfig as InMemoryIntegrationRecord | undefined;
    if (existing) {
      existing.clientId = clientId;
      existing.token = resolvedAccessToken;
      existing.apiUrl = input.apiBaseUrl ?? null;
      existing.config = config;
      existing.status = input.enabled ? "active" : "inactive";
      existing.updatedAt = now;
      return normalizeIntegrationConfigRecord(existing);
    }

    const created: InMemoryIntegrationRecord = {
      id: inMemoryIntegrationIdCounter++,
      clientId,
      userId: input.userId,
      type: input.provider,
      name: input.provider.toUpperCase(),
      token: resolvedAccessToken,
      apiUrl: input.apiBaseUrl ?? null,
      config,
      status: input.enabled ? "active" : "inactive",
      lastSyncAt: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    };
    inMemoryIntegrations.push(created);
    return normalizeIntegrationConfigRecord(created);
  }

  const existing = existingConfig ? [existingConfig] : [];

  const payload: InsertIntegration = {
    clientId,
    userId: input.userId,
    type: input.provider as any,
    name: input.provider.toUpperCase(),
    token: resolvedAccessToken,
    apiUrl: input.apiBaseUrl ?? null,
    config,
    status: input.enabled ? "active" : "inactive",
  };

  if (existing.length > 0) {
    await db.update(integrations).set(payload as any).where(eq(integrations.id, existing[0]!.id));
    return {
      ...input,
      id: existing[0]!.id,
      clientId,
      metadata: config,
      updatedAt: now.toISOString(),
    };
  }

  const result = await db.insert(integrations).values(payload as any);
  return {
    ...input,
    id: result[0]?.insertId as number,
    clientId,
    metadata: config,
    updatedAt: now.toISOString(),
  };
}

export async function getProviderIntegrationConfig(userId: number, provider: IntegrationProvider) {
  const db = await getDb();
  if (!db) {
    const row = inMemoryIntegrations.find((item) => item.userId === userId && item.type === provider);
    return row ? normalizeIntegrationConfigRecord(row) : null;
  }

  const rows = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.userId, userId), eq(integrations.type, provider as any)))
    .limit(1);

  if (rows.length === 0) return null;
  const row = rows[0]!;
  const config = (row.config ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    userId: row.userId,
    clientId: row.clientId,
    provider,
    enabled: row.status === "active",
    accountDomain: typeof config.accountDomain === "string" ? config.accountDomain : undefined,
    apiBaseUrl: typeof config.apiBaseUrl === "string" ? config.apiBaseUrl : row.apiUrl ?? undefined,
    accessToken: row.token ?? undefined,
    refreshToken: typeof config.refreshToken === "string" ? config.refreshToken : undefined,
    webhookSecret: typeof config.webhookSecret === "string" ? config.webhookSecret : undefined,
    webhookToken: typeof config.webhookToken === "string" ? config.webhookToken : undefined,
    userAgent: typeof config.userAgent === "string" ? config.userAgent : undefined,
    environment:
      config.environment === "sandbox" || config.environment === "production"
        ? config.environment
        : undefined,
    metadata: config,
    updatedAt: row.updatedAt?.toISOString?.() ?? undefined,
  };
}

export async function listProviderIntegrationConfigs() {
  const providers: IntegrationProvider[] = ["kommo", "asaas"];
  const db = await getDb();
  if (!db) {
    return inMemoryIntegrations
      .filter((item) => providers.includes(item.type as IntegrationProvider))
      .map((item) => normalizeIntegrationConfigRecord(item));
  }

  const rows = await db.select().from(integrations).where(inArray(integrations.type, providers as any));
  return rows.map((row) => {
    const config = (row.config ?? {}) as Record<string, unknown>;
    return {
      id: row.id,
      userId: row.userId,
      clientId: row.clientId,
      provider: row.type as IntegrationProvider,
      enabled: row.status === "active",
      accountDomain: typeof config.accountDomain === "string" ? config.accountDomain : undefined,
      apiBaseUrl: typeof config.apiBaseUrl === "string" ? config.apiBaseUrl : row.apiUrl ?? undefined,
      accessToken: row.token ?? undefined,
      refreshToken: typeof config.refreshToken === "string" ? config.refreshToken : undefined,
      webhookSecret: typeof config.webhookSecret === "string" ? config.webhookSecret : undefined,
      webhookToken: typeof config.webhookToken === "string" ? config.webhookToken : undefined,
      userAgent: typeof config.userAgent === "string" ? config.userAgent : undefined,
      environment:
        config.environment === "sandbox" || config.environment === "production"
          ? config.environment
          : undefined,
      metadata: config,
      updatedAt: row.updatedAt?.toISOString?.() ?? undefined,
    };
  });
}

export async function findProviderConfigByWebhookToken(provider: IntegrationProvider, token: string) {
  const all = await listProviderIntegrationConfigs();
  const normalizedToken = token.trim();
  return all.find((row) => row.provider === provider && (row.webhookSecret === normalizedToken || row.webhookToken === normalizedToken)) ?? null;
}

export async function updateIntegrationLastSync(userId: number, provider: IntegrationProvider, succeeded: boolean, message?: string) {
  const db = await getDb();
  if (!db) {
    const row = inMemoryIntegrations.find((item) => item.userId === userId && item.type === provider);
    if (row) {
      row.lastSyncAt = new Date();
      row.status = succeeded ? "active" : "error";
      row.errorMessage = message ?? null;
      row.updatedAt = new Date();
    }
    return;
  }

  await db
    .update(integrations)
    .set({
      lastSyncAt: new Date(),
      status: succeeded ? "active" : "error",
      errorMessage: message ?? null,
    } as any)
    .where(and(eq(integrations.userId, userId), eq(integrations.type, provider as any)));
}

export function getIntegrationPipelineSnapshot(userId: number, provider: IntegrationProvider): IntegrationPipelineSnapshot {
  return inMemoryPipelineStats.get(integrationKey(userId, provider)) ?? {
    queued: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    dlq: 0,
  };
}

export function recordIntegrationPipelineSnapshot(userId: number, provider: IntegrationProvider, snapshot: IntegrationPipelineSnapshot) {
  inMemoryPipelineStats.set(integrationKey(userId, provider), { ...snapshot, userId, provider });
}

export async function updateClient(id: number, updates: Partial<InsertClient>) {
  const db = await getDb();
  if (!db) {
    const client = inMemoryClients.find((item) => item.id === id);
    if (client) {
      Object.assign(client, updates, { updatedAt: new Date() });
    }
    return;
  }
  
  await db.update(clients).set(updates).where(eq(clients.id, id));
}

export async function deleteClient(id: number) {
  const db = await getDb();
  if (!db) {
    const idx = inMemoryClients.findIndex((item) => item.id === id);
    if (idx !== -1) inMemoryClients.splice(idx, 1);
    return;
  }
  
  await db.delete(clients).where(eq(clients.id, id));
}

function sanitizeSlugSegment(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

async function ensureClientIdForUserIntegrations(userId: number, clientName: string) {
  const db = await getDb();
  if (!db) {
    const existing = inMemoryUserClientIds.get(userId);
    if (existing) return existing;
    const clientId = Math.max(inMemorySyntheticClientIdCounter, inMemoryClientRecordIdCounter);
    inMemorySyntheticClientIdCounter = clientId + 1;
    inMemoryClientRecordIdCounter = Math.max(inMemoryClientRecordIdCounter, clientId + 1);
    inMemoryUserClientIds.set(userId, clientId);
    inMemoryClients.push({
      id: clientId,
      name: clientName,
      slug: `${sanitizeSlugSegment(clientName) || "cliente"}-${userId}`,
      logo: null,
      industry: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return clientId;
  }

  const existingIntegration = await db
    .select({ clientId: integrations.clientId })
    .from(integrations)
    .where(eq(integrations.userId, userId))
    .limit(1);

  if (existingIntegration.length > 0) {
    return existingIntegration[0]!.clientId;
  }

  const preferredSlug = `${sanitizeSlugSegment(clientName) || "cliente"}-${userId}`;
  const existingClient = await db.select().from(clients).where(eq(clients.slug, preferredSlug)).limit(1);
  if (existingClient.length > 0) {
    return existingClient[0]!.id;
  }

  const insertResult = await db.insert(clients).values({
    name: clientName,
    slug: preferredSlug,
    isActive: true,
  });

  return insertResult[0]?.insertId as number;
}

export async function ensureClientIdForUser(userId: number, clientName: string) {
  return ensureClientIdForUserIntegrations(userId, clientName);
}

export async function getUserIdsByClientId(clientId: number) {
  const db = await getDb();
  if (!db) {
    const ids = new Set<number>();
    for (const [userId, linkedClientId] of Array.from(inMemoryUserClientIds.entries())) {
      if (linkedClientId === clientId) ids.add(userId);
    }
    for (const integration of inMemoryIntegrations) {
      if (integration.clientId === clientId) ids.add(integration.userId);
    }
    return Array.from(ids);
  }

  const rows = await db
    .select({ userId: integrations.userId })
    .from(integrations)
    .where(eq(integrations.clientId, clientId));

  return Array.from(new Set(rows.map((row) => row.userId)));
}

export async function linkUserToClient(userId: number, clientId: number) {
  const db = await getDb();
  if (!db) {
    inMemoryUserClientIds.set(userId, clientId);
    return { success: true };
  }

  return { success: true };
}

export async function provisionUserIntegrations(input: {
  userId: number;
  clientName: string;
  items: AdminProvisionedIntegrationInput[];
}) {
  const items = input.items
    .map((item) => ({
      ...item,
      name: item.name?.trim(),
      token: item.token?.trim(),
      apiUrl: item.apiUrl?.trim(),
      identifier: item.identifier?.trim(),
    }))
    .filter((item) => item.type && (item.token || item.apiUrl || item.identifier));

  if (items.length === 0) {
    return { createdCount: 0, clientId: null as number | null };
  }

  const clientId = await ensureClientIdForUserIntegrations(input.userId, input.clientName);
  const db = await getDb();

  if (!db) {
    const now = new Date();
    for (const item of items) {
      inMemoryIntegrations.push({
        id: inMemoryIntegrationIdCounter++,
        clientId,
        userId: input.userId,
        type: item.type,
        name: item.name || item.type,
        token: item.token ?? null,
        apiUrl: item.apiUrl ?? null,
        config: {
          ...(item.identifier ? { identifier: item.identifier } : {}),
          ...(item.metadata ?? {}),
          source: "admin_user_create",
        },
        status: item.status ?? "pending",
        lastSyncAt: null,
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
      });
    }
    return { createdCount: items.length, clientId };
  }

  const payload: InsertIntegration[] = items.map((item) => ({
    clientId,
    userId: input.userId,
    type: item.type,
    name: item.name || item.type,
    token: item.token || null,
    apiUrl: item.apiUrl || null,
    config: {
      ...(item.identifier ? { identifier: item.identifier } : {}),
      ...(item.metadata ?? {}),
      source: "admin_user_create",
    },
    status: item.status ?? "pending",
  }));

  if (payload.length > 0) {
    await db.insert(integrations).values(payload as any);
  }

  return { createdCount: payload.length, clientId };
}

// ==================== CEO METRICS ====================

export async function getCeoMetrics(clientId: number, period?: string) {
  const db = await getDb();
  if (!db) return filterMetrics(inMemoryCeoMetrics, clientId, period);
  
  if (period) {
    return await db.select().from(ceoMetrics)
      .where(and(eq(ceoMetrics.clientId, clientId), eq(ceoMetrics.period, period)))
      .orderBy(desc(ceoMetrics.createdAt));
  }
  
  return await db.select().from(ceoMetrics)
    .where(eq(ceoMetrics.clientId, clientId))
    .orderBy(desc(ceoMetrics.createdAt));
}

export async function getLatestCeoMetrics(clientId: number) {
  const db = await getDb();
  if (!db) return findLatestMetric(inMemoryCeoMetrics, clientId);
  
  const result = await db.select().from(ceoMetrics)
    .where(eq(ceoMetrics.clientId, clientId))
    .orderBy(desc(ceoMetrics.createdAt))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertCeoMetrics(data: InsertCeoMetric) {
  const db = await getDb();
  if (!db) return upsertMetricRecord(inMemoryCeoMetrics, data);
  
  // Check if exists for this client and period
  const existing = await db.select().from(ceoMetrics)
    .where(and(eq(ceoMetrics.clientId, data.clientId), eq(ceoMetrics.period, data.period)))
    .limit(1);
  
  if (existing.length > 0) {
    await db.update(ceoMetrics).set(data).where(eq(ceoMetrics.id, existing[0].id));
    return existing[0].id;
  } else {
    const result = await db.insert(ceoMetrics).values(data);
    return result[0].insertId;
  }
}

// ==================== ANDON ALERTS ====================

export async function getAndonAlerts(clientId: number, includeResolved = false) {
  const db = await getDb();
  if (!db) {
    return getLatestByCreatedAt(
      inMemoryAndonAlerts.filter((alert) => alert.clientId === clientId && (includeResolved || !alert.isResolved)),
    );
  }
  
  if (includeResolved) {
    return await db.select().from(andonAlerts)
      .where(eq(andonAlerts.clientId, clientId))
      .orderBy(desc(andonAlerts.createdAt));
  }
  
  return await db.select().from(andonAlerts)
    .where(and(eq(andonAlerts.clientId, clientId), eq(andonAlerts.isResolved, false)))
    .orderBy(desc(andonAlerts.createdAt));
}

export async function createAndonAlert(alert: InsertAndonAlert) {
  const db = await getDb();
  if (!db) {
    inMemoryAndonAlerts.push({
      ...alert,
      id: inMemoryAndonAlertIdCounter++,
      isResolved: false,
      resolvedAt: null,
      createdAt: new Date(),
    });
    return;
  }
  
  await db.insert(andonAlerts).values(alert);
}

export async function resolveAndonAlert(id: number) {
  const db = await getDb();
  if (!db) {
    const alert = inMemoryAndonAlerts.find((item) => item.id === id);
    if (alert) {
      alert.isResolved = true;
      alert.resolvedAt = new Date();
    }
    return;
  }
  
  await db.update(andonAlerts).set({ isResolved: true, resolvedAt: new Date() }).where(eq(andonAlerts.id, id));
}

export async function deleteAndonAlert(id: number) {
  const db = await getDb();
  if (!db) {
    const idx = inMemoryAndonAlerts.findIndex((item) => item.id === id);
    if (idx !== -1) inMemoryAndonAlerts.splice(idx, 1);
    return;
  }
  
  await db.delete(andonAlerts).where(eq(andonAlerts.id, id));
}

// ==================== FINANCIAL DATA ====================

export async function getFinancialData(clientId: number, period?: string) {
  const db = await getDb();
  if (!db) return filterMetrics(inMemoryFinancialData, clientId, period);
  
  if (period) {
    return await db.select().from(financialData)
      .where(and(eq(financialData.clientId, clientId), eq(financialData.period, period)))
      .orderBy(desc(financialData.createdAt));
  }
  
  return await db.select().from(financialData)
    .where(eq(financialData.clientId, clientId))
    .orderBy(desc(financialData.createdAt));
}

export async function getLatestFinancialData(clientId: number) {
  const db = await getDb();
  if (!db) return findLatestMetric(inMemoryFinancialData, clientId);
  
  const result = await db.select().from(financialData)
    .where(eq(financialData.clientId, clientId))
    .orderBy(desc(financialData.createdAt))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertFinancialData(data: InsertFinancialData) {
  const db = await getDb();
  if (!db) return upsertMetricRecord(inMemoryFinancialData, data);
  
  const existing = await db.select().from(financialData)
    .where(and(eq(financialData.clientId, data.clientId), eq(financialData.period, data.period)))
    .limit(1);
  
  if (existing.length > 0) {
    await db.update(financialData).set(data).where(eq(financialData.id, existing[0].id));
    return existing[0].id;
  } else {
    const result = await db.insert(financialData).values(data);
    return result[0].insertId;
  }
}

// ==================== OPERATIONS DATA ====================

export async function getOperationsData(clientId: number, period?: string) {
  const db = await getDb();
  if (!db) return filterMetrics(inMemoryOperationsData, clientId, period);
  
  if (period) {
    return await db.select().from(operationsData)
      .where(and(eq(operationsData.clientId, clientId), eq(operationsData.period, period)))
      .orderBy(desc(operationsData.createdAt));
  }
  
  return await db.select().from(operationsData)
    .where(eq(operationsData.clientId, clientId))
    .orderBy(desc(operationsData.createdAt));
}

export async function getLatestOperationsData(clientId: number) {
  const db = await getDb();
  if (!db) return findLatestMetric(inMemoryOperationsData, clientId);
  
  const result = await db.select().from(operationsData)
    .where(eq(operationsData.clientId, clientId))
    .orderBy(desc(operationsData.createdAt))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertOperationsData(data: InsertOperationsData) {
  const db = await getDb();
  if (!db) return upsertMetricRecord(inMemoryOperationsData, data);
  
  const existing = await db.select().from(operationsData)
    .where(and(eq(operationsData.clientId, data.clientId), eq(operationsData.period, data.period)))
    .limit(1);
  
  if (existing.length > 0) {
    await db.update(operationsData).set(data).where(eq(operationsData.id, existing[0].id));
    return existing[0].id;
  } else {
    const result = await db.insert(operationsData).values(data);
    return result[0].insertId;
  }
}

// ==================== WASTE DATA ====================

export async function getWasteData(clientId: number, period?: string) {
  const db = await getDb();
  if (!db) return filterMetrics(inMemoryWasteData, clientId, period);
  
  if (period) {
    return await db.select().from(wasteData)
      .where(and(eq(wasteData.clientId, clientId), eq(wasteData.period, period)))
      .orderBy(desc(wasteData.createdAt));
  }
  
  return await db.select().from(wasteData)
    .where(eq(wasteData.clientId, clientId))
    .orderBy(desc(wasteData.createdAt));
}

export async function getLatestWasteData(clientId: number) {
  const db = await getDb();
  if (!db) return findLatestMetric(inMemoryWasteData, clientId);
  
  const result = await db.select().from(wasteData)
    .where(eq(wasteData.clientId, clientId))
    .orderBy(desc(wasteData.createdAt))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertWasteData(data: InsertWasteData) {
  const db = await getDb();
  if (!db) return upsertMetricRecord(inMemoryWasteData, data);
  
  const existing = await db.select().from(wasteData)
    .where(and(eq(wasteData.clientId, data.clientId), eq(wasteData.period, data.period)))
    .limit(1);
  
  if (existing.length > 0) {
    await db.update(wasteData).set(data).where(eq(wasteData.id, existing[0].id));
    return existing[0].id;
  } else {
    const result = await db.insert(wasteData).values(data);
    return result[0].insertId;
  }
}

// ==================== MARKETING DATA ====================

export async function getMarketingData(clientId: number, period?: string) {
  const db = await getDb();
  if (!db) return filterMetrics(inMemoryMarketingData, clientId, period);
  
  if (period) {
    return await db.select().from(marketingData)
      .where(and(eq(marketingData.clientId, clientId), eq(marketingData.period, period)))
      .orderBy(desc(marketingData.createdAt));
  }
  
  return await db.select().from(marketingData)
    .where(eq(marketingData.clientId, clientId))
    .orderBy(desc(marketingData.createdAt));
}

export async function getLatestMarketingData(clientId: number) {
  const db = await getDb();
  if (!db) return findLatestMetric(inMemoryMarketingData, clientId);
  
  const result = await db.select().from(marketingData)
    .where(eq(marketingData.clientId, clientId))
    .orderBy(desc(marketingData.createdAt))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertMarketingData(data: InsertMarketingData) {
  const db = await getDb();
  if (!db) return upsertMetricRecord(inMemoryMarketingData, data);
  
  const existing = await db.select().from(marketingData)
    .where(and(eq(marketingData.clientId, data.clientId), eq(marketingData.period, data.period)))
    .limit(1);
  
  if (existing.length > 0) {
    await db.update(marketingData).set(data).where(eq(marketingData.id, existing[0].id));
    return existing[0].id;
  } else {
    const result = await db.insert(marketingData).values(data);
    return result[0].insertId;
  }
}

// ==================== QUALITY DATA ====================

export async function getQualityData(clientId: number, period?: string) {
  const db = await getDb();
  if (!db) return filterMetrics(inMemoryQualityData, clientId, period);
  
  if (period) {
    return await db.select().from(qualityData)
      .where(and(eq(qualityData.clientId, clientId), eq(qualityData.period, period)))
      .orderBy(desc(qualityData.createdAt));
  }
  
  return await db.select().from(qualityData)
    .where(eq(qualityData.clientId, clientId))
    .orderBy(desc(qualityData.createdAt));
}

export async function getLatestQualityData(clientId: number) {
  const db = await getDb();
  if (!db) return findLatestMetric(inMemoryQualityData, clientId);
  
  const result = await db.select().from(qualityData)
    .where(eq(qualityData.clientId, clientId))
    .orderBy(desc(qualityData.createdAt))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertQualityData(data: InsertQualityData) {
  const db = await getDb();
  if (!db) return upsertMetricRecord(inMemoryQualityData, data);
  
  const existing = await db.select().from(qualityData)
    .where(and(eq(qualityData.clientId, data.clientId), eq(qualityData.period, data.period)))
    .limit(1);
  
  if (existing.length > 0) {
    await db.update(qualityData).set(data).where(eq(qualityData.id, existing[0].id));
    return existing[0].id;
  } else {
    const result = await db.insert(qualityData).values(data);
    return result[0].insertId;
  }
}

// ==================== PEOPLE DATA ====================

export async function getPeopleData(clientId: number, period?: string) {
  const db = await getDb();
  if (!db) return filterMetrics(inMemoryPeopleData, clientId, period);
  
  if (period) {
    return await db.select().from(peopleData)
      .where(and(eq(peopleData.clientId, clientId), eq(peopleData.period, period)))
      .orderBy(desc(peopleData.createdAt));
  }
  
  return await db.select().from(peopleData)
    .where(eq(peopleData.clientId, clientId))
    .orderBy(desc(peopleData.createdAt));
}

export async function getLatestPeopleData(clientId: number) {
  const db = await getDb();
  if (!db) return findLatestMetric(inMemoryPeopleData, clientId);
  
  const result = await db.select().from(peopleData)
    .where(eq(peopleData.clientId, clientId))
    .orderBy(desc(peopleData.createdAt))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertPeopleData(data: InsertPeopleData) {
  const db = await getDb();
  if (!db) return upsertMetricRecord(inMemoryPeopleData, data);
  
  const existing = await db.select().from(peopleData)
    .where(and(eq(peopleData.clientId, data.clientId), eq(peopleData.period, data.period)))
    .limit(1);
  
  if (existing.length > 0) {
    await db.update(peopleData).set(data).where(eq(peopleData.id, existing[0].id));
    return existing[0].id;
  } else {
    const result = await db.insert(peopleData).values(data);
    return result[0].insertId;
  }
}

// ==================== DATA GOVERNANCE ====================

export async function getDataGovernanceData(clientId: number, period?: string) {
  const db = await getDb();
  if (!db) return filterMetrics(inMemoryGovernanceData, clientId, period);
  
  if (period) {
    return await db.select().from(dataGovernanceData)
      .where(and(eq(dataGovernanceData.clientId, clientId), eq(dataGovernanceData.period, period)))
      .orderBy(desc(dataGovernanceData.createdAt));
  }
  
  return await db.select().from(dataGovernanceData)
    .where(eq(dataGovernanceData.clientId, clientId))
    .orderBy(desc(dataGovernanceData.createdAt));
}

export async function getLatestDataGovernanceData(clientId: number) {
  const db = await getDb();
  if (!db) return findLatestMetric(inMemoryGovernanceData, clientId);
  
  const result = await db.select().from(dataGovernanceData)
    .where(eq(dataGovernanceData.clientId, clientId))
    .orderBy(desc(dataGovernanceData.createdAt))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertDataGovernanceData(data: InsertDataGovernanceData) {
  const db = await getDb();
  if (!db) return upsertMetricRecord(inMemoryGovernanceData, data);
  
  const existing = await db.select().from(dataGovernanceData)
    .where(and(eq(dataGovernanceData.clientId, data.clientId), eq(dataGovernanceData.period, data.period)))
    .limit(1);
  
  if (existing.length > 0) {
    await db.update(dataGovernanceData).set(data).where(eq(dataGovernanceData.id, existing[0].id));
    return existing[0].id;
  } else {
    const result = await db.insert(dataGovernanceData).values(data);
    return result[0].insertId;
  }
}

// ==================== DATA IMPORTS ====================

export async function getDataImports(clientId?: number, limit = 50) {
  const db = await getDb();
  if (!db) {
    const rows = clientId
      ? inMemoryDataImports.filter((item) => item.clientId === clientId)
      : inMemoryDataImports;
    return getLatestByCreatedAt(rows).slice(0, limit);
  }
  
  if (clientId) {
    return await db.select().from(dataImports)
      .where(eq(dataImports.clientId, clientId))
      .orderBy(desc(dataImports.createdAt))
      .limit(limit);
  }
  
  return await db.select().from(dataImports)
    .orderBy(desc(dataImports.createdAt))
    .limit(limit);
}

export async function createDataImport(data: InsertDataImport) {
  const db = await getDb();
  if (!db) {
    const created: InMemoryDataImportRecord = {
      ...data,
      id: inMemoryDataImportIdCounter++,
      status: data.status ?? "pending",
      createdAt: new Date(),
      completedAt: data.completedAt ?? null,
    };
    inMemoryDataImports.push(created);
    return created.id;
  }
  
  const result = await db.insert(dataImports).values(data);
  return result[0].insertId;
}

export async function updateDataImportStatus(id: number, status: 'pending' | 'processing' | 'completed' | 'failed', recordsImported?: number, errorMessage?: string) {
  const db = await getDb();
  if (!db) {
    const item = inMemoryDataImports.find((row) => row.id === id);
    if (item) {
      item.status = status;
      if (recordsImported !== undefined) item.recordsImported = recordsImported;
      if (errorMessage) item.errorMessage = errorMessage;
      if (status === "completed" || status === "failed") item.completedAt = new Date();
    }
    return;
  }
  
  const updates: Partial<InsertDataImport> = { status };
  if (recordsImported !== undefined) updates.recordsImported = recordsImported;
  if (errorMessage) updates.errorMessage = errorMessage;
  if (status === 'completed' || status === 'failed') updates.completedAt = new Date();
  
  await db.update(dataImports).set(updates).where(eq(dataImports.id, id));
}

// ==================== BULK DATA OPERATIONS ====================

export async function getAllDashboardData(clientId: number) {
  const db = await getDb();
  if (!db) {
    return {
      ceoMetrics: findLatestMetric(inMemoryCeoMetrics, clientId),
      financialData: findLatestMetric(inMemoryFinancialData, clientId),
      operationsData: findLatestMetric(inMemoryOperationsData, clientId),
      wasteData: findLatestMetric(inMemoryWasteData, clientId),
      marketingData: findLatestMetric(inMemoryMarketingData, clientId),
      qualityData: findLatestMetric(inMemoryQualityData, clientId),
      peopleData: findLatestMetric(inMemoryPeopleData, clientId),
      dataGovernanceData: findLatestMetric(inMemoryGovernanceData, clientId),
      andonAlerts: getLatestByCreatedAt(
        inMemoryAndonAlerts.filter((alert) => alert.clientId === clientId && !alert.isResolved),
      ),
    };
  }
  
  const [ceo, financial, operations, waste, marketing, quality, people, dataGov, alerts] = await Promise.all([
    getLatestCeoMetrics(clientId),
    getLatestFinancialData(clientId),
    getLatestOperationsData(clientId),
    getLatestWasteData(clientId),
    getLatestMarketingData(clientId),
    getLatestQualityData(clientId),
    getLatestPeopleData(clientId),
    getLatestDataGovernanceData(clientId),
    getAndonAlerts(clientId),
  ]);
  
  return {
    ceoMetrics: ceo,
    financialData: financial,
    operationsData: operations,
    wasteData: waste,
    marketingData: marketing,
    qualityData: quality,
    peopleData: people,
    dataGovernanceData: dataGov,
    andonAlerts: alerts,
  };
}


// ==================== MANUAL ENTRIES ====================

const TEST_CLIENT_EMAILS = new Set(ENV.bootstrapTestClientEmails);
const inMemoryManualEntries: any[] = [];
let manualEntryIdCounter = 1;

const createInMemoryManualEntry = (
  userId: number,
  category: "financial" | "attendance",
  label: string,
  value: string,
  detail: string
) => ({
  id: manualEntryIdCounter++,
  userId,
  category,
  entryType: label,
  label,
  value,
  detail,
  createdAt: new Date().toISOString(),
});

const seedManualEntriesForTestUser = (userId: number) => {
  const alreadySeeded = inMemoryManualEntries.some(e => e.userId === userId);
  if (alreadySeeded) return;

  inMemoryManualEntries.push(
    createInMemoryManualEntry(userId, "financial", "Receita (Faturamento)", "2400000", "Receita Recorrente + Projetos"),
    createInMemoryManualEntry(userId, "financial", "CAC", "280", "Custo por lead convertido"),
    createInMemoryManualEntry(userId, "financial", "LTV", "1200", "Projetado")
  );

  for (let i = 0; i < 98; i++) {
    inMemoryManualEntries.push(createInMemoryManualEntry(userId, "attendance", "Paciente", "1", "Atendimento Normal"));
  }
  for (let i = 0; i < 22; i++) {
    const reason = i % 2 === 0 ? "Esqueceu" : (i % 3 === 0 ? "Imprevisto" : "Emergencia de ultima hora");
    inMemoryManualEntries.push(createInMemoryManualEntry(userId, "attendance", "No-Show", "1", reason));
  }
};

export async function getManualEntries(userId: number, category?: "financial" | "attendance") {
  const db = await getDb();
  if (!db) {
    const currentUser = inMemoryUsers.find(u => u.id === userId);
    const normalizedEmail = currentUser?.email?.toLowerCase();
    if (normalizedEmail && TEST_CLIENT_EMAILS.has(normalizedEmail)) {
      seedManualEntriesForTestUser(userId);
    }
    return inMemoryManualEntries
      .filter(e => e.userId === userId && (!category || e.category === category))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  if (category) {
    return db.select().from(manualEntries)
      .where(and(eq(manualEntries.userId, userId), eq(manualEntries.category, category)))
      .orderBy(desc(manualEntries.createdAt));
  }
  return db.select().from(manualEntries)
    .where(eq(manualEntries.userId, userId))
    .orderBy(desc(manualEntries.createdAt));
}

export async function createManualEntry(data: InsertManualEntry) {
  const db = await getDb();
  if (!db) {
    const entry = { id: manualEntryIdCounter++, ...data, createdAt: new Date().toISOString() };
    inMemoryManualEntries.push(entry);
    console.log("[InMemory] Manual entry created:", entry);
    return entry.id;
  }
  const result = await db.insert(manualEntries).values(data);
  return result[0].insertId;
}

export async function deleteManualEntry(id: number, userId: number) {
  const db = await getDb();
  if (!db) {
    const idx = inMemoryManualEntries.findIndex(e => e.id === id && e.userId === userId);
    if (idx !== -1) inMemoryManualEntries.splice(idx, 1);
    return { success: true };
  }
  await db.delete(manualEntries).where(and(eq(manualEntries.id, id), eq(manualEntries.userId, userId)));
  return { success: true };
}
