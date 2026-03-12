import { useMemo, useCallback, memo } from 'react';
import ReactApexChart from 'react-apexcharts';
import { useCurrency } from '@/contexts/CurrencyContext';
import { getChartTheme } from '../utils/chartOptions';
import FilterBar from './FilterBar';
import { useTranslation } from '../i18n';
import {
  type Appointment, Filters, getAllAppointments, applyFilters, computeKPIs,
  computeByProfessional, computeByChannel, computeWeeklyTrend, getFilterOptions,
} from '../data/mockData';

interface Props {
  activeTab: number;
  lang?: "PT" | "EN" | "ES";
  theme: 'dark' | 'light' | 'night';
  visualScale: 'normal' | 'large' | 'xl';
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  appointments?: Appointment[];
}

type Priority = 'P1' | 'P2' | 'P3' | 'OK';

function movingAverage(values: number[], window = 3) {
  return values.map((_, idx) => {
    const start = Math.max(0, idx - window + 1);
    const slice = values.slice(start, idx + 1);
    return slice.reduce((s, v) => s + v, 0) / (slice.length || 1);
  });
}

function toWeekKey(dateStr: string) {
  const d = new Date(dateStr);
  const weekStart = new Date(d);
  weekStart.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return weekStart.toISOString().slice(0, 10);
}

function badgeForPriority(priority: Priority) {
  if (priority === 'P1') return { label: 'P1', className: 'red' };
  if (priority === 'P2') return { label: 'P2', className: 'yellow' };
  if (priority === 'P3') return { label: 'P3', className: 'blue' };
  return { label: 'OK', className: 'green' };
}

