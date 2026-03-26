import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { computeKPIs, applyFilters, getAllAppointments, computeByChannel, computeByProfessional, computeByUnit, type Appointment, type Filters } from '../../data/mockData';
import { resolveKpiMeta, type KpiSourceMode } from '../../utils/kpiMeta';

type Theme = 'dark' | 'light' | 'night';

type SupportChatWidgetProps = {
  theme: Theme;
  appointments?: Appointment[];
  filters?: Filters;
  activePlan?: 'ESSENTIAL' | 'PRO' | 'ENTERPRISE';
  kpiSourceMode?: KpiSourceMode;
  lang?: 'PT' | 'EN' | 'ES';
};

type SupportMessage = {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  createdAt: string;
};

type SupportConversation = {
  id: string;
  title: string;
  messages: SupportMessage[];
  updatedAt: string;
  contextTerms: string[];
  customTitle?: boolean;
  pinnedAt?: string | null;
};

type NavItem = 'conversas' | 'projetos';

type Project = {
  id: string;
  name: string;
  description: string;
  messages: SupportMessage[];
  createdAt: string;
  updatedAt: string;
  favorited: boolean;
  archived: boolean;
};

const STORAGE_KEY = 'glx_support_chat_history_v1';
const PROJECTS_KEY = 'glx_projects_v1';
const PROFILE_KEY = 'glx-dashboard-profile';
const QUICK_REPLIES = ['Como exporto PDF?', 'Onde ficam os filtros?', 'Como trocar o periodo?'];

function readDashboardProfile(): { name: string; avatar: string } {
  if (typeof window === 'undefined') return { name: 'Cliente', avatar: '' };
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return { name: 'Cliente', avatar: '' };
    const parsed = JSON.parse(raw) as { name?: string; avatar?: string };
    return { name: parsed.name || 'Cliente', avatar: parsed.avatar || '' };
  } catch {
    return { name: 'Cliente', avatar: '' };
  }
}

const CONTEXT_RULES: Array<{ label: string; terms: string[] }> = [
  { label: 'pdf', terms: ['pdf', 'export', 'executivo'] },
  { label: 'filtros', terms: ['filtro', 'canal', 'profission', 'procedimento', 'meta'] },
  { label: 'periodo', terms: ['periodo', '30 dias', '90 dias'] },
  { label: 'topbar', terms: ['atualizar', 'refresh', 'dados ao vivo', 'notifica'] },
  { label: 'tema', terms: ['tema', 'dark', 'claro', 'escuro'] },
];

function nowIso() {
  return new Date().toISOString();
}

function getGreeting(lang: 'pt' | 'en' | 'es' = 'pt') {
  const hour = new Date().getHours();
  const greetings = {
    pt: 'Olá, como posso te ajudar?',
    en: hour < 12 ? 'How can I help you this morning?' : hour < 18 ? 'How can I help you this afternoon?' : 'How can I help you this evening?',
    es: hour < 12 ? '¿Cómo puedo ayudarte esta mañana?' : hour < 18 ? '¿Cómo puedo ayudarte esta tarde?' : '¿Cómo puedo ayudarte esta noche?',
  };
  return greetings[lang];
}

function createWelcomeMessage(): SupportMessage {
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    content:
      'Oi, eu sou o Alex da GLX, Head of Business Development. Vou te ajudar a entender sua empresa mais a fundo por meio de prompts e conversas guiadas dentro do painel.',
    createdAt: nowIso(),
  };
}

function createConversation(title = 'Nova conversa'): SupportConversation {
  return {
    id: crypto.randomUUID(),
    title,
    messages: [createWelcomeMessage()],
    updatedAt: nowIso(),
    contextTerms: ['dashboard', 'suporte'],
    customTitle: false,
    pinnedAt: null,
  };
}

