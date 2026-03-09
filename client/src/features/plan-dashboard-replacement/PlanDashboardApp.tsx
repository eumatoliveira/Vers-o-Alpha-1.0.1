import { useState, useEffect, useMemo, useCallback, useRef, memo, KeyboardEvent, MouseEvent, useDeferredValue, startTransition } from 'react';
import { Redirect, useLocation } from 'wouter';
import { Bell, CircleHelp, Menu, Moon, Settings, Sun, X } from 'lucide-react';
import { useAuth } from '@/_core/hooks/useAuth';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Language } from '@/i18n/index';
import { normalizePlanTier } from '@shared/controlTowerRules';
import { trpc } from '@/lib/trpc';
import EssentialDashboard from './components/EssentialDashboard';
import ProDashboard from './components/ProDashboard';
import EnterpriseDashboard from './components/EnterpriseDashboard';
import { Filters, controlTowerFactsToAppointments, defaultFilters } from './data/mockData';
import { buildDashboardCsv, extractDashboardSections } from './utils/csvExport';
import { exportDashboardHealthPDF, exportDashboardPDF } from './utils/pdfExport';
import { getDashboardExportPolicy } from './utils/exportPolicy';
import { buildDashboardApiFilters } from './utils/filterState';
import { translateDashboardText, useTranslation } from './i18n';
import { resolveKpiMeta, type KpiMeta, type KpiSourceMode } from './utils/kpiMeta';
import './scoped.css';

type Theme = 'dark' | 'light';
type Lang = 'PT' | 'EN' | 'ES';
type Plan = 'ESSENTIAL' | 'PRO' | 'ENTERPRISE';
type NotificationMode = 'all' | 'critical' | 'off';
type NotificationEntry = {
  id: string;
  badgeType: '' | 'danger' | 'info' | 'success';
  badge: string;
  title: string;
  desc: string;
  time: string;
  severityScore: number;
  auto?: boolean;
};

function toDashboardLang(language: Language): Lang {
  if (language === 'en') return 'EN';
  if (language === 'es') return 'ES';
  return 'PT';
}

function toAppLanguage(language: Lang): Language {
  if (language === 'EN') return 'en';
  if (language === 'ES') return 'es';
  return 'pt';
}

function toDashboardPlan(plan: string | null | undefined): Plan {
  const normalized = normalizePlanTier(plan);
  if (normalized === 'enterprise') return 'ENTERPRISE';
  if (normalized === 'pro') return 'PRO';
  return 'ESSENTIAL';
}

function planLabel(plan: Plan): string {
  if (plan === 'ENTERPRISE') return 'Enterprise';
  if (plan === 'PRO') return 'Pro';
  return 'Essential';
}

function getExplainActionLabel(language: Language) {
  if (language === 'en') return 'open calculation and source';
  if (language === 'es') return 'abrir cálculo y fuente';
  return 'abrir cálculo e fonte';
}

function translateKpiMeta(meta: KpiMeta, language: Language): KpiMeta {
  return {
    ...meta,
    label: translateDashboardText(meta.label, language),
    formula: translateDashboardText(meta.formula, language),
    howToCalculate: translateDashboardText(meta.howToCalculate, language),
    sources: meta.sources.map((source) => translateDashboardText(source, language)),
    fields: meta.fields,
    note: meta.note ? translateDashboardText(meta.note, language) : undefined,
  };
}

function translateRenderedDashboard(root: HTMLElement | null, language: Language) {
  if (!root || language === 'pt') return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }

  nodes.forEach((node) => {
    const raw = node.textContent;
    if (!raw) return;
    const trimmed = raw.trim();
    if (!trimmed) return;
    const translated = translateDashboardText(trimmed, language);
    if (translated !== trimmed) {
      node.textContent = raw.replace(trimmed, translated);
    }
  });
}

function resolveExportRole(user: unknown): string {
  if (!user || typeof user !== 'object') return 'CLIENTE';
  const record = user as Record<string, unknown>;
  const metadata = record.metadata && typeof record.metadata === 'object' ? record.metadata as Record<string, unknown> : null;
  const candidate =
    record.dashboardRole ??
    record.profileRole ??
    metadata?.dashboardRole ??
    metadata?.profileRole ??
    metadata?.role ??
    record.role ??
    'cliente';

  return String(candidate).trim().toUpperCase();
}

const sidebarMenus: Record<Plan, { items: string[] }> = {
  ESSENTIAL: { items: ['Visão CEO', 'Agenda & No-Show', 'Financeiro Executivo', 'Marketing & Captação', 'Operação & Experiência'] },
  PRO: { items: ['Visão CEO', 'War Room', 'Financeiro Avançado', 'Agenda/Otimização', 'Marketing/Unit Economics', 'Integrações', 'Operação & Experiência', 'Equipe'] },
  ENTERPRISE: { items: ['Visão CEO', 'War Room', 'Financeiro — Investidor', 'Agenda/Otimização', 'Marketing/Unit Economics', 'Multi-Unidade', 'Integrações', 'Operação & Experiência', 'Equipe', 'Governança'] },
};

