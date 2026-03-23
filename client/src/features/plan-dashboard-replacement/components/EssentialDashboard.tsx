import { useMemo, useCallback, memo, useState } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import FilterBar from './FilterBar';
import IntegrationSection from './IntegrationSection';
import { useTranslation } from '../i18n';
import {
  type Appointment, Filters, getAllAppointments, applyFilters, computeKPIs,
  computeByProfessional, computeByChannel, computeWeeklyTrend, computeMonthlyTrend, getFilterOptions,
} from '../data/mockData';
import { AgendaNoShowModule } from './modules/AgendaNoShowModule';
import { FinanceiroModule } from './modules/FinanceiroModule';
import { MarketingModule } from './modules/MarketingModule';
import { OperacaoUXModule } from './modules/OperacaoUXModule';

interface Props {
  activeTab: number;
  lang?: "PT" | "EN" | "ES";
  theme: 'dark' | 'light' | 'night';
  visualScale: 'normal' | 'large' | 'xl';
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  appointments?: Appointment[];
  integrationHealth?: {
    integrations?: Array<{
      key: string;
      label: string;
      provider: string;
      status: 'connected' | 'degraded' | 'disconnected';
      lastSyncAt: string | null;
      slaMinutes: number;
      failures24h: number;
    }>;
    technical?: {
      lastSyncAt?: string | null;
      apiFailures24h?: number;
      volumeRegistrosDia?: number;
    };
  } | null;
}

type Priority = 'P1' | 'P2' | 'P3' | 'OK';

const KPI_INFO: Record<string, { formula: string; explanation: string }> = {
  'ocupacao': {
    formula: 'Ocupação (%) = Consultas realizadas ÷ Capacidade disponível × 100',
    explanation: 'Some as consultas realizadas no período, some a capacidade disponível dos slots/profissionais/unidades e divida realizadas por capacidade.',
  },
  'noshow': {
    formula: 'No-Show (%) = No-Shows ÷ Total agendado × 100',
    explanation: 'Conte os pacientes que não compareceram sem aviso prévio e divida pelo total de agendamentos do período.',
  },
  'confirmacoes': {
    formula: 'Confirmações (%) = Confirmados ÷ Total agendado × 100',
    explanation: 'Pacientes que responderam "sim" à confirmação (WhatsApp, ligação ou sistema) divididos pelo total de agendamentos.',
  },
  'leadtime': {
    formula: 'Lead Time = Média dos dias entre solicitação e consulta realizada',
    explanation: 'Para cada agendamento, calcule a diferença em dias entre a data do pedido e a data da consulta. Some tudo e divida pelo número de agendamentos.',
  },
  'faturamento': {
    formula: 'Faturamento Bruto = Soma de todos os recebimentos no período',
    explanation: 'Some todos os valores recebidos (consultas, procedimentos, convênios) sem descontar nenhuma despesa.',
  },
  'margem': {
    formula: 'Margem (%) = (Receita Líquida − Despesas Totais) ÷ Receita Líquida × 100',
    explanation: 'Receita líquida é o bruto menos glosas, cancelamentos e inadimplência. Despesas totais incluem fixas e variáveis. Divida o lucro pela receita líquida.',
  },
  'inadimplencia': {
    formula: 'Inadimplência (%) = Valor não recebido ÷ Valor total emitido × 100',
    explanation: 'Some os valores emitidos (notas/cobranças) e subtraia o que foi efetivamente recebido. Divida a diferença pelo total emitido.',
  },
  'despesasfixas': {
    formula: 'Despesas Fixas (%) = Total de Despesas Fixas ÷ Receita Líquida × 100',
    explanation: 'Some aluguel, folha, contratos e outros custos que não variam com o volume. Divida pela receita líquida do período.',
  },
  'leads': {
    formula: 'Leads = Soma de todos os contatos iniciais no período',
    explanation: 'Conte todos os novos contatos recebidos por canal (WhatsApp, Instagram, Google, indicação etc.) no período selecionado.',
  },
  'conversao': {
    formula: 'Conversão (%) = Agendamentos efetivados ÷ Leads recebidos × 100',
    explanation: 'De todos os leads que entraram em contato, quantos chegaram a marcar uma consulta? Divida agendamentos por leads.',
  },
  'cpl': {
    formula: 'CPL = Investimento em marketing ÷ Leads gerados',
    explanation: 'Some o total investido em anúncios, agência e produção no período e divida pelo número de leads captados.',
  },
  'roi': {
    formula: 'ROI (%) = (Receita atribuída − Custo do canal) ÷ Custo do canal × 100',
    explanation: 'Para cada canal, some a receita gerada pelos pacientes captados, subtraia o custo e divida pelo custo. 200% significa R$3 de retorno para cada R$1 investido.',
  },
  'nps': {
    formula: 'NPS (0–10) = (% Promotores − % Detratores) × 10',
    explanation: 'Notas 9–10 são promotores; 0–6 são detratores; 7–8 são neutros. Subtraia % detratores de % promotores e converta para escala 0–10.',
  },
  'espera': {
    formula: 'Espera média = Soma dos tempos de espera ÷ Total de atendimentos',
    explanation: 'Registre o tempo entre chegada do paciente e início do atendimento para cada consulta. Some todos e divida pelo número de atendimentos.',
  },
  'retorno': {
    formula: 'Retorno (%) = Pacientes que retornaram ÷ Total atendidos × 100',
    explanation: 'Conte quantos pacientes atendidos voltaram em uma segunda consulta dentro da janela (30, 90 ou 180 dias). Divida pelo total atendido no período.',
  },
  'sla': {
    formula: 'SLA = Soma dos tempos de resposta ÷ Total de leads respondidos',
    explanation: 'Para cada lead, calcule o tempo entre o primeiro contato e a primeira resposta da equipe. Some tudo e divida pelo número de leads atendidos.',
  },
};


function toWeekKey(dateStr: string) {
  const d = new Date(dateStr);
  const weekStart = new Date(d);
  weekStart.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return weekStart.toISOString().slice(0, 10);
}

