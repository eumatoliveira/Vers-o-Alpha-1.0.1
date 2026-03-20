/**
 * aiChatRouter — GLX Insights Multi-Tenant AI Chat
 *
 * SEGURANÇA: todas as procedures são protectedProcedure.
 * ISOLAMENTO: nenhuma query é feita sem WHERE userId = ctx.user.id.
 *             O userId vem sempre do JWT validado pelo middleware, NUNCA do frontend.
 *
 * Fluxo de uma mensagem:
 *   1. Valida autenticação (protectedProcedure)
 *   2. Valida ownership da conversa (tenant guard)
 *   3. Classifica complexidade → seleciona modelo
 *   4. Verifica orçamento do usuário
 *   5. Busca contexto (resumo + janela deslizante)
 *   6. Dispara sumarização automática se necessário
 *   7. Chama o modelo via Forge API
 *   8. Persiste mensagem e registra uso
 *   9. Retorna resposta ao cliente
 */

import { z } from 'zod';
import { eq, and, desc, asc, count, lt } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from './_core/trpc';
import { ENV } from './_core/env';
import { db } from './db';
import {
  aiConversations,
  aiMessages,
  aiProjects,
  aiContextSummaries,
} from '../drizzle/schema';
import {
  classifyTask,
  getModelConfig,
  computeActualCost,
  estimateCost,
} from './services/ai/modelRouter';
import {
  buildContext,
  buildSummarizationPrompt,
  needsSummarization,
  SUMMARIZE_THRESHOLD,
} from './services/ai/contextBuilder';
import { checkBudget, recordUsage, getUserUsageSummary } from './services/ai/costTracker';

// ── Forge API call (model-aware, bypassa invokeLLM que tem modelo fixo) ───────

type ForgeMessage = { role: 'user' | 'assistant' | 'system'; content: string };