const i18n: Record<Lang, Record<string, string>> = {
  PT: {
    painelEssencial: 'Painel Essencial', painelPro: 'Painel Pro', painelEnterprise: 'Painel Enterprise',
    subtitleEssencial: 'Dashboard executivo para clínicas em estruturação',
    subtitlePro: 'Otimização inteligente por profissional, serviço e canal',
    subtitleEnterprise: 'Inteligência de rede multi-unidade para investidores',
    dadosVivo: '• Dados ao vivo', help: 'Help', atualizar: 'Atualizar',
    exportCsv: 'Exportar CSV', exportPdf: 'Exportar PDF', sair: 'Sair',
    perfil: 'PERFIL', plano: 'PLANO', idioma: 'IDIOMA',
    escuro: 'Escuro', claro: 'Claro',
    refreshMsg: 'Dados atualizados!', csvMsg: 'CSV exportado!', pdfMsg: 'PDF gerado com sucesso!',
    pdfGenerating: 'Gerando PDF...',
  },
  EN: {
    painelEssencial: 'Essential Panel', painelPro: 'Pro Panel', painelEnterprise: 'Enterprise Panel',
    subtitleEssencial: 'Executive dashboard for clinics in structuring',
    subtitlePro: 'Smart optimization by professional, service and channel',
    subtitleEnterprise: 'Multi-unit network intelligence for investors',
    dadosVivo: '• Live Data', help: 'Help', atualizar: 'Refresh',
    exportCsv: 'Export CSV', exportPdf: 'Export PDF', sair: 'Logout',
    perfil: 'PROFILE', plano: 'PLAN', idioma: 'LANGUAGE',
    escuro: 'Dark', claro: 'Light',
    refreshMsg: 'Data refreshed!', csvMsg: 'CSV exported!', pdfMsg: 'PDF generated!',
    pdfGenerating: 'Generating PDF...',
  },
  ES: {
    painelEssencial: 'Panel Esencial', painelPro: 'Panel Pro', painelEnterprise: 'Panel Enterprise',
    subtitleEssencial: 'Dashboard ejecutivo para clínicas en estructuración',
    subtitlePro: 'Optimización inteligente por profesional, servicio y canal',
    subtitleEnterprise: 'Inteligencia de red multi-unidad para inversores',
    dadosVivo: '• Datos en vivo', help: 'Ayuda', atualizar: 'Actualizar',
    exportCsv: 'Exportar CSV', exportPdf: 'Exportar PDF', sair: 'Salir',
    perfil: 'PERFIL', plano: 'PLAN', idioma: 'IDIOMA',
    escuro: 'Oscuro', claro: 'Claro',
    refreshMsg: '¡Datos actualizados!', csvMsg: '¡CSV exportado!', pdfMsg: '¡PDF generado!',
    pdfGenerating: 'Generando PDF...',
  },
};

const exportLocaleByLang: Record<Lang, string> = {
  PT: 'pt-BR',
  EN: 'en-US',
  ES: 'es-ES',
};

const csvLabelsByLang: Record<Lang, Parameters<typeof buildDashboardCsv>[0]["labels"]> = {
  PT: {
    exportTitle: 'Export GLX Dashboard',
    report: 'Relatório',
    plan: 'Plano',
    currency: 'Moeda',
    generatedAt: 'Gerado em',
    activeFilters: 'Filtros ativos',
    tab: 'Aba',
    kpis: 'KPIs',
    indicator: 'Indicador',
    value: 'Valor',
    table: 'Tabela',
  },
  EN: {
    exportTitle: 'GLX Dashboard Export',
    report: 'Report',
    plan: 'Plan',
    currency: 'Currency',
    generatedAt: 'Generated at',
    activeFilters: 'Active filters',
    tab: 'Tab',
    kpis: 'KPIs',
    indicator: 'Indicator',
    value: 'Value',
    table: 'Table',
  },
  ES: {
    exportTitle: 'Exportación Dashboard GLX',
    report: 'Informe',
    plan: 'Plan',
    currency: 'Moneda',
    generatedAt: 'Generado en',
    activeFilters: 'Filtros activos',
    tab: 'Pestaña',
    kpis: 'KPIs',
    indicator: 'Indicador',
    value: 'Valor',
    table: 'Tabla',
  },
};

const pdfLabelsByLang = {
  PT: {
    page: 'Página',
    of: 'de',
    confidential: 'GLX Performance Control Tower - Confidencial',
    rights: '© 2026 GLX Partners. Todos os direitos reservados.',
    tab: 'Aba',
    indicator: 'Indicador / KPI',
    consolidatedValue: 'Valor consolidado',
    detail: 'Detalhamento',
  },
  EN: {
    page: 'Page',
    of: 'of',
    confidential: 'GLX Performance Control Tower - Confidential',
    rights: '© 2026 GLX Partners. All rights reserved.',
    tab: 'Tab',
    indicator: 'Indicator / KPI',
    consolidatedValue: 'Consolidated value',
    detail: 'Detail',
  },
  ES: {
    page: 'Página',
    of: 'de',
    confidential: 'GLX Performance Control Tower - Confidencial',
    rights: '© 2026 GLX Partners. Todos los derechos reservados.',
    tab: 'Pestaña',
    indicator: 'Indicador / KPI',
    consolidatedValue: 'Valor consolidado',
    detail: 'Detalle',
  },
};

const exportFilterLabelsByLang: Record<Lang, { period: string; channel: string; professional: string; procedure: string; status: string; unit: string; severity: string; all: string; }> = {
  PT: {
    period: 'Período',
    channel: 'Canal',
    professional: 'Profissional',
    procedure: 'Procedimento',
    status: 'Status',
    unit: 'Unidade',
    severity: 'Severidade',
    all: 'todos',
  },
  EN: {
    period: 'Period',
    channel: 'Channel',
    professional: 'Professional',
    procedure: 'Procedure',
    status: 'Status',
    unit: 'Unit',
    severity: 'Severity',
    all: 'all',
  },
  ES: {
    period: 'Período',
    channel: 'Canal',
    professional: 'Profesional',
    procedure: 'Procedimiento',
    status: 'Estado',
    unit: 'Unidad',
    severity: 'Severidad',
    all: 'todos',
  },
};

function normalizeAlertText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

function statusSeverityScore(value: string) {
  const normalized = normalizeAlertText(value);
  if (!normalized) return 0;
  if (normalized.includes('P1') || normalized.includes('CRITIC')) return 3;
  if (normalized.includes('P2') || normalized.includes('WARN') || normalized.includes('ATENC')) return 2;
  if (normalized.includes('P3')) return 1;
  if (normalized.includes('OK')) return 0;
  return 0;
}

