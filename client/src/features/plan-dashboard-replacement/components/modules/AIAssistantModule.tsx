import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { KPISummary } from '../../data/dashboardTypes';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface CustomFact {
  id: string;
  label: string;
  value: string;
}

interface Props {
  kpis: KPISummary;
  fmt: (v: number) => string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY_FACTS  = 'glx_ai_facts_v2';
const STORAGE_KEY_CHAT   = 'glx_ai_chat_v2';
const STORAGE_KEY_APIKEY = 'glx_anthropic_key';

const PURPLE       = '#F97316';
const PURPLE_MID   = '#111111';
const PURPLE_LIGHT = '#FFF1E8';
const BLACK_SOFT   = '#1A1A1A';

const WELCOME_MSG: Message = {
  id: '__welcome__',
  role: 'assistant',
  content: 'Olá! 👋 Sou o **Assistente GLX**, sua IA especializada em performance de clínicas.\n\nJá tenho acesso em tempo real aos seus dados do dashboard. Me pergunte sobre **faturamento**, **no-show**, **NPS**, **marketing** ou qualquer métrica — vou analisar e dar recomendações práticas.',
  timestamp: new Date(),
};

// ─── System Prompt Builder ────────────────────────────────────────────────────

function buildSystemPrompt(kpis: KPISummary, fmt: (v: number) => string, facts: CustomFact[]): string {
  const roi = kpis.totalAdSpend > 0
    ? ((kpis.grossRevenue - kpis.totalAdSpend) / kpis.totalAdSpend) * 100
    : 0;

  const lines = [
    'Você é o **Assistente GLX**, uma IA especializada em análise de performance de clínicas médicas.',
    'Você tem acesso em tempo real aos dados do dashboard desta clínica. Responda sempre com base nesses dados reais.',
    'Seja objetivo, use os números específicos ao responder, inclua ícones (📋💰🚀⚙️) para organizar seções.',
    'Destaque métricas em **negrito**. Use ✅ para meta atingida, ⚠️ para atenção, 🔴 para crítico.',
    'Sempre termine respostas analíticas com recomendações práticas e acionáveis.',
    '',
    '═══ DADOS DO PERÍODO ═══',
    '',
    '📋 AGENDA & NO-SHOW',
    `• Consultas total: ${kpis.total}`,
    `• Realizadas: ${kpis.realized}`,
    `• No-Shows: ${kpis.noShows}`,
    `• Cancelamentos: ${kpis.canceled}`,
    `• Taxa de Ocupação: ${kpis.occupancyRate.toFixed(1)}% (meta > 80%)`,
    `• Taxa de No-Show: ${kpis.noShowRate.toFixed(1)}% (meta < 8%)`,
    `• Confirmações: ${kpis.confirmationRate.toFixed(1)}% (meta > 85%)`,
    `• Lead Time: ${kpis.leadTimeDays.toFixed(1)} dias (meta < 3 dias)`,
    `• Capacidade perdida: ${kpis.lostCapacityRate.toFixed(1)}%`,
    `• Custo estimado de no-show: ${fmt(kpis.noShowEstimatedCost)}`,
    '',
    '💰 FINANCEIRO',
    `• Faturamento Bruto: ${fmt(kpis.grossRevenue)}`,
    `• Receita Líquida: ${fmt(kpis.netRevenue)}`,
    `• Total de custos: ${fmt(kpis.totalCost)}`,
    `• Despesas Fixas: ${fmt(kpis.fixedExpenses)}`,
    `• Margem Líquida: ${kpis.margin.toFixed(1)}% (meta > 20%)`,
    `• EBITDA: ${fmt(kpis.ebitda)}`,
    `• Ticket Médio: ${fmt(kpis.avgTicket)}`,
    `• Inadimplência: ${kpis.inadimplenciaRate.toFixed(1)}% (meta < 4%)`,
    `• Despesas Fixas / Receita: ${kpis.fixedExpenseRatio.toFixed(1)}% (meta < 45%)`,
    `• Break-even: ${fmt(kpis.breakEven)}`,
    `• Perda por cancelamento: ${fmt(kpis.cancellationLoss)}`,
    `• Perda por inadimplência: ${fmt(kpis.inadimplenciaLoss)}`,
    '',
    '🚀 MARKETING & CAPTAÇÃO',
    `• Leads Gerados: ${kpis.leads} (meta > 80)`,
    `• CPL (Custo por Lead): ${fmt(kpis.cpl)} (meta < ${fmt(kpis.avgTicket * 0.25)})`,
    `• CAC (Custo de Aquisição): ${fmt(kpis.avgCAC)}`,
    `• Investimento em Ads: ${fmt(kpis.totalAdSpend)}`,
    `• ROI Estimado: ${roi.toFixed(0)}% (meta > 200%)`,
    '',
    '⚙️ OPERAÇÃO & EXPERIÊNCIA',
    `• NPS Geral: ${kpis.avgNPS.toFixed(1)}/10 (meta > 8,5)`,
    `• Tempo Médio de Espera: ${kpis.avgWait.toFixed(0)} min (meta < 12 min)`,
    `• Taxa de Retorno 90d: ${kpis.returnRate.toFixed(1)}% (meta > 40%)`,
    `• SLA de Resposta ao Lead: ${kpis.slaLeadHours.toFixed(2)}h (meta < 1h)`,
  ];

  if (facts.length > 0) {
    lines.push('');
    lines.push('═══ CONTEXTO PERSONALIZADO DA CLÍNICA ═══');
    facts.forEach(f => lines.push(`• ${f.label}: ${f.value}`));
  }

  lines.push('');
  lines.push('═══ FIM DOS DADOS ═══');

  return lines.join('\n');
}

// ─── Suggested Questions ─────────────────────────────────────────────────────

function getSuggestions(kpis: KPISummary): string[] {
  const q: string[] = [];
  if (kpis.noShowRate > 8)         q.push('Como reduzir o no-show?');
  if (kpis.occupancyRate < 80)     q.push('Por que minha ocupação está baixa?');
  if (kpis.margin < 20)            q.push('Como melhorar minha margem?');
  if (kpis.inadimplenciaRate > 4)  q.push('Estratégia para inadimplência?');
  if (kpis.avgNPS < 8.5)           q.push('Como aumentar o NPS?');
  if (kpis.slaLeadHours > 1)       q.push('Como melhorar o SLA de resposta?');
  q.push('Visão geral da clínica');
  q.push('Principais prioridades hoje');
  return q.slice(0, 4);
}

// ─── Markdown Renderer ───────────────────────────────────────────────────────

function MD({ text }: { text: string }) {
  return (
    <div style={{ lineHeight: 1.7 }}>
      {text.split('\n').map((line, i) => {
        if (line.startsWith('═══') || line === '') {
          return <div key={i} style={{ height: line === '' ? 4 : 'auto', fontSize: 10, color: '#a0a0a0', marginTop: 2 }}>{line}</div>;
        }
        const parts = line.split(/\*\*([^*]+)\*\*/g);
        const rendered = parts.map((part, j) =>
          j % 2 === 1 ? <strong key={j}>{part}</strong> : part
        );
        return <div key={i}>{rendered}</div>;
      })}
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(widget, document.body);
}

// ─── TypingDots ───────────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '4px 0' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: '50%', background: PURPLE,
          animation: `glxBounce 1.2s ${i * 0.2}s infinite ease-in-out`,
        }} />
      ))}
      <style>{`
        @keyframes glxBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-7px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ─── GLX Logo Button ─────────────────────────────────────────────────────────

function GLXIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <defs>
        <path id="glx-seal-top-mini" d="M 18,60 a 42,42 0 1,1 84,0" fill="none" />
        <path id="glx-seal-bottom-mini" d="M 102,60 a 42,42 0 1,1 -84,0" fill="none" />
      </defs>
      <circle cx="60" cy="60" r="58" fill="#111111" />
      <circle cx="60" cy="60" r="48" fill="none" stroke="#F97316" strokeWidth="3.2" />
      <text
        x="60"
        y="73"
        textAnchor="middle"
        fontSize="34"
        fontWeight="900"
        fill="#ffffff"
        fontFamily="Arial, sans-serif"
        letterSpacing="-1.6"
      >
        GLX
      </text>
      <text
        fill="#F97316"
        fontSize="9"
        fontWeight="900"
        fontFamily="Arial, sans-serif"
        letterSpacing="0.5"
      >
        <textPath href="#glx-seal-top-mini" startOffset="50%" textAnchor="middle">
          GROWTH.LEAN.EXECUTION
        </textPath>
      </text>
      <text
        fill="#F97316"
        fontSize="9"
        fontWeight="900"
        fontFamily="Arial, sans-serif"
        letterSpacing="0.5"
      >
        <textPath href="#glx-seal-bottom-mini" startOffset="50%" textAnchor="middle">
          GROWTH.LEAN.EXECUTION
        </textPath>
      </text>
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AIAssistantModule({ kpis, fmt }: Props) {
  const [isOpen, setIsOpen]       = useState(false);
  const [apiKey, setApiKey]       = useState<string>(() => localStorage.getItem(STORAGE_KEY_APIKEY) ?? '');
  const [messages, setMessages]   = useState<Message[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY_CHAT) || '[]')
        .map((m: Message & { timestamp: string }) => ({ ...m, timestamp: new Date(m.timestamp) }));
      return saved.length > 0 ? saved : [WELCOME_MSG];
    } catch { return []; }
  });
  const [input, setInput]           = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [facts, setFacts]           = useState<CustomFact[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY_FACTS) || '[]'); }
    catch { return []; }
  });
  const [showRag, setShowRag]   = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');
  const [error, setError]       = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const abortRef  = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isOpen) {
      setApiKey(localStorage.getItem(STORAGE_KEY_APIKEY) ?? '');
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, messages]);

  useEffect(() => {
    const nonWelcome = messages.filter(m => m.id !== '__welcome__');
    if (nonWelcome.length > 0) {
      localStorage.setItem(STORAGE_KEY_CHAT, JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => { localStorage.setItem(STORAGE_KEY_FACTS, JSON.stringify(facts)); }, [facts]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;
    setError(null);

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsStreaming(true);

    const assistantId = crypto.randomUUID();
    setStreamingId(assistantId);
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', timestamp: new Date() }]);

    if (!apiKey) {
      const normalized = text.trim().toLowerCase();
      const localReply = [
        'Resumo rapido da clinica:',
        `? Faturamento bruto: **${fmt(kpis.grossRevenue)}**`,
        `? Margem liquida: **${kpis.margin.toFixed(1)}%**`,
        `? No-show: **${kpis.noShowRate.toFixed(1)}%**`,
        `? NPS: **${kpis.avgNPS.toFixed(1)}**`,
        '',
        normalized.includes('no-show')
          ? 'Prioridade: reduzir no-show com confirmacao ativa e reengajamento no dia anterior.'
          : normalized.includes('margem') || normalized.includes('finance')
            ? 'Prioridade: proteger margem revisando custos fixos, ticket medio e inadimplencia.'
            : normalized.includes('nps') || normalized.includes('espera')
              ? 'Prioridade: atacar experiencia, tempo de espera e SLA de resposta.'
              : 'Posso te responder localmente com base nos KPIs visiveis do dashboard enquanto nenhuma API estiver configurada.',
      ].join('\n');

      window.setTimeout(() => {
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: localReply } : m));
        setIsStreaming(false);
        setStreamingId(null);
      }, 350);
      return;
    }

    const abort = new AbortController();
    abortRef.current = abort;

    const history = [...messages, userMsg]
      .filter(m => m.id !== '__welcome__')
      .slice(-20)
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: abort.signal,
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          stream: true,
          system: buildSystemPrompt(kpis, fmt, facts),
          messages: history,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
              accumulated += parsed.delta.text;
              setMessages(prev =>
                prev.map(m => m.id === assistantId ? { ...m, content: accumulated } : m)
              );
            }
          } catch { /* skip malformed SSE */ }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(msg);
      setMessages(prev => prev.filter(m => m.id !== assistantId));
    } finally {
      setIsStreaming(false);
      setStreamingId(null);
      abortRef.current = null;
    }
  }, [apiKey, isStreaming, kpis, fmt, facts, messages]);

  const addFact = useCallback(() => {
    if (!newLabel.trim() || !newValue.trim()) return;
    setFacts(prev => [...prev, { id: crypto.randomUUID(), label: newLabel.trim(), value: newValue.trim() }]);
    setNewLabel('');
    setNewValue('');
  }, [newLabel, newValue]);

  const suggestions = getSuggestions(kpis);

  // ── Floating Button + Chat Window ─────────────────────────────────────────
  const widget = (
    <>
      {/* CSS animations */}
      <style>{`
        @keyframes glxBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-7px); opacity: 1; }
        }
        @keyframes glxBlink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes glxSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes glxPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(124,58,237,0.5); }
          50%       { box-shadow: 0 0 0 8px rgba(124,58,237,0); }
        }
      `}</style>

      {/* ── Chat Window ──────────────────────────────────────────────────── */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: 90,
          right: 24,
          width: 380,
          height: 560,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 20,
          boxShadow: '0 20px 60px rgba(0,0,0,0.22), 0 4px 16px rgba(124,58,237,0.15)',
          overflow: 'hidden',
          background: 'var(--panel-bg, #fff)',
          border: `1px solid ${PURPLE}22`,
          animation: 'glxSlideUp 220ms ease',
        }}>

          {/* Header */}
          <div style={{
            background: BLACK_SOFT,
            borderTop: `6px solid ${PURPLE}`,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexShrink: 0,
          }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 800, letterSpacing: -0.4, flexShrink: 0 }}>GLX</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#fff', fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>Assistente GLX</div>
              <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 10.5, display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
                Claude · {kpis.total.toLocaleString()} consultas analisadas
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={() => setShowRag(v => !v)} title="Base de conhecimento"
                style={{ background: showRag ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 7, color: '#fff', padding: '4px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                ????
              </button>
              <button onClick={() => { setMessages([]); localStorage.removeItem(STORAGE_KEY_CHAT); }} title="Limpar"
                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 7, color: '#fff', padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>
                ????
              </button>
              <button onClick={() => setIsOpen(false)} title="Fechar"
                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 7, color: '#fff', padding: '4px 8px', fontSize: 14, cursor: 'pointer', lineHeight: 1 }}>
                ??????
              </button>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

              {/* Messages area */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

                {/* Error banner */}
                {error && (
                  <div style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca', padding: '8px 14px', fontSize: 11.5, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span>⚠️</span>
                    <span style={{ flex: 1 }}>{error}</span>
                    <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 14, fontWeight: 700 }}>×</button>
                  </div>
                )}

                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {messages.length === 0 && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                      <div style={{ width: 52, height: 52, borderRadius: '50%', background: PURPLE_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', color: PURPLE_MID, fontSize: 16, fontWeight: 800, letterSpacing: -0.5 }}>GLX</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Olá 👋</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.55, maxWidth: 260 }}>
                        Como posso te ajudar hoje?<br />Tenho seus dados em tempo real.
                      </div>
                    </div>
                  )}

                  {messages.map(msg => (
                    <div key={msg.id} style={{ display: 'flex', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8 }}>
                      {msg.role === 'assistant' && (
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: PURPLE_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', color: PURPLE_MID, fontSize: 9, fontWeight: 800, letterSpacing: -0.3, flexShrink: 0 }}>GLX</div>
                      )}
                      <div style={{
                        maxWidth: '80%',
                        padding: '10px 13px',
                        borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        background: msg.role === 'user'
                          ? `linear-gradient(135deg, ${PURPLE}, ${PURPLE_MID})`
                          : 'var(--bg-secondary, #f8fafc)',
                        color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                        fontSize: 12.5,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                        border: msg.role === 'assistant' ? '1px solid var(--border-card, #e5e7eb)' : 'none',
                        wordBreak: 'break-word',
                      }}>
                        {msg.role === 'assistant'
                          ? (msg.id === streamingId && msg.content === '')
                            ? <TypingDots />
                            : <MD text={msg.content} />
                          : msg.content}
                        {msg.id === streamingId && msg.content !== '' && (
                          <span style={{ display: 'inline-block', width: 2, height: '1em', background: PURPLE, marginLeft: 2, animation: 'glxBlink 1s infinite', verticalAlign: 'text-bottom' }} />
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>

                {/* Suggestion chips */}
                {messages.length <= 1 && !isStreaming && (
                  <div style={{ padding: '4px 12px 6px', display: 'flex', flexWrap: 'wrap', gap: 5, flexShrink: 0 }}>
                    {suggestions.map(q => (
                      <button key={q} onClick={() => send(q)}
                        style={{ background: PURPLE_LIGHT, border: `1px solid ${PURPLE}33`, color: PURPLE, borderRadius: 14, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                        ↗ {q}
                      </button>
                    ))}
                  </div>
                )}

                {/* Input */}
                <div style={{ padding: '8px 12px 12px', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, borderTop: '1px solid var(--border-card, #e5e7eb)' }}>
                  {isStreaming && (
                    <button onClick={() => abortRef.current?.abort()}
                      style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                      ■
                    </button>
                  )}
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
                    placeholder="Pergunte algo..."
                    disabled={isStreaming}
                    style={{
                      flex: 1, border: `1.5px solid ${PURPLE}44`, borderRadius: 20, padding: '9px 14px',
                      fontSize: 12.5, outline: 'none',
                      background: 'var(--panel-bg, #fff)', color: 'var(--text-primary)',
                      opacity: isStreaming ? 0.6 : 1,
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = PURPLE; }}
                    onBlur={e => { e.currentTarget.style.borderColor = `${PURPLE}44`; }}
                  />
                  <button
                    onClick={() => send(input)}
                    disabled={!input.trim() || isStreaming}
                    style={{
                      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                      background: input.trim() && !isStreaming ? `linear-gradient(135deg, ${PURPLE}, ${PURPLE_MID})` : '#e5e7eb',
                      border: 'none', cursor: input.trim() && !isStreaming ? 'pointer' : 'default',
                      color: '#fff', fontSize: 16,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    ↑
                  </button>
                </div>

                <div style={{ textAlign: 'center', fontSize: 9.5, color: 'var(--text-muted)', paddingBottom: 8, flexShrink: 0 }}>
                  O Assistente GLX pode cometer erros. Confirme no dashboard.
                </div>
              </div>

              {/* ── RAG Slide-in ──────────────────────────────────────────── */}
              {showRag && (
                <div style={{
                  width: 210, flexShrink: 0,
                  borderLeft: '1px solid var(--border-card, #e5e7eb)',
                  background: 'var(--panel-bg, #fff)',
                  display: 'flex', flexDirection: 'column', overflow: 'hidden',
                }}>
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-card, #e5e7eb)', background: PURPLE_LIGHT }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: PURPLE }}>📚 Base de Conhecimento</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Contexto enviado ao Claude</div>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--text-muted)', marginBottom: 2 }}>Auto (dashboard)</div>
                    {[
                      { label: 'Consultas',    value: kpis.realized.toString() },
                      { label: 'Faturamento',  value: fmt(kpis.grossRevenue) },
                      { label: 'Ticket Médio', value: fmt(kpis.avgTicket) },
                      { label: 'NPS',          value: kpis.avgNPS.toFixed(1) },
                      { label: 'Margem',       value: `${kpis.margin.toFixed(1)}%` },
                    ].map(f => (
                      <div key={f.label} style={{ background: '#f8fafc', borderRadius: 6, padding: '5px 8px', fontSize: 11, display: 'flex', justifyContent: 'space-between', gap: 4, border: '1px solid #e5e7eb' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{f.label}</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 10.5 }}>{f.value}</span>
                      </div>
                    ))}

                    <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--text-muted)', marginTop: 8, marginBottom: 2 }}>Treinável</div>
                    {facts.length === 0 && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '6px 0' }}>Nenhum contexto ainda.</div>
                    )}
                    {facts.map(f => (
                      <div key={f.id} style={{ background: PURPLE_LIGHT, borderRadius: 6, padding: '6px 8px', fontSize: 11, display: 'flex', alignItems: 'flex-start', gap: 4, border: `1px solid ${PURPLE}22` }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, color: PURPLE, fontSize: 10.5 }}>{f.label}</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: 10.5 }}>{f.value}</div>
                        </div>
                        <button onClick={() => setFacts(prev => prev.filter(x => x.id !== f.id))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 13, padding: 0, lineHeight: 1 }}>×</button>
                      </div>
                    ))}
                  </div>

                  <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border-card, #e5e7eb)', display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
                      placeholder="Categoria"
                      style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 8px', fontSize: 11, background: 'var(--panel-bg, #fff)', color: 'var(--text-primary)', outline: 'none' }} />
                    <input value={newValue} onChange={e => setNewValue(e.target.value)}
                      placeholder="Valor"
                      onKeyDown={e => { if (e.key === 'Enter') addFact(); }}
                      style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 8px', fontSize: 11, background: 'var(--panel-bg, #fff)', color: 'var(--text-primary)', outline: 'none' }} />
                    <button onClick={addFact} disabled={!newLabel.trim() || !newValue.trim()}
                      style={{
                        background: newLabel.trim() && newValue.trim() ? PURPLE : '#e5e7eb',
                        border: 'none', borderRadius: 6, color: '#fff', padding: '7px', fontSize: 11, fontWeight: 700,
                        cursor: newLabel.trim() && newValue.trim() ? 'pointer' : 'default',
                      }}>
                      + Adicionar ao RAG
                    </button>
                  </div>
                </div>
              )}
            </div>
        </div>
      )}

      {/* ── Floating Button ──────────────────────────────────────────────────── */}
      <button
        onClick={() => setIsOpen(v => !v)}
        title="Assistente GLX IA"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: BLACK_SOFT,
          border: `3px solid ${PURPLE}`,
          boxShadow: isOpen
            ? `0 4px 20px rgba(249,115,22,0.35)`
            : `0 4px 20px rgba(17,17,17,0.28)`,
          cursor: 'pointer',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 200ms ease, box-shadow 200ms ease',
          animation: !apiKey && !isOpen ? 'glxPulse 2.5s infinite' : undefined,
          transform: isOpen ? 'scale(0.95)' : 'scale(1)',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = isOpen ? 'scale(0.95)' : 'scale(1)'; }}
      >
        {isOpen ? (
          <span style={{ color: '#fff', fontSize: 20, lineHeight: 1 }}>╲╱</span>
        ) : (
          <GLXIcon />
        )}
        {/* Unread dot when closed and has messages */}
        {!isOpen && messages.filter(m => m.id !== '__welcome__').length > 0 && (
          <span style={{
            position: 'absolute', top: 3, right: 3,
            width: 12, height: 12, borderRadius: '50%',
            background: '#4ade80', border: '2px solid #fff',
          }} />
        )}
      </button>
    </>
  );
}