async function callForge(
  messages: ForgeMessage[],
  model: string,
  maxTokens: number,
): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  if (!ENV.forgeApiKey) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Forge API não configurada.' });

  const apiUrl = ENV.forgeApiUrl
    ? `${ENV.forgeApiUrl.replace(/\/$/, '')}/v1/chat/completions`
    : 'https://forge.manus.im/v1/chat/completions';

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Forge API error ${res.status}: ${text.slice(0, 200)}`,
    });
  }

  const json = await res.json();
  const content: string = json.choices?.[0]?.message?.content ?? '';
  const tokensIn: number = json.usage?.prompt_tokens ?? 0;
  const tokensOut: number = json.usage?.completion_tokens ?? 0;
  return { content, tokensIn, tokensOut };
}

// ── Tenant guard helper ───────────────────────────────────────────────────────

async function assertConversationOwner(conversationId: number, userId: number) {
  const conv = await db.query.aiConversations.findFirst({
    where: and(eq(aiConversations.id, conversationId), eq(aiConversations.userId, userId)),
  });
  if (!conv) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Conversa não encontrada.' });
  }
  return conv;
}

async function assertProjectOwner(projectId: number, userId: number) {
  const proj = await db.query.aiProjects.findFirst({
    where: and(eq(aiProjects.id, projectId), eq(aiProjects.userId, userId)),
  });
  if (!proj) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Projeto não encontrado.' });
  }
  return proj;
}

// ── Sumarização automática ────────────────────────────────────────────────────

async function runSummarizationIfNeeded(
  conversationId: number,
  userId: number,
  totalMessageCount: number,
) {
  const existingSummary = await db.query.aiContextSummaries.findFirst({
    where: and(
      eq(aiContextSummaries.conversationId, conversationId),
      eq(aiContextSummaries.userId, userId),
    ),
    orderBy: desc(aiContextSummaries.createdAt),
  });

  if (!needsSummarization(totalMessageCount, !!existingSummary)) return;

  // Busca as mensagens antigas (excluindo as últimas SUMMARIZE_THRESHOLD)
  const allMessages = await db.query.aiMessages.findMany({
    where: and(eq(aiMessages.conversationId, conversationId), eq(aiMessages.userId, userId)),
    orderBy: asc(aiMessages.createdAt),
  });

  const oldMessages = allMessages.slice(0, -SUMMARIZE_THRESHOLD);
  if (oldMessages.length === 0) return;

  const summaryPrompt = buildSummarizationPrompt(oldMessages);
  const summaryConfig = getModelConfig('summary');

  try {
    const { content, tokensIn, tokensOut } = await callForge(
      summaryPrompt,
      summaryConfig.model,
      summaryConfig.maxTokensOut,
    );

    const lastOldMessage = oldMessages[oldMessages.length - 1];
    await db.insert(aiContextSummaries).values({
      conversationId,
      userId,
      summaryText: content,
      upToMessageId: lastOldMessage.id,
      tokensUsed: tokensIn + tokensOut,
    });

    // Registra custo da sumarização
    void recordUsage({
      userId,
      conversationId,
      tokensIn,
      tokensOut,
      modelUsed: summaryConfig.model,
      requestType: 'summary',
      estimatedCostUsd: computeActualCost(tokensIn, tokensOut, summaryConfig),
    });
  } catch {
    // Sumarização falhou — continua sem resumo (não bloqueia o usuário)
  }
}

// ── Router ────────────────────────────────────────────────────────────────────

export const aiChatRouter = router({

  // ── Projetos ────────────────────────────────────────────────────────────────

  projects: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.query.aiProjects.findMany({
        where: and(
          eq(aiProjects.userId, ctx.user.id),
          eq(aiProjects.archived, false),
        ),
        orderBy: desc(aiProjects.updatedAt),
      });
    }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(120),
        description: z.string().max(500).optional(),
        systemPrompt: z.string().max(800).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const [result] = await db.insert(aiProjects).values({
          userId: ctx.user.id,  // userId vem do JWT, nunca do input
          name: input.name,
          description: input.description,
          systemPrompt: input.systemPrompt,
        });
        return { id: result.insertId };
      }),

    archive: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await assertProjectOwner(input.projectId, ctx.user.id);
        await db.update(aiProjects)
          .set({ archived: true })
          .where(and(eq(aiProjects.id, input.projectId), eq(aiProjects.userId, ctx.user.id)));
        return { success: true };
      }),
  }),

  // ── Conversas ───────────────────────────────────────────────────────────────

  conversations: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const baseWhere = and(
          eq(aiConversations.userId, ctx.user.id),
          eq(aiConversations.status, 'active'),
          input.projectId ? eq(aiConversations.projectId, input.projectId) : undefined,
        );
        return db.query.aiConversations.findMany({
          where: baseWhere,
          orderBy: desc(aiConversations.updatedAt),
        });
      }),

    create: protectedProcedure
      .input(z.object({
        title: z.string().max(160).default('Nova conversa'),
        projectId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Valida que o projeto pertence ao usuário antes de criar
        if (input.projectId) {
          await assertProjectOwner(input.projectId, ctx.user.id);
        }
        const [result] = await db.insert(aiConversations).values({
          userId: ctx.user.id,
          projectId: input.projectId ?? null,
          title: input.title,
        });
        return { id: result.insertId };
      }),

    delete: protectedProcedure
      .input(z.object({ conversationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await assertConversationOwner(input.conversationId, ctx.user.id);
        await db.update(aiConversations)
          .set({ status: 'archived' })
          .where(and(
            eq(aiConversations.id, input.conversationId),
            eq(aiConversations.userId, ctx.user.id),
          ));
        return { success: true };
      }),

    messages: protectedProcedure
      .input(z.object({ conversationId: z.number() }))
      .query(async ({ ctx, input }) => {
        await assertConversationOwner(input.conversationId, ctx.user.id);
        return db.query.aiMessages.findMany({
          where: and(
            eq(aiMessages.conversationId, input.conversationId),
            eq(aiMessages.userId, ctx.user.id),
          ),
          orderBy: asc(aiMessages.createdAt),
          columns: { id: true, role: true, content: true, modelUsed: true, createdAt: true },
        });
      }),
  }),

  // ── Enviar mensagem (core do sistema) ───────────────────────────────────────

  sendMessage: protectedProcedure
    .input(z.object({
      conversationId: z.number(),
      message: z.string().min(1).max(4000),
      /** Força modelo mais robusto para análises solicitadas explicitamente */
      forceComplex: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;  // SEMPRE do JWT

      // 1. Tenant guard — verifica que a conversa pertence ao usuário
      const conversation = await assertConversationOwner(input.conversationId, userId);

      // 2. Busca projeto associado (com tenant check implícito via assertProjectOwner)
      let project = null;
      if (conversation.projectId) {
        project = await db.query.aiProjects.findFirst({
          where: and(eq(aiProjects.id, conversation.projectId), eq(aiProjects.userId, userId)),
          columns: { name: true, description: true, systemPrompt: true },
        });
      }

      // 3. Conta mensagens para verificar se precisa sumarizar
      const [{ total }] = await db
        .select({ total: count() })
        .from(aiMessages)
        .where(and(eq(aiMessages.conversationId, input.conversationId), eq(aiMessages.userId, userId)));

      // 4. Busca histórico recente (janela deslizante — apenas as últimas N mensagens)
      const recentMessages = await db.query.aiMessages.findMany({
        where: and(
          eq(aiMessages.conversationId, input.conversationId),
          eq(aiMessages.userId, userId),
        ),
        orderBy: desc(aiMessages.createdAt),
        limit: 8,
        columns: { id: true, role: true, content: true },
      });
      recentMessages.reverse(); // cronológico

      // 5. Busca resumo de contexto mais recente
      const contextSummary = await db.query.aiContextSummaries.findFirst({
        where: and(
          eq(aiContextSummaries.conversationId, input.conversationId),
          eq(aiContextSummaries.userId, userId),
        ),
        orderBy: desc(aiContextSummaries.createdAt),
        columns: { summaryText: true },
      });

      // 6. Classifica complexidade e seleciona modelo
      const complexity = classifyTask(input.message, total, input.forceComplex ?? false);
      const modelConfig = getModelConfig(complexity);

      // 7. Verifica orçamento antes de chamar o modelo
      const fullContextText = recentMessages.map(m => m.content).join(' ') + input.message;
      const estimatedCost = estimateCost(fullContextText, modelConfig.maxTokensOut, modelConfig);
      const budget = await checkBudget(userId, estimatedCost);
      if (!budget.allowed) {
        throw new TRPCError({ code: 'FORBIDDEN', message: budget.reason });
      }

      // 8. Dispara sumarização automática em background (não bloqueia)
      void runSummarizationIfNeeded(input.conversationId, userId, total);

      // 9. Monta contexto mínimo eficiente
      const userPlan = (ctx.user.plan ?? 'essencial') as 'essencial' | 'pro' | 'enterprise';
      const contextMessages = buildContext({
        userMessage: input.message,
        userPlan,
        recentMessages,
        contextSummary: contextSummary ?? null,
        project: project ?? null,
      });

      // 10. Chama o modelo
      const { content, tokensIn, tokensOut } = await callForge(
        contextMessages,
        modelConfig.model,
        modelConfig.maxTokensOut,
      );

      const actualCost = computeActualCost(tokensIn, tokensOut, modelConfig);

      // 11. Persiste mensagem do usuário e resposta do assistente
      await db.insert(aiMessages).values([
        {
          conversationId: input.conversationId,
          userId,
          role: 'user',
          content: input.message,
          tokensIn: 0,
          tokensOut: 0,
          modelUsed: modelConfig.model,
          requestType: complexity,
          estimatedCostUsd: '0',
        },
        {
          conversationId: input.conversationId,
          userId,
          role: 'assistant',
          content,
          tokensIn,
          tokensOut,
          modelUsed: modelConfig.model,
          requestType: complexity,
          estimatedCostUsd: actualCost.toFixed(6) as unknown as string,
        },
      ]);

      // 12. Atualiza título automático na primeira mensagem
      if (total === 0) {
        const autoTitle = input.message.slice(0, 60) + (input.message.length > 60 ? '...' : '');
        await db.update(aiConversations)
          .set({ title: autoTitle })
          .where(and(eq(aiConversations.id, input.conversationId), eq(aiConversations.userId, userId)));
      }

      // 13. Registra uso (fire-and-forget)
      void recordUsage({
        userId,
        conversationId: input.conversationId,
        projectId: conversation.projectId ?? undefined,
        tokensIn,
        tokensOut,
        modelUsed: modelConfig.model,
        requestType: complexity,
        estimatedCostUsd: actualCost,
      });

      return {
        content,
        modelUsed: modelConfig.model,
        complexity,
        tokensIn,
        tokensOut,
        estimatedCostUsd: actualCost,
      };
    }),

  // ── Billing / observabilidade ────────────────────────────────────────────────

  usage: protectedProcedure.query(async ({ ctx }) => {
    return getUserUsageSummary(ctx.user.id);
  }),

  limits: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const { aiUserLimits } = await import('../drizzle/schema');
      return db.query.aiUserLimits.findFirst({
        where: eq(aiUserLimits.userId, ctx.user.id),
      });
    }),
  }),
});