function severityPresentation(score: number) {
  if (score >= 3) return { badgeType: 'danger' as const, badge: 'P1' };
  if (score >= 2) return { badgeType: '' as const, badge: 'P2' };
  return { badgeType: 'info' as const, badge: 'P3' };
}

function extractDashboardAlerts(root: HTMLElement | null) {
  if (!root) return [] as Array<{ key: string; section: string; metric: string; value: string; target: string; status: string; score: number }>;

  const rows: Array<{ key: string; section: string; metric: string; value: string; target: string; status: string; score: number }> = [];
  root.querySelectorAll<HTMLTableRowElement>('.data-table tbody tr').forEach((row) => {
    const cells = Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.replace(/\s+/g, ' ').trim() ?? '');
    if (cells.length < 4) return;

    const section =
      row.closest('.chart-card')?.querySelector('.chart-card-title')?.textContent?.replace(/\s+/g, ' ').trim() ??
      row.closest('.pdf-export-section')?.getAttribute('data-title')?.trim() ??
      'Dashboard';

    const metric = cells.length >= 6 ? cells[1] : cells[0];
    const value = cells.length >= 6 ? cells[2] : cells[1];
    const target = cells.length >= 6 ? cells[3] : cells[2];
    const status = cells.length >= 6 ? cells[cells.length - 2] : cells[cells.length - 1];
    const score = statusSeverityScore(status);

    if (!metric || score <= 0) return;

    rows.push({
      key: `${section}::${metric}`,
      section,
      metric,
      value,
      target,
      status,
      score,
    });
  });

  return rows;
}