function stripMarkdown(text: string) {
  return text
    .replace(/#{1,6}\s*/g, '')      // # ## ### etc
    .replace(/\*\*/g, '')           // **bold**
    .replace(/\*(?!\s)/g, '')       // *italic* (single, not bullet spaces)
    .replace(/^- /gm, '')           // leading "- " on lines
    .replace(/---+/g, '')           // horizontal rules
    .trim();
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function buildSupportReply(
  input: string,
  appointments?: Appointment[],
  filters?: Filters,
  activePlan?: string,
  kpiSourceMode?: KpiSourceMode,
): string {
  const q = normalizeText(input);
  const data = appointments && appointments.length > 0 ? appointments : getAllAppointments();
  const filtered = filters ? applyFilters(data, filters) : data;
  const kpis = computeKPIs(filtered);
  const mode = kpiSourceMode ?? 'fallback';
  const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  const fmtR = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Navigation / UI
  if (q.includes('pdf') || q.includes('export')) {
    return 'Use o botão "PDF Executivo" no topo direito. Ele gera a versão visual completa do dashboard atual com KPIs e gráficos.';
  }
  if (q.includes('filtro') || q.includes('canal') || q.includes('periodo') || q.includes('period')) {
    return `Os filtros ficam abaixo do cabeçalho principal. Você pode combinar: período, canal, profissional, procedimento, unidade e alertas. Atualmente ${filtered.length} registros correspondem ao filtro ativo.`;
  }
  if (q.includes('tema') || q.includes('dark') || q.includes('claro') || q.includes('escuro')) {
    return 'Os controles de tema ficam no canto superior direito, ao lado do status de dados ao vivo.';
  }
  if (q.includes('atual') || q.includes('refresh')) {
    return 'Clique em "Atualizar" no topo para recarregar os dados em tempo real.';
  }

  // KPI — No-show
  if (q.includes('no show') || q.includes('noshow') || q.includes('no-show') || q.includes('faltou') || q.includes('faltaram')) {
    const meta = resolveKpiMeta('No-Show', mode);
    const byChannel = computeByChannel(filtered).sort((a, b) => b.noShowRate - a.noShowRate)[0];
    return `📊 No-Show atual: **${fmt(kpis.noShowRate)}%** (${kpis.noShows} de ${kpis.total} consultas).\nPior canal: ${byChannel?.name ?? '—'} com ${fmt(byChannel?.noShowRate ?? 0)}%.\nFórmula: ${meta.formula}.\nPara reduzir: reforce confirmação automatizada 48h antes.`;
  }

  // KPI — Ocupação
  if (q.includes('ocupa') || q.includes('capacidade') || q.includes('agenda cheia') || q.includes('slot')) {
    const meta = resolveKpiMeta('Ocupacao', mode);
    return `📊 Taxa de ocupação: **${fmt(kpis.occupancyRate)}%**.\nFórmula: ${meta.formula}.\n${kpis.occupancyRate < 70 ? '⚠️ Abaixo de 70% — há espaço ocioso significativo na agenda.' : '✅ Ocupação saudável.'}`;
  }

  // KPI — Ticket médio
  if (q.includes('ticket') || q.includes('receita por') || q.includes('valor medio') || q.includes('ticket medio')) {
    return `💰 Ticket médio atual: **${fmtR(kpis.avgTicket)}**.\nReceita bruta total: ${fmtR(kpis.grossRevenue)} em ${kpis.realized} consultas realizadas.\n${kpis.avgTicket < 200 ? '⚠️ Ticket abaixo de R$ 200 — considere revisão de precificação ou mix de procedimentos.' : '✅ Ticket dentro da faixa esperada.'}`;
  }

  // KPI — Margem / EBITDA
  if (q.includes('margem') || q.includes('ebitda') || q.includes('lucro') || q.includes('resultado')) {
    const meta = resolveKpiMeta('Margem Liquida', mode);
    return `📊 Margem líquida: **${fmt(kpis.margin)}%** | EBITDA: ${fmtR(kpis.ebitda)}.\nReceita líquida: ${fmtR(kpis.netRevenue)} | Custos totais: ${fmtR(kpis.totalCost)}.\nFórmula: ${meta.formula}.\n${kpis.margin < 20 ? '⚠️ Margem abaixo de 20% — revise despesas fixas e inadimplência.' : '✅ Margem saudável.'}`;
  }

  // KPI — CAC / Leads
  if (q.includes('cac') || q.includes('custo de aquisicao') || q.includes('lead') || q.includes('captacao')) {
    const meta = resolveKpiMeta('CAC', mode);
    return `📊 CAC médio: **${fmtR(kpis.avgCAC)}** | Total de leads: ${kpis.leads} | CPL: ${fmtR(kpis.cpl)}.\nFórmula: ${meta.formula}.\n${kpis.avgCAC > 150 ? '⚠️ CAC alto — analise canais com menor retorno.' : '✅ CAC dentro do esperado.'}\nInvestimento em mídia: ${fmtR(kpis.totalAdSpend)}.`;
  }

  // KPI — NPS
  if (q.includes('nps') || q.includes('satisfacao') || q.includes('satisfação') || q.includes('promotor')) {
    const meta = resolveKpiMeta('NPS', mode);
    return `📊 NPS médio: **${fmt(kpis.avgNPS)}**.\nFórmula: ${meta.formula}.\n${kpis.avgNPS >= 70 ? '✅ Zona de excelência (≥70).' : kpis.avgNPS >= 50 ? '🟡 Zona de qualidade (50–69).' : '⚠️ Zona de aperfeiçoamento (<50) — investigue causas de insatisfação.'}`;
  }

  // KPI — Inadimplência
  if (q.includes('inadim') || q.includes('nao pagou') || q.includes('não pagou') || q.includes('cobranca') || q.includes('cobrança')) {
    return `📊 Inadimplência: **${fmt(kpis.inadimplenciaRate)}%** | Perda estimada: ${fmtR(kpis.inadimplenciaLoss)}.\n${kpis.inadimplenciaRate > 5 ? '⚠️ Acima de 5% — acione régua de cobrança automatizada.' : '✅ Inadimplência sob controle.'}`;
  }

  // Por profissional
  if (q.includes('profissional') || q.includes('medico') || q.includes('médico') || q.includes('doutor') || q.includes('doutora')) {
    const byProf = computeByProfessional(filtered).sort((a, b) => b.grossRevenue - a.grossRevenue);
    const top = byProf[0];
    const worst = byProf[byProf.length - 1];
    return `👨‍⚕️ Top profissional por receita: **${top?.name ?? '—'}** (${fmtR(top?.grossRevenue ?? 0)}, no-show ${fmt(top?.noShowRate ?? 0)}%).\nMenor receita: ${worst?.name ?? '—'} (${fmtR(worst?.grossRevenue ?? 0)}).\nTotal de ${byProf.length} profissionais no período.`;
  }

  // Por unidade
  if (q.includes('unidade') || q.includes('filial') || q.includes('clinica') || q.includes('clínica') || q.includes('jardins') || q.includes('paulista')) {
    const byUnit = computeByUnit(filtered).sort((a, b) => b.grossRevenue - a.grossRevenue);
    const lines = byUnit.map(u => `• ${u.name}: ${fmtR(u.grossRevenue)} | margem ${fmt(u.margin)}%`).join('\n');
    return `🏥 Desempenho por unidade:\n${lines || 'Nenhum dado de unidade no período.'}`;
  }

  // Resumo geral
  if (q.includes('resumo') || q.includes('overview') || q.includes('visao geral') || q.includes('visão geral') || q.includes('como estou') || q.includes('como esta') || q.includes('como está')) {
    const planLabel = activePlan === 'PRO' ? 'Pro' : activePlan === 'ENTERPRISE' ? 'Enterprise' : 'Essential';
    return `📋 Resumo do período (Plano ${planLabel} · ${mode === 'integrated' ? 'dados reais' : 'dados simulados'}):\n• Consultas: ${kpis.total} agendadas / ${kpis.realized} realizadas\n• Receita bruta: ${fmtR(kpis.grossRevenue)} | Líquida: ${fmtR(kpis.netRevenue)}\n• Ticket médio: ${fmtR(kpis.avgTicket)} | Margem: ${fmt(kpis.margin)}%\n• No-show: ${fmt(kpis.noShowRate)}% | Ocupação: ${fmt(kpis.occupancyRate)}%\n• CAC: ${fmtR(kpis.avgCAC)} | NPS: ${fmt(kpis.avgNPS)}`;
  }

  return `Posso te ajudar com KPIs específicos como no-show, ticket médio, margem, CAC, NPS, ocupação, inadimplência, desempenho por profissional ou unidade. O que quer analisar?`;
}

function deriveContextTerms(messages: SupportMessage[]) {
  const text = normalizeText(messages.map((message) => message.content).join(' '));
  const terms = new Set<string>(['dashboard', 'suporte']);

  CONTEXT_RULES.forEach((rule) => {
    if (rule.terms.some((term) => text.includes(normalizeText(term)))) {
      terms.add(rule.label);
    }
  });

  return Array.from(terms);
}

function formatConversationTitle(messages: SupportMessage[]) {
  const firstUserMessage = messages.find((message) => message.role === 'user');
  if (!firstUserMessage) return 'Nova conversa';

  const title = firstUserMessage.content.trim();
  return title.length > 30 ? `${title.slice(0, 30)}...` : title;
}

function sortConversations(items: SupportConversation[]) {
  return [...items].sort((left, right) => {
    if (left.pinnedAt && right.pinnedAt) {
      return left.pinnedAt.localeCompare(right.pinnedAt);
    }

    if (left.pinnedAt) return -1;
    if (right.pinnedAt) return 1;

    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

function readStoredProjects(): Project[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Project[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function createProject(name: string, description: string): Project {
  return {
    id: crypto.randomUUID(),
    name,
    description,
    messages: [{
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `Projeto "${name}" criado! Contexto: ${description || 'nenhum contexto definido'}. Como posso te ajudar a avançar?`,
      createdAt: nowIso(),
    }],
    createdAt: nowIso(),
    updatedAt: nowIso(),
    favorited: false,
    archived: false,
  };
}

const CLAUDE_API_KEY_STORAGE = 'glx_anthropic_key';
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';

// ── Crypto helpers (AES-GCM + PBKDF2) ───────────────────────────────────────
const _ENC_PREFIX = 'glx_enc::';
const _PBKDF2_SALT = new TextEncoder().encode('glx-insights-salt-2026');
const _PBKDF2_PASS = 'glx-dashboard-secure-key-v1';

async function _deriveKey(usage: 'encrypt' | 'decrypt'): Promise<CryptoKey> {
  const raw = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(_PBKDF2_PASS), 'PBKDF2', false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: _PBKDF2_SALT, iterations: 12000, hash: 'SHA-256' },
    raw, { name: 'AES-GCM', length: 256 }, false, [usage],
  );
}

async function encryptApiKey(plain: string): Promise<string> {
  const key = await _deriveKey('encrypt');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain));
  const buf = new Uint8Array(12 + enc.byteLength);
  buf.set(iv);
  buf.set(new Uint8Array(enc), 12);
  return _ENC_PREFIX + btoa(Array.from(buf, b => String.fromCharCode(b)).join(''));
}

async function decryptApiKey(stored: string): Promise<string> {
  if (!stored.startsWith(_ENC_PREFIX)) return stored; // legacy plain fallback
  try {
    const buf = Uint8Array.from(atob(stored.slice(_ENC_PREFIX.length)), c => c.charCodeAt(0));
    const key = await _deriveKey('decrypt');
    const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, key, buf.slice(12));
    return new TextDecoder().decode(dec);
  } catch {
    return ''; // wrong key or corrupted — treat as missing
  }
}

async function callClaudeStream(opts: {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  useWebSearch?: boolean;
  model?: string;
  onChunk: (accumulated: string) => void;
  onDone: () => void;
  onError: (msg: string) => void;
}): Promise<() => void> {
  const storedKey = localStorage.getItem(CLAUDE_API_KEY_STORAGE) ?? '';
  if (!storedKey) {
    opts.onError('O assistente não está disponível no momento. Entre em contato com o suporte.');
    opts.onDone();
    return () => {};
  }
  const apiKey = await decryptApiKey(storedKey);
  if (!apiKey) {
    opts.onError('Não foi possível iniciar o assistente. Entre em contato com o suporte.');
    opts.onDone();
    return () => {};
  }

  const abort = new AbortController();

  const body: Record<string, unknown> = {
    model: opts.model ?? CLAUDE_MODEL,
    max_tokens: 1024,
    stream: true,
    system: opts.system,
    messages: opts.messages,
  };

  if (opts.useWebSearch) {
    body.tools = [{ type: 'web_search_20250305', name: 'web_search' }];
  }

  fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal: abort.signal,
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  })
    .then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const isCreditErr =
          res.status === 529 || res.status === 402 ||
          (err?.error?.type ?? '').includes('credit') ||
          (err?.error?.message ?? '').toLowerCase().includes('credit');
        opts.onError(isCreditErr ? '__CREDIT_ERROR__' : (err?.error?.message ?? `Erro HTTP ${res.status}`));
        opts.onDone();
        return;
      }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
              accumulated += parsed.delta.text;
              opts.onChunk(accumulated);
            }
          } catch { /* skip malformed SSE */ }
        }
      }
      opts.onDone();
    })
    .catch((err) => {
      if (err.name !== 'AbortError') opts.onError(err.message ?? 'Erro desconhecido');
      opts.onDone();
    });

  return () => abort.abort();
}

