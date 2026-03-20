/**
 * Context Builder — GLX Insights Multi-Tenant AI
 *
 * Monta o prompt mínimo necessário para cada requisição.
 * Nunca reenvia o histórico completo — usa janela deslizante + resumo persistido.
 *
 * Estrutura do contexto (em ordem de custo):
 *   1. system prompt curto e fixo            (~60 tokens)
 *   2. contexto do projeto (se existir)       (~80 tokens)
 *   3. resumo comprimido de mensagens antigas (~120 tokens)
 *   4. últimas N mensagens relevantes         (~400 tokens)
 *   5. mensagem atual do usuário
 *
 * Total estimado por requisição: ~700 tokens de entrada
 * vs ~3000+ tokens se reenviar histórico completo
 */

import type { AiMessage, AiContextSummary, AiProject } from '../../../drizzle/schema';

export type ContextMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export type BuildContextOptions = {
  userMessage: string;
  /** Plano do usuário para personalizar o system prompt */
  userPlan: 'essencial' | 'pro' | 'enterprise';
  /** Últimas mensagens da conversa (já pré-filtradas por userId + conversationId) */
  recentMessages: Pick<AiMessage, 'role' | 'content' | 'id'>[];
  /** Resumo comprimido das mensagens mais antigas (null = sem histórico antigo) */
  contextSummary: Pick<AiContextSummary, 'summaryText'> | null;
  /** Projeto associado à conversa (null = conversa livre) */
  project: Pick<AiProject, 'name' | 'description' | 'systemPrompt'> | null;
  /** Quantas mensagens recentes incluir (default: 8) */
  windowSize?: number;
};

/** System prompt base — curto e direto */
const BASE_SYSTEM = `Você é o Alex, especialista em BI da GLX para clínicas médicas.
Responda em português, de forma executiva e direta.
Sem markdown com # ou **. Sem emojis exceto no título da resposta.
Organize em seções curtas com linha em branco entre elas.`;

const PLAN_ADDENDUM: Record<string, string> = {
  enterprise: '\nUsuário Enterprise: pode solicitar análises avançadas, exportação e acesso completo.',
  pro: '\nUsuário Pro: pode solicitar análises e relatórios detalhados.',
  essencial: '\nUsuário Essencial: foco em métricas principais e visão geral.',
};

/**
 * Constrói o array de mensagens a enviar ao modelo.
 * O resultado é o contexto mínimo necessário para uma resposta de qualidade.
 */
export function buildContext(opts: BuildContextOptions): ContextMessage[] {
  const windowSize = opts.windowSize ?? 8;
  const messages: ContextMessage[] = [];

  // ── 1. System prompt ────────────────────────────────────────────────────────
  let systemContent = BASE_SYSTEM + (PLAN_ADDENDUM[opts.userPlan] ?? '');

  // ── 2. Contexto do projeto (se existir) ─────────────────────────────────────
  if (opts.project) {
    const projectCtx = [
      `Projeto ativo: "${opts.project.name}"`,
      opts.project.description ? `Contexto: ${opts.project.description.slice(0, 200)}` : null,
      opts.project.systemPrompt ? opts.project.systemPrompt.slice(0, 300) : null,
    ].filter(Boolean).join('\n');
    systemContent += `\n\n${projectCtx}`;
  }

  messages.push({ role: 'system', content: systemContent });

  // ── 3. Resumo comprimido de mensagens antigas ────────────────────────────────
  if (opts.contextSummary) {
    messages.push({
      role: 'system',
      content: `Resumo da conversa anterior:\n${opts.contextSummary.summaryText}`,
    });
  }

  // ── 4. Janela deslizante das mensagens recentes ─────────────────────────────
  const window = opts.recentMessages.slice(-windowSize);
  for (const msg of window) {
    if (msg.role === 'system') continue; // system messages já foram incluídas acima
    messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
  }

  // ── 5. Mensagem atual ───────────────────────────────────────────────────────
  messages.push({ role: 'user', content: opts.userMessage });

  return messages;
}

/**
 * Threshold para disparar sumarização automática.
 * Quando a conversa ultrapassa esse número de mensagens, as mais antigas são resumidas.
 */
export const SUMMARIZE_THRESHOLD = 14;

/**
 * Monta o prompt de sumarização — enviado ao modelo barato para comprimir histórico.
 */
export function buildSummarizationPrompt(
  messages: Pick<AiMessage, 'role' | 'content'>[],
): ContextMessage[] {
  const history = messages
    .filter(m => m.role !== 'system')
    .map(m => `${m.role === 'user' ? 'Usuário' : 'Alex'}: ${m.content}`)
    .join('\n');

  return [
    {
      role: 'system',
      content:
        'Resuma a conversa a seguir em no máximo 5 frases objetivas em português. ' +
        'Mantenha apenas os pontos de decisão, dados mencionados e contexto relevante. ' +
        'Sem formatação markdown.',
    },
    { role: 'user', content: history },
  ];
}

/**
 * Decide se a conversa precisa de sumarização antes de continuar.
 */
export function needsSummarization(
  totalMessages: number,
  hasSummary: boolean,
): boolean {
  if (!hasSummary && totalMessages >= SUMMARIZE_THRESHOLD) return true;
  // Re-sumariza se cresceu mais SUMMARIZE_THRESHOLD mensagens desde o último resumo
  if (hasSummary && totalMessages >= SUMMARIZE_THRESHOLD * 2) return true;
  return false;
}
