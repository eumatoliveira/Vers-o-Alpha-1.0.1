/**
 * Model Router — GLX Insights Multi-Tenant AI
 *
 * Classifica a tarefa e seleciona o modelo mais barato capaz de respondê-la.
 * Regra: nunca usar modelo maior do que o necessário.
 *
 * Modelos via Forge API (OpenAI-compatible):
 *   simple   → gemini-2.0-flash-lite  ($0.075/$0.30 por 1M tokens)
 *   standard → gemini-2.5-flash       ($0.15/$0.60 por 1M tokens)
 *   complex  → gemini-2.5-pro         ($1.25/$10   por 1M tokens)
 *
 * Custo por token (USD):
 *   simple:   in=0.000000075  out=0.0000003
 *   standard: in=0.00000015   out=0.0000006
 *   complex:  in=0.00000125   out=0.00001
 */

export type TaskComplexity = 'simple' | 'standard' | 'complex' | 'summary';

export type ModelConfig = {
  model: string;
  complexity: TaskComplexity;
  maxTokensOut: number;
  costPerTokenIn: number;   // USD
  costPerTokenOut: number;  // USD
};

const MODELS: Record<TaskComplexity, ModelConfig> = {
  simple: {
    model: 'gemini-2.0-flash-lite',
    complexity: 'simple',
    maxTokensOut: 512,
    costPerTokenIn: 0.000000075,
    costPerTokenOut: 0.0000003,
  },
  standard: {
    model: 'gemini-2.5-flash',
    complexity: 'standard',
    maxTokensOut: 1024,
    costPerTokenIn: 0.00000015,
    costPerTokenOut: 0.0000006,
  },
  complex: {
    model: 'gemini-2.5-pro',
    complexity: 'complex',
    maxTokensOut: 2048,
    costPerTokenIn: 0.00000125,
    costPerTokenOut: 0.00001,
  },
  summary: {
    // Sumarização usa modelo barato — o output vai para o contexto, não para o usuário
    model: 'gemini-2.0-flash-lite',
    complexity: 'summary',
    maxTokensOut: 400,
    costPerTokenIn: 0.000000075,
    costPerTokenOut: 0.0000003,
  },
};

const COMPLEX_KEYWORDS = [
  'analise', 'análise', 'relatório', 'relatorio', 'compare', 'comparação',
  'projeção', 'projecao', 'tendência', 'tendencia', 'estratégia', 'estrategia',
  'detalhado', 'completo', 'aprofundado', 'explique', 'estruture', 'planilha',
  'dashboard', 'ebitda', 'margem', 'forecasting', 'benchmark',
];

const SIMPLE_KEYWORDS = [
  'o que é', 'o que e', 'qual é', 'qual e', 'como funciona', 'onde fica',
  'quando', 'quem', 'sim', 'não', 'nao', 'ok', 'certo', 'obrigado', 'tchau',
];

/**
 * Classifica a complexidade da tarefa com base no conteúdo e tamanho da mensagem.
 * Nunca faz chamada de rede — é síncrono e de custo zero.
 */
export function classifyTask(
  userMessage: string,
  historyLength: number,
  forceComplex = false,
): TaskComplexity {
  if (forceComplex) return 'complex';

  const lower = userMessage.toLowerCase();
  const wordCount = userMessage.trim().split(/\s+/).length;

  // Mensagens muito curtas → simples
  if (wordCount <= 8 && SIMPLE_KEYWORDS.some(k => lower.includes(k))) {
    return 'simple';
  }

  // Palavras-chave de análise profunda → complex
  if (COMPLEX_KEYWORDS.some(k => lower.includes(k))) {
    return 'complex';
  }

  // Mensagem longa com histórico extenso → complex
  if (wordCount > 60 || historyLength > 10) return 'complex';

  // Mensagem média → standard
  if (wordCount > 20) return 'standard';

  return 'simple';
}

export function getModelConfig(complexity: TaskComplexity): ModelConfig {
  return MODELS[complexity];
}

/**
 * Estimativa de custo antes de enviar a requisição.
 * Usa contagem de caracteres ÷ 3,8 como proxy de tokens (português médio).
 */
export function estimateCost(
  inputText: string,
  expectedOutputTokens: number,
  config: ModelConfig,
): number {
  const estimatedInputTokens = Math.ceil(inputText.length / 3.8);
  return (
    estimatedInputTokens * config.costPerTokenIn +
    expectedOutputTokens * config.costPerTokenOut
  );
}

/**
 * Custo real após receber resposta com contagem exata de tokens.
 */
export function computeActualCost(
  tokensIn: number,
  tokensOut: number,
  config: ModelConfig,
): number {
  return tokensIn * config.costPerTokenIn + tokensOut * config.costPerTokenOut;
}