function buildProjectReply(input: string, project: Project): string {
  const q = normalizeText(input);

  if (q.includes('prompt') || q.includes('rag') || q.includes('ia') || q.includes('inteligencia') || q.includes('modelo')) {
    return `Para o projeto "${project.name}", posso gerar prompts contextualizados. Contexto base: "${project.description.slice(0, 100)}". Quer um prompt de análise, extração ou síntese?`;
  }

  if (q.includes('como') || q.includes('o que') || q.includes('qual') || q.includes('explica')) {
    return `Com base no projeto "${project.name}" — ${project.description.slice(0, 80)} — sugiro mapear os dados disponíveis e os gaps. Quer que eu estruture um plano de ação?`;
  }

  if (q.includes('etapa') || q.includes('passo') || q.includes('plano') || q.includes('estrutur')) {
    return `Etapas sugeridas para "${project.name}":\n1. Definir escopo e dados de entrada\n2. Estruturar prompts de extração\n3. Validar outputs\n4. Iterar com feedback real. Por onde quer começar?`;
  }

  return `Entendido. No contexto de "${project.name}", vou te ajudar a avançar. Qual é o próximo passo que você quer definir?`;
}

function readStoredConversations() {
  if (typeof window === 'undefined') return [createConversation()];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [createConversation()];

    const parsed = JSON.parse(raw) as SupportConversation[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [createConversation()];

    return sortConversations(
      parsed.map((conversation) => ({
        ...conversation,
        customTitle: conversation.customTitle ?? false,
        pinnedAt: conversation.pinnedAt ?? null,
      })),
    );
  } catch {
    return [createConversation()];
  }
}

