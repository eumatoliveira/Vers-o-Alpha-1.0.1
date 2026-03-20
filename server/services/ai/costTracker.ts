/**
 * Cost Tracker — GLX Insights Multi-Tenant AI
 *
 * Registra uso por usuário, calcula custo e bloqueia ao atingir orçamento.
 * Toda leitura/escrita é estritamente escopada por userId.
 */

import { eq, and, gte, sql } from 'drizzle-orm';
import { db } from '../../db';
import {
  aiUsageLogs,
  aiConversations,
  aiUserLimits,
  type InsertAiUsageLog,
} from '../../../drizzle/schema';
import type { TaskComplexity } from './modelRouter';

export type UsageEntry = {
  userId: number;
  conversationId?: number;
  projectId?: number;
  tokensIn: number;
  tokensOut: number;
  modelUsed: string;
  requestType: TaskComplexity;
  estimatedCostUsd: number;
};

/**
 * Persiste um registro de uso e atualiza o acumulado da conversa.
 * Fire-and-forget — não bloqueia a resposta ao usuário.
 */
export async function recordUsage(entry: UsageEntry): Promise<void> {
  const totalTokens = entry.tokensIn + entry.tokensOut;
  const costStr = entry.estimatedCostUsd.toFixed(6);

  const log: InsertAiUsageLog = {
    userId: entry.userId,
    conversationId: entry.conversationId ?? null,
    projectId: entry.projectId ?? null,
    tokensIn: entry.tokensIn,
    tokensOut: entry.tokensOut,
    totalTokens,
    estimatedCostUsd: costStr as unknown as string,
    modelUsed: entry.modelUsed,
    requestType: entry.requestType,
  };

  await db.insert(aiUsageLogs).values(log);

  // Atualiza acumulado da conversa
  if (entry.conversationId) {
    await db
      .update(aiConversations)
      .set({
        tokensSent: sql`tokensSent + ${entry.tokensIn}`,
        tokensReceived: sql`tokensReceived + ${entry.tokensOut}`,
        estimatedCostUsd: sql`estimatedCostUsd + ${entry.estimatedCostUsd}`,
      })
      .where(
        and(
          eq(aiConversations.id, entry.conversationId),
          eq(aiConversations.userId, entry.userId), // tenant guard
        ),
      );
  }
}

/**
 * Verifica se o usuário pode fazer uma nova requisição.
 * Retorna { allowed: true } ou { allowed: false, reason }.
 */
export async function checkBudget(
  userId: number,
  estimatedCostUsd: number,
): Promise<{ allowed: boolean; reason?: string }> {
  const limits = await db.query.aiUserLimits.findFirst({
    where: eq(aiUserLimits.userId, userId),
  });

  if (!limits) return { allowed: true }; // sem limites configurados
  if (limits.isBlocked) return { allowed: false, reason: 'Conta bloqueada por uso excessivo de IA.' };

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  if (limits.dailyBudgetUsd) {
    const daily = await db
      .select({ total: sql<number>`COALESCE(SUM(estimatedCostUsd), 0)` })
      .from(aiUsageLogs)
      .where(and(eq(aiUsageLogs.userId, userId), gte(aiUsageLogs.createdAt, startOfDay)));

    const dailyUsed = Number(daily[0]?.total ?? 0);
    const dailyLimit = Number(limits.dailyBudgetUsd);
    if (dailyUsed + estimatedCostUsd > dailyLimit) {
      return {
        allowed: false,
        reason: `Limite diário de US$ ${dailyLimit.toFixed(2)} atingido. Tente novamente amanhã.`,
      };
    }
  }

  if (limits.monthlyBudgetUsd) {
    const monthly = await db
      .select({ total: sql<number>`COALESCE(SUM(estimatedCostUsd), 0)` })
      .from(aiUsageLogs)
      .where(and(eq(aiUsageLogs.userId, userId), gte(aiUsageLogs.createdAt, startOfMonth)));

    const monthlyUsed = Number(monthly[0]?.total ?? 0);
    const monthlyLimit = Number(limits.monthlyBudgetUsd);
    if (monthlyUsed + estimatedCostUsd > monthlyLimit) {
      return {
        allowed: false,
        reason: `Limite mensal de US$ ${monthlyLimit.toFixed(2)} atingido.`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Retorna o resumo de uso do usuário para o período (billing dashboard).
 */
export async function getUserUsageSummary(userId: number) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [daily, monthly, allTime] = await Promise.all([
    db
      .select({
        tokensIn: sql<number>`COALESCE(SUM(tokensIn), 0)`,
        tokensOut: sql<number>`COALESCE(SUM(tokensOut), 0)`,
        totalTokens: sql<number>`COALESCE(SUM(totalTokens), 0)`,
        costUsd: sql<number>`COALESCE(SUM(estimatedCostUsd), 0)`,
        requests: sql<number>`COUNT(*)`,
      })
      .from(aiUsageLogs)
      .where(and(eq(aiUsageLogs.userId, userId), gte(aiUsageLogs.createdAt, startOfDay))),

    db
      .select({
        tokensIn: sql<number>`COALESCE(SUM(tokensIn), 0)`,
        tokensOut: sql<number>`COALESCE(SUM(tokensOut), 0)`,
        totalTokens: sql<number>`COALESCE(SUM(totalTokens), 0)`,
        costUsd: sql<number>`COALESCE(SUM(estimatedCostUsd), 0)`,
        requests: sql<number>`COUNT(*)`,
      })
      .from(aiUsageLogs)
      .where(and(eq(aiUsageLogs.userId, userId), gte(aiUsageLogs.createdAt, startOfMonth))),

    db
      .select({
        totalTokens: sql<number>`COALESCE(SUM(totalTokens), 0)`,
        costUsd: sql<number>`COALESCE(SUM(estimatedCostUsd), 0)`,
        requests: sql<number>`COUNT(*)`,
      })
      .from(aiUsageLogs)
      .where(eq(aiUsageLogs.userId, userId)),
  ]);

  return {
    daily: daily[0],
    monthly: monthly[0],
    allTime: allTime[0],
  };
}