function toMonthKey(dateStr: string) {
  return dateStr.slice(0, 7); // "YYYY-MM"
}

const _agendaMonthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
function monthLabel(key: string) {
  const m = parseInt(key.slice(5, 7)) - 1;
  return _agendaMonthNames[m] ?? key;
}


function renderMoneyValueWithSmallSymbol(value: string) {
  const hasLeadingMinus = /^-+\s*/.test(value);
  const normalized = value.replace(/^-+\s*/, '');
  if (!normalized.startsWith('R$')) return value;
  return (
    <>
      {hasLeadingMinus ? '-' : null}
      <span className="money-symbol">R$</span> {normalized.replace(/^R\$\s*/, '')}
    </>
  );
}

function renderPercentValueWithSmallSymbol(value: number, fractionDigits = 1) {
  return (
    <>
      {value.toFixed(fractionDigits)}
      <span className="percent-symbol">%</span>
    </>
  );
}

function EssentialDashboard({ activeTab, filters, onFiltersChange, appointments, integrationHealth }: Props) {
  const { t } = useTranslation();
  const { formatCompactMoney, moneyTitle } = useCurrency();
  const fmt = useCallback((value: number) => formatCompactMoney(value), [formatCompactMoney]);
  const allData = useMemo(() => (appointments && appointments.length > 0) ? appointments : getAllAppointments(), [appointments]);
  const filterOptions = useMemo(() => getFilterOptions(allData), [allData]);
  const filtered = useMemo(() => applyFilters(allData, filters), [allData, filters]);
  const kpis = useMemo(() => computeKPIs(filtered), [filtered]);
  const byProf = useMemo(() => computeByProfessional(filtered), [filtered]);
  const byChannel = useMemo(() => computeByChannel(filtered), [filtered]);
  const isLongPeriod = useMemo(() => filters.period === '3m' || filters.period === '6m' || filters.period === '1 ano', [filters.period]);
  const weeklyTrend = useMemo(() => isLongPeriod ? computeMonthlyTrend(filtered) : computeWeeklyTrend(filtered), [filtered, isLongPeriod]);
  const sortedFiltered = useMemo(() => [...filtered].sort((a, b) => a.date.localeCompare(b.date)), [filtered]);
  const agendaWeeks = useMemo(() => {
    const buckets = new Map<string, typeof filtered>();
    const keyFn = isLongPeriod ? toMonthKey : toWeekKey;
    sortedFiltered.forEach((row) => {
      const key = keyFn(row.date);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(row);
    });

    const sliceCount = isLongPeriod ? 12 : 8;
    return Array.from(buckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-sliceCount)
      .map(([weekKey, rows], idx) => {
        const total = rows.length;
        const realized = rows.filter(r => r.status === 'Realizada').length;
        const noShows = rows.filter(r => r.status === 'No-Show').length;
        const canceled = rows.filter(r => r.status === 'Cancelada').length;
        const confirmed = rows.filter(r => r.status === 'Confirmada').length;
        const weeklyTarget = Math.max(16, Math.round(total * 0.85));
        const cancelNoticeRate = canceled ? Math.min(92, Math.max(22, 52 + idx * 4 - (canceled % 3) * 2)) : 0;
        const leadTimeDays = total
          ? rows.reduce((s, r, i) => s + 1.1 + ((r.waitMinutes / 60) * 0.8) + ((i % 5) * 0.35), 0) / total
          : 0;

        return {
          label: isLongPeriod ? monthLabel(weekKey) : (() => { const d = new Date(weekKey + 'T00:00:00'); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`; })(),
          weekKey,
          total,
          realized,
          noShows,
          canceled,
          confirmed,
          noShowRate: total ? (noShows / total) * 100 : 0,
          occupancyRate: total ? (realized / Math.max(total, Math.ceil(total * 1.05))) * 100 : 0,
          confirmationRate: total ? (confirmed / total) * 100 : 0,
          cancelNoticeRate,
          consultsMetaPct: weeklyTarget ? (realized / weeklyTarget) * 100 : 0,
          weeklyTarget,
          leadTimeDays,
        };
      });
  }, [sortedFiltered]);
  const channelStatusBreakdown = useMemo(() => byChannel.filter(c => c.total > 0), [byChannel]);
  const channelDropStats = useMemo(() => {
    if (agendaWeeks.length === 0) return [] as { name: string; dropPct: number; total: number }[];
    const splitIndex = Math.max(1, Math.floor(agendaWeeks.length / 2));
    const recentWeeks = new Set(agendaWeeks.slice(-splitIndex).map(w => w.weekKey));
    const priorWeeks = new Set(agendaWeeks.slice(0, Math.max(1, agendaWeeks.length - splitIndex)).map(w => w.weekKey));

    return channelStatusBreakdown.map((channel) => {
      const rows = sortedFiltered.filter(a => a.channel === channel.name);
      const recent = rows.filter(a => recentWeeks.has(toWeekKey(a.date))).length;
      const prior = rows.filter(a => priorWeeks.has(toWeekKey(a.date))).length;
      const dropPct = prior > 0 ? ((prior - recent) / prior) * 100 : 0;
      return { name: channel.name, dropPct, total: channel.total };
    });
  }, [agendaWeeks, channelStatusBreakdown, sortedFiltered]);
  const agendaRules = useMemo(() => {
    const current = agendaWeeks[agendaWeeks.length - 1];
    const previous = agendaWeeks[agendaWeeks.length - 2];
    const worstChannelDrop = channelDropStats.reduce(
      (acc, item) => (item.dropPct > acc.dropPct ? item : acc),
      { name: '-', dropPct: 0, total: 0 },
    );

    const noShow = current?.noShowRate ?? kpis.noShowRate;
    const occupancy = current?.occupancyRate ?? kpis.occupancyRate;
    const confirmations = current?.confirmationRate ?? 0;
    const cancelNotice = current?.cancelNoticeRate ?? 0;
    const consultMeta = current?.consultsMetaPct ?? 0;
    const leadTime = current?.leadTimeDays ?? 0;
    const cancelTrendDown = previous ? cancelNotice < previous.cancelNoticeRate : false;

    const classifyNoShow = (v: number): Priority => (v > 15 ? 'P3' : v > 8 ? 'P2' : 'P1');
    const classifyOccupancy = (v: number): Priority => (v < 65 ? 'P3' : v < 80 ? 'P2' : 'P1');
    const classifyConfirm = (v: number): Priority => (v < 70 ? 'P3' : v < 85 ? 'P2' : 'P1');
    const classifyCancelNotice = (v: number): Priority => (v < 40 && cancelTrendDown ? 'P2' : 'P1');
    const classifyChannel = (v: number): Priority => (v > 35 ? 'P3' : v > 20 ? 'P2' : 'P1');
    const classifyConsult = (v: number): Priority => (v < 60 ? 'P3' : v < 80 ? 'P2' : 'P1');
    const classifyLead = (v: number): Priority => (v > 7 ? 'P3' : v > 5 ? 'P2' : 'P1');

    return [
      { id: '01', kpi: 'Taxa de No-Show (%)', value: `${noShow.toFixed(1)}%`, meta: '< 8%', baseN: `${current?.total ?? kpis.total}`, priority: classifyNoShow(noShow), action: 'Drill-down por canal de origem' },
      { id: '02', kpi: 'Taxa de Ocupação (%)', value: `${occupancy.toFixed(1)}%`, meta: '> 80%', baseN: `${current?.total ?? kpis.total}`, priority: classifyOccupancy(occupancy), action: 'Ajustar capacidade por profissional/turno' },
      { id: '03', kpi: 'Confirmações Realizadas (%)', value: `${confirmations.toFixed(1)}%`, meta: '> 85%', baseN: `${current?.total ?? kpis.total}`, priority: classifyConfirm(confirmations), action: 'Automatizar confirmações (WhatsApp)' },
      { id: '04', kpi: 'Cancelamentos com Aviso (%)', value: `${cancelNotice.toFixed(1)}%`, meta: '> 60%', baseN: `${kpis.canceled}`, priority: classifyCancelNotice(cancelNotice), action: 'IA/NLP para motivo de cancelamento' },
      { id: '05', kpi: 'Agendamentos por Canal', value: `${Math.max(0, worstChannelDrop.dropPct).toFixed(0)}% (${worstChannelDrop.name})`, meta: 'Meta por canal', baseN: `${kpis.leads}`, priority: classifyChannel(worstChannelDrop.dropPct), action: 'Reagir a queda >20% por canal' },
      { id: '06', kpi: 'Consultas Realizadas / Semana', value: `${consultMeta.toFixed(0)}%`, meta: '> 80%', baseN: `${current?.weeklyTarget ?? 0}`, priority: classifyConsult(consultMeta), action: 'Recuperar agenda semanal' },
      { id: '07', kpi: 'Lead Time do Agendamento (dias)', value: `${leadTime.toFixed(1)}d`, meta: '< 3d', baseN: `${kpis.leads}`, priority: classifyLead(leadTime), action: 'Atuar na recepção se > 7d' },
    ];
  }, [agendaWeeks, channelDropStats, kpis]);
  const financeWeeks = useMemo(() => {
    return weeklyTrend.map((w, idx) => {
      const gross = w.grossRevenue;
      const conventionGlosas = gross * (0.015 + (idx % 3) * 0.004);
      const cancelLoss = gross * (0.035 + (idx % 4) * 0.006);
      const delinquency = gross * (0.03 + (idx % 5) * 0.007);
      const chargebacks = gross * (0.01 + (idx % 3) * 0.003);
      const net = Math.max(0, gross - cancelLoss - delinquency - chargebacks - conventionGlosas);
      const fixedExpenses = net * (0.42 + (idx % 4) * 0.045);
      const variableCosts = w.totalCost * 0.55;
      const profit = net - fixedExpenses - variableCosts;
      const marginPct = net > 0 ? (profit / net) * 100 : 0;
      const delinquencyPct = gross > 0 ? (delinquency / gross) * 100 : 0;
      const fixedPct = net > 0 ? (fixedExpenses / net) * 100 : 0;
      const netPctGross = gross > 0 ? (net / gross) * 100 : 0;
      const specialtyBenchmarkTicket = 700 + (idx % 2) * 35;
      return {
        label: w.label,
        gross,
        net,
        cancelLoss,
        delinquency,
        chargebacks,
        conventionGlosas,
        netPctGross,
        marginPct,
        ticketAvg: w.avgTicket,
        ticketBenchmark: specialtyBenchmarkTicket,
        delinquencyPct,
        fixedPct,
        receiptsCount: Math.max(1, w.realized),
        consultations: Math.max(1, w.realized),
        d20ProgressPct: 62 + idx * 4,
        d20ThresholdPct: 80,
      };
    });
  }, [weeklyTrend]);
  const financeCurrent = financeWeeks[financeWeeks.length - 1];
  const financePrev = financeWeeks[financeWeeks.length - 2];
  const financeRules = useMemo(() => {
    const current = financeCurrent;
    if (!current) return [];
    const grossMeta = current.gross * 1.12;
    const d20Priority: Priority = current.d20ProgressPct < 80 ? 'P2' : 'P1';
    const netPriority: Priority = current.netPctGross < 85 ? 'P3' : current.netPctGross < 92 ? 'P2' : 'P1';
    const marginPriority: Priority = current.marginPct < 12 ? 'P3' : current.marginPct < 20 ? 'P2' : 'P1';
    const ticketDrop = financePrev ? ((financePrev.ticketAvg - current.ticketAvg) / Math.max(financePrev.ticketAvg, 1)) * 100 : 0;
    const ticketPriority: Priority = ticketDrop > 10 ? 'P2' : 'P1';
    const inadPriority: Priority = current.delinquencyPct > 8 ? 'P3' : current.delinquencyPct > 4 ? 'P2' : 'P1';
    const fixedPriority: Priority = current.fixedPct > 60 ? 'P3' : current.fixedPct > 45 ? 'P2' : 'P1';
    return [
      { id:'01', kpi:'Faturamento Bruto Mensal', value: fmt(current.gross), meta: fmt(grossMeta), baseN:String(current.receiptsCount), priority:d20Priority, action:'D20 Rule: projetar risco se <80% no dia 20' },
      { id:'02', kpi:'Receita Líquida', value: `${current.netPctGross.toFixed(1)}% do bruto`, meta:'> 92% do bruto', baseN:fmt(current.gross), priority:netPriority, action:'Monitorar glosas, estornos e inadimplência' },
      { id:'03', kpi:'Margem Líquida (%)', value: `${current.marginPct.toFixed(1)}%`, meta:'> 20%', baseN:fmt(current.net), priority:marginPriority, action:'Comparar benchmark da especialidade' },
      { id:'04', kpi:moneyTitle('Ticket Médio'), value: fmt(current.ticketAvg), meta: fmt(current.ticketBenchmark), baseN:String(current.consultations), priority:ticketPriority, action:'Segmentar por procedimento' },
      { id:'05', kpi:'Inadimplência (%)', value: `${current.delinquencyPct.toFixed(1)}%`, meta:'< 4%', baseN:fmt(current.gross), priority:inadPriority, action:'Cobrança ativa e política de recebíveis' },
      { id:'06', kpi:'Despesas Fixas / Receita (%)', value: `${current.fixedPct.toFixed(1)}%`, meta:'< 45%', baseN:fmt(current.net), priority:fixedPriority, action:'Revisar estrutura fixa e contratos' },
    ];
  }, [financeCurrent, financePrev, fmt, moneyTitle]);
  const cashProjection = useMemo(() => {
    const points = financeWeeks.slice(-6).map((w, idx) => {
      const netIn = w.net;
      const out = w.cancelLoss + w.delinquency + (w.fixedPct / 100) * Math.max(w.net, 1) + 12000;
      const base = 60000 + idx * 3500;
      return { label: w.label, cash: base + netIn - out };
    });
    const last = points[points.length - 1]?.cash ?? 50000;
    const projected = Array.from({ length: 3 }, (_, i) => ({
      label: `P+${(i + 1) * 5}d`,
      cash: last + (i + 1) * (i === 2 ? -8000 : 3000),
    }));
    return { historical: points, projected };
  }, [financeWeeks]);
  const cashCurrentValue = cashProjection.historical[cashProjection.historical.length - 1]?.cash ?? 0;
  const cashProjectedValue = cashProjection.projected[cashProjection.projected.length - 1]?.cash ?? cashCurrentValue;
  const delinquencyCurrent = financeCurrent?.delinquencyPct ?? 0;
  const fixedExpenseRatioCurrent = financeCurrent?.fixedPct ?? 0;
  const delinquencyColor = delinquencyCurrent > 8 ? 'var(--red)' : delinquencyCurrent >= 4 ? 'var(--yellow)' : 'var(--green)';
  const fixedExpenseRatioColor = fixedExpenseRatioCurrent > 60 ? 'var(--red)' : fixedExpenseRatioCurrent >= 45 ? 'var(--yellow)' : 'var(--green)';
  const cashPositionColor = cashCurrentValue < 0 ? 'var(--red)' : cashProjectedValue < 0 ? 'var(--yellow)' : 'var(--green)';
  const marketingWeeks = useMemo(() => {
    return weeklyTrend.map((w, idx) => {
      const leads = Math.max(1, w.leads);
      const confirmed = Math.round(leads * (0.22 + (idx % 4) * 0.04));
      const conversion = (confirmed / leads) * 100;
      const marketingSpend = leads * (55 + (idx % 3) * 12);
      const cpl = marketingSpend / leads;
      const leadMeta = Math.max(10, Math.round(leads * (idx % 2 === 0 ? 1.05 : 0.95)));
      return {
        label: w.label,
        leads,
        confirmed,
        conversion,
        marketingSpend,
        cpl,
        leadMeta,
      };
    });
  }, [weeklyTrend]);
  const marketingByChannel = useMemo(() => {
    return channelStatusBreakdown.map((c, idx) => {
      const leads = Math.max(1, Math.round(c.total * (0.55 + ((idx + 1) % 3) * 0.08)));
      const confirmed = Math.max(0, c.total - c.noShows - c.canceled);
      const conversion = leads > 0 ? (confirmed / leads) * 100 : 0;
      const noShowRateChannel = c.total > 0 ? (c.noShows / c.total) * 100 : 0;
      const spend = Math.max(250, leads * (35 + idx * 18));
      const cpl = spend / leads;
      const attributedRevenue = (c.realized || 0) * (220 + idx * 35);
      const roi = spend > 0 ? ((attributedRevenue - spend) / spend) * 100 : 0;
      return {
        ...c,
        leads,
        confirmed,
        conversion,
        noShowRateChannel,
        spend,
        cpl,
        attributedRevenue,
        roi,
      };
    }).filter(c => c.total > 0);
  }, [channelStatusBreakdown]);
  const marketingCurrent = marketingWeeks[marketingWeeks.length - 1];
  const marketingPrev = marketingWeeks[marketingWeeks.length - 2];
  const marketingRules = useMemo(() => {
    const current = marketingCurrent;
    if (!current) return [];
    const leadsDrop = marketingPrev ? ((marketingPrev.leads - current.leads) / Math.max(marketingPrev.leads, 1)) * 100 : 0;
    const leadsPriority: Priority = leadsDrop > 35 ? 'P3' : leadsDrop > 20 ? 'P2' : 'P1';
    const conversionPriority: Priority = current.conversion < 20 ? 'P3' : current.conversion < 25 ? 'P2' : 'P1';
    const worstNoShowChannel = marketingByChannel.reduce((acc, c) => c.noShowRateChannel > acc.noShowRateChannel ? c : acc, marketingByChannel[0] ?? { name: '-', noShowRateChannel: 0 });
    const noShowPriority: Priority = (worstNoShowChannel.noShowRateChannel ?? 0) > 35 ? 'P3' : (worstNoShowChannel.noShowRateChannel ?? 0) > 25 ? 'P2' : 'P1';
    const cplWorsened = marketingPrev ? (((current.cpl - marketingPrev.cpl) / Math.max(marketingPrev.cpl, 1)) * 100) > 20 && current.conversion <= (marketingPrev.conversion ?? current.conversion) : false;
    const cplPriority: Priority = cplWorsened ? 'P2' : 'P1';
    const channelFilterLabel: Record<string, string> = { Whatsapp: 'Whatsapp', Facebook: 'Facebook', Outros: 'Outros', 'Indicação': 'Indicação' };
    const roiWorst = marketingByChannel.reduce((acc, c) => c.roi < acc.roi ? c : acc, marketingByChannel[0] ?? { name: '-', roi: 0 });
    const selectedChannelRoi = filters.channel
      ? (marketingByChannel.find(c => c.name === filters.channel) ?? roiWorst)
      : roiWorst;
    const roiChannelLabel = filters.channel
      ? (channelFilterLabel[filters.channel] ?? filters.channel)
      : ((selectedChannelRoi as any).name ?? '-');
    const roiPriority: Priority = (selectedChannelRoi.roi ?? 0) < 0 ? 'P3' : 'P1';
    return [
      { id:'01', kpi:'Leads Gerados / Semana', value:String(current.leads), meta:String(current.leadMeta), baseN:String(current.leads), priority:leadsPriority, action:'Comparar semana anterior e alertar tendência' },
      { id:'02', kpi:'Conversão Lead → Agendamento (%)', value:`${current.conversion.toFixed(1)}%`, meta:'> 30%', baseN:String(current.leads), priority:conversionPriority, action:'Separar funil por canal (script quebrando)' },
      { id:'03', kpi:'No-Show por Canal de Origem (%)', value:`${(worstNoShowChannel.noShowRateChannel ?? 0).toFixed(1)}% (${(worstNoShowChannel as any).name ?? '-'})`, meta:'< média geral', baseN:String((worstNoShowChannel as any).total ?? 0), priority:noShowPriority, action:'Atacar canal com no-show acima da média' },
      { id:'04', kpi:moneyTitle('CPL'), value:fmt(current.cpl), meta:fmt(140), baseN:String(current.leads), priority:cplPriority, action:'Integrar Meta/Google Ads e revisar criativos' },
      { id:'05', kpi:'ROI por Canal (%)', value:`${(selectedChannelRoi.roi ?? 0).toFixed(0)}% (${roiChannelLabel})`, meta:'> 200%', baseN:fmt((selectedChannelRoi as any).attributedRevenue ?? 0), priority:roiPriority, action:'Suspender canal com ROI negativo' },
    ];
  }, [marketingCurrent, marketingPrev, marketingByChannel, filters.channel, fmt, moneyTitle]);
  const opsWeeks = useMemo(() => {
    return weeklyTrend.map((w, idx) => {
      const nps = w.avgNPS;
      const waitMinutes = Math.max(6, w.avgWait + (idx % 3) * 2);
      const return90d = Math.max(10, Math.min(65, w.returnRate + (idx % 4) * 1.5));
      const return180d = Math.max(return90d, Math.min(78, return90d + 6 + (idx % 2) * 2));
      const slaLeadHours = Math.max(0.2, 0.6 + (idx % 5) * 0.55);
      const leadResponses = Math.max(1, w.leads);
      const npsResponses = Math.max(1, w.promoters + w.neutrals + w.detractors);
      return {
        label: w.label,
        nps,
        waitMinutes,
        return90d,
        return180d,
        slaLeadHours,
        leadResponses,
        npsResponses,
      };
    });
  }, [weeklyTrend]);
  const opsCurrent = opsWeeks[opsWeeks.length - 1];
  const npsGaugeValue = +(opsCurrent?.nps ?? kpis.avgNPS).toFixed(1);
  const periodReturnLabel = useMemo(() => {
    const map: Record<string, string> = { '7d': '7 Dias', '15d': '15 Dias', '30d': '30 Dias', '3m': '3 Meses', '6m': '6 Meses', '1 ano': '12 Meses' };
    return map[filters.period] ?? '30 Dias';
  }, [filters.period]);
  const opsRules = useMemo(() => {
    if (!opsCurrent) return [];
    const npsPriority: Priority = opsCurrent.nps < 7.5 ? 'P3' : opsCurrent.nps < 8.5 ? 'P2' : 'P1';
    const waitPriority: Priority = opsCurrent.waitMinutes > 25 ? 'P3' : opsCurrent.waitMinutes > 12 ? 'P2' : 'P1';
    const returnPriority: Priority = opsCurrent.return90d < 25 ? 'P3' : opsCurrent.return90d < 40 ? 'P2' : 'P1';
    const slaPriority: Priority = opsCurrent.slaLeadHours > 4 ? 'P3' : opsCurrent.slaLeadHours > 2 ? 'P2' : 'P1';
    return [
      { id:'01', kpi:'NPS Geral (0-10)', value: opsCurrent.nps.toFixed(1), meta:'> 8,5', baseN:String(opsCurrent.npsResponses), priority:npsPriority, action:'Coleta automática WhatsApp pós-consulta' },
      { id:'02', kpi:'Tempo Médio de Espera (min)', value: `${opsCurrent.waitMinutes.toFixed(0)} min`, meta:'< 12 min', baseN:String(kpis.realized), priority:waitPriority, action:'Rebalancear agenda / encaixes' },
      { id:'03', kpi:`Taxa de Retorno ${periodReturnLabel} (%)`, value: `${opsCurrent.return90d.toFixed(1)}%`, meta:'> 40%', baseN:String(kpis.realized), priority:returnPriority, action:'Cohort 180d e rotina de recall' },
      { id:'04', kpi:'SLA de Resposta ao Lead (h)', value: `${opsCurrent.slaLeadHours.toFixed(2)}h`, meta:'< 1h', baseN:String(opsCurrent.leadResponses), priority:slaPriority, action:'SLA por recepção / responsável' },
    ];
  }, [opsCurrent, kpis.realized, periodReturnLabel]);

  const [kpiModal, setKpiModal] = useState<{ title: string; formula: string; explanation: string } | null>(null);
  const openKpiModal = useCallback((title: string, kpiKey: string) => {
    const info = KPI_INFO[kpiKey];
    if (info) setKpiModal({ title, ...info });
  }, []);

  const showFilterBar = activeTab !== 5;

  return (
    <div className="animate-fade-in" key={activeTab}>
      {showFilterBar ? <FilterBar filters={filters} onChange={onFiltersChange} options={filterOptions} /> : null}

      {/* ===== VISÃO CEO ===== */}
      {activeTab === 0 && (<>
        <div className="section-header"><h2><span className="orange-bar" /> {t('Visão CEO — Painel Executivo Completo')}</h2></div>


        {/* ── SCORE CARDS POR ÁREA (4 por coluna) ── */}
        {(() => {
          const pColor = (p: string) => p === 'P3' ? '#ef4444' : p === 'P2' ? '#eab308' : '#22c55e';
          // Period-aware label suffix — translated
          const pSuffix = t(filters.period === '7d' ? '/ Semana'
            : filters.period === '15d' ? '/ Quinzena'
            : filters.period === '30d' ? '/ Mês'
            : filters.period === '3m' ? '/ Trimestre'
            : filters.period === '6m' ? '/ Semestre'
            : '/ Ano');
          // Accumulated values from kpis (cover the full selected period)
          const totalLeads = kpis.leads;
          const totalGross = kpis.grossRevenue;

          const areas: { icon: string; label: string; items: { rule: any; kpiLabel: string; valueOverride?: string; meta: string; kpiKey: string }[] }[] = [
            {
              icon: '🗓', label: t('Agenda & No-Show'),
              items: [
                { rule: agendaRules[1], kpiLabel: t('Taxa de Ocupação (%)'), meta: t('Meta > 80% — agenda preenchida?'), kpiKey: 'ocupacao' },
                { rule: agendaRules[0], kpiLabel: t('Taxa de No-Show (%)'), meta: t('Meta < 8% — 1 em cada 12 pode faltar'), kpiKey: 'noshow' },
                { rule: agendaRules[2], kpiLabel: t('Confirmações Realizadas (%)'), meta: t('Meta > 85% — pacientes confirmaram?'), kpiKey: 'confirmacoes' },
                { rule: agendaRules[6], kpiLabel: t('Lead Time do Agendamento (dias)'), meta: t('Meta < 3 dias de espera'), kpiKey: 'leadtime' },
              ],
            },
            {
              icon: '💰', label: t('Financeiro'),
              items: [
                { rule: financeRules[0], kpiLabel: `${t('Faturamento Bruto')} ${pSuffix}`, valueOverride: fmt(totalGross), meta: t('Total recebido no período'), kpiKey: 'faturamento' },
                { rule: financeRules[2], kpiLabel: t('Margem Líquida (%)'), meta: t('Meta > 20% — seu lucro real por R$100'), kpiKey: 'margem' },
                { rule: financeRules[4], kpiLabel: t('Inadimplência (%)'), meta: t('Meta < 4% — quem não pagou?'), kpiKey: 'inadimplencia' },
                { rule: financeRules[5], kpiLabel: t('Despesas Fixas / Receita (%)'), meta: t('Meta < 45% — custo fixo sobre receita'), kpiKey: 'despesasfixas' },
              ],
            },
            {
              icon: '📣', label: t('Marketing & Captação'),
              items: [
                { rule: marketingRules[0], kpiLabel: `${t('Leads Gerados')} ${pSuffix}`, valueOverride: String(totalLeads), meta: t('Novos interessados — crescendo?'), kpiKey: 'leads' },
                { rule: marketingRules[1], kpiLabel: t('Conversão Lead → Agendamento (%)'), meta: t('Meta > 25% — quantos viraram consulta?'), kpiKey: 'conversao' },
                { rule: marketingRules[3], kpiLabel: t('CPL — Custo por Paciente'), meta: t('Custo por novo paciente captado'), kpiKey: 'cpl' },
                { rule: marketingRules[4], kpiLabel: t('ROI por Canal (%)'), meta: t('Meta > 200% — marketing compensa?'), kpiKey: 'roi' },
              ],
            },
            {
              icon: '⚙', label: t('Operação & UX'),
              items: [
                { rule: opsRules[0], kpiLabel: t('NPS Geral (0–10)'), meta: t('Meta > 8,5 — paciente indicaria você?'), kpiKey: 'nps' },
                { rule: opsRules[1], kpiLabel: t('Tempo Médio de Espera (min)'), meta: t('Meta < 12 min em sala de espera'), kpiKey: 'espera' },
                { rule: opsRules[2], kpiLabel: `${t('Taxa de Retorno')} ${periodReturnLabel} (%)`, meta: `${t('Meta > 40% — paciente voltou em')} ${periodReturnLabel}?`, kpiKey: 'retorno' },
                { rule: opsRules[3], kpiLabel: t('SLA de Resposta ao Lead (h)'), meta: t('Meta < 1h para responder o paciente'), kpiKey: 'sla' },
              ],
            },
          ];
          return (
            <div className="kpi-ceo-grid">
              {areas.map(area => (
                <div key={area.label} style={{display:'flex',flexDirection:'column',gap:8}}>
                  <div style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',paddingLeft:2}}>
                    {area.icon} {area.label}
                  </div>
                  {area.items.filter(i => i.rule).map(({ rule: r, kpiLabel, valueOverride, meta, kpiKey }) => {
                    const clr = pColor(r.priority);
                    return (
                      <div key={r.id} className="overview-card" onClick={() => openKpiModal(kpiLabel, kpiKey)} style={{borderTop:`3px solid ${clr}`,padding:'12px 14px',cursor:'pointer',position:'relative'}}>
                        <div className="overview-card-label" style={{fontSize:11,marginBottom:4}}>{kpiLabel}</div>
                        <div className="overview-card-value" style={{color:clr,fontSize:26,lineHeight:1.1}}>{valueOverride ?? r.value}</div>
                        <div className="overview-card-info" style={{marginTop:4}}>
                          <span style={{fontSize:10,color:'var(--text-muted)'}}>{meta}</span>
                        </div>
                        <span style={{position:'absolute',top:8,right:10,fontSize:13,color:'var(--text-muted)',opacity:0.5}}>?</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          );
        })()}

      </>)}

      {/* ===== AGENDA ===== */}
      {activeTab === 1 && (<>
        <div className="section-header"><h2><span className="orange-bar" /> {t('Agenda & No-Show')}</h2></div>
        <div className="overview-row">
          <div className="overview-card"><div className="overview-card-label">Total Agendamentos</div><div className="overview-card-value">{kpis.total}</div></div>
          <div className="overview-card"><div className="overview-card-label">Consultas Realizadas</div><div className="overview-card-value">{kpis.realized}</div></div>
          <div className="overview-card"><div className="overview-card-label">Taxa de Ocupação</div><div className="overview-card-value" style={{color:kpis.occupancyRate>=80?'var(--green)':kpis.occupancyRate>=60?'var(--yellow)':'var(--red)'}}>{kpis.occupancyRate.toFixed(1)}%</div></div>
          <div className="overview-card"><div className="overview-card-label">Taxa de No-Show</div><div className="overview-card-value" style={{color:kpis.noShowRate<=8?'var(--green)':kpis.noShowRate<=12?'var(--yellow)':'var(--red)'}}>{kpis.noShowRate.toFixed(1)}%</div></div>
          <div className="overview-card"><div className="overview-card-label">Taxa de Confirmações</div><div className="overview-card-value" style={{color:kpis.confirmationRate>=85?'var(--green)':kpis.confirmationRate>=70?'var(--yellow)':'var(--red)'}}>{kpis.confirmationRate.toFixed(1)}%</div></div>
          <div className="overview-card"><div className="overview-card-label">Lead Time do Agendamento</div><div className="overview-card-value" style={{color:kpis.leadTimeDays<=3?'var(--green)':kpis.leadTimeDays<=7?'var(--yellow)':'var(--red)'}}>{kpis.leadTimeDays.toFixed(1)}d</div></div>
          {(() => {
            const CHANNEL_DISPLAY: Record<string, string> = {
              Telefone: 'Whatsapp', WhatsApp: 'Whatsapp', Whatsapp: 'Whatsapp',
              Facebook: 'Facebook',
              Presencial: 'Outros', Outros: 'Outros',
              'Indicação': 'Indicação',
              Google: 'Google', Instagram: 'Instagram',
            };
            const counts = new Map<string, number>();
            filtered.forEach(a => {
              const name = CHANNEL_DISPLAY[a.channel] ?? a.channel;
              counts.set(name, (counts.get(name) ?? 0) + 1);
            });
            const topChannel = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
            return (
              <div className="overview-card">
                <div className="overview-card-label">Canal de Aquisição</div>
                <div className="overview-card-value" style={{fontSize:22,whiteSpace:'nowrap'}}>{topChannel ? `${topChannel[0]} / ${topChannel[1]} agend.` : '—'}</div>
              </div>
            );
          })()}
        </div>
        <AgendaNoShowModule agendaWeeks={agendaWeeks} filtered={filtered} kpis={kpis} filters={filters} showTargets={filters.severity !== ''} plan="ESSENTIAL" />
      </>)}
      {/* ===== FINANCEIRO ===== */}
      {activeTab === 2 && (<>
        <div className="section-header"><h2><span className="orange-bar" /> Financeiro Executivo</h2></div>
        <div className="overview-row">
          {(() => {
            const gross = financeCurrent?.gross ?? 0;
            const net   = financeCurrent?.net   ?? 0;
            const margin = financeCurrent?.marginPct ?? 0;
            const ticket = financeCurrent?.ticketAvg ?? 0;
            const prevTicket = financePrev?.ticketAvg ?? ticket;
            const weeklyTarget = 120_000 / Math.max(financeWeeks.length, 1);
            const grossColor  = gross >= weeklyTarget ? 'var(--green)' : gross >= weeklyTarget * 0.80 ? 'var(--yellow)' : 'var(--red)';
            const netRatio    = gross > 0 ? net / gross : 1;
            const netColor    = netRatio >= 0.92 ? 'var(--green)' : netRatio >= 0.85 ? 'var(--yellow)' : 'var(--red)';
            const marginColor = margin >= 20 ? 'var(--green)' : margin >= 12 ? 'var(--yellow)' : 'var(--red)';
            const ticketDrop  = prevTicket > 0 ? (prevTicket - ticket) / prevTicket : 0;
            const ticketColor = ticketDrop < 0 ? 'var(--green)' : ticketDrop < 0.10 ? 'var(--yellow)' : 'var(--red)';
            return (<>
              <div className="overview-card"><div className="overview-card-label no-kpi-source">Faturamento Bruto</div><div className="overview-card-value" style={{color:grossColor}}>{renderMoneyValueWithSmallSymbol(fmt(gross))}</div></div>
              <div className="overview-card"><div className="overview-card-label no-kpi-source">Receita Líquida</div><div className="overview-card-value" style={{color:netColor}}>{renderMoneyValueWithSmallSymbol(fmt(net))}</div></div>
              <div className="overview-card"><div className="overview-card-label no-kpi-source">Margem Líquida</div><div className="overview-card-value" style={{color:marginColor}}>{margin.toFixed(1)}%</div></div>
              <div className="overview-card"><div className="overview-card-label no-kpi-source">Ticket Médio</div><div className="overview-card-value" style={{color:ticketColor}}>{renderMoneyValueWithSmallSymbol(fmt(ticket))}</div></div>
            </>);
          })()}
          <div className="overview-card"><div className="overview-card-label no-kpi-source">Inadimplência (%)</div><div className="overview-card-value" style={{ color: delinquencyColor }}>{delinquencyCurrent.toFixed(1)}%</div></div>
          <div className="overview-card"><div className="overview-card-label no-kpi-source">Despesas Fixas/Receita (%)</div><div className="overview-card-value" style={{ color: fixedExpenseRatioColor }}>{fixedExpenseRatioCurrent.toFixed(1)}%</div></div>
          <div className="overview-card"><div className="overview-card-label no-kpi-source">Posição de Caixa</div><div className="overview-card-value" style={{ color: cashPositionColor }}>{renderMoneyValueWithSmallSymbol(fmt(cashCurrentValue))}</div></div>
        </div>
        <FinanceiroModule financeWeeks={financeWeeks} filtered={filtered} kpis={kpis} filters={filters} showTargets={filters.severity !== ''} plan="ESSENTIAL" />
      </>)}
      {/* ===== MARKETING ===== */}
      {activeTab === 3 && (<>
        <div className="section-header"><h2><span className="orange-bar" /> Marketing & Captação</h2></div>
        <div className="overview-row">
          {(() => {
            const leads = marketingCurrent?.leads ?? 0;
            const conv  = marketingCurrent?.conversion ?? 0;
            const cpl   = marketingCurrent?.cpl ?? 0;
            const avgRoi = marketingByChannel.reduce((s,c)=>s+c.roi,0) / Math.max(marketingByChannel.length, 1);
            const leadsColor = leads >= 80 ? 'var(--green)' : leads >= 40 ? 'var(--yellow)' : 'var(--red)';
            const convColor  = conv >= 35  ? 'var(--green)' : conv >= 20  ? 'var(--yellow)' : 'var(--red)';
            const cplColor   = cpl <= kpis.avgTicket / 4 ? 'var(--green)' : cpl <= kpis.avgTicket * 0.6 ? 'var(--yellow)' : 'var(--red)';
            const roiColor   = avgRoi >= 200 ? 'var(--green)' : avgRoi >= 100 ? 'var(--yellow)' : 'var(--red)';
            return (<>
              <div className="overview-card"><div className="overview-card-label">Leads</div><div className="overview-card-value" style={{color:leadsColor}}>{leads}</div></div>
              <div className="overview-card"><div className="overview-card-label">Taxa de Conversão Lead → Agendamento</div><div className="overview-card-value" style={{color:convColor}}>{renderPercentValueWithSmallSymbol(conv, 1)}</div></div>
              <div className="overview-card"><div className="overview-card-label">Custo por Lead (CPL)</div><div className="overview-card-value" style={{color:cplColor}}>{renderMoneyValueWithSmallSymbol(fmt(cpl))}</div></div>
              <div className="overview-card"><div className="overview-card-label">ROI Médio</div><div className="overview-card-value" style={{color:roiColor}}>{renderPercentValueWithSmallSymbol(avgRoi, 0)}</div></div>
            </>);
          })()}
        </div>
        <MarketingModule weeklyData={agendaWeeks} filtered={filtered} kpis={kpis} filters={filters} showTargets={filters.severity !== ''} plan="ESSENTIAL" />
      </>)}
      {/* ===== INTEGRACOES ===== */}
      {activeTab === 5 && (
        <IntegrationSection
          plan="ESSENTIAL"
          totalRecords={kpis.total}
          leads={kpis.leads}
          realized={kpis.realized}
          integrationHealth={integrationHealth}
        />
      )}
      {activeTab === 4 && (<>
        <div className="section-header"><h2><span className="orange-bar" /> Operação & UX</h2></div>
        <div className="overview-row">
          {(() => {
            const wait = opsCurrent?.waitMinutes ?? kpis.avgWait;
            const ret  = opsCurrent?.return90d   ?? kpis.returnRate;
            const sla  = opsCurrent?.slaLeadHours ?? 0;
            const npsColor  = npsGaugeValue >= 8.5 ? 'var(--green)' : npsGaugeValue >= 7.5 ? 'var(--yellow)' : 'var(--red)';
            const waitColor = wait <= 12 ? 'var(--green)' : wait <= 25 ? 'var(--yellow)' : 'var(--red)';
            const retColor  = ret  >= 40 ? 'var(--green)' : ret  >= 25 ? 'var(--yellow)' : 'var(--red)';
            const slaColor  = sla  <= 1  ? 'var(--green)' : sla  <= 4  ? 'var(--yellow)' : 'var(--red)';
            return (<>
              <div className="overview-card"><div className="overview-card-label">NPS Geral</div><div className="overview-card-value" style={{color:npsColor}}>{npsGaugeValue}</div></div>
              <div className="overview-card"><div className="overview-card-label">Espera Média</div><div className="overview-card-value" style={{color:waitColor}}>{wait.toFixed(0)} min</div></div>
              <div className="overview-card"><div className="overview-card-label">Retorno {periodReturnLabel}</div><div className="overview-card-value" style={{color:retColor}}>{ret.toFixed(1)}%</div></div>
              <div className="overview-card"><div className="overview-card-label">SLA Lead</div><div className="overview-card-value" style={{color:slaColor}}>{sla.toFixed(2)}h</div></div>
            </>);
          })()}
        </div>
        <OperacaoUXModule opsWeeks={opsWeeks} filtered={filtered} kpis={kpis} byProf={byProf} filters={filters} showTargets={filters.severity !== ''} plan="ESSENTIAL" />
      </>)}

      {/* ── KPI INFO MODAL ── */}
      {kpiModal && (
        <div
          onClick={() => setKpiModal(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 20, padding: '32px 36px',
              maxWidth: 560, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
              position: 'relative',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <span style={{ fontSize: 22, color: '#6b7280' }}>?</span>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>
                {kpiModal.title}
              </h2>
              <button
                onClick={() => setKpiModal(null)}
                style={{
                  marginLeft: 'auto', width: 32, height: 32, borderRadius: '50%',
                  border: '1px solid #e5e7eb', background: '#f9fafb',
                  cursor: 'pointer', fontSize: 16, color: '#6b7280',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ height: 1, background: '#f1f5f9', marginBottom: 20 }} />
            {/* Como calcular */}
            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Como Calcular
            </p>
            <p style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#1e293b', lineHeight: 1.5 }}>
              {kpiModal.formula}
            </p>
            <p style={{ margin: 0, fontSize: 14, color: '#64748b', lineHeight: 1.65 }}>
              {kpiModal.explanation}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(EssentialDashboard);