const NAV_ITEMS: Array<{ id: NavItem; label: string; icon: React.ReactNode }> = [
  {
    id: 'conversas',
    label: 'Conversas',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    id: 'projetos',
    label: 'Projetos',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
];

const DARK = {
  sidebar: '#1a1a1a',
  main: '#1e1e1e',
  border: '#2d2d2d',
  text: '#e8e8e8',
  muted: '#6b7280',
  accent: '#f97316',
  accentSoft: 'rgba(249,115,22,0.14)',
  surface: '#252525',
  shadow: '0 24px 56px rgba(0,0,0,0.55)',
};

export function SupportChatWidget({ theme: _theme, appointments, filters, activePlan, kpiSourceMode, lang = 'PT' }: SupportChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dashProfile, setDashProfile] = useState(readDashboardProfile);

  useEffect(() => {
    const sync = () => setDashProfile(readDashboardProfile());
    window.addEventListener('glx-profile-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('glx-profile-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeNav, setActiveNav] = useState<NavItem>('conversas');
  const [input, setInput] = useState('');
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const [conversations, setConversations] = useState<SupportConversation[]>(() => readStoredConversations());
  const [activeConversationId, setActiveConversationId] = useState<string>(() => readStoredConversations()[0]?.id ?? createConversation().id);
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortClaudeRef = useRef<(() => void) | null>(null);

  // Resize state
  const [chatWidth, setChatWidth] = useState(620);
  const [chatHeight, setChatHeight] = useState(560);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef<{ x: number; y: number; w: number; h: number; dir: string } | null>(null);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  // Auto-collapse sidebar on mobile
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [webSearchOn, setWebSearchOn] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(() => localStorage.getItem('glx_selected_model') ?? CLAUDE_MODEL);
  const [attachedFiles, setAttachedFiles] = useState<Array<{ name: string; preview?: string }>>([]);
  const [apiKeyStatus, setApiKeyStatus] = useState<'unchecked' | 'ok' | 'missing' | 'testing'>('unchecked');
  const [apiTestMsg, setApiTestMsg] = useState<string | null>(null);

  // Projects state
  const [projects, setProjects] = useState<Project[]>(() => readStoredProjects());
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [projectInput, setProjectInput] = useState('');
  const [projectMenuId, setProjectMenuId] = useState<string | null>(null);

  // Check API key on open; auto-migrate plain keys to encrypted
  useEffect(() => {
    const stored = localStorage.getItem(CLAUDE_API_KEY_STORAGE);
    if (!stored) { setApiKeyStatus('missing'); return; }
    if (!stored.startsWith(_ENC_PREFIX)) {
      // migrate plain → encrypted silently
      encryptApiKey(stored).then(enc => localStorage.setItem(CLAUDE_API_KEY_STORAGE, enc));
    }
    setApiKeyStatus('ok');
  }, [isOpen]);

  const testClaudeApi = async () => {
    const stored = localStorage.getItem(CLAUDE_API_KEY_STORAGE);
    if (!stored) {
      setApiKeyStatus('missing');
      setApiTestMsg('⚠️ Nenhuma chave API encontrada. Configure em Admin > Assistente IA.');
      return;
    }
    setApiKeyStatus('testing');
    setApiTestMsg('Testando conexão com Claude...');
    setPlusMenuOpen(false);
    const key = await decryptApiKey(stored);
    if (!key) {
      setApiKeyStatus('missing');
      setApiTestMsg('⚠️ Falha ao descriptografar a chave. Reconfigure em Admin > Assistente IA.');
      setTimeout(() => setApiTestMsg(null), 5000);
      return;
    }
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 32,
          messages: [{ role: 'user', content: 'Diga apenas: OK' }],
        }),
      });
      if (res.ok) {
        setApiKeyStatus('ok');
        setApiTestMsg('✅ API do Claude conectada com sucesso!');
      } else {
        const err = await res.json().catch(() => ({}));
        setApiKeyStatus('missing');
        setApiTestMsg(`⚠️ Erro: ${err?.error?.message ?? `HTTP ${res.status}`}`);
      }
    } catch (e) {
      setApiKeyStatus('missing');
      setApiTestMsg(`⚠️ Falha na conexão: ${(e as Error).message}`);
    }
    setTimeout(() => setApiTestMsg(null), 5000);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  }, [projects]);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) ?? conversations[0],
    [activeConversationId, conversations],
  );

  useEffect(() => {
    if (!activeConversation && conversations[0]) {
      setActiveConversationId(conversations[0].id);
    }
  }, [activeConversation, conversations]);

  const syncJumpButton = useCallback(() => {
    const viewport = messagesViewportRef.current;
    if (!viewport) return;
    const distanceToBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    setShowJumpToBottom(distanceToBottom > 24);
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const viewport = messagesViewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior });
    setShowJumpToBottom(false);
  }, []);

  useEffect(() => {
    if (!isOpen || activeNav !== 'conversas') return;

    const frame = window.requestAnimationFrame(() => {
      scrollToBottom('auto');
      syncJumpButton();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeConversationId, activeConversation?.messages.length, isOpen, activeNav, scrollToBottom, syncJumpButton]);

  const updateConversation = (conversationId: string, nextMessages: SupportMessage[]) => {
    setConversations((current) =>
      sortConversations(
        current.map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                messages: nextMessages,
                title: conversation.customTitle ? conversation.title : formatConversationTitle(nextMessages),
                updatedAt: nowIso(),
                contextTerms: deriveContextTerms(nextMessages),
              }
            : conversation,
        ),
      ),
    );
  };

  const handleNewConversation = () => {
    const nextConversation = createConversation();
    setConversations((current) => sortConversations([nextConversation, ...current]));
    setActiveConversationId(nextConversation.id);
    setActiveNav('conversas');
    setInput('');
  };

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !activeConversation || isStreaming) return;

    const fileContext = attachedFiles.length > 0 ? `\n\n[Arquivos anexados: ${attachedFiles.map(f => f.name).join(', ')}]` : '';
    const fullText = trimmed + fileContext;
    attachedFiles.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview); });
    setAttachedFiles([]);

    const userMessage: SupportMessage = { id: crypto.randomUUID(), role: 'user', content: fullText, createdAt: nowIso() };
    const assistantId = crypto.randomUUID();
    const assistantPlaceholder: SupportMessage = { id: assistantId, role: 'assistant', content: '...', createdAt: nowIso() };
    const nextMessages = [...activeConversation.messages, userMessage, assistantPlaceholder];
    updateConversation(activeConversation.id, nextMessages);
    setInput('');
    setActiveNav('conversas');

    const apiKey = localStorage.getItem(CLAUDE_API_KEY_STORAGE) ?? '';
    if (!apiKey) {
      updateConversation(activeConversation.id, nextMessages.map(m =>
        m.id === assistantId ? { ...m, content: buildSupportReply(fullText, appointments, filters, activePlan, kpiSourceMode) } : m
      ));
      return;
    }

    const data = appointments && appointments.length > 0 ? appointments : getAllAppointments();
    const filtered = filters ? applyFilters(data, filters) : data;
    const kpis = computeKPIs(filtered);
    const fmt = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    const system = `Você é o Alex, Head of Business Development da GLX, especialista em BI para clínicas médicas.

REGRAS DE FORMATO — siga rigorosamente:
- Escreva em português, de forma executiva e direta.
- NÃO use markdown com ## ou **negrito**. Jamais use hashtags de título.
- Use emojis APENAS no título principal da resposta (uma linha isolada, ex: "💰 Insights Financeiros — Período Atual").
- Organize em seções com títulos simples em linha própria (ex: "Visão geral", "O que os números mostram", "Pontos de atenção", "Leitura executiva", "Próximos passos recomendados").
- Cada métrica ocupa uma linha própria: "Receita Bruta: R$ 182.227,21"
- Após cada métrica, adicione uma linha de interpretação curta em prosa (ex: "Indica um bom patamar por consulta, com margem saudável para a operação.").
- Separe seções com uma linha em branco. Não use "---" como separador.
- Listas de ações: use linhas iniciadas com nome da ação, sem marcadores especiais.
- Termine com uma frase aberta convidando a aprofundar, sem usar markdown.

EXEMPLO DE ESTRUTURA CORRETA:
💰 Insights Financeiros — Período Atual

Aqui estão os principais destaques financeiros da clínica no período analisado.

Visão geral

Receita Bruta: R$ 182.227,21
Receita Líquida: R$ 161.180,56
Custos Totais: R$ 21.046,65 (11,5% da receita bruta)
EBITDA: R$ 40.068,53 ✅

O que os números mostram

Ticket médio: R$ 613,56
Indica um bom patamar por consulta, com margem saudável para a operação.

Dados do período atual:
Consultas: ${kpis.total} agendadas / ${kpis.realized} realizadas
Receita bruta: ${fmt(kpis.grossRevenue)} | Líquida: ${fmt(kpis.netRevenue)}
Ticket médio: ${fmt(kpis.avgTicket)} | Margem: ${kpis.margin.toFixed(1)}%
EBITDA: ${fmt(kpis.ebitda)}
No-show: ${kpis.noShowRate.toFixed(1)}% | Ocupação: ${kpis.occupancyRate.toFixed(1)}%
CAC: ${fmt(kpis.avgCAC)} | CPL: ${fmt(kpis.cpl)} | Leads: ${kpis.leads}
NPS: ${kpis.avgNPS.toFixed(1)} | Inadimplência: ${kpis.inadimplenciaRate.toFixed(1)}%
Plano ativo: ${activePlan ?? 'ESSENTIAL'} | Fonte: ${kpiSourceMode ?? 'fallback'}`;
    const history = activeConversation.messages.filter(m => m.id !== '__welcome__').slice(-10).map(m => ({ role: m.role, content: m.content }));

    setIsStreaming(true);
    callClaudeStream({
      system,
      messages: [...history, { role: 'user', content: fullText }],
      useWebSearch: webSearchOn,
      model: selectedModel,
      onChunk: (acc) => {
        setConversations(prev => prev.map(c =>
          c.id === activeConversation.id ? { ...c, messages: c.messages.map(m => m.id === assistantId ? { ...m, content: acc } : m) } : c
        ));
      },
      onDone: () => setIsStreaming(false),
      onError: (msg) => {
        const content = msg === '__CREDIT_ERROR__' ? '__CREDIT_ERROR__' : `⚠️ ${msg}`;
        setConversations(prev => prev.map(c =>
          c.id === activeConversation.id ? { ...c, messages: c.messages.map(m => m.id === assistantId ? { ...m, content } : m) } : c
        ));
        setIsStreaming(false);
      },
    }).then(cancel => { abortClaudeRef.current = cancel; });

  };

  const deleteConversation = (conversationId: string) => {
    setConversations((current) => {
      const remaining = current.filter((c) => c.id !== conversationId);
      const nextList = remaining.length > 0 ? remaining : [createConversation()];
      const sorted = sortConversations(nextList);
      setActiveConversationId((cur) => {
        if (cur !== conversationId) return cur;
        return sorted[0]?.id ?? createConversation().id;
      });
      return sorted;
    });
  };

  const sendProjectMessage = (proj: Project, text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    const userMsg: SupportMessage = { id: crypto.randomUUID(), role: 'user', content: trimmed, createdAt: nowIso() };
    const assistantId = crypto.randomUUID();
    const placeholder: SupportMessage = { id: assistantId, role: 'assistant', content: '...', createdAt: nowIso() };
    setProjects(prev => prev.map(p => p.id === proj.id ? { ...p, messages: [...p.messages, userMsg, placeholder], updatedAt: nowIso() } : p));
    setProjectInput('');

    const apiKey = localStorage.getItem(CLAUDE_API_KEY_STORAGE) ?? '';
    if (!apiKey) {
      setProjects(prev => prev.map(p => p.id === proj.id ? { ...p, messages: p.messages.map(m => m.id === assistantId ? { ...m, content: buildProjectReply(trimmed, proj) } : m) } : p));
      return;
    }

    const system = `Você é o Alex da GLX, especialista em BI e estratégia para clínicas médicas.

REGRAS DE FORMATO — siga rigorosamente:
- Escreva em português, de forma executiva e direta.
- NÃO use markdown com ## ou **negrito**. Jamais use hashtags de título.
- Use emojis APENAS no título principal da resposta (uma linha isolada).
- Organize em seções com títulos simples em linha própria.
- Separe seções com uma linha em branco. Não use "---" como separador.
- Listas de ações: use linhas iniciadas com nome da ação, sem marcadores especiais.
- Termine com uma frase aberta convidando a aprofundar.

Contexto do projeto do usuário:
Nome: "${proj.name}"
Descrição: "${proj.description || 'sem descrição'}"

Responda sempre com base no contexto do projeto, seja objetivo e prático.`;
    const history = proj.messages.filter(m => m.role !== 'assistant' || m.content !== '...').slice(-10).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    setIsStreaming(true);
    callClaudeStream({
      system,
      messages: [...history, { role: 'user', content: trimmed }],
      useWebSearch: webSearchOn,
      model: selectedModel,
      onChunk: (acc) => setProjects(prev => prev.map(p => p.id === proj.id ? { ...p, messages: p.messages.map(m => m.id === assistantId ? { ...m, content: acc } : m) } : p)),
      onDone: () => setIsStreaming(false),
      onError: (msg) => {
        const content = msg === '__CREDIT_ERROR__' ? '__CREDIT_ERROR__' : `⚠️ ${msg}`;
        setProjects(prev => prev.map(p => p.id === proj.id ? { ...p, messages: p.messages.map(m => m.id === assistantId ? { ...m, content } : m) } : p));
        setIsStreaming(false);
      },
    }).then(cancel => { abortClaudeRef.current = cancel; });
  };

  const canSend = input.trim().length > 0;
  const isNewConversation =
    activeConversation?.messages.length === 1 && activeConversation.messages[0].role === 'assistant';

  const startResize = (e: React.MouseEvent, dir: 'left' | 'top' | 'corner') => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartRef.current = { x: e.clientX, y: e.clientY, w: chatWidth, h: chatHeight, dir };

    const onMove = (ev: MouseEvent) => {
      if (!resizeStartRef.current) return;
      const { x, y, w, h, dir } = resizeStartRef.current;
      if (dir === 'left' || dir === 'corner') {
        const newW = Math.max(360, Math.min(window.innerWidth - 40, w - (ev.clientX - x)));
        setChatWidth(newW);
      }
      if (dir === 'top' || dir === 'corner') {
        const newH = Math.max(400, Math.min(window.innerHeight - 80, h - (ev.clientY - y)));
        setChatHeight(newH);
      }
    };

    const onUp = () => {
      resizeStartRef.current = null;
      setIsResizing(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Responsive dimensions: cap to viewport so chat never overflows on mobile
  const maxW = typeof window !== 'undefined' ? window.innerWidth - 36 : chatWidth;
  const maxH = typeof window !== 'undefined' ? window.innerHeight - 120 : chatHeight;
  const resolvedWidth = Math.min(chatWidth, maxW);
  const resolvedHeight = Math.min(chatHeight, maxH);

  const widget = (
    <div
      onClick={() => plusMenuOpen && setPlusMenuOpen(false)}
      style={{
        position: 'fixed',
        right: 18,
        bottom: 42,
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 10,
      }}
    >
      {isOpen ? (
        <div
          style={{
            width: resolvedWidth,
            height: resolvedHeight,
            borderRadius: 20,
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            background: DARK.main,
            boxShadow: DARK.shadow,
            border: `1px solid ${DARK.border}`,
            transition: isResizing ? 'none' : 'width 220ms ease',
            userSelect: isResizing ? 'none' : 'auto',
          }}
        >
          {/* ── RESIZE HANDLES ── */}
          {/* Top edge */}
          <div
            onMouseDown={(e) => startResize(e, 'top')}
            style={{ position: 'absolute', top: 0, left: 14, right: 14, height: 6, cursor: 'ns-resize', zIndex: 20 }}
          />
          {/* Left edge */}
          <div
            onMouseDown={(e) => startResize(e, 'left')}
            style={{ position: 'absolute', top: 14, left: 0, bottom: 14, width: 6, cursor: 'ew-resize', zIndex: 20 }}
          />
          {/* Top-left corner */}
          <div
            onMouseDown={(e) => startResize(e, 'corner')}
            title="Arrastar para redimensionar"
            style={{ position: 'absolute', top: 0, left: 0, width: 18, height: 18, cursor: 'nw-resize', zIndex: 21, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
              <circle cx="1.5" cy="1.5" r="1.2" fill="#4b5563" />
              <circle cx="4.5" cy="1.5" r="1.2" fill="#4b5563" />
              <circle cx="1.5" cy="4.5" r="1.2" fill="#4b5563" />
              <circle cx="4.5" cy="4.5" r="1.2" fill="#4b5563" />
              <circle cx="7.5" cy="1.5" r="1.2" fill="#4b5563" />
              <circle cx="1.5" cy="7.5" r="1.2" fill="#4b5563" />
            </svg>
          </div>
          {/* ── SIDEBAR ── */}
          {sidebarOpen ? (
            <div
              style={{
                width: 200,
                flexShrink: 0,
                background: DARK.sidebar,
                display: 'flex',
                flexDirection: 'column',
                borderRight: `1px solid ${DARK.border}`,
              }}
            >

              {/* Logo */}
              <div style={{ padding: '18px 16px 10px' }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: DARK.text, letterSpacing: '-0.3px' }}>Alex.</span>
              </div>

              {/* Nav */}
              <nav style={{ padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {NAV_ITEMS.map(({ id, label, icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveNav(id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '9px 12px',
                      borderRadius: 10,
                      border: 'none',
                      background: activeNav === id ? DARK.surface : 'transparent',
                      color: activeNav === id ? DARK.text : DARK.muted,
                      cursor: 'pointer',
                      fontSize: 13.5,
                      fontWeight: 500,
                      textAlign: 'left',
                      transition: 'background 150ms ease, color 150ms ease',
                    }}
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </nav>

              {/* Recentes */}
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', marginTop: 8 }}>
                <div
                  style={{
                    padding: '8px 20px 6px',
                    fontSize: 10.5,
                    color: DARK.muted,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                  }}
                >
                  Recentes
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
                  {conversations.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        borderRadius: 8,
                        background: c.id === activeConversationId ? DARK.surface : 'transparent',
                        transition: 'background 150ms ease',
                      }}
                      className="conv-row"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActiveConversationId(c.id);
                          setActiveNav('conversas');
                        }}
                        style={{
                          flex: 1,
                          textAlign: 'left',
                          padding: '7px 12px',
                          border: 'none',
                          background: 'transparent',
                          color: c.id === activeConversationId ? DARK.text : DARK.muted,
                          cursor: 'pointer',
                          fontSize: 12.5,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          minWidth: 0,
                        }}
                      >
                        {c.title}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteConversation(c.id)}
                        title="Excluir conversa"
                        style={{
                          flexShrink: 0,
                          width: 22,
                          height: 22,
                          marginRight: 6,
                          borderRadius: 6,
                          border: 'none',
                          background: 'transparent',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontSize: 13,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: 0.6,
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.6'; }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* User row */}
              <div
                style={{
                  padding: '10px 14px',
                  borderTop: `1px solid ${DARK.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                {dashProfile.avatar ? (
                  <img
                    src={dashProfile.avatar}
                    alt={dashProfile.name}
                    style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <img
                    src="/images/logo-badge.jpg"
                    alt="GLX"
                    style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                  />
                )}
                <span style={{ color: DARK.muted, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {dashProfile.name}
                </span>
                <button
                  type="button"
                  onClick={handleNewConversation}
                  title="Nova conversa"
                  style={{
                    marginLeft: 'auto',
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    border: `1px solid ${DARK.border}`,
                    background: DARK.accent,
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  +
                </button>
              </div>
            </div>
          ) : null}

          {/* ── MAIN CHAT ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderBottom: `1px solid ${DARK.border}`,
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={() => setSidebarOpen((v) => !v)}
                style={{
                  width: 34, height: 34, borderRadius: '50%',
                  border: `1px solid ${DARK.border}`, background: DARK.surface,
                  color: DARK.text, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>

              {/* Model selector */}
              <select
                value={selectedModel}
                onChange={(e) => {
                  setSelectedModel(e.target.value);
                  localStorage.setItem('glx_selected_model', e.target.value);
                }}
                style={{
                  margin: '0 8px',
                  padding: '4px 8px',
                  borderRadius: 14,
                  border: `1px solid ${DARK.border}`,
                  background: DARK.surface,
                  color: DARK.muted,
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                  outline: 'none',
                  appearance: 'none',
                  maxWidth: 140,
                }}
              >
                <option value="claude-haiku-4-5-20251001">⚡ Haiku · Rápido</option>
                <option value="claude-sonnet-4-6">✦ Sonnet · Equilibrado</option>
                <option value="claude-opus-4-6">◆ Opus · Avançado</option>
              </select>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Minimizar"
                style={{
                  width: 34, height: 34, borderRadius: '50%',
                  border: `1px solid ${DARK.border}`, background: DARK.surface,
                  color: DARK.muted, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>

            {/* Content area */}
            {activeNav === 'conversas' ? (
              <>
                {isNewConversation ? (
                  /* Empty state */
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 14,
                      padding: '0 24px',
                    }}
                  >
                    <div style={{ fontSize: 20, color: DARK.text, fontWeight: 600, textAlign: 'center', lineHeight: 1.3 }}>
                      {getGreeting(lang.toLowerCase() as 'pt' | 'en' | 'es')}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 4 }}>
                      {QUICK_REPLIES.map((reply) => (
                        <button
                          key={reply}
                          type="button"
                          onClick={() => sendMessage(reply)}
                          style={{
                            borderRadius: 999,
                            border: `1px solid ${DARK.border}`,
                            background: DARK.surface,
                            color: DARK.text,
                            padding: '8px 14px',
                            fontSize: 12,
                            cursor: 'pointer',
                          }}
                        >
                          {reply}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Messages */
                  <div
                    ref={messagesViewportRef}
                    onScroll={syncJumpButton}
                    style={{
                      flex: 1,
                      overflowY: 'auto',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      position: 'relative',
                    }}
                  >
                    <style>{`
                      @keyframes glx-dot-bounce {
                        0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }
                        40% { transform: translateY(-5px); opacity: 1; }
                      }
                    `}</style>
                    {activeConversation?.messages.map((message) => (
                      <div
                        key={message.id}
                        style={{
                          alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                          display: 'flex',
                          flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
                          alignItems: 'flex-end',
                          gap: 6,
                          maxWidth: '86%',
                        }}
                      >
                        {message.role === 'assistant' && (
                          <div style={{
                            width: 22, height: 22, borderRadius: '50%', background: DARK.accent, flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 700,
                          }}>
                            A
                          </div>
                        )}
                        <div
                          style={{
                            borderRadius: 16,
                            padding: '10px 14px',
                            fontSize: 13,
                            lineHeight: 1.6,
                            background: message.content === '__CREDIT_ERROR__'
                              ? 'rgba(239,68,68,0.12)'
                              : message.role === 'user' ? DARK.accent : DARK.surface,
                            color: message.role === 'user' ? '#fff' : DARK.text,
                            whiteSpace: 'pre-line',
                            border: message.content === '__CREDIT_ERROR__' ? '1px solid rgba(239,68,68,0.35)' : 'none',
                          }}
                        >
                        {message.content === '__CREDIT_ERROR__' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span style={{ color: '#f87171', fontWeight: 600, fontSize: 13 }}>
                              ⚠️ Créditos da API esgotados.
                            </span>
                            <span style={{ color: DARK.muted, fontSize: 12 }}>
                              O limite de uso do assistente foi atingido. Entre em contato com a GLX para reativar.
                            </span>
                            <a
                              href="https://tinyurl.com/limite-claude"
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                marginTop: 2,
                                padding: '7px 12px',
                                borderRadius: 10,
                                background: '#25D366',
                                color: '#fff',
                                fontWeight: 600,
                                fontSize: 12.5,
                                textDecoration: 'none',
                                alignSelf: 'flex-start',
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                              Falar com a GLX no WhatsApp
                            </a>
                          </div>
                        ) : message.role === 'assistant' && message.content === '...' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 0' }}>
                            {[0, 0.18, 0.36].map((delay, i) => (
                              <span key={i} style={{
                                width: 7, height: 7, borderRadius: '50%',
                                background: DARK.muted,
                                display: 'inline-block',
                                animation: `glx-dot-bounce 1.1s ease-in-out ${delay}s infinite`,
                              }} />
                            ))}
                          </span>
                        ) : (
                          message.role === 'assistant' ? stripMarkdown(message.content) : message.content
                        )}
                        </div>
                      </div>
                    ))}
                    {showJumpToBottom ? (
                      <button
                        type="button"
                        onClick={() => scrollToBottom()}
                        style={{
                          position: 'sticky',
                          bottom: 4,
                          alignSelf: 'center',
                          width: 30,
                          height: 30,
                          borderRadius: '50%',
                          border: 'none',
                          background: DARK.accent,
                          color: '#fff',
                          cursor: 'pointer',
                          fontSize: 14,
                          fontWeight: 700,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        }}
                        aria-label="Ir ao fim"
                      >
                        ↓
                      </button>
                    ) : null}
                  </div>
                )}

                {/* Input bar */}
                <div style={{ padding: '10px 14px 14px', flexShrink: 0, position: 'relative' }}>
                  {/* Plus menu */}
                  {plusMenuOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 70,
                        left: 14,
                        background: '#2a2a2a',
                        border: `1px solid ${DARK.border}`,
                        borderRadius: 14,
                        overflow: 'hidden',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
                        zIndex: 30,
                        minWidth: 220,
                      }}
                    >
                      {/* File upload (hidden input) */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.ppt,.pptx"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const files = Array.from(e.target.files ?? []);
                          const newFiles = files.map(file => ({
                            name: file.name,
                            preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
                          }));
                          setAttachedFiles(prev => [...prev, ...newFiles]);
                          if (e.target) e.target.value = '';
                          setPlusMenuOpen(false);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => { setPlusMenuOpen(false); setActiveNav('projetos'); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', border: 'none', background: 'transparent', color: DARK.text, padding: '11px 16px', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
                      >
                        Adicionar ao projeto
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPlusMenuOpen(false);
                          sendMessage('Gere um resumo completo dos KPIs do dashboard atual com análise e recomendações');
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', border: 'none', background: 'transparent', color: DARK.text, padding: '11px 16px', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
                      >
                        Pesquisa
                      </button>
                      <div style={{ borderTop: `1px solid ${DARK.border}` }}>
                        <button
                          type="button"
                          onClick={() => setWebSearchOn(v => !v)}
                          style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', border: 'none', background: webSearchOn ? 'rgba(249,115,22,0.08)' : 'transparent', color: DARK.text, padding: '11px 16px', fontSize: 13, cursor: 'pointer', justifyContent: 'space-between' }}
                        >
                          <span>Busca na web</span>
                          {webSearchOn ? <span style={{ color: DARK.accent, fontSize: 15 }}>✓</span> : null}
                        </button>
                      </div>
                      <div style={{ borderTop: `1px solid ${DARK.border}` }}>
                        <button
                          type="button"
                          onClick={testClaudeApi}
                          style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', border: 'none', background: 'transparent', color: DARK.text, padding: '11px 16px', fontSize: 13, cursor: 'pointer', justifyContent: 'space-between' }}
                        >
                          <span>Testar API Claude</span>
                          <span style={{
                            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                            background: apiKeyStatus === 'ok' ? '#22c55e' : apiKeyStatus === 'testing' ? '#f59e0b' : '#ef4444',
                          }} />
                        </button>
                      </div>
                    </div>
                  )}
                  {/* Attached files chips — above input bar */}
                  {attachedFiles.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                      {attachedFiles.map((file, i) => {
                        const isPdf = file.name.toLowerCase().endsWith('.pdf');
                        const isCsv = file.name.toLowerCase().match(/\.(csv|xls|xlsx)$/);
                        const isAudio = file.name.toLowerCase().match(/\.(mp3|wav|ogg|m4a|aac)$/);
                        return (
                          <div key={i} style={{ position: 'relative', width: 80, height: 80, borderRadius: 12, overflow: 'hidden', flexShrink: 0, background: DARK.border }}>
                            {file.preview ? (
                              <img src={file.preview} alt={file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: 6 }}>
                                <span style={{ fontSize: isPdf ? 28 : isCsv ? 26 : isAudio ? 26 : 24 }}>
                                  {isPdf ? '📄' : isCsv ? '📊' : isAudio ? '🎵' : '📎'}
                                </span>
                                <span style={{ fontSize: 9, color: DARK.muted, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', padding: '0 4px' }}>
                                  {file.name.length > 12 ? file.name.slice(0, 12) + '…' : file.name}
                                </span>
                              </div>
                            )}
                            {/* Remove button */}
                            <button
                              type="button"
                              onClick={() => {
                                const f = attachedFiles[i];
                                if (f.preview) URL.revokeObjectURL(f.preview);
                                setAttachedFiles(prev => prev.filter((_, j) => j !== i));
                              }}
                              style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.65)', color: '#fff', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                            >✕</button>
                            {/* Clip icon overlay for images */}
                            {file.preview && (
                              <div style={{ position: 'absolute', top: 4, left: 4, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>📎</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: DARK.surface,
                      borderRadius: 16,
                      padding: '6px 6px 6px 10px',
                      border: `1px solid ${plusMenuOpen ? DARK.accent : DARK.border}`,
                      transition: 'border-color 150ms ease',
                    }}
                  >
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => setPlusMenuOpen(v => !v)}
                        title="Mais opções"
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: '50%',
                          border: `1px solid ${DARK.border}`,
                          background: plusMenuOpen ? DARK.accent : webSearchOn ? 'rgba(249,115,22,0.18)' : 'transparent',
                          color: plusMenuOpen ? '#fff' : webSearchOn ? DARK.accent : DARK.muted,
                          cursor: 'pointer',
                          fontSize: 20,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          lineHeight: 1,
                          transition: 'background 150ms ease, color 150ms ease',
                        }}
                      >
                        +
                      </button>
                      {/* API status dot */}
                      <div style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: apiKeyStatus === 'ok' ? '#22c55e' : apiKeyStatus === 'testing' ? '#f59e0b' : apiKeyStatus === 'missing' ? '#ef4444' : '#6b7280',
                        border: `1.5px solid ${DARK.surface}`,
                        transition: 'background 300ms ease',
                      }} />
                    </div>
                    <input
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          sendMessage(input);
                        }
                      }}
                      placeholder="Chat com Alex"
                      style={{
                        flex: 1,
                        border: 'none',
                        background: 'transparent',
                        color: DARK.text,
                        fontSize: 13,
                        outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => sendMessage(input)}
                      disabled={!canSend}
                      aria-label="Enviar"
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: '50%',
                        border: 'none',
                        background: canSend ? DARK.accent : DARK.border,
                        color: '#fff',
                        cursor: canSend ? 'pointer' : 'default',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        opacity: canSend ? 1 : 0.5,
                        transition: 'background 150ms ease, opacity 150ms ease',
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* ── PROJETOS ── */
              <>
                {activeProjectId ? (
                  /* Project chat view */
                  (() => {
                    const proj = projects.find(p => p.id === activeProjectId);
                    if (!proj) return null;
                    const canSendProj = projectInput.trim().length > 0;
                    return (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        {/* Project header */}
                        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${DARK.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => setActiveProjectId(null)}
                            style={{ border: 'none', background: 'transparent', color: DARK.muted, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 4px' }}
                          >←</button>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: DARK.text }}>{proj.name}</div>
                            {proj.description && <div style={{ fontSize: 11, color: DARK.muted, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>{proj.description}</div>}
                          </div>
                        </div>
                        {/* Messages */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {proj.messages.map(msg => (
                            <div key={msg.id} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '82%', borderRadius: 16, padding: '10px 14px', fontSize: 13, lineHeight: 1.55, background: msg.role === 'user' ? DARK.accent : DARK.surface, color: msg.role === 'user' ? '#fff' : DARK.text, whiteSpace: 'pre-line' }}>
                              {msg.role === 'assistant' ? stripMarkdown(msg.content) : msg.content}
                            </div>
                          ))}
                        </div>
                        {/* Input */}
                        <div style={{ padding: '10px 14px 14px', flexShrink: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: DARK.surface, borderRadius: 16, padding: '6px 6px 6px 10px', border: `1px solid ${DARK.border}` }}>
                            <input
                              value={projectInput}
                              onChange={e => setProjectInput(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  sendProjectMessage(proj, projectInput);
                                }
                              }}
                              placeholder={`Pergunte sobre "${proj.name}"...`}
                              style={{ flex: 1, border: 'none', background: 'transparent', color: DARK.text, fontSize: 13, outline: 'none' }}
                            />
                            <button
                              type="button"
                              disabled={!canSendProj}
                              onClick={() => sendProjectMessage(proj, projectInput)}
                              style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: canSendProj ? DARK.accent : DARK.border, color: '#fff', cursor: canSendProj ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: canSendProj ? 1 : 0.5 }}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  /* Project list view */
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    {/* Toolbar */}
                    <div style={{ padding: '12px 14px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${DARK.border}` }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: DARK.text }}>Projetos</span>
                      <button
                        type="button"
                        onClick={() => { setShowNewProject(true); setNewProjectName(''); setNewProjectDesc(''); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${DARK.border}`, borderRadius: 20, background: DARK.surface, color: DARK.text, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      >
                        + Novo projeto
                      </button>
                    </div>
                    {/* Cards */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {projects.filter(p => !p.archived).length === 0 ? (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: DARK.muted, paddingTop: 60 }}>
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                          <span style={{ fontSize: 13 }}>Nenhum projeto ainda</span>
                        </div>
                      ) : projects.filter(p => !p.archived).map(proj => (
                        <div
                          key={proj.id}
                          style={{ borderRadius: 12, border: `1px solid ${DARK.border}`, background: DARK.surface, padding: '12px 14px', cursor: 'pointer', position: 'relative' }}
                          onClick={() => { setActiveProjectId(proj.id); setProjectMenuId(null); }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: DARK.text }}>{proj.name}</div>
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); setProjectMenuId(projectMenuId === proj.id ? null : proj.id); }}
                              style={{ border: 'none', background: 'transparent', color: DARK.muted, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}
                            >···</button>
                          </div>
                          {proj.description && <div style={{ fontSize: 12, color: DARK.muted, marginTop: 4, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{proj.description}</div>}
                          <div style={{ fontSize: 11, color: DARK.muted, marginTop: 8 }}>
                            Atualizado {new Date(proj.updatedAt).toLocaleDateString('pt-BR')}
                          </div>
                          {/* Context menu */}
                          {projectMenuId === proj.id && (
                            <div
                              onClick={e => e.stopPropagation()}
                              style={{ position: 'absolute', top: 36, right: 14, background: '#2a2a2a', border: `1px solid ${DARK.border}`, borderRadius: 10, overflow: 'hidden', zIndex: 10, minWidth: 140, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
                            >
                              {[
                                { label: proj.favorited ? 'Desfavoritar' : 'Favoritar', icon: '☆', action: () => setProjects(prev => prev.map(p => p.id === proj.id ? { ...p, favorited: !p.favorited } : p)) },
                                { label: 'Arquivar', icon: '▽', action: () => { setProjects(prev => prev.map(p => p.id === proj.id ? { ...p, archived: true } : p)); setProjectMenuId(null); } },
                                { label: 'Apagar', icon: '✕', action: () => { setProjects(prev => prev.filter(p => p.id !== proj.id)); setProjectMenuId(null); }, danger: true },
                              ].map(item => (
                                <button
                                  key={item.label}
                                  type="button"
                                  onClick={() => { item.action(); if (item.label !== 'Favoritar' && item.label !== 'Desfavoritar') setProjectMenuId(null); }}
                                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 'none', background: 'transparent', color: (item as any).danger ? '#ef4444' : DARK.text, padding: '10px 14px', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
                                >
                                  <span style={{ fontSize: 14 }}>{item.icon}</span>{item.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* New project modal */}
                {showNewProject && (
                  <div
                    style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, borderRadius: 20 }}
                    onClick={() => setShowNewProject(false)}
                  >
                    <div
                      onClick={e => e.stopPropagation()}
                      style={{ background: '#1e1e1e', border: `1px solid ${DARK.border}`, borderRadius: 16, padding: '24px 20px', width: '88%', display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 20px 48px rgba(0,0,0,0.6)' }}
                    >
                      <div style={{ fontSize: 17, fontWeight: 700, color: DARK.text }}>Criar um projeto pessoal</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 12, color: DARK.muted }}>No que você está trabalhando?</label>
                        <input
                          autoFocus
                          value={newProjectName}
                          onChange={e => setNewProjectName(e.target.value)}
                          placeholder="Dê um nome ao projeto"
                          style={{ background: DARK.surface, border: `1px solid ${DARK.border}`, borderRadius: 10, padding: '10px 12px', color: DARK.text, fontSize: 13, outline: 'none' }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 12, color: DARK.muted }}>O que você quer realizar?</label>
                        <textarea
                          value={newProjectDesc}
                          onChange={e => setNewProjectDesc(e.target.value)}
                          placeholder="Descreva seu projeto, objetivos, assunto, etc..."
                          rows={4}
                          style={{ background: DARK.surface, border: `1px solid ${DARK.border}`, borderRadius: 10, padding: '10px 12px', color: DARK.text, fontSize: 13, outline: 'none', resize: 'none', fontFamily: 'inherit' }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                        <button type="button" onClick={() => setShowNewProject(false)} style={{ border: `1px solid ${DARK.border}`, background: 'transparent', color: DARK.text, borderRadius: 10, padding: '9px 16px', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                        <button
                          type="button"
                          disabled={!newProjectName.trim()}
                          onClick={() => {
                            if (!newProjectName.trim()) return;
                            const proj = createProject(newProjectName.trim(), newProjectDesc.trim());
                            setProjects(prev => [proj, ...prev]);
                            setActiveProjectId(proj.id);
                            setShowNewProject(false);
                          }}
                          style={{ border: 'none', background: newProjectName.trim() ? DARK.text : DARK.border, color: newProjectName.trim() ? DARK.main : DARK.muted, borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: newProjectName.trim() ? 'pointer' : 'default' }}
                        >Criar projeto</button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        style={{
          width: 88,
          height: 88,
          borderRadius: '50%',
          border: `2px solid ${DARK.border}`,
          background: DARK.sidebar,
          overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
          cursor: 'pointer',
          padding: 0,
        }}
        aria-label="Abrir suporte"
        title="Abrir suporte"
      >
        <img
          src="/images/logo-badge.jpg"
          alt="GLX"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </button>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(widget, document.body);
}