function formatNotificationTime(language: Language) {
  const locale = language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'pt-BR';
  return new Date().toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function notificationModeAllows(mode: NotificationMode, score: number) {
  if (mode === 'off') return false;
  if (mode === 'critical') return score >= 3;
  return score >= 2;
}

const initialNotifications = [
  { id: '1', badgeType: 'danger', badge: 'P1', title: 'CAC acima do teto', desc: 'R$ 185 vs meta de R$ 150. Google Ads principal ofensor.', time: 'Hoje, 11:15' },
  { id: '2', badgeType: '', badge: 'P2', title: 'No-Show acima da meta', desc: 'Taxa de 12.5% meta < 10%. 3 semanas consecutivas.', time: 'Hoje, 14:30' },
  { id: '3', badgeType: 'info', badge: 'i', title: 'Relatório semanal disponível', desc: 'Semana 08/2026 processada com sucesso.', time: 'Ontem, 18:00' },
  { id: '4', badgeType: 'success', badge: '✓', title: 'Meta de ocupação atingida', desc: '78% acima da meta de 75%.', time: 'Ontem, 09:00' },
];

const NotificationItem = memo(({ item, isRemoved, onToggleRemove }: { item: NotificationEntry, isRemoved: boolean, onToggleRemove: (id: string, remove: boolean) => void }) => {
  if (isRemoved) {
    return (
      <div className="notif-item deleted" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', border: '1px solid var(--border)', borderRadius: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Notificação removida.</span>
        <button className="text-btn" style={{ padding: '6px 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer' }} onClick={() => onToggleRemove(item.id, false)}>
          ↩ Desfazer
        </button>
      </div>
    );
  }

  return (
    <div className="notif-item" style={{ position: 'relative', paddingRight: 32 }}>
      <div className={`notif-badge ${item.badgeType}`}>{item.badge}</div>
      <div>
        <strong>{item.title}</strong>
        <p>{item.desc}</p>
        <span className="notif-time">{item.time}</span>
      </div>
      <button
        className="notif-close-btn"
        style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
        onClick={() => onToggleRemove(item.id, true)}
        title="Excluir notificação"
      >
        <X size={16} />
      </button>
    </div>
  );
});

const NotificationPanel = memo(({ notifications, onClose, removedNotifs, onToggleRemove }: { notifications: NotificationEntry[], onClose: () => void, removedNotifs: Set<string>, onToggleRemove: (id: string, remove: boolean) => void }) => (
  <div className="overlay-backdrop" onClick={onClose}>
    <div className="overlay-panel" onClick={e => e.stopPropagation()} style={{ width: 380 }}>
      <div className="overlay-header">
        <h3>Notificações</h3>
        <button className="overlay-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
      </div>
      <div className="overlay-body">
        {notifications.length > 0 ? notifications.map(n => <NotificationItem key={n.id} item={n} isRemoved={removedNotifs.has(n.id)} onToggleRemove={onToggleRemove} />) : <div className="notif-item"><strong>Sem notificaÃ§Ãµes novas.</strong></div>}
      </div>
    </div>
  </div>
));

const SettingsPanel = memo(({ onClose, theme, setTheme, lang, setLang }: { onClose: () => void; theme: Theme; setTheme: (t: Theme) => void; lang: Lang; setLang: (l: Lang) => void }) => (
  <div className="overlay-backdrop" onClick={onClose}>
    <div className="overlay-panel" onClick={e => e.stopPropagation()} style={{ width: 360 }}>
      <div className="overlay-header"><h3>Configurações</h3><button className="overlay-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button></div>
      <div className="overlay-body">
        <div className="settings-group"><label>Tema</label><div className="selector-row"><button className={`selector-btn ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme('dark')}>Escuro</button><button className={`selector-btn ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')}>Claro</button></div></div>
        <div className="settings-group"><label>Idioma</label><div className="selector-row">{(['PT', 'EN', 'ES'] as Lang[]).map(l => <button key={l} className={`selector-btn ${lang === l ? 'active' : ''}`} onClick={() => setLang(l)}>{l}</button>)}</div></div>
        <div className="settings-group"><label>Refresh automático</label><select className="filter-select" style={{ width: '100%' }}><option>Desligado</option><option>30 segundos</option><option>1 minuto</option><option>5 minutos</option></select></div>
        <div className="settings-group"><label>Notificações</label><select className="filter-select" style={{ width: '100%' }}><option>Ativadas</option><option>Apenas críticas</option><option>Desativadas</option></select></div>
      </div>
    </div>
  </div>
));

const HelpPanel = memo(({ onClose }: { onClose: () => void }) => (
  <div className="overlay-backdrop" onClick={onClose}>
    <div className="overlay-panel" onClick={e => e.stopPropagation()} style={{ width: 420 }}>
      <div className="overlay-header"><h3>Central de Ajuda</h3><button className="overlay-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button></div>
      <div className="overlay-body">
        <div className="help-section"><h4>Filtros</h4><p>Use os filtros globais para segmentar KPIs e gráficos por período, canal, profissional, procedimento, unidade ou severidade.</p></div>
        <div className="help-section"><h4>Drill-Down</h4><p>Clique em qualquer barra ou segmento nos gráficos para filtrar automaticamente. Um segundo clique desfaz o filtro.</p></div>
        <div className="help-section"><h4>Planos</h4><p><strong>Essential:</strong> 5 módulos básicos.</p><p><strong>Pro:</strong> 8 módulos com War Room, Heatmaps e Unit Economics.</p><p><strong>Enterprise:</strong> 10 módulos com Valuation, Multi-Unidade e Governança.</p></div>
        <div className="help-section"><h4>Exportação</h4><p><strong>CSV:</strong> Dados tabelados filtrados. <strong>PDF:</strong> Relatório visual com branding GLX para stakeholders.</p></div>
      </div>
    </div>
  </div>
));

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return <div className="toast-container"><div className="toast">{message}</div></div>;
}

const KpiExplainPanel = memo(({ meta, onClose }: { meta: KpiMeta; onClose: () => void }) => (
  <div className="overlay-backdrop" onClick={onClose}>
    <div className="overlay-panel kpi-explain-panel" onClick={e => e.stopPropagation()}>
      <div className="overlay-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CircleHelp size={18} />
          <h3>{meta.label}</h3>
        </div>
        <button className="overlay-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
      </div>
      <div className="overlay-body">
        <div className="kpi-explain-section">
          <label>Como calcular</label>
          <strong>{meta.formula}</strong>
          <p>{meta.howToCalculate}</p>
        </div>
        <div className="kpi-explain-section">
          <label>Fonte do dado</label>
          <ul className="kpi-explain-list">
            {meta.sources.map((source) => <li key={source}>{source}</li>)}
          </ul>
        </div>
        <div className="kpi-explain-section">
          <label>Campos usados</label>
          <div className="kpi-explain-tags">
            {meta.fields.map((field) => <span key={field}>{field}</span>)}
          </div>
        </div>
        {meta.note ? (
          <div className="kpi-explain-note">
            {meta.note}
          </div>
        ) : null}
      </div>
    </div>
  </div>
));

const SettingsPanelWithNotifications = memo(({ onClose, theme, setTheme, lang, setLang, notificationMode, setNotificationMode }: { onClose: () => void; theme: Theme; setTheme: (t: Theme) => void; lang: Lang; setLang: (l: Lang) => void; notificationMode: NotificationMode; setNotificationMode: (mode: NotificationMode) => void }) => (
  <div className="overlay-backdrop" onClick={onClose}>
    <div className="overlay-panel" onClick={e => e.stopPropagation()} style={{ width: 360 }}>
      <div className="overlay-header"><h3>ConfiguraÃ§Ãµes</h3><button className="overlay-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button></div>
      <div className="overlay-body">
        <div className="settings-group"><label>Tema</label><div className="selector-row"><button className={`selector-btn ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme('dark')}>Escuro</button><button className={`selector-btn ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')}>Claro</button></div></div>
        <div className="settings-group"><label>Idioma</label><div className="selector-row">{(['PT', 'EN', 'ES'] as Lang[]).map(l => <button key={l} className={`selector-btn ${lang === l ? 'active' : ''}`} onClick={() => setLang(l)}>{l}</button>)}</div></div>
        <div className="settings-group"><label>Refresh automÃ¡tico</label><select className="filter-select" style={{ width: '100%' }}><option>Desligado</option><option>30 segundos</option><option>1 minuto</option><option>5 minutos</option></select></div>
        <div className="settings-group"><label>NotificaÃ§Ãµes</label><select className="filter-select" style={{ width: '100%' }} value={notificationMode} onChange={(event) => setNotificationMode(event.target.value as NotificationMode)}><option value="all">Ativadas</option><option value="critical">Apenas crÃ­ticas</option><option value="off">Desativadas</option></select></div>
      </div>
    </div>
  </div>
));

function PlanDashboardApp() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const {
    currency,
    baseCurrency,
    supportedCurrencies,
    lastUpdatedAt,
    rate,
    stale: currencyStale,
    warning: currencyWarning,
    setCurrency,
  } = useCurrency();
  const { language, setLanguage } = useLanguage();
  const { t: translateText } = useTranslation();
  const userPlan = toDashboardPlan((user as any)?.plan);
  const [activePlan, setActivePlan] = useState<Plan>(userPlan);
  const [activeMenuItem, setActiveMenuItem] = useState(0);
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark';
    return window.localStorage.getItem('glx-dashboard-theme') === 'light' ? 'light' : 'dark';
  });
  const deferredTheme = useDeferredValue(theme);
  const [lang, setLang] = useState<Lang>(() => toDashboardLang(language));
  const [notificationMode, setNotificationMode] = useState<NotificationMode>(() => {
    if (typeof window === 'undefined') return 'all';
    const stored = window.localStorage.getItem('glx-dashboard-notification-mode');
    return stored === 'critical' || stored === 'off' || stored === 'all' ? stored : 'all';
  });
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [removedNotifs, setRemovedNotifs] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [pdfExportMode, setPdfExportMode] = useState<"executive" | "investor" | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [selectedKpiMeta, setSelectedKpiMeta] = useState<KpiMeta | null>(null);
  const contentRef = useRef<HTMLElement>(null);
  const appRootRef = useRef<HTMLDivElement>(null);
  const exportContentRef = useRef<HTMLDivElement>(null);
  const previousAlertsRef = useRef<Map<string, number>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);

  const handleToggleNotif = useCallback((id: string, remove: boolean) => {
    setRemovedNotifs(prev => {
      const next = new Set(prev);
      if (remove) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const playAlertTone = useCallback(async (score: number) => {
    if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return;

    const context = audioContextRef.current ?? new AudioContext();
    audioContextRef.current = context;

    try {
      if (context.state === 'suspended') {
        await context.resume();
      }

      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = score >= 3 ? 'sawtooth' : 'square';
      oscillator.frequency.setValueAtTime(score >= 3 ? 880 : 660, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (score >= 3 ? 0.35 : 0.22));

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + (score >= 3 ? 0.38 : 0.24));
    } catch (error) {
      console.warn('Alert audio unavailable:', error);
    }
  }, []);

  const visibleNotifications = useMemo(
    () => notifications.filter((item) => notificationModeAllows(notificationMode, item.severityScore)),
    [notificationMode, notifications],
  );
  const activeNotifCount = visibleNotifications.filter((item) => !removedNotifs.has(item.id)).length;
  const hasUnreadCriticalNotification = visibleNotifications.some((item) => !removedNotifs.has(item.id) && item.severityScore >= 3);
  const hasUnreadWarningNotification = visibleNotifications.some((item) => !removedNotifs.has(item.id) && item.severityScore >= 2);

  const t = useMemo(() => i18n[lang], [lang]);
  const menu = sidebarMenus[activePlan];
  const titleKey = activePlan === 'ESSENTIAL' ? 'painelEssencial' : activePlan === 'PRO' ? 'painelPro' : 'painelEnterprise';
  const subtitleKey = activePlan === 'ESSENTIAL' ? 'subtitleEssencial' : activePlan === 'PRO' ? 'subtitlePro' : 'subtitleEnterprise';
  const activeFilterCount = [filters.channel, filters.professional, filters.procedure, filters.status, filters.unit, filters.severity].filter(Boolean).length;
  const profileName = (user as any)?.name || 'Cliente';
  const profileEmail = (user as any)?.email || '';
  const profileRole = String((user as any)?.role || 'cliente').toUpperCase();
  const exportRole = useMemo(() => resolveExportRole(user), [user]);
  const exportPolicy = useMemo(
    () => getDashboardExportPolicy(activePlan, exportRole, activeMenuItem),
    [activeMenuItem, activePlan, exportRole],
  );
  const pdfLoading = pdfExportMode !== null;
  const apiFilters = useMemo(() => buildDashboardApiFilters(filters), [filters]);
  const dashboardQuery = trpc.controlTower.getDashboardData.useQuery(apiFilters, {
    refetchOnWindowFocus: false,
    staleTime: 20_000,
  });
  const apiAppointments = useMemo(
    () => controlTowerFactsToAppointments(dashboardQuery.data?.facts ?? []),
    [dashboardQuery.data?.facts],
  );
  const resolvedAppointments = dashboardQuery.isSuccess && apiAppointments.length > 0 ? apiAppointments : undefined;
  const kpiSourceMode: KpiSourceMode = dashboardQuery.isSuccess && apiAppointments.length > 0 ? 'integrated' : 'fallback';
  const translatedKpiMeta = useMemo(
    () => (selectedKpiMeta ? translateKpiMeta(selectedKpiMeta, language) : null),
    [language, selectedKpiMeta],
  );

  useEffect(() => {
    const next = toDashboardLang(language);
    setLang(prev => (prev === next ? prev : next));
  }, [language]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('glx-dashboard-notification-mode', notificationMode);
  }, [notificationMode]);

  useEffect(() => {
    appRootRef.current?.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    setActivePlan(prev => (prev === userPlan ? prev : userPlan));
    setActiveMenuItem(0);
    setFilters(defaultFilters);
  }, [userPlan]);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [activeMenuItem, activePlan]);

  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;

    const cards = root.querySelectorAll<HTMLElement>('.overview-card');
    cards.forEach((card) => {
      const label = card.querySelector('.overview-card-label')?.textContent?.trim();
      if (!label) return;
      card.dataset.kpiTitle = label;
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `${translateDashboardText(label, language)}: ${getExplainActionLabel(language)}`);
      card.classList.add('kpi-explainer-target');
    });
  }, [activeMenuItem, activePlan, dashboardQuery.data, filters, language, refreshKey, resolvedAppointments]);

  useEffect(() => {
    translateRenderedDashboard(document.querySelector('.glx-plan-dashboard-root'), language);
    translateRenderedDashboard(contentRef.current, language);
    translateRenderedDashboard(exportContentRef.current, language);
  }, [language, activeMenuItem, activePlan, dashboardQuery.data, resolvedAppointments, filters, pdfExportMode, selectedKpiMeta, showHelp, showNotifications, showSettings]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const alerts = extractDashboardAlerts(contentRef.current);
      if (alerts.length === 0) return;

      const nextSnapshot = new Map<string, number>();
      alerts.forEach((alert) => nextSnapshot.set(alert.key, alert.score));

      if (previousAlertsRef.current.size === 0) {
        previousAlertsRef.current = nextSnapshot;
        return;
      }

      const regressions = alerts.filter((alert) => notificationModeAllows(notificationMode, alert.score) && alert.score > (previousAlertsRef.current.get(alert.key) ?? 0));
      previousAlertsRef.current = nextSnapshot;

      if (regressions.length === 0 || notificationMode === 'off') return;

      const createdAt = formatNotificationTime(language);
      const generated = regressions
        .slice(0, 4)
        .map((alert) => {
          const presentation = severityPresentation(alert.score);
          return {
            id: `${alert.key}-${alert.score}-${Date.now()}`,
            badgeType: presentation.badgeType,
            badge: presentation.badge,
            title: `${translateText('Alerta')} ${translateDashboardText(alert.metric, language)}`,
            desc: `${translateDashboardText(alert.section, language)}: ${translateText('valor')} ${alert.value} | ${translateText('meta')} ${alert.target} | ${translateText('status')} ${alert.status}`,
            time: createdAt,
            severityScore: alert.score,
            auto: true,
          } satisfies NotificationEntry;
        });

      setNotifications((prev) => [...generated, ...prev].slice(0, 20));
      setToastMsg(generated[0]?.title ?? translateText('Novo alerta no dashboard'));
      void playAlertTone(Math.max(...generated.map((item) => item.severityScore)));
    }, 300);

    return () => window.clearTimeout(timer);
  }, [activeMenuItem, activePlan, dashboardQuery.data, filters, language, notificationMode, playAlertTone, refreshKey, resolvedAppointments, showNotifications, translateText]);

  const handleSetLang = useCallback((next: Lang) => {
    setLang(next);
    setLanguage(toAppLanguage(next));
  }, [setLanguage]);

  const handleSetTheme = useCallback((next: Theme) => {
    if (next === theme) return;
    appRootRef.current?.setAttribute('data-theme', next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('glx-dashboard-theme', next);
    }
    startTransition(() => {
      setTheme(next);
    });
  }, [theme]);

  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1);
    setToastMsg(t.refreshMsg);
  }, [t]);

  const handleExportCSV = useCallback(() => {
    try {
      if (!exportPolicy.csv.enabled) {
        throw new Error(exportPolicy.csv.title || 'Exportacao CSV indisponivel para este perfil.');
      }

      const root = contentRef.current;
      if (!root) throw new Error('Container do dashboard não encontrado.');
      const sections = extractDashboardSections(root);
      if (sections.length === 0) {
        throw new Error('Nenhuma seção do dashboard encontrada para exportar.');
      }

      const csv = buildDashboardCsv({
        reportTitle: `${t[titleKey]} - ${translateDashboardText(menu.items[activeMenuItem] ?? 'Aba atual', language)}`,
        planLabel: planLabel(activePlan),
        currency,
        generatedAt: new Date().toLocaleString(exportLocaleByLang[lang]),
        filters: [
          { label: exportFilterLabelsByLang[lang].period, value: filters.period },
          { label: exportFilterLabelsByLang[lang].channel, value: filters.channel || exportFilterLabelsByLang[lang].all },
          { label: exportFilterLabelsByLang[lang].professional, value: filters.professional || exportFilterLabelsByLang[lang].all },
          { label: exportFilterLabelsByLang[lang].procedure, value: filters.procedure || exportFilterLabelsByLang[lang].all },
          { label: exportFilterLabelsByLang[lang].status, value: filters.status || exportFilterLabelsByLang[lang].all },
          { label: exportFilterLabelsByLang[lang].unit, value: filters.unit || exportFilterLabelsByLang[lang].all },
          { label: exportFilterLabelsByLang[lang].severity, value: filters.severity || exportFilterLabelsByLang[lang].all },
        ],
        sections,
        labels: csvLabelsByLang[lang],
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ts = new Date().getTime();
      a.setAttribute('download', `glx_${activePlan.toLowerCase()}_${lang.toLowerCase()}_${currency.toLowerCase()}_tab_${activeMenuItem}_${ts}.csv`);
      document.body.appendChild(a);
      a.click();

      // Give enough time for the browser to trigger download before revoking
      setTimeout(() => {
        if (a.parentNode) document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 5000);
      setToastMsg(t.csvMsg);
    } catch (err) {
      console.error('CSV export error:', err);
      setToastMsg(`${translateText('Erro ao exportar CSV:')} ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [activeMenuItem, activePlan, currency, exportPolicy.csv.enabled, exportPolicy.csv.title, filters, lang, language, menu.items, t, titleKey, translateText]);

  const handleLogout = useCallback(async () => {
    try {
      await logout({ redirectTo: '/login' });
    } catch (err) {
      console.error('Logout error:', err);
      setToastMsg(translateText('Erro ao sair. Tente novamente.'));
    }
  }, [logout, translateText]);

  const handleExportPDF = useCallback(async (mode: "executive" | "investor" = "executive") => {
    if (!contentRef.current || pdfLoading) return;
    setPdfExportMode(mode);
    setToastMsg(mode === "investor" ? translateText('Gerando PDF investidor...') : t.pdfGenerating);

    try {
      const exportNode =
        mode === "executive"
          ? exportContentRef.current ?? contentRef.current
          : contentRef.current;

      if (!exportNode) throw new Error("Export ref missing");

      if (mode === "executive") {
        const response = await fetch("/api/export/pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            clinicName: profileName,
            plan: activePlan.toLowerCase(),
            language: lang,
            currency,
            filters,
            appointments: resolvedAppointments,
          }),
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const filenameFromHeader = response.headers
          .get("Content-Disposition")
          ?.match(/filename=\"?([^\";]+)\"?/)?.[1];
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filenameFromHeader || `glx_${activePlan.toLowerCase()}_executive.pdf`;
        document.body.appendChild(anchor);
        anchor.click();
        window.setTimeout(() => {
          URL.revokeObjectURL(url);
          anchor.remove();
        }, 1000);

        setToastMsg(translateText('PDF executivo gerado com sucesso!'));
        return;
      }

      const pdfTitle = `${t[titleKey]} - ${translateText('Investor View')}`;
      const pdfSubtitle = translateText('LGPD-safe | Investor packet');
      const filePrefix = `glx_investor_${activePlan.toLowerCase()}_${lang.toLowerCase()}_${currency.toLowerCase()}`;

      await exportDashboardPDF(
        exportNode,
        pdfTitle,
        pdfSubtitle,
        filePrefix,
        pdfLabelsByLang[lang],
        exportLocaleByLang[lang],
      );

      await exportDashboardHealthPDF(
        exportNode,
        `${pdfTitle} - ${translateText('Health Summary')}`,
        translateText('Graficos, resumo de saude e metodologia de medicao'),
        `${filePrefix}_health`,
        {
          ...pdfLabelsByLang[lang],
          statusSummary: translateText('Resumo de saude'),
          healthy: translateText('Saudavel'),
          stable: translateText('Estavel'),
          critical: translateText('Critico'),
          legend: translateText('Legenda'),
          legendHealthy: translateText('Saudavel: indicador dentro da meta ou com status OK.'),
          legendStable: translateText('Estavel: indicador em atencao, warning, P2 ou P3, sem ruptura imediata.'),
          legendCritical: translateText('Critico: indicador com status P1 ou critico, exigindo acao imediata.'),
          methodology: translateText('Metodologia e calculos'),
          formula: translateText('Formula'),
          howMeasured: translateText('Como a medicao e feita'),
          sources: translateText('Fontes e campos usados'),
          chartGallery: translateText('Graficos executivos'),
          snapshot: translateText('Snapshot consolidado'),
        },
        exportLocaleByLang[lang],
        kpiSourceMode,
      );

      setToastMsg(translateText('PDF investidor gerado com sucesso!'));
    } catch (err) {
      console.error('PDF export error:', err);
      setToastMsg(translateText('Erro na engine de PDF.'));
    } finally {
      setPdfExportMode(null);
    }
  }, [activePlan, currency, filters, kpiSourceMode, lang, pdfLoading, profileName, resolvedAppointments, t, titleKey, subtitleKey, translateText]);

  const openKpiMeta = useCallback((label: string | null | undefined) => {
    if (!label) return;
    setSelectedKpiMeta(resolveKpiMeta(label, kpiSourceMode));
  }, [kpiSourceMode]);

  const handleKpiInteraction = useCallback((event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const card = target.closest<HTMLElement>('[data-kpi-title], .overview-card');
    if (!card) return;

    if ('key' in event && event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    if ('key' in event) {
      event.preventDefault();
    }

    const label = card.dataset.kpiTitle || card.getAttribute('data-kpi-title') || card.querySelector('.overview-card-label')?.textContent?.trim();
    openKpiMeta(label);
  }, [openKpiMeta]);

  if ((user as any)?.role === 'admin') {
    return <Redirect to="/admin" />;
  }

  return (
    <div ref={appRootRef} className="glx-plan-dashboard-root app-shell" data-theme={theme} data-lang={language}>
      <div className="dashboard-ambient" aria-hidden="true">
        <span className="ambient-grid" />
        <span className="ambient-orb ambient-orb-a" />
        <span className="ambient-orb ambient-orb-b" />
        <span className="ambient-orb ambient-orb-c" />
      </div>
      {mobileSidebarOpen && <button type="button" className="sidebar-backdrop" aria-label={translateText('Fechar menu')} onClick={() => setMobileSidebarOpen(false)} />}
      {showNotifications && <NotificationPanel notifications={visibleNotifications} onClose={() => setShowNotifications(false)} removedNotifs={removedNotifs} onToggleRemove={handleToggleNotif} />}
      {showSettings && <SettingsPanelWithNotifications onClose={() => setShowSettings(false)} theme={theme} setTheme={handleSetTheme} lang={lang} setLang={handleSetLang} notificationMode={notificationMode} setNotificationMode={setNotificationMode} />}
      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}
      {translatedKpiMeta && <KpiExplainPanel meta={translatedKpiMeta} onClose={() => setSelectedKpiMeta(null)} />}
      {toastMsg && <Toast message={toastMsg} onDone={() => setToastMsg('')} />}

      <aside className={`sidebar ${mobileSidebarOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">GLX</div>
          <div className="sidebar-logo-text"><span>PERFORMANCE</span><span>CONTROL TOWER</span></div>
        </div>
        <nav className="sidebar-nav">
          {menu.items.map((item, idx) => (
            <div key={idx} className={`sidebar-item ${activeMenuItem === idx ? 'active' : ''}`} onClick={() => setActiveMenuItem(idx)}>{translateDashboardText(item, language)}</div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-profile-label">{t.perfil}</div>
          <div className="sidebar-profile-name">{profileRole}</div>
          <div className="sidebar-profile-email">{profileEmail || profileName}</div>
          <div style={{ marginTop: 14 }}>
            <div className="selector-row-label">{t.idioma}</div>
            <select className="filter-select" style={{ width: '100%' }} value={lang} onChange={e => handleSetLang(e.target.value as Lang)}>
              <option value="PT">Português</option>
              <option value="EN">English</option>
              <option value="ES">Español</option>
            </select>
          </div>
          <div style={{ marginTop: 12 }}>
            <div className="selector-row-label">{translateText('Tema').toUpperCase()}</div>
            <div className="theme-toggle-wrapper" onClick={() => handleSetTheme(theme === 'dark' ? 'light' : 'dark')} style={{ cursor: 'pointer' }}>
              <span className="theme-toggle-icon" aria-hidden="true">
                {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
              </span>
              <div className={`theme-toggle-track ${theme === 'light' ? 'light' : ''}`}>
                <div className="theme-toggle-thumb" />
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <div className="selector-row-label">{t.plano}</div>
            <div className="selector-row">
              <button
                className="selector-btn active"
                type="button"
                title={translateText('Abrir página de planos')}
                onClick={() => setLocation('/planos')}
              >
                {planLabel(activePlan)}
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-title-row">
            <button type="button" className="mobile-menu-btn" aria-label={translateText('Abrir menu')} onClick={() => setMobileSidebarOpen(true)}>
              <Menu aria-hidden="true" />
            </button>
            <div className="topbar-title"><h1>{t[titleKey]}</h1><span>{t[subtitleKey]}</span></div>
          </div>
          <div className="topbar-actions">
            {activeFilterCount > 0 && <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, marginRight: 4 }}>{activeFilterCount} filtro{activeFilterCount > 1 ? 's' : ''}</span>}
            <div className="currency-toolbar">
              <label className="currency-toolbar-label" htmlFor="dashboard-currency-select">{translateText('Moeda')}</label>
              <select
                id="dashboard-currency-select"
                className="filter-select currency-select"
                value={currency}
                onChange={(event) => void setCurrency(event.target.value as typeof currency)}
              >
                {supportedCurrencies.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <span className="currency-toolbar-meta">
                {currency === baseCurrency || !rate
                  ? `${baseCurrency} ${translateText('base')}`
                  : `1 ${baseCurrency} = ${rate.toFixed(4)} ${currency}`}
              </span>
            </div>
            <button className="topbar-btn live status-btn">{t.dadosVivo}</button>
            <button className={`topbar-btn topbar-icon-btn notification-btn ${hasUnreadCriticalNotification ? 'has-critical-alert' : hasUnreadWarningNotification ? 'has-warning-alert' : ''}`} onClick={() => setShowNotifications(true)} style={{ position: 'relative' }} aria-label={translateText('Abrir notificações')}>
              <Bell aria-hidden="true" />
              {activeNotifCount > 0 && <span style={{ position: 'absolute', top: -2, right: -2, width: 14, height: 14, borderRadius: '50%', background: 'var(--red)', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{activeNotifCount}</span>}
            </button>
            <button className="topbar-btn topbar-icon-btn" onClick={() => setShowSettings(true)} aria-label={translateText('Abrir configurações')}>
              <Settings aria-hidden="true" />
            </button>
            <button className="topbar-btn text-btn" onClick={() => setShowHelp(true)}>{t.help}</button>
            <button className="topbar-btn text-btn" onClick={handleRefresh}>{t.atualizar}</button>
            {exportPolicy.csv.visible && (
              <button
                type="button"
                className="topbar-btn text-btn"
                onClick={handleExportCSV}
                disabled={!exportPolicy.csv.enabled}
                title={exportPolicy.csv.title}
              >
                {translateText(exportPolicy.csv.label)}
              </button>
            )}
            {exportPolicy.pdf.visible && (
              <button
                type="button"
                className="topbar-btn export-pdf"
                onClick={() => handleExportPDF("executive")}
                disabled={pdfLoading || !exportPolicy.pdf.enabled}
                title={exportPolicy.pdf.title}
              >
                {pdfLoading && pdfExportMode === "executive" ? '...' : translateText(exportPolicy.pdf.label)}
              </button>
            )}
            {exportPolicy.investorPdf.visible && (
              <button
                type="button"
                className="topbar-btn text-btn export-investor-pdf"
                onClick={() => handleExportPDF("investor")}
                disabled={pdfLoading || !exportPolicy.investorPdf.enabled}
                title={exportPolicy.investorPdf.title}
              >
                {pdfLoading && pdfExportMode === "investor" ? '...' : translateText(exportPolicy.investorPdf.label)}
              </button>
            )}
            <button className="topbar-btn text-btn" onClick={handleLogout}>{t.sair}</button>
          </div>
        </header>
        {(currencyWarning || lastUpdatedAt) && (
          <div className={`currency-banner ${currencyStale ? 'warning' : ''}`}>
            <span>
              {currencyWarning ?? `${translateText('Cotação de referência')}: ${new Date(lastUpdatedAt!).toLocaleString()}`}
            </span>
          </div>
        )}
        <main className="content" ref={contentRef} key={refreshKey} onClickCapture={handleKpiInteraction} onKeyDownCapture={handleKpiInteraction}>
          {activePlan === 'ESSENTIAL' && <EssentialDashboard lang={lang} activeTab={activeMenuItem} theme={deferredTheme} filters={filters} onFiltersChange={setFilters} appointments={resolvedAppointments} />}
          {activePlan === 'PRO' && <ProDashboard lang={lang} activeTab={activeMenuItem} theme={deferredTheme} filters={filters} onFiltersChange={setFilters} appointments={resolvedAppointments} />}
          {activePlan === 'ENTERPRISE' && <EnterpriseDashboard lang={lang} activeTab={activeMenuItem} theme={deferredTheme} filters={filters} onFiltersChange={setFilters} appointments={resolvedAppointments} />}
        </main>

        {/* Hidden Container for Multi-Tab Export */}
        <div ref={exportContentRef} style={{ position: 'absolute', left: '-99999px', top: 0, width: 1440, visibility: 'hidden', pointerEvents: 'none' }}>
          {menu.items.map((tabName, idx) => (
            <div key={idx} className="pdf-export-section" data-title={translateDashboardText(tabName, language)}>
              {activePlan === 'ESSENTIAL' && <EssentialDashboard lang={lang} activeTab={idx} theme="light" filters={filters} onFiltersChange={() => { }} appointments={resolvedAppointments} />}
              {activePlan === 'PRO' && <ProDashboard lang={lang} activeTab={idx} theme="light" filters={filters} onFiltersChange={() => { }} appointments={resolvedAppointments} />}
              {activePlan === 'ENTERPRISE' && <EnterpriseDashboard lang={lang} activeTab={idx} theme="light" filters={filters} onFiltersChange={() => { }} appointments={resolvedAppointments} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PlanDashboardApp;