function EssentialDashboard({ activeTab, theme, visualScale, filters, onFiltersChange, lang = "PT", appointments }: Props) {
  const { t } = useTranslation();
  const { formatCompactMoney, formatMoney, moneyTitle } = useCurrency();
  const fmt = useCallback((value: number) => formatCompactMoney(value), [formatCompactMoney]);
  const ct = useMemo(() => getChartTheme(theme, visualScale), [theme, visualScale]);
  const allData = useMemo(() => appointments ?? getAllAppointments(), [appointments]);
  const filterOptions = useMemo(() => getFilterOptions(allData), [allData]);
  const filtered = useMemo(() => applyFilters(allData, filters), [allData, filters]);
  const kpis = useMemo(() => computeKPIs(filtered), [filtered]);
  const byProf = useMemo(() => computeByProfessional(filtered), [filtered]);
  const byChannel = useMemo(() => computeByChannel(filtered), [filtered]);
  const weeklyTrend = useMemo(() => computeWeeklyTrend(filtered), [filtered]);
  const sortedFiltered = useMemo(() => [...filtered].sort((a, b) => a.date.localeCompare(b.date)), [filtered]);
  const agendaWeeks = useMemo(() => {
    const buckets = new Map<string, typeof filtered>();
    sortedFiltered.forEach((row) => {
      const key = toWeekKey(row.date);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(row);
    });

    return Array.from(buckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-8)
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
          label: `S${idx + 1}`,
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
  const leadTimeSeries = useMemo(() => agendaWeeks.map(w => +w.leadTimeDays.toFixed(1)), [agendaWeeks]);
  const leadTimeAvgSeries = useMemo(() => movingAverage(leadTimeSeries, 3).map(v => +v.toFixed(1)), [leadTimeSeries]);
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

    const classifyNoShow = (v: number): Priority => (v > 15 ? 'P1' : v >= 12 ? 'P2' : v >= 8 ? 'P3' : 'OK');
    const classifyOccupancy = (v: number): Priority => (v < 65 ? 'P1' : v < 72 ? 'P2' : v < 80 ? 'P3' : 'OK');
    const classifyConfirm = (v: number): Priority => (v < 70 ? 'P1' : v < 78 ? 'P2' : v < 85 ? 'P3' : 'OK');
    const classifyCancelNotice = (v: number): Priority => (v < 40 && cancelTrendDown ? 'P2' : 'OK');
    const classifyChannel = (v: number): Priority => (v > 35 ? 'P1' : v > 20 ? 'P2' : 'OK');
    const classifyConsult = (v: number): Priority => (v < 60 ? 'P1' : v < 70 ? 'P2' : v < 80 ? 'P3' : 'OK');
    const classifyLead = (v: number): Priority => (v > 7 ? 'P1' : v > 5 ? 'P2' : 'OK');

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
    const d20Priority: Priority = current.d20ProgressPct < 80 ? 'P2' : 'OK';
    const netPriority: Priority = current.netPctGross < 85 ? 'P1' : current.netPctGross < 92 ? 'P2' : 'OK';
    const marginPriority: Priority = current.marginPct < 12 ? 'P1' : current.marginPct < 16 ? 'P2' : current.marginPct < 20 ? 'P3' : 'OK';
    const ticketDrop = financePrev ? ((financePrev.ticketAvg - current.ticketAvg) / Math.max(financePrev.ticketAvg, 1)) * 100 : 0;
    const ticketPriority: Priority = ticketDrop > 10 ? 'P2' : 'OK';
    const inadPriority: Priority = current.delinquencyPct > 8 ? 'P1' : current.delinquencyPct > 4 ? 'P2' : 'OK';
    const fixedPriority: Priority = current.fixedPct > 60 ? 'P1' : current.fixedPct > 45 ? 'P2' : 'OK';
    return [
      { id:'01', kpi:'Faturamento Bruto Mensal', value: fmt(current.gross), meta: fmt(grossMeta), baseN:String(current.receiptsCount), priority:d20Priority, action:'D20 Rule: projetar risco se <80% no dia 20' },
      { id:'02', kpi:'Receita Líquida', value: `${current.netPctGross.toFixed(1)}% do bruto`, meta:'> 92% do bruto', baseN:fmt(current.gross), priority:netPriority, action:'Monitorar glosas, estornos e inadimplência' },
      { id:'03', kpi:'Margem Líquida (%)', value: `${current.marginPct.toFixed(1)}%`, meta:'> 20%', baseN:fmt(current.net), priority:marginPriority, action:'Comparar benchmark da especialidade' },
      { id:'04', kpi:moneyTitle('Ticket Médio'), value: fmt(current.ticketAvg), meta: fmt(current.ticketBenchmark), baseN:String(current.consultations), priority:ticketPriority, action:'Segmentar por procedimento' },
      { id:'05', kpi:'Inadimplência (%)', value: `${current.delinquencyPct.toFixed(1)}%`, meta:'< 4%', baseN:fmt(current.gross), priority:inadPriority, action:'Cobrança ativa e política de recebíveis' },
      { id:'06', kpi:'Despesas Fixas / Receita (%)', value: `${current.fixedPct.toFixed(1)}%`, meta:'< 45%', baseN:fmt(current.net), priority:fixedPriority, action:'Revisar estrutura fixa e contratos' },
    ];
  }, [financeCurrent, financePrev]);
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
    const leadsPriority: Priority = leadsDrop > 35 ? 'P1' : leadsDrop > 20 ? 'P2' : 'OK';
    const conversionPriority: Priority = current.conversion < 20 ? 'P1' : current.conversion < 25 ? 'P2' : 'OK';
    const worstNoShowChannel = marketingByChannel.reduce((acc, c) => c.noShowRateChannel > acc.noShowRateChannel ? c : acc, marketingByChannel[0] ?? { name: '-', noShowRateChannel: 0 });
    const noShowPriority: Priority = (worstNoShowChannel.noShowRateChannel ?? 0) > 35 ? 'P1' : (worstNoShowChannel.noShowRateChannel ?? 0) > 25 ? 'P2' : 'OK';
    const cplWorsened = marketingPrev ? (((current.cpl - marketingPrev.cpl) / Math.max(marketingPrev.cpl, 1)) * 100) > 20 && current.conversion <= (marketingPrev.conversion ?? current.conversion) : false;
    const cplPriority: Priority = cplWorsened ? 'P2' : 'OK';
    const roiWorst = marketingByChannel.reduce((acc, c) => c.roi < acc.roi ? c : acc, marketingByChannel[0] ?? { name: '-', roi: 0 });
    const roiPriority: Priority = (roiWorst.roi ?? 0) < 0 ? 'P1' : 'OK';
    return [
      { id:'01', kpi:'Leads Gerados / Semana', value:String(current.leads), meta:String(current.leadMeta), baseN:String(current.leads), priority:leadsPriority, action:'Comparar semana anterior e alertar tendência' },
      { id:'02', kpi:'Conversão Lead → Agendamento (%)', value:`${current.conversion.toFixed(1)}%`, meta:'> 30%', baseN:String(current.leads), priority:conversionPriority, action:'Separar funil por canal (script quebrando)' },
      { id:'03', kpi:'No-Show por Canal de Origem (%)', value:`${(worstNoShowChannel.noShowRateChannel ?? 0).toFixed(1)}% (${(worstNoShowChannel as any).name ?? '-'})`, meta:'< média geral', baseN:String((worstNoShowChannel as any).total ?? 0), priority:noShowPriority, action:'Atacar canal com no-show acima da média' },
      { id:'04', kpi:moneyTitle('CPL'), value:fmt(current.cpl), meta:fmt(140), baseN:String(current.leads), priority:cplPriority, action:'Integrar Meta/Google Ads e revisar criativos' },
      { id:'05', kpi:'ROI por Canal (%)', value:`${(roiWorst.roi ?? 0).toFixed(0)}% (${(roiWorst as any).name ?? '-'})`, meta:'> 200%', baseN:fmt((roiWorst as any).attributedRevenue ?? 0), priority:roiPriority, action:'Suspender canal com ROI negativo' },
    ];
  }, [marketingCurrent, marketingPrev, marketingByChannel]);
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
  const slaByReception = useMemo(() => {
    const base = opsCurrent?.slaLeadHours ?? 1.2;
    return [
      { name: 'Recepção A', sla: +(base * 0.85).toFixed(2) },
      { name: 'Recepção B', sla: +(base * 1.35).toFixed(2) },
      { name: 'Recepção C', sla: +(base * 0.95).toFixed(2) },
    ];
  }, [opsCurrent]);
  const opsRules = useMemo(() => {
    if (!opsCurrent) return [];
    const npsPriority: Priority = opsCurrent.nps < 7.5 ? 'P1' : opsCurrent.nps < 8.5 ? 'P2' : 'OK';
    const waitPriority: Priority = opsCurrent.waitMinutes > 25 ? 'P1' : opsCurrent.waitMinutes > 12 ? 'P2' : 'OK';
    const returnPriority: Priority = opsCurrent.return90d < 25 ? 'P1' : opsCurrent.return90d < 40 ? 'P2' : 'OK';
    const slaPriority: Priority = opsCurrent.slaLeadHours > 4 ? 'P1' : opsCurrent.slaLeadHours > 2 ? 'P2' : 'OK';
    return [
      { id:'01', kpi:'NPS Geral (0-10)', value: opsCurrent.nps.toFixed(1), meta:'> 8,5', baseN:String(opsCurrent.npsResponses), priority:npsPriority, action:'Coleta automática WhatsApp pós-consulta' },
      { id:'02', kpi:'Tempo Médio de Espera (min)', value: `${opsCurrent.waitMinutes.toFixed(0)} min`, meta:'< 12 min', baseN:String(kpis.realized), priority:waitPriority, action:'Rebalancear agenda / encaixes' },
      { id:'03', kpi:'Taxa de Retorno 90d (%)', value: `${opsCurrent.return90d.toFixed(1)}%`, meta:'> 40%', baseN:String(kpis.realized), priority:returnPriority, action:'Cohort 180d e rotina de recall' },
      { id:'04', kpi:'SLA de Resposta ao Lead (h)', value: `${opsCurrent.slaLeadHours.toFixed(2)}h`, meta:'< 1h', baseN:String(opsCurrent.leadResponses), priority:slaPriority, action:'SLA por recepção / responsável' },
    ];
  }, [opsCurrent, kpis.realized]);

  const drillProfessional = useCallback((idx: number) => {
    const name = byProf[idx]?.name;
    if (name) onFiltersChange({ ...filters, professional: filters.professional === name ? '' : name });
  }, [byProf, filters, onFiltersChange]);

  const profClick = useMemo(() => ({
    chart: { events: { dataPointSelection: (_e: any, _c: any, cfg: any) => drillProfessional(cfg.dataPointIndex) } },
  }), [drillProfessional]);

  return (
    <div className="animate-fade-in" key={activeTab}>
      <FilterBar filters={filters} onChange={onFiltersChange} options={filterOptions} />

      {/* ===== VISÃO CEO ===== */}
      {activeTab === 0 && (<>
        <div className="section-header"><h2><span className="orange-bar" /> {t('Visão CEO — Resumo')}</h2></div>
        <div className="overview-row">
          <div className="overview-card"><div className="overview-card-label">{moneyTitle(t('Faturamento Bruto'))}</div><div className="overview-card-value">{fmt(kpis.grossRevenue)}</div><div className="overview-card-info"><div className="dot" style={{background:'var(--green)'}}/><span>{t('Período')}</span></div></div>
          <div className="overview-card"><div className="overview-card-label">{moneyTitle(t('Receita Líquida'))}</div><div className="overview-card-value">{fmt(kpis.netRevenue)}</div><div className="overview-card-info"><div className="dot" style={{background:'var(--green)'}}/><span>{t('92% do bruto')}</span></div></div>
          <div className="overview-card"><div className="overview-card-label">{t('Ocupação')}</div><div className="overview-card-value">{kpis.occupancyRate.toFixed(1)}%</div></div>
          <div className="overview-card"><div className="overview-card-label">{t('No-Show')}</div><div className="overview-card-value" style={{color: kpis.noShowRate > 10 ? 'var(--yellow)' : 'var(--green)'}}>{kpis.noShowRate.toFixed(1)}%</div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">{t('Evolução Receita')}</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{...ct.chart,type:'area'},fill:{type:'gradient',gradient:{shadeIntensity:1,opacityFrom:0.4,opacityTo:0}},colors:['#ff5a1f','#45a29e'],xaxis:{...ct.xaxis,categories:weeklyTrend.map(w=>w.label)},legend:{...ct.legend,show:true,position:'bottom' as const}}} series={[{name:t('Bruto'),data:weeklyTrend.map(w=>Math.round(w.grossRevenue))},{name:t('Líquido'),data:weeklyTrend.map(w=>Math.round(w.netRevenue))}]} type="area" height={220}/>
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">{t('Indicadores Semáforo')}</span></div><div className="chart-card-body" style={{padding:18}}>
            <table className="data-table"><thead><tr><th>{t('Indicador')}</th><th>{t('Valor')}</th><th>{t('Meta')}</th><th>{t('Status')}</th></tr></thead><tbody>
              <tr><td>{t('No-Show')}</td><td style={{fontWeight:700}}>{kpis.noShowRate.toFixed(1)}%</td><td>{'<'} 10%</td><td><span className={`chart-card-badge ${kpis.noShowRate<=10?'green':kpis.noShowRate<=15?'yellow':'red'}`} style={{display:'inline-block'}}>{kpis.noShowRate<=10?t('OK'):kpis.noShowRate<=15?t('ATENÇÃO'):t('CRÍTICO')}</span></td></tr>
              <tr><td>{t('Ocupação')}</td><td style={{fontWeight:700}}>{kpis.occupancyRate.toFixed(1)}%</td><td>{'>'} 75%</td><td><span className={`chart-card-badge ${kpis.occupancyRate>=75?'green':'yellow'}`} style={{display:'inline-block'}}>{kpis.occupancyRate>=75?t('OK'):t('ATENÇÃO')}</span></td></tr>
              <tr><td>{t('NPS')}</td><td style={{fontWeight:700}}>{kpis.avgNPS.toFixed(1)}</td><td>{'>'} 8.0</td><td><span className={`chart-card-badge ${kpis.avgNPS>=8?'green':'yellow'}`} style={{display:'inline-block'}}>{kpis.avgNPS>=8?t('OK'):t('ATENÇÃO')}</span></td></tr>
              <tr><td>{t('Margem')}</td><td style={{fontWeight:700}}>{kpis.margin.toFixed(1)}%</td><td>{'>'} 20%</td><td><span className={`chart-card-badge ${kpis.margin>=20?'green':'red'}`} style={{display:'inline-block'}}>{kpis.margin>=20?t('OK'):t('CRÍTICO')}</span></td></tr>
            </tbody></table>
          </div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">{t('Ocupação Semanal (detalhe)')}</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{...ct.chart,type:'line'},stroke:{curve:'smooth' as const,width:3},colors:['#3b82f6'],markers:{size:4,colors:['#3b82f6']},xaxis:{...ct.xaxis,categories:weeklyTrend.map(w=>w.label)},annotations:{yaxis:[{y:75,borderColor:'#22c55e',strokeDashArray:4,label:{text:t('Meta 75%'),style:{color:'#fff',background:'#22c55e'}}}]}}} series={[{name:t('Ocupação %'),data:weeklyTrend.map(w=>+w.occupancyRate.toFixed(1))}]} type="line" height={220}/>
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">{t('Faturamento por Profissional')}</span><span style={{fontSize:10,color:'var(--text-muted)'}}>{t('🔍 Clique')}</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,...profClick,chart:{...ct.chart,type:'bar',...profClick.chart},plotOptions:{bar:{distributed:true,columnWidth:'55%',borderRadius:4}},colors:['#ff5a1f','#45a29e','#3b82f6'],xaxis:{...ct.xaxis,categories:byProf.map(p=>p.name)},legend:{show:false}}} series={[{name:t('Receita'),data:byProf.map(p=>Math.round(p.grossRevenue))}]} type="bar" height={220}/>
          </div></div>
        </div>
      </>)}

      {/* ===== AGENDA ===== */}
      {activeTab === 1 && (<>
        <div className="section-header"><h2><span className="orange-bar" /> {t('Agenda & No-Show')}</h2></div>
        <div className="overview-row">
          <div className="overview-card"><div className="overview-card-label">Total Agendamentos</div><div className="overview-card-value">{kpis.total}</div></div>
          <div className="overview-card"><div className="overview-card-label">Realizadas</div><div className="overview-card-value">{kpis.realized}</div></div>
          <div className="overview-card"><div className="overview-card-label">Ocupação</div><div className="overview-card-value">{kpis.occupancyRate.toFixed(1)}%</div></div>
          <div className="overview-card"><div className="overview-card-label">No-Show</div><div className="overview-card-value" style={{color:kpis.noShowRate>10?'var(--yellow)':'var(--green)'}}>{kpis.noShowRate.toFixed(1)}%</div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">01 Taxa de No-Show (%)</span><span style={{fontSize:10,color:'var(--text-muted)'}}>Linha interativa + thresholds</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{...ct.chart,type:'line'},stroke:{curve:'smooth' as const,width:[3,2,2,2]},colors:['#ef4444','#f97316','#3b82f6','#22c55e'],markers:{size:[4,0,0,0]},xaxis:{...ct.xaxis,categories:agendaWeeks.map(w=>w.label)},annotations:{yaxis:[{y:15,borderColor:'#ef4444',strokeDashArray:4,label:{text:'P1 > 15%',style:{color:'#fff',background:'#ef4444'}}},{y:10,borderColor:'#f97316',strokeDashArray:4,label:{text:'P2 10-15',style:{color:'#fff',background:'#f97316'}}},{y:8,borderColor:'#3b82f6',strokeDashArray:4,label:{text:'P3 8-10',style:{color:'#fff',background:'#3b82f6'}}}]},legend:{...ct.legend,show:true,position:'bottom' as const}}} series={[{name:'No-Show %',data:agendaWeeks.map(w=>+w.noShowRate.toFixed(1))},{name:'P2/P1',data:agendaWeeks.map(()=>15)},{name:'P3',data:agendaWeeks.map(()=>8)},{name:'Meta',data:agendaWeeks.map(()=>10)}]} type="line" height={220}/>
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">05 Agendamentos por Canal</span><span style={{fontSize:10,color:'var(--text-muted)'}}>Stacked bar interativo</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{...ct.chart,type:'bar',stacked:true},plotOptions:{bar:{columnWidth:'52%',borderRadius:3}},colors:['#22c55e','#ef4444','#eab308','#3b82f6'],xaxis:{...ct.xaxis,categories:channelStatusBreakdown.map(c=>c.name)},legend:{...ct.legend,show:true,position:'bottom' as const}}} series={[{name:'Realizadas',data:channelStatusBreakdown.map(c=>c.realized)},{name:'No-Show',data:channelStatusBreakdown.map(c=>c.noShows)},{name:'Canceladas',data:channelStatusBreakdown.map(c=>c.canceled)},{name:'Confirmadas',data:channelStatusBreakdown.map(c=>Math.max(0,c.total-c.realized-c.noShows-c.canceled))}]} type="bar" height={220}/>
          </div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">02 Taxa de Ocupação (%)</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{...ct.chart,type:'line'},stroke:{curve:'smooth' as const,width:3},colors:['#3b82f6'],markers:{size:4,colors:['#3b82f6']},xaxis:{...ct.xaxis,categories:agendaWeeks.map(w=>w.label)},annotations:{yaxis:[{y:75,borderColor:'#22c55e',strokeDashArray:4,label:{text:'Meta > 75%',style:{color:'#fff',background:'#22c55e'}}},{y:70,borderColor:'#3b82f6',strokeDashArray:4,label:{text:'P3 70-75',style:{color:'#fff',background:'#3b82f6'}}},{y:60,borderColor:'#eab308',strokeDashArray:4,label:{text:'P2 60-70',style:{color:'#111',background:'#eab308'}}}]}}} series={[{name:'Ocupação %',data:agendaWeeks.map(w=>+w.occupancyRate.toFixed(1))}]} type="line" height={220}/>
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">03 Confirmações Realizadas (%)</span><span style={{fontSize:10,color:'var(--text-muted)'}}>Combo barra + linha</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{...ct.chart,type:'line'},stroke:{width:[0,3,2],curve:'smooth' as const},plotOptions:{bar:{columnWidth:'45%',borderRadius:4}},colors:['#3b82f6','#22c55e','#64748b'],xaxis:{...ct.xaxis,categories:agendaWeeks.map(w=>w.label)},annotations:{yaxis:[{y:80,borderColor:'#22c55e',strokeDashArray:4,label:{text:'Meta 80%',style:{color:'#fff',background:'#22c55e'}}}]},legend:{...ct.legend,show:true,position:'bottom' as const}}} series={[{name:'Confirmações %',type:'column',data:agendaWeeks.map(w=>+w.confirmationRate.toFixed(1))},{name:'Meta %',type:'line',data:agendaWeeks.map(()=>80)},{name:'Base N',type:'line',data:agendaWeeks.map(w=>w.total)}]} type="line" height={220}/>
          </div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">04 Cancelamentos com Aviso (%)</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{...ct.chart,type:'line'},stroke:{curve:'smooth' as const,width:[3,2]},colors:['#f59e0b','#22c55e'],xaxis:{...ct.xaxis,categories:agendaWeeks.map(w=>w.label)},annotations:{yaxis:[{y:60,borderColor:'#22c55e',strokeDashArray:4,label:{text:'Meta 60%',style:{color:'#fff',background:'#22c55e'}}},{y:40,borderColor:'#eab308',strokeDashArray:4,label:{text:'P2 < 40%',style:{color:'#111',background:'#eab308'}}}]},legend:{...ct.legend,show:true,position:'bottom' as const}}} series={[{name:'Cancel c/ aviso %',data:agendaWeeks.map(w=>+w.cancelNoticeRate.toFixed(1))},{name:'Meta',data:agendaWeeks.map(()=>60)}]} type="line" height={220}/>
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">06 Consultas Realizadas / Semana</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{...ct.chart,type:'bar'},plotOptions:{bar:{columnWidth:'50%',borderRadius:4}},colors:['#22c55e','#64748b'],xaxis:{...ct.xaxis,categories:agendaWeeks.map(w=>w.label)},legend:{...ct.legend,show:true,position:'bottom' as const}}} series={[{name:'Realizadas',data:agendaWeeks.map(w=>w.realized)},{name:'Meta semanal',data:agendaWeeks.map(w=>w.weeklyTarget)}]} type="bar" height={220}/>
          </div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">07 Lead Time do Agendamento (dias)</span><span style={{fontSize:10,color:'var(--text-muted)'}}>Linha + média móvel</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{...ct.chart,type:'line'},stroke:{curve:'smooth' as const,width:[3,2,2]},colors:['#a855f7','#3b82f6','#22c55e'],xaxis:{...ct.xaxis,categories:agendaWeeks.map(w=>w.label)},annotations:{yaxis:[{y:3,borderColor:'#22c55e',strokeDashArray:4,label:{text:'Meta < 3d',style:{color:'#fff',background:'#22c55e'}}},{y:5,borderColor:'#eab308',strokeDashArray:4,label:{text:'P2 > 5d',style:{color:'#111',background:'#eab308'}}},{y:7,borderColor:'#ef4444',strokeDashArray:4,label:{text:'P1 > 7d',style:{color:'#fff',background:'#ef4444'}}}]},legend:{...ct.legend,show:true,position:'bottom' as const}}} series={[{name:'Lead time (d)',data:leadTimeSeries},{name:'Média móvel',data:leadTimeAvgSeries},{name:'Meta',data:agendaWeeks.map(()=>3)}]} type="line" height={220}/>
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">Drill-down de No-Show por Canal</span><span style={{fontSize:10,color:'var(--text-muted)'}}>Identifica canais com maior no-show</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{...ct.chart,type:'bar'},plotOptions:{bar:{horizontal:true,distributed:true,barHeight:'58%',borderRadius:4}},colors:['#ef4444','#f97316','#eab308','#3b82f6','#22c55e','#64748b'],annotations:{xaxis:[{x:10,borderColor:'#f97316',strokeDashArray:4,label:{text:'Meta 10%',style:{color:'#fff',background:'#f97316'}}}]},legend:{show:false}}} series={[{name:'No-Show %',data:channelStatusBreakdown.map(c => ({ x: c.name, y: +c.noShowRate.toFixed(1) }))}]} type="bar" height={220}/>
          </div></div>
        </div>
      </>)}
      {/* ===== FINANCEIRO ===== */}
      {activeTab === 2 && (<>
        <div className="section-header"><h2><span className="orange-bar" /> Financeiro Executivo</h2></div>
        <div className="overview-row">
          <div className="overview-card"><div className="overview-card-label">{moneyTitle('Faturamento Bruto')}</div><div className="overview-card-value">{fmt(financeCurrent?.gross ?? 0)}</div></div>
          <div className="overview-card"><div className="overview-card-label">{moneyTitle('Receita Líquida')}</div><div className="overview-card-value">{fmt(financeCurrent?.net ?? 0)}</div></div>
          <div className="overview-card"><div className="overview-card-label">Margem Líquida</div><div className="overview-card-value" style={{color:(financeCurrent?.marginPct ?? 0) >= 18 ? 'var(--green)' : 'var(--yellow)'}}>{(financeCurrent?.marginPct ?? 0).toFixed(1)}%</div></div>
          <div className="overview-card"><div className="overview-card-label">{moneyTitle('Ticket Médio')}</div><div className="overview-card-value">{fmt(financeCurrent?.ticketAvg ?? 0)}</div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">01 Faturamento Bruto Mensal (R$)</span><span style={{fontSize:10,color:'var(--text-muted)'}}>Coluna + meta proporcional (D20)</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{...ct.chart,type:'bar'},plotOptions:{bar:{columnWidth:'52%',borderRadius:4}},colors:['#ff5a1f','#64748b'],xaxis:{...ct.xaxis,categories:financeWeeks.map(w=>w.label)},annotations:{yaxis:[{y:(financeCurrent?.gross ?? 0)*1.12,borderColor:'#22c55e',strokeDashArray:4,label:{text:'Meta setup',style:{color:'#fff',background:'#22c55e'}}}]},legend:{...ct.legend,show:true,position:'bottom' as const}}} series={[{name:'Bruto',data:financeWeeks.map(w=>Math.round(w.gross))},{name:'Meta proporcional D20',data:financeWeeks.map(w=>Math.round(w.gross*(w.d20ThresholdPct/Math.max(w.d20ProgressPct,1))))}]} type="bar" height={220}/>
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">02 Receita Líquida (R$)</span><span style={{fontSize:10,color:'var(--text-muted)'}}>Bruto - cancelamentos - inadimplência - estornos - glosas</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{...ct.chart,type:'bar',stacked:true},plotOptions:{bar:{columnWidth:'52%',borderRadius:3}},colors:['#22c55e','#ef4444','#eab308','#8b5cf6','#3b82f6'],xaxis:{...ct.xaxis,categories:financeWeeks.map(w=>w.label)},legend:{...ct.legend,show:true,position:'bottom' as const}}} series={[{name:'Receita líquida',data:financeWeeks.map(w=>Math.round(w.net))},{name:'Cancelamentos',data:financeWeeks.map(w=>Math.round(w.cancelLoss))},{name:'Inadimplência',data:financeWeeks.map(w=>Math.round(w.delinquency))},{name:'Estornos',data:financeWeeks.map(w=>Math.round(w.chargebacks))},{name:'Glosas convênio',data:financeWeeks.map(w=>Math.round(w.conventionGlosas))}]} type="bar" height={220}/>
          </div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">03 Margem Líquida (%)</span><span style={{fontSize:10,color:'var(--text-muted)'}}>Linha + zonas de risco + benchmark</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{...ct.chart,type:'line'},stroke:{curve:'smooth' as const,width:[3,2]},colors:['#a855f7','#94a3b8'],xaxis:{...ct.xaxis,categories:financeWeeks.map(w=>w.label)},annotations:{yaxis:[{y:18,borderColor:'#22c55e',strokeDashArray:4,label:{text:'Meta 18%',style:{color:'#fff',background:'#22c55e'}}},{y:15,borderColor:'#3b82f6',strokeDashArray:4,label:{text:'P3 15-18',style:{color:'#fff',background:'#3b82f6'}}},{y:12,borderColor:'#eab308',strokeDashArray:4,label:{text:'P2 12-15',style:{color:'#111',background:'#eab308'}}}]},fill:{type:'gradient',gradient:{shadeIntensity:1,opacityFrom:0.18,opacityTo:0}},legend:{...ct.legend,show:true,position:'bottom' as const}}} series={[{name:'Margem líquida %',data:financeWeeks.map(w=>+w.marginPct.toFixed(1))},{name:'Benchmark setor',data:financeWeeks.map(()=>16.5)}]} type="line" height={220}/>
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">04 Ticket Médio (R$)</span><span style={{fontSize:10,color:'var(--text-muted)'}}>Benchmark da especialidade</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{...ct.chart,type:'line'},stroke:{curve:'smooth' as const,width:[3,2]},colors:['#ff5a1f','#22c55e'],xaxis:{...ct.xaxis,categories:financeWeeks.map(w=>w.label)},legend:{...ct.legend,show:true,position:'bottom' as const}}} series={[{name:'Ticket médio',data:financeWeeks.map(w=>Math.round(w.ticketAvg))},{name:'Benchmark especialidade',data:financeWeeks.map(w=>Math.round(w.ticketBenchmark))}]} type="line" height={220}/>
          </div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">05 Inadimplência (%)</span><span style={{fontSize:10,color:'var(--text-muted)'}}>Bullet chart executivo</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{type:'bar'},plotOptions:{bar:{horizontal:true,barHeight:'45%',borderRadius:4}},colors:['#ef4444'],xaxis:{...ct.xaxis,max:12},annotations:{xaxis:[{x:5,borderColor:'#22c55e',strokeDashArray:4,label:{text:'Meta 5%',style:{color:'#fff',background:'#22c55e'}}},{x:8,borderColor:'#ef4444',strokeDashArray:4,label:{text:'P1 8%',style:{color:'#fff',background:'#ef4444'}}}]},legend:{show:false}}} series={[{name:'Inadimplência %',data:[+(financeCurrent?.delinquencyPct ?? 0).toFixed(1)]}]} type="bar" height={180}/>
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">06 Despesas Fixas / Receita (%)</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{...ct.chart,type:'area'},fill:{type:'gradient',gradient:{shadeIntensity:1,opacityFrom:0.22,opacityTo:0}},colors:['#f59e0b'],xaxis:{...ct.xaxis,categories:financeWeeks.map(w=>w.label)},annotations:{yaxis:[{y:50,borderColor:'#22c55e',strokeDashArray:4,label:{text:'Meta 50%',style:{color:'#fff',background:'#22c55e'}}},{y:60,borderColor:'#ef4444',strokeDashArray:4,label:{text:'P1 > 60%',style:{color:'#fff',background:'#ef4444'}}}]}}} series={[{name:'Despesas fixas / receita %',data:financeWeeks.map(w=>+w.fixedPct.toFixed(1))}]} type="area" height={220}/>
          </div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">07 Posição de Caixa (R$)</span><span style={{fontSize:10,color:'var(--text-muted)'}}>Linha histórica + projeção 15d</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{...ct.chart,type:'line'},stroke:{curve:'smooth' as const,width:[3,3]},colors:['#22c55e','#3b82f6'],xaxis:{...ct.xaxis,categories:[...cashProjection.historical.map(p=>p.label), ...cashProjection.projected.map(p=>p.label)]},annotations:{yaxis:[{y:0,borderColor:'#ef4444',strokeDashArray:4,label:{text:'Zero caixa',style:{color:'#fff',background:'#ef4444'}}}]},legend:{...ct.legend,show:true,position:'bottom' as const}}} series={[{name:'Caixa histórico',data:[...cashProjection.historical.map(p=>Math.round(p.cash)), ...cashProjection.projected.map(()=>null as any)]},{name:'Caixa projetado 15d',data:[...cashProjection.historical.map(()=>null as any), ...cashProjection.projected.map(p=>Math.round(p.cash))]}]} type="line" height={220}/>
          </div></div>
        </div>
      </>)}
      {/* ===== MARKETING ===== */}
      {activeTab === 3 && (<>
        <div className="section-header"><h2><span className="orange-bar" /> Marketing & Captação</h2></div>
        <div className="overview-row">
          <div className="overview-card"><div className="overview-card-label">Leads / Semana</div><div className="overview-card-value">{marketingCurrent?.leads ?? 0}</div></div>
          <div className="overview-card"><div className="overview-card-label">Conversão Lead → Agendamento</div><div className="overview-card-value">{(marketingCurrent?.conversion ?? 0).toFixed(1)}%</div></div>
          <div className="overview-card"><div className="overview-card-label">{moneyTitle('CPL')}</div><div className="overview-card-value">{fmt(marketingCurrent?.cpl ?? 0)}</div></div>
          <div className="overview-card"><div className="overview-card-label">ROI Médio por Canal</div><div className="overview-card-value" style={{color:(marketingByChannel.reduce((s,c)=>s+c.roi,0)/Math.max(marketingByChannel.length,1)) > 200 ? 'var(--green)' : 'var(--yellow)'}}>{(marketingByChannel.reduce((s,c)=>s+c.roi,0)/Math.max(marketingByChannel.length,1)).toFixed(0)}%</div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">01 Leads Gerados / Semana</span><span style={{fontSize:10,color:'var(--text-muted)'}}>Coluna semanal + linha de meta</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{...ct.chart,type:'line'},stroke:{width:[0,3],curve:'smooth' as const},plotOptions:{bar:{columnWidth:'46%',borderRadius:4}},colors:['#3b82f6','#22c55e'],xaxis:{...ct.xaxis,categories:marketingWeeks.map(w=>w.label)},legend:{...ct.legend,show:true,position:'bottom' as const}}} series={[{name:'Leads',type:'column',data:marketingWeeks.map(w=>w.leads)},{name:'Meta',type:'line',data:marketingWeeks.map(w=>w.leadMeta)}]} type="line" height={220}/>
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">02 Conversão Lead → Agendamento (%)</span><span style={{fontSize:10,color:'var(--text-muted)'}}>Meta alvo 30%</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{...ct.chart,type:'line'},stroke:{curve:'smooth' as const,width:[3,2]},colors:['#ff5a1f','#22c55e'],xaxis:{...ct.xaxis,categories:marketingWeeks.map(w=>w.label)},annotations:{yaxis:[{y:30,borderColor:'#22c55e',strokeDashArray:4,label:{text:'Meta 30%',style:{color:'#fff',background:'#22c55e'}}},{y:25,borderColor:'#eab308',strokeDashArray:4,label:{text:'P2 20-25',style:{color:'#111',background:'#eab308'}}},{y:20,borderColor:'#ef4444',strokeDashArray:4,label:{text:'P1 < 20%',style:{color:'#fff',background:'#ef4444'}}}]},legend:{...ct.legend,show:true,position:'bottom' as const}}} series={[{name:'Conversão %',data:marketingWeeks.map(w=>+w.conversion.toFixed(1))},{name:'Meta',data:marketingWeeks.map(()=>30)}]} type="line" height={220}/>
          </div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">03 No-Show por Canal de Origem (%)</span><span style={{fontSize:10,color:'var(--text-muted)'}}>Barra comparativa por canal</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{type:'bar'},plotOptions:{bar:{horizontal:true,distributed:true,barHeight:'60%',borderRadius:4}},colors:['#ef4444','#f97316','#eab308','#3b82f6','#22c55e','#64748b'],xaxis:{...ct.xaxis},annotations:{xaxis:[{x:kpis.noShowRate,borderColor:'#22c55e',strokeDashArray:4,label:{text:'Média geral',style:{color:'#fff',background:'#22c55e'}}},{x:25,borderColor:'#eab308',strokeDashArray:4,label:{text:'P2 25%',style:{color:'#111',background:'#eab308'}}},{x:35,borderColor:'#ef4444',strokeDashArray:4,label:{text:'P1 35%',style:{color:'#fff',background:'#ef4444'}}}]},legend:{show:false}}} series={[{name:'No-Show %',data:marketingByChannel.map(c=>({x:c.name,y:+c.noShowRateChannel.toFixed(1)}))}]} type="bar" height={220}/>
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">04 Custo por Lead — CPL (R$)</span><span style={{fontSize:10,color:'var(--text-muted)'}}>Benchmark + alerta sem melhora em conversão</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{...ct.chart,type:'line'},stroke:{curve:'smooth' as const,width:[3,2]},colors:['#8b5cf6','#22c55e'],xaxis:{...ct.xaxis,categories:marketingWeeks.map(w=>w.label)},annotations:{yaxis:[{y:140,borderColor:'#22c55e',strokeDashArray:4,label:{text:'Benchmark',style:{color:'#fff',background:'#22c55e'}}}]},legend:{...ct.legend,show:true,position:'bottom' as const}}} series={[{name:'CPL',data:marketingWeeks.map(w=>Math.round(w.cpl))},{name:'Benchmark especialidade',data:marketingWeeks.map(()=>140)}]} type="line" height={220}/>
          </div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">05 ROI por Canal de Marketing (%)</span><span style={{fontSize:10,color:'var(--text-muted)'}}>Barra ordenada + semáforo</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{type:'bar'},plotOptions:{bar:{horizontal:true,borderRadius:4,distributed:true,barHeight:'58%'}},colors:marketingByChannel.map(c=>c.roi<0?'#ef4444':c.roi<200?'#eab308':'#22c55e'),xaxis:{...ct.xaxis},annotations:{xaxis:[{x:200,borderColor:'#22c55e',strokeDashArray:4,label:{text:'Meta 200%',style:{color:'#fff',background:'#22c55e'}}},{x:0,borderColor:'#ef4444',strokeDashArray:4,label:{text:'ROI negativo',style:{color:'#fff',background:'#ef4444'}}}]},legend:{show:false}}} series={[{name:'ROI %',data:[...marketingByChannel].sort((a,b)=>b.roi-a.roi).map(c=>({x:c.name,y:+c.roi.toFixed(0)}))}]} type="bar" height={240}/>
          </div></div>
        </div>
      </>)}
      {/* ===== OPERAÇÃO ===== */}
      {activeTab === 4 && (<>
        <div className="section-header"><h2><span className="orange-bar" /> Operação & Experiência</h2></div>
        <div className="overview-row">
          <div className="overview-card"><div className="overview-card-label">NPS Geral</div><div className="overview-card-value" style={{color:npsGaugeValue >= 8 ? 'var(--green)' : 'var(--yellow)'}}>{npsGaugeValue}</div></div>
          <div className="overview-card"><div className="overview-card-label">Espera média</div><div className="overview-card-value">{(opsCurrent?.waitMinutes ?? kpis.avgWait).toFixed(0)} min</div></div>
          <div className="overview-card"><div className="overview-card-label">Retorno 90d</div><div className="overview-card-value">{(opsCurrent?.return90d ?? kpis.returnRate).toFixed(1)}%</div></div>
          <div className="overview-card"><div className="overview-card-label">SLA Lead</div><div className="overview-card-value">{(opsCurrent?.slaLeadHours ?? 0).toFixed(2)}h</div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">01 NPS Geral (0-10)</span><span style={{fontSize:10,color:'var(--text-muted)'}}>Gauge executivo + tendência mensal</span></div><div className="chart-card-body">
            <div style={{display:'grid',gridTemplateColumns:'1fr 1.4fr',gap:12,alignItems:'center'}}>
              <ReactApexChart options={{...ct,chart:{type:'radialBar'},plotOptions:{radialBar:{startAngle:-120,endAngle:120,track:{background:'rgba(255,255,255,0.08)'},dataLabels:{name:{show:true,fontSize:'12px'},value:{show:true,fontSize:'24px',formatter:(v:any)=>`${(Number(v)/10).toFixed(1)}`}}}},labels:['NPS']}} series={[Math.max(0, Math.min(100, npsGaugeValue * 10))]} type="radialBar" height={240}/>
              <ReactApexChart options={{...ct,chart:{...ct.chart,type:'line'},stroke:{curve:'smooth' as const,width:[3,2]},colors:['#22c55e','#ff5a1f'],xaxis:{...ct.xaxis,categories:opsWeeks.map(w=>w.label)},annotations:{yaxis:[{y:8,borderColor:'#22c55e',strokeDashArray:4,label:{text:'Meta 8.0',style:{color:'#fff',background:'#22c55e'}}},{y:7.5,borderColor:'#ef4444',strokeDashArray:4,label:{text:'P1 7.5',style:{color:'#fff',background:'#ef4444'}}}]},legend:{...ct.legend,show:true,position:'bottom' as const}}} series={[{name:'NPS',data:opsWeeks.map(w=>+w.nps.toFixed(1))},{name:'Meta',data:opsWeeks.map(()=>8)}]} type="line" height={240}/>
            </div>
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">02 Tempo Médio de Espera (min)</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{...ct.chart,type:'bar'},plotOptions:{bar:{distributed:true,columnWidth:'50%',borderRadius:4}},colors:['#eab308','#ff5a1f','#3b82f6'],xaxis:{...ct.xaxis,categories:byProf.map(p=>p.name)},annotations:{yaxis:[{y:15,borderColor:'#22c55e',strokeDashArray:4,label:{text:'Meta 15min',style:{color:'#fff',background:'#22c55e'}}},{y:25,borderColor:'#ef4444',strokeDashArray:4,label:{text:'P1 25min',style:{color:'#fff',background:'#ef4444'}}}]},legend:{show:false}}} series={[{name:'Espera (min)',data:byProf.map((p,idx)=>Math.round(p.avgWait + (idx%2)*3))}]} type="bar" height={240}/>
          </div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">03 Taxa de Retorno / Fidelização (%)</span><span style={{fontSize:10,color:'var(--text-muted)'}}>Linha + cohort 90d/180d</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{...ct.chart,type:'line'},stroke:{curve:'smooth' as const,width:[3,2,2]},colors:['#22c55e','#3b82f6','#ff5a1f'],xaxis:{...ct.xaxis,categories:opsWeeks.map(w=>w.label)},annotations:{yaxis:[{y:35,borderColor:'#22c55e',strokeDashArray:4,label:{text:'Meta 35%',style:{color:'#fff',background:'#22c55e'}}},{y:30,borderColor:'#eab308',strokeDashArray:4,label:{text:'P2 20-30',style:{color:'#111',background:'#eab308'}}},{y:20,borderColor:'#ef4444',strokeDashArray:4,label:{text:'P1 20%',style:{color:'#fff',background:'#ef4444'}}}]},legend:{...ct.legend,show:true,position:'bottom' as const}}} series={[{name:'Cohort 90d',data:opsWeeks.map(w=>+w.return90d.toFixed(1))},{name:'Cohort 180d',data:opsWeeks.map(w=>+w.return180d.toFixed(1))},{name:'Meta',data:opsWeeks.map(()=>35)}]} type="line" height={240}/>
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">04 SLA de Resposta ao Lead (horas)</span><span style={{fontSize:10,color:'var(--text-muted)'}}>GAP corrigido: SLA por funcionário da recepção</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{...ct.chart,type:'line'},stroke:{curve:'smooth' as const,width:[3,2,2]},colors:['#8b5cf6','#22c55e','#ef4444'],xaxis:{...ct.xaxis,categories:opsWeeks.map(w=>w.label)},annotations:{yaxis:[{y:1,borderColor:'#22c55e',strokeDashArray:4,label:{text:'Meta 1h',style:{color:'#fff',background:'#22c55e'}}},{y:2,borderColor:'#eab308',strokeDashArray:4,label:{text:'P2 2h',style:{color:'#111',background:'#eab308'}}},{y:4,borderColor:'#ef4444',strokeDashArray:4,label:{text:'P1 4h',style:{color:'#fff',background:'#ef4444'}}}]},legend:{...ct.legend,show:true,position:'bottom' as const}}} series={[{name:'SLA médio (h)',data:opsWeeks.map(w=>+w.slaLeadHours.toFixed(2))},{name:'Meta',data:opsWeeks.map(()=>1)},{name:'P2 limiar',data:opsWeeks.map(()=>2)}]} type="line" height={170}/>
            <ReactApexChart options={{...ct,chart:{type:'bar'},plotOptions:{bar:{horizontal:true,distributed:true,barHeight:'55%',borderRadius:4}},colors:['#22c55e','#ef4444','#3b82f6'],xaxis:{...ct.xaxis,max:6},legend:{show:false}}} series={[{name:'SLA por recepção (h)',data:slaByReception.map(r=>({x:r.name,y:r.sla}))}]} type="bar" height={160}/>
          </div></div>
        </div>
        <div className="chart-card">
          <div className="chart-card-header"><span className="chart-card-title">Tabela Operação & Experiência (P1/P2)</span><span style={{fontSize:10,color:'var(--text-muted)'}}>Alertas e ações imediatas</span></div>
          <div className="chart-card-body" style={{padding:12}}>
            <table className="data-table"><thead><tr><th>ID</th><th>KPI</th><th>Valor</th><th>Meta</th><th>Base N</th><th>Status</th><th>Ação</th></tr></thead><tbody>
              {opsRules.map((row) => { const badge = badgeForPriority(row.priority); return <tr key={row.id}><td>{row.id}</td><td>{row.kpi}</td><td style={{fontWeight:700}}>{row.value}</td><td>{row.meta}</td><td>{row.baseN}</td><td><span className={`chart-card-badge ${badge.className}`} style={{display:'inline-block'}}>{badge.label}</span></td><td>{row.action}</td></tr>; })}
            </tbody></table>
          </div>
        </div>
      </>)}    </div>
  );
}

export default memo(EssentialDashboard);


