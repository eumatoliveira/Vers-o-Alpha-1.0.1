import { useMemo, useCallback, memo, useState } from 'react';
import ReactApexChart from 'react-apexcharts';
import { useCurrency } from '@/contexts/CurrencyContext';
import { getChartTheme } from '../utils/chartOptions';
import FilterBar from './FilterBar';
import {
  type Appointment, Filters, getAllAppointments, applyFilters, computeKPIs,
  computeByProfessional, computeByChannel, computeByProcedure,
  computeByWeekday, computeWeeklyTrend, getFilterOptions,
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
type ProfessionalRow = ReturnType<typeof computeByProfessional>[number];

type TeamMemberForm = {
  name: string;
  role: string;
  realized: string;
  grossRevenue: string;
  avgTicket: string;
  avgNPS: string;
  noShowRate: string;
  occupancyRate: string;
  avgWait: string;
};

function weekKey(dateStr: string) {
  const d = new Date(dateStr);
  const ws = new Date(d);
  ws.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return ws.toISOString().slice(0, 10);
}

function badge(priority: Priority) {
  if (priority === 'P1') return { label: 'P1', className: 'red' };
  if (priority === 'P2') return { label: 'P2', className: 'yellow' };
  if (priority === 'P3') return { label: 'P3', className: 'blue' };
  return { label: 'OK', className: 'green' };
}

const EMPTY_TEAM_MEMBER_FORM: TeamMemberForm = {
  name: '',
  role: '',
  realized: '',
  grossRevenue: '',
  avgTicket: '',
  avgNPS: '',
  noShowRate: '',
  occupancyRate: '',
  avgWait: '',
};

function ProDashboard({ activeTab, theme, visualScale, filters, onFiltersChange, lang = "PT", appointments }: Props) {
  const { currency, convertMoneyValue, formatCompactMoney, formatMoney, moneyTitle } = useCurrency();
  const fmt = useCallback((value: number) => formatCompactMoney(value), [formatCompactMoney]);
  const ct = useMemo(() => getChartTheme(theme, visualScale), [theme, visualScale]);
  const allData = useMemo(() => appointments ?? getAllAppointments(), [appointments]);
  const filterOptions = useMemo(() => getFilterOptions(allData), [allData]);
  const filtered = useMemo(() => applyFilters(allData, filters), [allData, filters]);
  const kpis = useMemo(() => computeKPIs(filtered), [filtered]);
  const byProf = useMemo(() => computeByProfessional(filtered), [filtered]);
  const byChannel = useMemo(() => computeByChannel(filtered), [filtered]);
  const byProc = useMemo(() => computeByProcedure(filtered), [filtered]);
  const byWeekday = useMemo(() => computeByWeekday(filtered), [filtered]);
  const weeklyTrend = useMemo(() => computeWeeklyTrend(filtered), [filtered]);
  const [teamMemberForm, setTeamMemberForm] = useState<TeamMemberForm>(EMPTY_TEAM_MEMBER_FORM);
  const [manualTeamMembers, setManualTeamMembers] = useState<ProfessionalRow[]>([]);
  const [editingManualTeamMemberIndex, setEditingManualTeamMemberIndex] = useState<number | null>(null);
  const [editingBaseTeamMemberName, setEditingBaseTeamMemberName] = useState<string | null>(null);
  const [deletedBaseTeamMemberNames, setDeletedBaseTeamMemberNames] = useState<string[]>([]);
  const [baseTeamMemberOverrides, setBaseTeamMemberOverrides] = useState<Record<string, ProfessionalRow>>({});
  const activeChannels = useMemo(() => byChannel.filter(c => c.total > 0), [byChannel]);
  const displayedTeamMembers = useMemo(() => [
    ...byProf
      .filter((member) => !deletedBaseTeamMemberNames.includes(member.name))
      .map((member) => baseTeamMemberOverrides[member.name] ?? member),
    ...manualTeamMembers,
  ], [baseTeamMemberOverrides, byProf, deletedBaseTeamMemberNames, manualTeamMembers]);
  const sortedFiltered = useMemo(() => [...filtered].sort((a,b) => a.date.localeCompare(b.date)), [filtered]);
  const agendaProWeeks = useMemo(() => {
    const buckets = new Map<string, typeof filtered>();
    sortedFiltered.forEach((row) => {
      const key = weekKey(row.date);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(row);
    });
    return Array.from(buckets.entries()).sort((a,b)=>a[0].localeCompare(b[0])).slice(-8).map(([key, rows], idx) => {
      const total = rows.length;
      const realized = rows.filter(r => r.status === 'Realizada').length;
      const noShow = rows.filter(r => r.status === 'No-Show').length;
      const confirmed = rows.filter(r => r.status === 'Confirmada').length;
      const leadTimeDays = total ? rows.reduce((s, r, i) => s + 0.9 + (r.waitMinutes/60)*0.9 + (i%4)*0.45, 0) / total : 0;
      return {
        label: `S${idx+1}`,
        total,
        realized,
        noShow,
        confirmed,
        noShowRate: total ? (noShow/total)*100 : 0,
        occupancyRate: total ? (realized/Math.max(total, Math.ceil(total*1.04)))*100 : 0,
        leadTimeDays,
      };
    });
  }, [sortedFiltered]);
  const segmentedNoShow = useMemo(() => {
    const byDoctor = byProf.map(p => ({ segment: `Médico: ${p.name}`, noShowRate: p.noShowRate, n: p.total }));
    const byChannelSeg = activeChannels.map(c => ({ segment: `Canal: ${c.name}`, noShowRate: c.noShowRate + (c.name.includes('Instagram') ? 10 : 0), n: c.total }));
    const slots = ['09h', '11h', '14h', '16h'].map((slot, idx) => ({
      segment: `Horário: ${slot}`,
      noShowRate: Math.max(3, Math.min(32, kpis.noShowRate + (idx===2 ? 12 : idx*2))),
      n: Math.max(8, Math.round(kpis.total / 4)),
    }));
    return [...byDoctor, ...byChannelSeg, ...slots].sort((a,b)=>b.noShowRate-a.noShowRate);
  }, [byProf, activeChannels, kpis.noShowRate, kpis.total]);
  const slotOccupancyByProf = useMemo(() => {
    return byProf.flatMap((p, pIdx) => ['09h','11h','14h','16h'].map((slot, sIdx) => {
      const occupancy = Math.max(35, Math.min(98, p.occupancyRate + (sIdx-1)*8 - (pIdx===1 && sIdx===2 ? 18 : 0)));
      return { label: `${p.name} → ${slot}`, prof: p.name, slot, occupancy, capacityN: Math.max(4, Math.round(p.total/4)) };
    }));
  }, [byProf]);
  const heatmapDayHourProf = useMemo(() => {
    const hours = ['08h','10h','12h','14h','16h','18h'];
    return byProf.map((p, pIdx) => ({
      name: p.name,
      data: hours.map((h, hIdx) => ({
        x: h,
        y: Math.max(20, Math.min(100, Math.round(p.occupancyRate + (hIdx-2)*6 - (h==='14h' && pIdx===1 ? 20 : 0)))),
      })),
    }));
  }, [byProf]);
  const cancelReasons = useMemo(() => {
    const totalCancels = Math.max(1, kpis.canceled);
    const rows = [
      { reason: 'Preço / orçamento', count: Math.round(totalCancels * 0.26) },
      { reason: 'Conflito de agenda', count: Math.round(totalCancels * 0.22) },
      { reason: 'Melhorou / desistiu', count: Math.round(totalCancels * 0.18) },
      { reason: 'Sem confirmação', count: Math.round(totalCancels * 0.16) },
      { reason: 'Localização / transporte', count: Math.max(1, totalCancels - (Math.round(totalCancels * 0.26)+Math.round(totalCancels * 0.22)+Math.round(totalCancels * 0.18)+Math.round(totalCancels * 0.16))) },
    ];
    return rows.map(r => ({ ...r, pct: (r.count/totalCancels)*100 })).sort((a,b)=>b.count-a.count);
  }, [kpis.canceled]);
  const overbookingSim = useMemo(() => {
    const noShowHist = Math.round(kpis.noShows);
    const coverTarget = Math.round(noShowHist * 0.6);
    const activatedSlots = Math.max(1, Math.round(coverTarget * 0.9));
    const estimatedExtraRevenue = activatedSlots * Math.round(kpis.avgTicket || 300);
    const estimatedWait = 8 + (activatedSlots / Math.max(noShowHist,1)) * 18;
    const npsTradeoff = [
      { x: 0, revenue: 0, nps: kpis.avgNPS + 0.2 },
      { x: Math.round(activatedSlots * 0.5), revenue: estimatedExtraRevenue * 0.55, nps: kpis.avgNPS - 0.2 },
      { x: activatedSlots, revenue: estimatedExtraRevenue, nps: kpis.avgNPS - 0.7 },
      { x: activatedSlots + 2, revenue: estimatedExtraRevenue * 1.08, nps: kpis.avgNPS - 1.3 },
    ];
    return { noShowHist, coverTarget, activatedSlots, estimatedExtraRevenue, estimatedWait, npsTradeoff };
  }, [kpis.noShows, kpis.avgTicket, kpis.avgNPS]);
  const agendaProRules = useMemo(() => {
    const current = agendaProWeeks[agendaProWeeks.length - 1];
    const worstSegment = segmentedNoShow[0];
    const worstSlot = slotOccupancyByProf.reduce((acc, s)=>s.occupancy<acc.occupancy?s:acc, slotOccupancyByProf[0] ?? { occupancy: 100, label: '-', capacityN: 0 });
    const topCancel = cancelReasons[0];
    const classifyNoShow = (v:number): Priority => v > 20 ? 'P1' : v >= 12 ? 'P2' : v >= 8 ? 'P3' : 'OK';
    const classifyOcc = (v:number): Priority => v < 55 ? 'P1' : v < 70 ? 'P2' : v < 80 ? 'P3' : 'OK';
    const classifyLead = (v:number): Priority => v > 7 ? 'P1' : v > 3 ? 'P2' : 'OK';
    const classifyCancel = (v:number): Priority => v > 40 ? 'P1' : 'OK';
    const classifyOverbook = (v:number): Priority => v > 20 ? 'P1' : 'OK';
    const rows: Array<{ id: string; kpi: string; value: string; meta: string; baseN: string; priority: Priority; action: string }> = [
      { id:'01', kpi:'No-Show Segmentado (%)', value:`${(worstSegment?.noShowRate ?? 0).toFixed(1)}%`, meta:'< 8%', baseN:String(worstSegment?.n ?? 0), priority:classifyNoShow(worstSegment?.noShowRate ?? 0), action:`Drill-down: ${worstSegment?.segment ?? '-'}` },
      { id:'02', kpi:'Ocupação por Profissional/Slot (%)', value:`${(worstSlot?.occupancy ?? 0).toFixed(0)}%`, meta:'> 80%', baseN:String(worstSlot?.capacityN ?? 0), priority:classifyOcc(worstSlot?.occupancy ?? 0), action:'Redistribuição automática de slots' },
      { id:'03', kpi:'Heatmap Dia×Hora×Prof', value:'Padrão recorrente detectado', meta:'Nenhum slot <40% após 10h', baseN:String(kpis.total), priority:((heatmapDayHourProf.some(r=>r.data.some(c=>c.x!=='08h' && Number(c.y) < 40))) ? 'P2' : 'OK'), action:'Filtro por especialidade + redistribuição' },
      { id:'04', kpi:'Lead Time do Agendamento (dias)', value:`${((current?.leadTimeDays ?? 0)).toFixed(1)}d`, meta:'< 3d', baseN:String(kpis.leads), priority:classifyLead(current?.leadTimeDays ?? 0), action:'Atuar no funil comercial/recepção' },
      { id:'05', kpi:'Cancelamentos por Motivo', value:`${(topCancel?.pct ?? 0).toFixed(0)}%`, meta:'Top motivo < 30%', baseN:String(kpis.canceled), priority:classifyCancel(topCancel?.pct ?? 0), action:`Ação estrutural: ${topCancel?.reason ?? '-'}` },
      { id:'06', kpi:'Overbooking Controlado', value:`${overbookingSim.coverTarget}/${overbookingSim.noShowHist} slots`, meta:'Cobrir 60% do no-show', baseN:String(overbookingSim.noShowHist), priority:classifyOverbook(overbookingSim.estimatedWait), action:`Recalibrar se espera estimada ${overbookingSim.estimatedWait.toFixed(0)}min` },
    ];
    return rows;
  }, [agendaProWeeks, segmentedNoShow, slotOccupancyByProf, cancelReasons, heatmapDayHourProf, kpis.total, kpis.leads, kpis.canceled, kpis.noShows, overbookingSim]);
  const financeAdvWeeks = useMemo(() => {
    const weeks = weeklyTrend.slice(-8);
    return weeks.map((w, idx) => {
      const cmv = w.grossRevenue * (0.18 + (idx % 3) * 0.015);
      const variable = w.grossRevenue * (0.11 + (idx % 2) * 0.01);
      const fixedProrata = Math.max(2500, w.grossRevenue * 0.22);
      const ebitda = w.netRevenue - cmv - variable - fixedProrata;
      const ebitdaMargin = w.netRevenue > 0 ? (ebitda / w.netRevenue) * 100 : 0;
      const forecastP50 = (w.realized + w.noShows + Math.round(w.canceled * 0.5)) * (w.avgTicket || kpis.avgTicket || 300);
      return {
        ...w,
        cmv, variable, fixedProrata, ebitda, ebitdaMargin,
        forecastP10: forecastP50 * 0.88,
        forecastP50,
        forecastP90: forecastP50 * 1.12,
      };
    });
  }, [weeklyTrend, kpis.avgTicket]);
  const costCenters = useMemo(() => {
    const totalNet = Math.max(1, kpis.netRevenue);
    const totalEbitda = financeAdvWeeks.length ? financeAdvWeeks[financeAdvWeeks.length - 1].ebitda : 0;
    return [
      { area: 'Recepcao', revenue: totalNet * 0.18, cost: totalNet * 0.11, ebitda: totalEbitda * 0.16 },
      { area: 'Medico', revenue: totalNet * 0.62, cost: totalNet * 0.43, ebitda: totalEbitda * 0.56 },
      { area: 'Marketing', revenue: totalNet * 0.20, cost: totalNet * 0.14, ebitda: totalEbitda * 0.28 },
    ].map((r) => ({ ...r, margin: r.revenue > 0 ? (r.ebitda / r.revenue) * 100 : 0 }));
  }, [financeAdvWeeks, kpis.netRevenue]);
  const serviceMargins = useMemo(() => {
    return byProc.map((p, idx) => {
      const directCost = p.grossRevenue * (0.18 + (idx % 3) * 0.04);
      const repasse = p.grossRevenue * (0.22 + (idx % 2) * 0.03);
      const margin = p.grossRevenue > 0 ? ((p.grossRevenue - directCost - repasse) / p.grossRevenue) * 100 : 0;
      return { ...p, directCost, repasse, margin, simulatedUp5PctEbitdaImpact: p.grossRevenue * 0.05 * (margin / 100) };
    }).sort((a, b) => b.grossRevenue - a.grossRevenue);
  }, [byProc]);
  const profMargins = useMemo(() => {
    return byProf.map((p, idx) => {
      const repasse = p.grossRevenue * (0.34 + (idx % 2) * 0.04);
      const custoHora = p.grossRevenue * (0.12 + (idx % 3) * 0.02);
      const margin = p.grossRevenue > 0 ? ((p.grossRevenue - repasse - custoHora) / p.grossRevenue) * 100 : 0;
      const productivityScore = Math.max(0, margin) * 0.45 + p.total * 0.7 + p.avgNPS * 4;
      return { ...p, repasse, custoHora, margin, productivityScore };
    });
  }, [byProf]);
  const agingReceivables = useMemo(() => {
    const gross = Math.max(1, kpis.grossRevenue);
    const totalRecv = gross * 0.42;
    const f0_30 = totalRecv * 0.58;
    const f31_60 = totalRecv * 0.25;
    const f61_90 = totalRecv * 0.11;
    const f90p = totalRecv - f0_30 - f31_60 - f61_90;
    return { totalRecv, buckets: [{ label: '0-30d', value: f0_30 }, { label: '31-60d', value: f31_60 }, { label: '61-90d', value: f61_90 }, { label: '>90d', value: f90p }] };
  }, [kpis.grossRevenue]);
  const cashProjection8w = useMemo(() => {
    const current = Math.max(8000, kpis.grossRevenue * 0.32);
    const labels = Array.from({ length: 8 }, (_, i) => `S${i + 1}`);
    let base = current;
    let cons = current;
    let opt = current;
    const scenarioBase: number[] = [];
    const scenarioCons: number[] = [];
    const scenarioOpt: number[] = [];
    labels.forEach((_, i) => {
      const entries = (financeAdvWeeks[i % Math.max(financeAdvWeeks.length, 1)]?.forecastP50 ?? (kpis.grossRevenue / 4)) * (i < 2 ? 0.9 : 1.02);
      const exits = (kpis.totalCost / 4) * (0.95 + (i % 3) * 0.05);
      base += entries - exits;
      cons += entries * 0.86 - exits * 1.05;
      opt += entries * 1.08 - exits * 0.97;
      scenarioBase.push(Math.round(base));
      scenarioCons.push(Math.round(cons));
      scenarioOpt.push(Math.round(opt));
    });
    return { labels, scenarioBase, scenarioCons, scenarioOpt, current };
  }, [financeAdvWeeks, kpis.grossRevenue, kpis.totalCost]);
  const revenueConcentration = useMemo(() => {
    const sortedServices = [...serviceMargins].sort((a, b) => b.grossRevenue - a.grossRevenue);
    const total = Math.max(1, sortedServices.reduce((s, r) => s + r.grossRevenue, 0));
    const top3 = sortedServices.slice(0, 3);
    const topItemPct = top3[0] ? (top3[0].grossRevenue / total) * 100 : 0;
    return {
      labels: top3.map((s) => s.name),
      values: top3.map((s) => Math.round((s.grossRevenue / total) * 1000) / 10),
      topItemPct,
      total,
    };
  }, [serviceMargins]);
  const breakEven = useMemo(() => {
    const fixedMonthly = Math.max(20000, kpis.totalCost * 0.65);
    const contributionMarginPct = Math.max(0.15, Math.min(0.8, (kpis.netRevenue - kpis.totalCost * 0.35) / Math.max(kpis.netRevenue, 1)));
    const breakEvenRevenue = fixedMonthly / contributionMarginPct;
    const day15Coverage = (kpis.grossRevenue * 0.52) / breakEvenRevenue * 100;
    const day20Coverage = (kpis.grossRevenue * 0.72) / breakEvenRevenue * 100;
    const sim = [
      { ticket: Math.round(kpis.avgTicket * 0.9), volume: Math.max(10, Math.round(kpis.realized * 0.9)) },
      { ticket: Math.round(kpis.avgTicket), volume: Math.max(10, kpis.realized) },
      { ticket: Math.round(kpis.avgTicket * 1.1), volume: Math.max(10, Math.round(kpis.realized * 1.1)) },
    ].map((s) => ({ ...s, revenue: s.ticket * s.volume, coversPct: (s.ticket * s.volume) / breakEvenRevenue * 100 }));
    return { fixedMonthly, contributionMarginPct: contributionMarginPct * 100, breakEvenRevenue, day15Coverage, day20Coverage, sim };
  }, [kpis.totalCost, kpis.netRevenue, kpis.grossRevenue, kpis.avgTicket, kpis.realized]);
  const financeAdvRules = useMemo(() => {
    const last = financeAdvWeeks[financeAdvWeeks.length - 1];
    const ebitdaMargin = last?.ebitdaMargin ?? 0;
    const worstService = serviceMargins.reduce((a, b) => (b.margin < a.margin ? b : a), serviceMargins[0] ?? ({ name: '-', margin: 0, grossRevenue: 0 } as any));
    const worstProf = profMargins.reduce((a, b) => (b.margin < a.margin ? b : a), profMargins[0] ?? ({ name: '-', margin: 0, grossRevenue: 0 } as any));
    const forecastGap = last && last.forecastP50 ? Math.abs(last.grossRevenue - last.forecastP50) / last.forecastP50 * 100 : 0;
    const gt90 = agingReceivables.buckets.find((b) => b.label === '>90d')?.value ?? 0;
    const gt90PctRevenue = (gt90 / Math.max(kpis.grossRevenue, 1)) * 100;
    const anyNegativeCash = cashProjection8w.scenarioCons.some((v) => v < 0);
    const topConcentration = revenueConcentration.topItemPct;
    const p = (cond1:boolean, cond2:boolean, cond3:boolean): Priority => cond1 ? 'P1' : cond2 ? 'P2' : cond3 ? 'P3' : 'OK';
    return [
      { id:'01', kpi:'DRE / EBITDA Operacional', value:`${ebitdaMargin.toFixed(1)}%`, meta:'> 20%', baseN:fmt(last?.netRevenue ?? kpis.netRevenue), priority:p(ebitdaMargin<10, ebitdaMargin<15, ebitdaMargin<20), action:'Ajustar centros de custo e mix semanal' },
      { id:'02', kpi:'Margem por Servico', value:`${worstService.name}: ${worstService.margin.toFixed(1)}%`, meta:'Top3 > 25%', baseN:fmt(worstService.grossRevenue ?? 0), priority:(worstService.margin < 10 ? 'P1' : 'OK') as Priority, action:'Revisar precificacao/repasse + simulador 5%' },
      { id:'03', kpi:'Margem por Profissional', value:`${worstProf.name}: ${worstProf.margin.toFixed(1)}%`, meta:'Positivo em todos', baseN:fmt(worstProf.grossRevenue ?? 0), priority:(worstProf.margin < 0 ? 'P1' : 'OK') as Priority, action:'Revisar repasse e custo/hora' },
      { id:'04', kpi:'Forecast Receita (IA)', value:`Gap ${forecastGap.toFixed(1)}%`, meta:'Desvio +-10%', baseN:String((last ? (last.realized + last.noShows + Math.round(last.canceled * 0.5)) : 0)), priority:(forecastGap > 20 ? 'P1' : forecastGap > 10 ? 'P2' : 'OK') as Priority, action:'Recalibrar sazonalidade e agenda confirmada' },
      { id:'05', kpi:'Recebiveis Aging', value:`>90d ${gt90PctRevenue.toFixed(1)}%`, meta:'>60d < 5% receita', baseN:fmt(agingReceivables.totalRecv), priority:(gt90PctRevenue > 5 ? 'P1' : 'OK') as Priority, action:'Cobrança automatica WhatsApp + régua' },
      { id:'06', kpi:'Projecao de Caixa 8s', value:anyNegativeCash ? 'Semana negativa' : 'Positivo', meta:'Sempre positivo', baseN:'Fluxo previsto', priority:(anyNegativeCash ? 'P1' : 'OK') as Priority, action:'Cortar saidas / reforcar caixa' },
      { id:'07', kpi:'Concentracao de Receita', value:`Top item ${topConcentration.toFixed(1)}%`, meta:'< 50% em 1 item', baseN:fmt(revenueConcentration.total), priority:(topConcentration > 60 ? 'P1' : topConcentration > 50 ? 'P2' : 'OK') as Priority, action:'Diversificar mix e canais' },
      { id:'08', kpi:'Break-Even', value:`D20 ${breakEven.day20Coverage.toFixed(0)}%`, meta:'> 90% coberto no dia 15', baseN:fmt(breakEven.breakEvenRevenue), priority:(breakEven.day20Coverage < 70 ? 'P1' : breakEven.day15Coverage < 90 ? 'P2' : 'OK') as Priority, action:'Ajustar ticket x volume e despesas fixas' },
    ];
  }, [financeAdvWeeks, serviceMargins, profMargins, agingReceivables, cashProjection8w, revenueConcentration, breakEven, kpis.netRevenue, kpis.grossRevenue]);
  const marketingProWeeks = useMemo(() => {
    const base = weeklyTrend.slice(-8);
    return base.map((w, idx) => {
      const channelRows = activeChannels.map((c, cIdx) => {
        const share = c.total / Math.max(1, activeChannels.reduce((s, x) => s + x.total, 0));
        const leads = Math.max(1, Math.round((w.total * 0.55 + idx * 2) * share * (0.92 + (cIdx % 3) * 0.08)));
        const contacts = Math.max(1, Math.round(leads * (0.72 - (cIdx % 2) * 0.05)));
        const booked = Math.max(1, Math.round(contacts * (0.63 - (cIdx % 3) * 0.04)));
        const attended = Math.max(1, Math.round(booked * (0.78 - (c.noShowRate / 200))));
        const newPatients = Math.max(1, Math.round(attended * 0.78));
        const ticket = Math.max(180, Math.round(c.avgTicket * (0.9 + (cIdx % 4) * 0.06)));
        const spend = Math.max(0, Math.round(c.avgCAC * newPatients * (0.9 + (idx % 3) * 0.07)));
        const revenue = Math.round(newPatients * ticket * (1.05 + (cIdx % 2) * 0.12));
        return { name: c.name, leads, contacts, booked, attended, newPatients, ticket, spend, revenue };
      });
      const leadsTotal = channelRows.reduce((s, r) => s + r.leads, 0);
      const contacts = channelRows.reduce((s, r) => s + r.contacts, 0);
      const booked = channelRows.reduce((s, r) => s + r.booked, 0);
      const attended = channelRows.reduce((s, r) => s + r.attended, 0);
      const revenue = channelRows.reduce((s, r) => s + r.revenue, 0);
      const spend = channelRows.reduce((s, r) => s + r.spend, 0);
      return { label: w.label, channelRows, leadsTotal, contacts, booked, attended, revenue, spend };
    });
  }, [weeklyTrend, activeChannels]);
  const marketingChannelStats = useMemo(() => {
    const rows = activeChannels.map((c) => {
      const agg = marketingProWeeks.reduce((acc, w) => {
        const row = w.channelRows.find((x) => x.name === c.name);
        if (!row) return acc;
        acc.leads += row.leads; acc.contacts += row.contacts; acc.booked += row.booked; acc.attended += row.attended; acc.newPatients += row.newPatients; acc.spend += row.spend; acc.revenue += row.revenue; acc.ticket += row.ticket;
        return acc;
      }, { leads:0, contacts:0, booked:0, attended:0, newPatients:0, spend:0, revenue:0, ticket:0 });
      const avgTicket = agg.newPatients ? agg.revenue / agg.newPatients : c.avgTicket;
      const cac = agg.newPatients ? agg.spend / agg.newPatients : 0;
      const funnelRate = agg.leads ? (agg.attended / agg.leads) * 100 : 0;
      const roi = agg.spend ? ((agg.revenue - agg.spend) / agg.spend) * 100 : 0;
      const speedDays = Math.max(2, 4 + (c.noShowRate / 8) + (c.avgCAC / 80));
      const retention = 1.8 + (c.returnRate / 100) * 2.2;
      const ltv = avgTicket * retention;
      return { name: c.name, ...agg, avgTicket, cac, funnelRate, roi, speedDays, ltv, ltvCac: cac ? ltv / cac : 0 };
    });
    return rows;
  }, [activeChannels, marketingProWeeks]);
  const marketingProRules = useMemo(() => {
    const latest = marketingProWeeks[marketingProWeeks.length - 1];
    const prev = marketingProWeeks[marketingProWeeks.length - 2];
    const leadDrop = latest && prev && prev.leadsTotal ? ((prev.leadsTotal - latest.leadsTotal) / prev.leadsTotal) * 100 : 0;
    const worstCAC = marketingChannelStats.reduce((a,b)=> (b.cac - b.avgTicket) > (a.cac - a.avgTicket) ? b : a, marketingChannelStats[0] ?? ({} as any));
    const funnelOverall = latest?.leadsTotal ? (latest.attended / latest.leadsTotal) * 100 : 0;
    const bottleneckLosses = [
      { step: 'Lead->Contato', loss: latest?.leadsTotal ? (1 - (latest.contacts / latest.leadsTotal)) * 100 : 0 },
      { step: 'Contato->Agendamento', loss: latest?.contacts ? (1 - (latest.booked / latest.contacts)) * 100 : 0 },
      { step: 'Agendamento->Comparecimento', loss: latest?.booked ? (1 - (latest.attended / latest.booked)) * 100 : 0 },
    ].sort((a,b)=>b.loss-a.loss);
    const worstROI = marketingChannelStats.reduce((a,b)=>b.roi<a.roi?b:a, marketingChannelStats[0] ?? ({} as any));
    const avgSpeed = marketingChannelStats.length ? marketingChannelStats.reduce((s,r)=>s+r.speedDays,0)/marketingChannelStats.length : 0;
    const ltvCac = marketingChannelStats.length ? marketingChannelStats.reduce((s,r)=>s+r.ltvCac,0)/marketingChannelStats.length : 0;
    const p=(c1:boolean,c2:boolean)=> c1 ? 'P1' : c2 ? 'P2' : 'OK';
    return [
      { id:'01', kpi:'Leads por Canal / Semana', value:`${(latest?.leadsTotal ?? 0)} leads`, meta:'Meta por canal', baseN:String(latest?.leadsTotal ?? 0), priority:p(leadDrop>40, leadDrop>25) as Priority, action:`Queda ${leadDrop.toFixed(0)}% vs semana anterior` },
      { id:'02', kpi:'CAC por Canal', value:`${worstCAC?.name ?? '-'} ${fmt(worstCAC?.cac ?? 0)}`, meta:'CAC < Ticket', baseN:String(worstCAC?.newPatients ?? 0), priority:((worstCAC?.cac ?? 0) > (worstCAC?.avgTicket ?? 0) ? 'P1' : 'OK') as Priority, action:'Suspender/ajustar criativo e segmentacao' },
      { id:'03', kpi:'Funil Lead->Consulta', value:`${funnelOverall.toFixed(1)}%`, meta:'> 22%', baseN:String(latest?.leadsTotal ?? 0), priority:p(funnelOverall<10, funnelOverall<15) as Priority, action:`Gargalo: ${bottleneckLosses[0]?.step} (${bottleneckLosses[0]?.loss.toFixed(0)}% perda)` },
      { id:'04', kpi:'LTV / LTV:CAC', value:`${ltvCac.toFixed(1)}x`, meta:'> 3x CAC', baseN:'Base historica', priority:((ltvCac < 2) ? 'P1' : (ltvCac < 3 ? 'P2' : 'OK')) as Priority, action:'Reavaliar canal pago e retenção por coorte' },
      { id:'05', kpi:'ROI por Canal', value:`${worstROI?.name ?? '-'} ${worstROI?.roi?.toFixed?.(0) ?? '0'}%`, meta:'> 200%', baseN:fmt(worstROI?.revenue ?? 0), priority:((worstROI?.roi ?? 0) < 0 ? 'P1' : ((worstROI?.roi ?? 0) < 200 ? 'P2' : 'OK')) as Priority, action:'Semaforo de corte/reallocacao de verba' },
      { id:'06', kpi:'Velocidade do Funil (dias)', value:`${avgSpeed.toFixed(1)}d`, meta:'< 5d', baseN:String(marketingChannelStats.reduce((s,r)=>s+r.newPatients,0)), priority:((avgSpeed > 15) ? 'P1' : (avgSpeed > 10 ? 'P2' : 'OK')) as Priority, action:'SLA comercial e follow-up no mesmo dia' },
      { id:'07', kpi:'Waterfall Variacao Receita', value:'Componente Retencao incluso', meta:'Explicada >= 90%', baseN:'Periodo vs periodo', priority:('OK' as Priority), action:'Monitorar mix negativo crescente' },
    ];
  }, [marketingProWeeks, marketingChannelStats]);
  const opsProTrend = useMemo(() => {
    return weeklyTrend.slice(-8).map((w, idx) => ({
      label: w.label,
      nps: Math.max(6.5, Math.min(9.6, kpis.avgNPS + (idx - 3) * 0.08)),
      wait: Math.max(6, Math.round(kpis.avgWait + (idx % 3) * 2 - 2)),
      return90: Math.max(8, Math.min(65, kpis.returnRate + (idx - 2) * 1.5)),
      slaLeadH: Math.max(0.4, +(0.8 + (idx % 4) * 0.55 + (idx === 6 ? 2.6 : 0)).toFixed(1)),
      cancelWithReasonPct: Math.max(35, Math.min(96, 78 + (idx % 3) * 4 - (idx === 5 ? 20 : 0))),
    }));
  }, [weeklyTrend, kpis.avgNPS, kpis.avgWait, kpis.returnRate]);
  const opsProByProfessional = useMemo(() => {
    return byProf.map((p, idx) => ({
      ...p,
      npsResponses: p.promoters + p.neutrals + p.detractors,
      waitByDoctor: Math.max(4, Math.round(p.avgWait + (idx === 1 ? 7 : idx === 0 ? 2 : -1))),
      return90: Math.max(10, Math.min(70, p.returnRate + (idx === 0 ? 4 : idx === 1 ? -6 : 2))),
      slaLeadH: +(0.7 + idx * 0.9 + (idx === 1 ? 2.2 : 0)).toFixed(1),
      rcaHint: p.avgNPS < 7.5 ? 'Atraso + handoff recepcao + expectativa' : 'Sem RCA critica',
    }));
  }, [byProf]);
  const opsCohortByProcedure = useMemo(() => {
    return byProc.map((p, idx) => ({
      name: p.name,
      return90: Math.max(8, Math.min(70, 24 + idx * 7 + (p.avgTicket > 500 ? 6 : -2))),
      eligible: Math.max(8, Math.round(p.realized * 0.65)),
    }));
  }, [byProc]);
  const receptionSLARanking = useMemo(() => {
    const names = ['Julia (Recepcao)', 'Marina (Recepcao)', 'Paula (Recepcao)'];
    return names.map((name, idx) => ({
      name,
      slaH: +(0.8 + idx * 1.1 + (idx === 2 ? 2.4 : 0)).toFixed(1),
      leadsResponded: Math.max(10, Math.round(kpis.leads / 3) + idx * 3),
    }));
  }, [kpis.leads]);
  const areaProductivity = useMemo(() => {
    const rows = [
      { area: 'Recepcao', produtividade: 72, qualidade: 78, aderencia: 69 },
      { area: 'Medico', produtividade: 88, qualidade: 84, aderencia: 80 },
      { area: 'Adm', produtividade: 76, qualidade: 82, aderencia: 74 },
      { area: 'Marketing', produtividade: 81, qualidade: 73, aderencia: 70 },
    ];
    return rows.map((r) => ({ ...r, score: +(r.produtividade * 0.4 + r.qualidade * 0.35 + r.aderencia * 0.25).toFixed(1) }));
  }, []);
  const checklistByArea = useMemo(() => {
    return [
      { area: 'Recepcao', completed: 62, total: 80, role: 'recepcao' },
      { area: 'Medico', completed: 55, total: 60, role: 'medico' },
      { area: 'Adm', completed: 38, total: 50, role: 'adm' },
    ].map((r) => ({ ...r, pct: (r.completed / r.total) * 100 }));
  }, []);
  const opsProRules = useMemo(() => {
    const worstNps = opsProByProfessional.reduce((a,b)=>b.avgNPS<a.avgNPS?b:a, opsProByProfessional[0] ?? ({} as any));
    const worstWait = opsProByProfessional.reduce((a,b)=>b.waitByDoctor>a.waitByDoctor?b:a, opsProByProfessional[0] ?? ({} as any));
    const worstReturn = opsProByProfessional.reduce((a,b)=>b.return90<a.return90?b:a, opsProByProfessional[0] ?? ({} as any));
    const worstSla = receptionSLARanking.reduce((a,b)=>b.slaH>a.slaH?b:a, receptionSLARanking[0] ?? ({} as any));
    const worstArea = areaProductivity.reduce((a,b)=>b.score<a.score?b:a, areaProductivity[0] ?? ({} as any));
    const latestCancelReason = opsProTrend[opsProTrend.length - 1]?.cancelWithReasonPct ?? 0;
    const worstChecklist = checklistByArea.reduce((a,b)=>b.pct<a.pct?b:a, checklistByArea[0] ?? ({} as any));
    return [
      { id:'01', kpi:'NPS por Profissional', value:`${worstNps?.name ?? '-'} ${worstNps?.avgNPS?.toFixed?.(1) ?? '0'}`, meta:'> 8.0 todos', baseN:String(worstNps?.npsResponses ?? 0), priority:((worstNps?.avgNPS ?? 10) < 7.5 ? 'P1' : 'OK') as Priority, action: worstNps?.avgNPS < 7.5 ? `RCA: ${worstNps?.rcaHint}` : 'Monitorar tendencia mensal' },
      { id:'02', kpi:'Espera por Medico (min)', value:`${worstWait?.name ?? '-'} ${worstWait?.waitByDoctor ?? 0}min`, meta:'< 12 min', baseN:String(worstWait?.total ?? 0), priority:((worstWait?.waitByDoctor ?? 0) > 30 ? 'P1' : (worstWait?.waitByDoctor ?? 0) > 20 ? 'P2' : 'OK') as Priority, action:'Ajustar agenda/slot e triagem de atrasos' },
      { id:'03', kpi:'Retorno/Fidelizacao 90d', value:`${worstReturn?.name ?? '-'} ${worstReturn?.return90?.toFixed?.(1) ?? '0'}%`, meta:'> 40%', baseN:String(worstReturn?.realized ?? 0), priority:((worstReturn?.return90 ?? 100) < 15 ? 'P1' : (worstReturn?.return90 ?? 100) < 25 ? 'P2' : 'OK') as Priority, action:'Cohort por procedimento + plano de retorno' },
      { id:'04', kpi:'SLA Resposta ao Lead (h)', value:`${worstSla?.name ?? '-'} ${worstSla?.slaH ?? 0}h`, meta:'< 1h', baseN:String(worstSla?.leadsResponded ?? 0), priority:((worstSla?.slaH ?? 0) > 4 ? 'P1' : (worstSla?.slaH ?? 0) > 2 ? 'P2' : 'OK') as Priority, action:'Ranking individual e escala de resposta' },
      { id:'05', kpi:'Produtividade por Area', value:`${worstArea?.area ?? '-'} ${worstArea?.score?.toFixed?.(1) ?? '0'}%`, meta:'> 85%', baseN:'Metas por area', priority:((worstArea?.score ?? 100) < 60 ? 'P1' : (worstArea?.score ?? 100) < 75 ? 'P2' : 'OK') as Priority, action:'Plano de melhoria composto (produtividade/qualidade/processo)' },
      { id:'06', kpi:'Cancelamentos com Motivo (%)', value:`${latestCancelReason.toFixed(1)}%`, meta:'> 80%', baseN:String(kpis.canceled), priority:((latestCancelReason < 50) ? 'P2' : 'OK') as Priority, action:'Tornar motivo obrigatorio e padronizado' },
      { id:'07', kpi:'Checklists / Rotinas (%)', value:`${worstChecklist?.area ?? '-'} ${worstChecklist?.pct?.toFixed?.(1) ?? '0'}%`, meta:'> 90%', baseN:String(worstChecklist?.total ?? 0), priority:((worstChecklist?.pct ?? 100) < 70 ? 'P2' : 'OK') as Priority, action:`Checklists configuraveis por papel (${worstChecklist?.role ?? '-'})` },
    ];
  }, [opsProByProfessional, receptionSLARanking, areaProductivity, opsProTrend, checklistByArea, kpis.canceled]);

  const drillProf = useCallback((idx: number) => {
    const name = byProf[idx]?.name;
    if (name) onFiltersChange({ ...filters, professional: filters.professional === name ? '' : name });
  }, [byProf, filters, onFiltersChange]);

  const drillChannel = useCallback((idx: number) => {
    const name = activeChannels[idx]?.name;
    if (name) onFiltersChange({ ...filters, channel: filters.channel === name ? '' : name });
  }, [activeChannels, filters, onFiltersChange]);

  const drillProc = useCallback((idx: number) => {
    const name = byProc[idx]?.name;
    if (name) onFiltersChange({ ...filters, procedure: filters.procedure === name ? '' : name });
  }, [byProc, filters, onFiltersChange]);

  const handleTeamMemberFormChange = useCallback((field: keyof TeamMemberForm, value: string) => {
    setTeamMemberForm((current) => ({ ...current, [field]: value }));
  }, []);

  const handleAddTeamMember = useCallback(() => {
    if (!teamMemberForm.name.trim()) return;
    const realized = Number(teamMemberForm.realized) || 0;
    const grossRevenue = Number(teamMemberForm.grossRevenue) || 0;
    const avgTicket = Number(teamMemberForm.avgTicket) || (realized > 0 ? grossRevenue / realized : 0);
    const avgNPS = Number(teamMemberForm.avgNPS) || 0;
    const noShowRate = Number(teamMemberForm.noShowRate) || 0;
    const occupancyRate = Number(teamMemberForm.occupancyRate) || 0;
    const avgWait = Number(teamMemberForm.avgWait) || 0;
    const leads = Math.max(0, Math.round(realized * 0.35));
    const noShows = Math.max(0, Math.round((realized * noShowRate) / Math.max(1, 100 - noShowRate)));
    const total = realized + noShows;
    const totalCost = grossRevenue * 0.48;
    const fixedExpenses = grossRevenue * 0.18;
    const netRevenue = grossRevenue * 0.92;

    const nextMember = {
      name: teamMemberForm.name.trim(),
      total,
      realized,
      noShows,
      canceled: Math.max(0, Math.round(total * 0.05)),
      grossRevenue,
      netRevenue,
      totalCost,
      fixedExpenses,
      margin: grossRevenue > 0 ? ((netRevenue - totalCost) / grossRevenue) * 100 : 0,
      ebitda: netRevenue - fixedExpenses,
      avgTicket,
      noShowRate,
      occupancyRate,
      cancelRate: 5,
      confirmationRate: 88,
      lostCapacityRate: Math.max(0, 100 - occupancyRate),
      noShowEstimatedCost: noShows * avgTicket,
      leadTimeDays: 1.8,
      inadimplenciaRate: 3.2,
      fixedExpenseRatio: netRevenue > 0 ? (fixedExpenses / netRevenue) * 100 : 0,
      breakEven: fixedExpenses > 0 ? fixedExpenses / Math.max(avgTicket * 0.45, 1) : 0,
      avgNPS,
      avgWait,
      returnRate: 32,
      avgCAC: 110,
      leads,
      cpl: leads > 0 ? 65 : 0,
      capacityAvailable: occupancyRate > 0 ? Math.round((realized / occupancyRate) * 100) : total,
      totalAdSpend: leads * 65,
      cancellationLoss: grossRevenue * 0.03,
      inadimplenciaLoss: grossRevenue * 0.02,
      estornoLoss: grossRevenue * 0.01,
      slaLeadHours: 1.2,
      promoters: Math.max(0, Math.round(realized * 0.45)),
      neutrals: Math.max(0, Math.round(realized * 0.35)),
      detractors: Math.max(0, Math.round(realized * 0.2)),
      complaints: Math.max(0, Math.round(realized * 0.06)),
    };

    setManualTeamMembers((current) => {
      if (editingBaseTeamMemberName) {
        return current;
      }

      if (editingManualTeamMemberIndex === null) {
        return [...current, nextMember];
      }

      return current.map((member, index) => (
        index === editingManualTeamMemberIndex ? nextMember : member
      ));
    });
    if (editingBaseTeamMemberName) {
      setBaseTeamMemberOverrides((current) => ({ ...current, [editingBaseTeamMemberName]: nextMember }));
      setDeletedBaseTeamMemberNames((current) => current.filter((name) => name !== editingBaseTeamMemberName));
    }
    setTeamMemberForm(EMPTY_TEAM_MEMBER_FORM);
    setEditingManualTeamMemberIndex(null);
    setEditingBaseTeamMemberName(null);
  }, [editingBaseTeamMemberName, editingManualTeamMemberIndex, teamMemberForm]);

  const handleEditManualTeamMember = useCallback((index: number) => {
    const member = manualTeamMembers[index];
    if (!member) return;

    setTeamMemberForm({
      name: member.name,
      role: '',
      realized: String(member.realized),
      grossRevenue: String(Math.round(member.grossRevenue)),
      avgTicket: String(Math.round(member.avgTicket)),
      avgNPS: member.avgNPS.toFixed(1),
      noShowRate: member.noShowRate.toFixed(1),
      occupancyRate: member.occupancyRate.toFixed(1),
      avgWait: member.avgWait.toFixed(0),
    });
    setEditingManualTeamMemberIndex(index);
    setEditingBaseTeamMemberName(null);
  }, [manualTeamMembers]);

  const handleEditBaseTeamMember = useCallback((name: string) => {
    const member = displayedTeamMembers.find((current) => current.name === name);
    if (!member) return;

    setTeamMemberForm({
      name: member.name,
      role: '',
      realized: String(member.realized),
      grossRevenue: String(Math.round(member.grossRevenue)),
      avgTicket: String(Math.round(member.avgTicket)),
      avgNPS: member.avgNPS.toFixed(1),
      noShowRate: member.noShowRate.toFixed(1),
      occupancyRate: member.occupancyRate.toFixed(1),
      avgWait: member.avgWait.toFixed(0),
    });
    setEditingBaseTeamMemberName(name);
    setEditingManualTeamMemberIndex(null);
  }, [displayedTeamMembers]);

  const handleDeleteManualTeamMember = useCallback((index: number) => {
    setManualTeamMembers((current) => current.filter((_, currentIndex) => currentIndex !== index));
    setEditingManualTeamMemberIndex((current) => (current === index ? null : current));
  }, []);

  const handleDeleteBaseTeamMember = useCallback((name: string) => {
    setDeletedBaseTeamMemberNames((current) => current.includes(name) ? current : [...current, name]);
    setBaseTeamMemberOverrides((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
    setEditingBaseTeamMemberName((current) => current === name ? null : current);
  }, []);

  const handleCancelTeamMemberEdit = useCallback(() => {
    setTeamMemberForm(EMPTY_TEAM_MEMBER_FORM);
    setEditingManualTeamMemberIndex(null);
    setEditingBaseTeamMemberName(null);
  }, []);

  const profClick = useMemo(() => ({ chart: { events: { dataPointSelection: (_e: any, _c: any, cfg: any) => drillProf(cfg.dataPointIndex) } } }), [drillProf]);
  const channelClick = useMemo(() => ({ chart: { events: { dataPointSelection: (_e: any, _c: any, cfg: any) => drillChannel(cfg.dataPointIndex) } } }), [drillChannel]);
  const procClick = useMemo(() => ({ chart: { events: { dataPointSelection: (_e: any, _c: any, cfg: any) => drillProc(cfg.dataPointIndex) } } }), [drillProc]);

  return (
    <div className="animate-fade-in" key={activeTab}>
      <FilterBar filters={filters} onChange={onFiltersChange} options={filterOptions} />

      {/* ===== VISÃO CEO PRO ===== */}
      {activeTab === 0 && (<>
        <div className="section-header"><h2><span className="orange-bar" /> Visão CEO — Pro</h2></div>
        <div className="overview-row">
          <div className="overview-card"><div className="overview-card-label">{moneyTitle('Receita Bruta')}</div><div className="overview-card-value">{fmt(kpis.grossRevenue)}</div><div className="overview-card-info"><div className="dot" style={{background:'var(--green)'}}/><span>Período</span></div></div>
          <div className="overview-card"><div className="overview-card-label">Margem</div><div className="overview-card-value" style={{color:kpis.margin>=20?'var(--green)':'var(--red)'}}>{kpis.margin.toFixed(1)}%</div></div>
          <div className="overview-card"><div className="overview-card-label">NPS</div><div className="overview-card-value" style={{color:kpis.avgNPS>=8?'var(--green)':'var(--yellow)'}}>{kpis.avgNPS.toFixed(1)}</div></div>
          <div className="overview-card"><div className="overview-card-label">Ocupação</div><div className="overview-card-value">{kpis.occupancyRate.toFixed(1)}%</div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">Receita Semanal (Bruto × Líquido)</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{...ct.chart,type:'area'},fill:{type:'gradient',gradient:{shadeIntensity:1,opacityFrom:0.4,opacityTo:0}},colors:['#ff5a1f','#45a29e'],xaxis:{...ct.xaxis,categories:weeklyTrend.map(w=>w.label)},legend:{...ct.legend,show:true,position:'bottom' as const}}} series={[{name:'Bruto',data:weeklyTrend.map(w=>Math.round(w.grossRevenue))},{name:'Líquido',data:weeklyTrend.map(w=>Math.round(w.netRevenue))}]} type="area" height={230}/>
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">Ocupação Semanal</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{...ct.chart,type:'line'},stroke:{curve:'smooth',width:3},colors:['#ff5a1f'],markers:{size:4},annotations:{yaxis:[{y:75,borderColor:'#22c55e',strokeDashArray:4,label:{text:'Meta 75%',style:{color:'#fff',background:'#22c55e'}}}]},xaxis:{...ct.xaxis,categories:weeklyTrend.map(w=>w.label)}}} series={[{name:'Ocupação %',data:weeklyTrend.map(w=>+w.occupancyRate.toFixed(1))}]} type="line" height={230}/>
          </div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">Score por Área</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{type:'radar'},xaxis:{categories:['Agenda','Financeiro','Marketing','Operação','Experiência']},yaxis:{show:false},colors:['#ff5a1f']}} series={[{name:'Score',data:[Math.round(kpis.occupancyRate/10),Math.round(kpis.margin*5/20),Math.round(kpis.leads/40),Math.round(kpis.avgNPS),Math.round(kpis.returnRate/5)]}]} type="radar" height={230}/>
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">Indicadores Semáforo</span></div><div className="chart-card-body" style={{padding:14}}>
            <table className="data-table"><thead><tr><th>Indicador</th><th>Valor</th><th>Meta</th><th>Status</th></tr></thead><tbody>
              <tr><td>No-Show</td><td style={{fontWeight:700}}>{kpis.noShowRate.toFixed(1)}%</td><td>{'<'}10%</td><td><span className={`chart-card-badge ${kpis.noShowRate<=10?'green':kpis.noShowRate<=15?'yellow':'red'}`} style={{display:'inline-block'}}>{kpis.noShowRate<=10?'OK':kpis.noShowRate<=15?'ATENÇÃO':'CRÍTICO'}</span></td></tr>
              <tr><td>Ocupação</td><td style={{fontWeight:700}}>{kpis.occupancyRate.toFixed(1)}%</td><td>{'>'}75%</td><td><span className={`chart-card-badge ${kpis.occupancyRate>=75?'green':'yellow'}`} style={{display:'inline-block'}}>{kpis.occupancyRate>=75?'OK':'ATENÇÃO'}</span></td></tr>
              <tr><td>NPS</td><td style={{fontWeight:700}}>{kpis.avgNPS.toFixed(1)}</td><td>{'>'}8.0</td><td><span className={`chart-card-badge ${kpis.avgNPS>=8?'green':'yellow'}`} style={{display:'inline-block'}}>{kpis.avgNPS>=8?'OK':'ATENÇÃO'}</span></td></tr>
              <tr><td>Margem</td><td style={{fontWeight:700}}>{kpis.margin.toFixed(1)}%</td><td>{'>'}20%</td><td><span className={`chart-card-badge ${kpis.margin>=20?'green':'red'}`} style={{display:'inline-block'}}>{kpis.margin>=20?'OK':'CRÍTICO'}</span></td></tr>
              <tr><td>CAC</td><td style={{fontWeight:700}}>{fmt(kpis.avgCAC)}</td><td>{'<'}{formatMoney(convertMoneyValue(150), { maximumFractionDigits: 0 })}</td><td><span className={`chart-card-badge ${kpis.avgCAC<=150?'green':'red'}`} style={{display:'inline-block'}}>{kpis.avgCAC<=150?'OK':'CRÍTICO'}</span></td></tr>
              <tr><td>Ticket Médio</td><td style={{fontWeight:700}}>{fmt(kpis.avgTicket)}</td><td>{'>'}{formatMoney(convertMoneyValue(300), { maximumFractionDigits: 0 })}</td><td><span className={`chart-card-badge ${kpis.avgTicket>=300?'green':'yellow'}`} style={{display:'inline-block'}}>{kpis.avgTicket>=300?'OK':'ATENÇÃO'}</span></td></tr>
            </tbody></table>
          </div></div>
        </div>

        <div className="section-header"><h2><span className="orange-bar" /> Alertas e Ação</h2></div>
        <div className="overview-row">
          <div className="overview-card"><div className="overview-card-label">No-Show Rate</div><div className="overview-card-value" style={{color:kpis.noShowRate>10?'var(--red)':'var(--green)'}}>{kpis.noShowRate.toFixed(1)}%</div><div style={{fontSize:11,color:'var(--text-muted)',lineHeight:1.5}}>Percentual de faltas sobre todos os agendamentos.</div></div>
          <div className="overview-card"><div className="overview-card-label">Cancelamentos</div><div className="overview-card-value">{kpis.canceled}</div><div style={{fontSize:11,color:'var(--text-muted)',lineHeight:1.5}}>Total de agendas canceladas antes do atendimento.</div></div>
          <div className="overview-card"><div className="overview-card-label">Espera Média</div><div className="overview-card-value" style={{color:kpis.avgWait>15?'var(--yellow)':'var(--green)'}}>{kpis.avgWait.toFixed(0)} min</div></div>
          <div className="overview-card"><div className="overview-card-label">Detratores NPS</div><div className="overview-card-value" style={{color:'var(--red)'}}>{kpis.detractors}</div><div style={{fontSize:11,color:'var(--text-muted)',lineHeight:1.5}}>Pacientes com nota baixa e maior risco de reclamação.</div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">No-Show vs Cancelamentos (Semanal)</span><span style={{fontSize:10,color:'var(--text-muted)'}}>Compara faltas e cancelamentos por semana</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{type:'bar'},plotOptions:{bar:{borderRadius:4,columnWidth:'40%'}},colors:['#eab308','#ef4444'],xaxis:{...ct.xaxis,categories:weeklyTrend.map(w=>w.label)},legend:{...ct.legend,show:true,position:'bottom' as const}}} series={[{name:'No-Show',data:weeklyTrend.map(w=>w.noShows)},{name:'Cancelados',data:weeklyTrend.map(w=>w.canceled)}]} type="bar" height={230}/>
            <div style={{fontSize:11,color:'var(--text-muted)',lineHeight:1.5,padding:'4px 12px 0'}}>Mostra se a perda da agenda veio de faltas no dia ou de cancelamentos antecipados.</div>
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">Heatmap Espera (Prof × Dia)</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{type:'heatmap'},colors:['#ff5a1f'],dataLabels:{enabled:true},plotOptions:{heatmap:{shadeIntensity:0.5,colorScale:{ranges:[{from:0,to:15,color:'#22c55e',name:'OK'},{from:16,to:25,color:'#eab308',name:'Atenção'},{from:26,to:60,color:'#ef4444',name:'Crítico'}]}}}}} series={byProf.map(p=>({name:p.name,data:byWeekday.map(w=>({x:w.name,y:Math.round(w.avgWait+(p.avgWait-kpis.avgWait)*0.5)}))}))} type="heatmap" height={200}/>
            <div style={{fontSize:11,color:'var(--text-muted)',lineHeight:1.5,padding:'4px 12px 0'}}>Verde ? fluxo saud?vel; amarelo e vermelho apontam gargalos operacionais.</div>
          </div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">No-Show por Profissional</span><span style={{fontSize:10,color:'var(--text-muted)'}}>👆 Clique</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,...profClick,chart:{...ct.chart,type:'bar',...profClick.chart},plotOptions:{bar:{distributed:true}},colors:['#ef4444','#eab308','#ff5a1f'],xaxis:{...ct.xaxis,categories:byProf.map(p=>p.name)},legend:{show:false}}} series={[{name:'No-Show %',data:byProf.map(p=>+p.noShowRate.toFixed(1))}]} type="bar" height={200}/>
            <div style={{fontSize:11,color:'var(--text-muted)',lineHeight:1.5,padding:'4px 12px 0'}}>Ajuda a localizar onde a taxa de falta est? mais concentrada dentro da equipe.</div>
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">Alertas Ativos</span><span style={{fontSize:10,color:'var(--text-muted)'}}>Prioridades que pedem a??o operacional</span></div><div className="chart-card-body" style={{padding:14}}>
            {kpis.noShowRate>10 && <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}><span className="chart-card-badge red" style={{display:'inline-block'}}>P1</span><span style={{color:'var(--text-secondary)',fontSize:12}}>No-Show Rate {kpis.noShowRate.toFixed(1)}% — acima da meta</span></div>}
            {kpis.avgCAC>150 && <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}><span className="chart-card-badge red" style={{display:'inline-block'}}>P1</span><span style={{color:'var(--text-secondary)',fontSize:12}}>CAC {fmt(kpis.avgCAC)} — acima do teto {formatMoney(convertMoneyValue(150), { maximumFractionDigits: 0 })}</span></div>}
            {kpis.avgWait>15 && <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}><span className="chart-card-badge yellow" style={{display:'inline-block'}}>P2</span><span style={{color:'var(--text-secondary)',fontSize:12}}>Espera {kpis.avgWait.toFixed(0)}min — meta {'<'}15min</span></div>}
            {kpis.avgNPS<8 && <div style={{display:'flex',alignItems:'center',gap:8}}><span className="chart-card-badge yellow" style={{display:'inline-block'}}>P2</span><span style={{color:'var(--text-secondary)',fontSize:12}}>NPS {kpis.avgNPS.toFixed(1)} — abaixo da meta 8.0</span></div>}
          </div></div>
        </div>
      
      </>)}

      {/* ===== FINANCEIRO AVANCADO ===== */}
      {activeTab === 1 && (<>
        <div className="section-header"><h2><span className="orange-bar" /> Financeiro Avancado</h2></div>
        <div className="overview-row">
          <div className="overview-card"><div className="overview-card-label">{moneyTitle('EBITDA')}</div><div className="overview-card-value">{fmt(financeAdvWeeks[financeAdvWeeks.length - 1]?.ebitda ?? 0)}</div></div>
          <div className="overview-card"><div className="overview-card-label">Margem EBITDA</div><div className="overview-card-value" style={{ color: (financeAdvWeeks[financeAdvWeeks.length - 1]?.ebitdaMargin ?? 0) >= 20 ? 'var(--green)' : 'var(--yellow)' }}>{(financeAdvWeeks[financeAdvWeeks.length - 1]?.ebitdaMargin ?? 0).toFixed(1)}%</div></div>
          <div className="overview-card"><div className="overview-card-label">{moneyTitle("Aging >90d")}</div><div className="overview-card-value">{fmt(agingReceivables.buckets.find((b) => b.label === '>90d')?.value ?? 0)}</div></div>
          <div className="overview-card"><div className="overview-card-label">{moneyTitle('Break-even')}</div><div className="overview-card-value">{fmt(breakEven.breakEvenRevenue)}</div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">01 DRE Semanal / EBITDA Operacional</span></div><div className="chart-card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
              <ReactApexChart options={{ ...ct, chart: { type: 'bar' }, plotOptions: { bar: { colors: { ranges: [{ from: -9999999, to: -1, color: '#ef4444' }, { from: 0, to: 9999999, color: '#22c55e' }] }, columnWidth: '52%' } }, xaxis: { type: 'category' as const }, legend: { show: false }, dataLabels: { enabled: true, formatter: (v: number) => fmt(v) }, tooltip: { y: { formatter: (v: number) => fmt(v) } } }} series={[{ name: 'DRE', data: (() => { const l = financeAdvWeeks[financeAdvWeeks.length - 1]; if (!l) return []; return [{ x: 'RL', y: Math.round(l.netRevenue) }, { x: 'CMV', y: -Math.round(l.cmv) }, { x: 'Variaveis', y: -Math.round(l.variable) }, { x: 'Fixos', y: -Math.round(l.fixedProrata) }, { x: 'EBITDA', y: Math.round(l.ebitda) }]; })() }]} type="bar" height={250} />
              <ReactApexChart options={{ ...ct, chart: { ...ct.chart, type: 'line' }, stroke: { curve: 'smooth' as const, width: [3, 2] }, colors: ['#22c55e', '#3b82f6'], xaxis: { ...ct.xaxis, categories: financeAdvWeeks.map((w) => w.label) }, annotations: { yaxis: [{ y: 20, borderColor: '#22c55e', strokeDashArray: 4, label: { text: 'Meta 20%', style: { color: '#fff', background: '#22c55e' } } }, { y: 15, borderColor: '#eab308', strokeDashArray: 4, label: { text: 'P2', style: { color: '#111', background: '#eab308' } } }, { y: 10, borderColor: '#ef4444', strokeDashArray: 4, label: { text: 'P1', style: { color: '#fff', background: '#ef4444' } } }] }, legend: { ...ct.legend, show: true, position: 'bottom' as const } }} series={[{ name: 'EBITDA %', data: financeAdvWeeks.map((w) => +w.ebitdaMargin.toFixed(1)) }, { name: 'Meta', data: financeAdvWeeks.map(() => 20) }]} type="line" height={250} />
            </div>
          </div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">02 Margem por Servico / Procedimento</span></div><div className="chart-card-body">
            <ReactApexChart options={{ ...ct, ...procClick, chart: { ...ct.chart, type: 'bar', ...procClick.chart }, plotOptions: { bar: { horizontal: true, borderRadius: 4 } }, colors: ['#22c55e', '#ef4444'], xaxis: { ...ct.xaxis, max: 100 }, legend: { ...ct.legend, show: true, position: 'bottom' as const } }} series={[{ name: 'Margem %', data: serviceMargins.map((s) => ({ x: s.name, y: +s.margin.toFixed(1) })) }, { name: 'Impacto +5% (indice)', data: serviceMargins.map((s) => ({ x: s.name, y: Math.min(100, Math.max(0, s.simulatedUp5PctEbitdaImpact / 200)) })) }]} type="bar" height={240} />
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">03 Margem por Profissional</span></div><div className="chart-card-body">
            <ReactApexChart options={{ ...ct, ...profClick, chart: { ...ct.chart, type: 'bar', ...profClick.chart }, plotOptions: { bar: { borderRadius: 4, columnWidth: '48%', distributed: true } }, colors: profMargins.map((p) => p.margin < 0 ? '#ef4444' : '#22c55e'), xaxis: { ...ct.xaxis, categories: profMargins.map((p) => p.name) }, legend: { ...ct.legend, show: true, position: 'bottom' as const } }} series={[{ name: 'Margem %', data: profMargins.map((p) => +p.margin.toFixed(1)) }, { name: 'Score', data: profMargins.map((p) => +p.productivityScore.toFixed(0)) }]} type="bar" height={240} />
          </div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">05 Recebiveis - Aging</span></div><div className="chart-card-body">
            <ReactApexChart options={{ ...ct, chart: { type: 'bar', stacked: true }, plotOptions: { bar: { horizontal: true, borderRadius: 4 } }, colors: ['#22c55e', '#eab308', '#f97316', '#ef4444'], xaxis: { ...ct.xaxis }, legend: { ...ct.legend, show: true, position: 'bottom' as const } }} series={agingReceivables.buckets.map((b) => ({ name: b.label, data: [Math.round(b.value)] }))} type="bar" height={220} />
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">06 Projecao de Caixa (8 semanas)</span></div><div className="chart-card-body">
            <ReactApexChart options={{ ...ct, chart: { ...ct.chart, type: 'line' }, stroke: { curve: 'smooth' as const, width: [3, 3, 3] }, colors: ['#ef4444', '#3b82f6', '#22c55e'], xaxis: { ...ct.xaxis, categories: cashProjection8w.labels }, annotations: { yaxis: [{ y: 0, borderColor: '#ef4444', strokeDashArray: 4, label: { text: 'Zero', style: { color: '#fff', background: '#ef4444' } } }] }, legend: { ...ct.legend, show: true, position: 'bottom' as const } }} series={[{ name: 'Conservador', data: cashProjection8w.scenarioCons }, { name: 'Base', data: cashProjection8w.scenarioBase }, { name: 'Otimista', data: cashProjection8w.scenarioOpt }]} type="line" height={220} />
          </div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">07 Concentracao de Receita (%)</span></div><div className="chart-card-body">
            <ReactApexChart options={{ ...ct, chart: { type: 'donut' }, labels: [...(revenueConcentration.labels.length ? revenueConcentration.labels : ['Top1', 'Top2', 'Top3']), 'Outros'], colors: ['#ff5a1f', '#3b82f6', '#22c55e', '#475569'], plotOptions: { pie: { donut: { size: '60%' } } }, legend: { ...ct.legend, position: 'bottom' as const } }} series={[...(revenueConcentration.values.length ? revenueConcentration.values : [0, 0, 0]), Math.max(0, 100 - revenueConcentration.values.reduce((s, v) => s + v, 0))]} type="donut" height={220} />
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">08 Break-Even - Ponto de Equilibrio</span></div><div className="chart-card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <ReactApexChart options={{ ...ct, chart: { type: 'bar' }, plotOptions: { bar: { borderRadius: 4, columnWidth: '52%' } }, colors: ['#3b82f6', '#22c55e', '#ef4444'], xaxis: { ...ct.xaxis, categories: ['D15 %', 'D20 %', 'Meta 90%'] }, legend: { show: false } }} series={[{ name: 'Cobertura', data: [+breakEven.day15Coverage.toFixed(1), +breakEven.day20Coverage.toFixed(1), 90] }]} type="bar" height={220} />
              <ReactApexChart options={{ ...ct, chart: { type: 'scatter' }, colors: ['#8b5cf6'], xaxis: { ...ct.xaxis, title: { text: 'Ticket' } }, yaxis: { title: { text: 'Volume' } }, legend: { show: false } }} series={[{ name: 'Simulador', data: breakEven.sim.map((s) => ({ x: s.ticket, y: s.volume })) }]} type="scatter" height={220} />
            </div>
          </div></div>
        </div>
      </>)}
      {/* ===== AGENDA / OTIMIZAÇÃO ===== */}
      {activeTab === 2 && (<>
        <div className="section-header"><h2><span className="orange-bar" /> Agenda / Otimização</h2></div>
        <div className="overview-row">
          <div className="overview-card"><div className="overview-card-label">Total</div><div className="overview-card-value">{kpis.total}</div></div>
          <div className="overview-card"><div className="overview-card-label">Realizadas</div><div className="overview-card-value">{kpis.realized}</div></div>
          <div className="overview-card"><div className="overview-card-label">Ocupação</div><div className="overview-card-value">{kpis.occupancyRate.toFixed(1)}%</div></div>
          <div className="overview-card"><div className="overview-card-label">Ociosidade</div><div className="overview-card-value" style={{color:'var(--yellow)'}}>{(100-kpis.occupancyRate).toFixed(1)}%</div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">01 No-Show Segmentado (%)</span><span style={{fontSize:10,color:'var(--text-muted)'}}>Linha + drill-down por segmento</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{...ct.chart,type:'line'},stroke:{curve:'smooth' as const,width:[3,2,2,2]},colors:['#ef4444','#f97316','#3b82f6','#22c55e'],markers:{size:[4,0,0,0]},xaxis:{...ct.xaxis,categories:segmentedNoShow.slice(0,8).map(s=>s.segment.split(': ')[1] || s.segment)},annotations:{yaxis:[{y:20,borderColor:'#ef4444',strokeDashArray:4,label:{text:'P1 20%',style:{color:'#fff',background:'#ef4444'}}},{y:12,borderColor:'#eab308',strokeDashArray:4,label:{text:'P2 12-20',style:{color:'#111',background:'#eab308'}}},{y:8,borderColor:'#3b82f6',strokeDashArray:4,label:{text:'P3 8-12',style:{color:'#fff',background:'#3b82f6'}}}]},legend:{...ct.legend,show:true,position:'bottom' as const}}} series={[{name:'No-show % segmento',data:segmentedNoShow.slice(0,8).map(s=>+s.noShowRate.toFixed(1))},{name:'P1',data:segmentedNoShow.slice(0,8).map(()=>20)},{name:'P2',data:segmentedNoShow.slice(0,8).map(()=>12)},{name:'Meta',data:segmentedNoShow.slice(0,8).map(()=>8)}]} type="line" height={230}/>
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">02 Ocupação por Profissional/Slot (%)</span><span style={{fontSize:10,color:'var(--text-muted)'}}>Slots ociosos e redistribuição</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{type:'bar'},plotOptions:{bar:{horizontal:true,distributed:true,barHeight:'58%',borderRadius:4}},colors:slotOccupancyByProf.map(s=>s.occupancy<55?'#ef4444':s.occupancy<70?'#eab308':s.occupancy<80?'#3b82f6':'#22c55e'),xaxis:{...ct.xaxis,max:100},annotations:{xaxis:[{x:80,borderColor:'#22c55e',strokeDashArray:4,label:{text:'Meta 80%',style:{color:'#fff',background:'#22c55e'}}}]},legend:{show:false}}} series={[{name:'Ocupação %',data:slotOccupancyByProf.map(s=>({x:s.label,y:+s.occupancy.toFixed(1)}))}]} type="bar" height={230}/>
          </div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">03 Heatmap Dia × Hora × Profissional</span><span style={{fontSize:10,color:'var(--text-muted)'}}>Heatmap multi-dimensional interativo</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{type:'heatmap'},dataLabels:{enabled:true},plotOptions:{heatmap:{shadeIntensity:0.55,colorScale:{ranges:[{from:0,to:39,color:'#ef4444',name:'<40%'},{from:40,to:69,color:'#eab308',name:'40-70%'},{from:70,to:100,color:'#22c55e',name:'>70%'}]}}}}} series={heatmapDayHourProf} type="heatmap" height={240}/>
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">04 Lead Time do Agendamento (dias)</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{...ct.chart,type:'line'},stroke:{curve:'smooth' as const,width:[3,2,2]},colors:['#8b5cf6','#eab308','#ef4444'],xaxis:{...ct.xaxis,categories:agendaProWeeks.map(w=>w.label)},annotations:{yaxis:[{y:3,borderColor:'#22c55e',strokeDashArray:4,label:{text:'Meta 3d',style:{color:'#fff',background:'#22c55e'}}},{y:7,borderColor:'#ef4444',strokeDashArray:4,label:{text:'P1 7d',style:{color:'#fff',background:'#ef4444'}}}]},legend:{...ct.legend,show:true,position:'bottom' as const}}} series={[{name:'Lead time (d)',data:agendaProWeeks.map(w=>+w.leadTimeDays.toFixed(1))},{name:'P2 (3-7d)',data:agendaProWeeks.map(()=>3)},{name:'P1 (7d)',data:agendaProWeeks.map(()=>7)}]} type="line" height={240}/>
          </div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">05 Cancelamentos por Motivo</span><span style={{fontSize:10,color:'var(--text-muted)'}}>Barra ordenada por frequência</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{type:'bar'},plotOptions:{bar:{horizontal:true,distributed:true,barHeight:'58%',borderRadius:4}},colors:cancelReasons.map(r=>r.pct>40?'#ef4444':r.pct>30?'#eab308':'#22c55e'),xaxis:{...ct.xaxis},annotations:{xaxis:[{x:30,borderColor:'#22c55e',strokeDashArray:4,label:{text:'Meta 30%',style:{color:'#fff',background:'#22c55e'}}},{x:40,borderColor:'#ef4444',strokeDashArray:4,label:{text:'P1 40%',style:{color:'#fff',background:'#ef4444'}}}]},legend:{show:false}}} series={[{name:'Motivo %',data:cancelReasons.map(r=>({x:r.reason,y:+r.pct.toFixed(1)}))}]} type="bar" height={230}/>
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">06 Simulador de Overbooking Controlado</span><span style={{fontSize:10,color:'var(--text-muted)'}}>Trade-off NPS vs Receita</span></div><div className="chart-card-body">
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <ReactApexChart options={{...ct,chart:{type:'bar'},plotOptions:{bar:{borderRadius:4,columnWidth:'55%'}},colors:['#3b82f6','#22c55e','#ff5a1f'],xaxis:{...ct.xaxis,categories:['No-show hist.','Cobertura alvo 60%','Slots ativados']},legend:{show:false}}} series={[{name:'Slots',data:[overbookingSim.noShowHist, overbookingSim.coverTarget, overbookingSim.activatedSlots]}]} type="bar" height={210}/>
              <ReactApexChart options={{...ct,chart:{...ct.chart,type:'line'},stroke:{curve:'smooth' as const,width:[3,3]},colors:['#22c55e','#ef4444'],xaxis:{...ct.xaxis,categories:overbookingSim.npsTradeoff.map(p=>`${p.x} slots`)},annotations:{yaxis:[{y:20,borderColor:'#ef4444',strokeDashArray:4,label:{text:'P1 espera >20min',style:{color:'#fff',background:'#ef4444'}}}]},legend:{...ct.legend,show:true,position:'bottom' as const}}} series={[{name:'Receita extra (R$)',data:overbookingSim.npsTradeoff.map(p=>Math.round(p.revenue))},{name:'NPS (x10)',data:overbookingSim.npsTradeoff.map(p=>+(p.nps*10).toFixed(1))}]} type="line" height={210}/>
            </div>
          </div></div>
        </div>
      </>)}
      {/* ===== MARKETING / UNIT ECONOMICS ===== */}
      {activeTab === 3 && (<>
        <div className="section-header"><h2><span className="orange-bar" /> Marketing / Unit Economics</h2></div>
        <div className="overview-row">
          <div className="overview-card"><div className="overview-card-label">Leads</div><div className="overview-card-value">{marketingProWeeks[marketingProWeeks.length-1]?.leadsTotal ?? 0}</div></div>
          <div className="overview-card"><div className="overview-card-label">{moneyTitle('CAC Médio')}</div><div className="overview-card-value" style={{color:'var(--green)'}}>{fmt(marketingChannelStats.reduce((s,r)=>s+r.cac,0)/Math.max(1,marketingChannelStats.length))}</div></div>
          <div className="overview-card"><div className="overview-card-label">{moneyTitle('LTV Médio')}</div><div className="overview-card-value">{fmt(marketingChannelStats.reduce((s,r)=>s+r.ltv,0)/Math.max(1,marketingChannelStats.length))}</div></div>
          <div className="overview-card"><div className="overview-card-label">LTV/CAC</div><div className="overview-card-value" style={{color:(marketingChannelStats.reduce((s,r)=>s+r.ltvCac,0)/Math.max(1,marketingChannelStats.length))>=3?'var(--green)':'var(--yellow)'}}>{(marketingChannelStats.reduce((s,r)=>s+r.ltvCac,0)/Math.max(1,marketingChannelStats.length)).toFixed(1)}x</div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">01 Leads por Canal / Semana</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,...channelClick,chart:{...ct.chart,type:'bar',stacked:true,...channelClick.chart},plotOptions:{bar:{borderRadius:4,columnWidth:'55%'}},colors:['#ff5a1f','#3b82f6','#eab308','#22c55e','#8b5cf6','#45a29e'],xaxis:{...ct.xaxis,categories:marketingProWeeks.map(w=>w.label)},legend:{...ct.legend,show:true,position:'bottom' as const}}} series={activeChannels.map((ch)=>({name:ch.name,data:marketingProWeeks.map(w=>w.channelRows.find(r=>r.name===ch.name)?.leads ?? 0)}))} type="bar" height={240}/>
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">{moneyTitle('02 CAC por Canal')}</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,...channelClick,chart:{...ct.chart,type:'bar',...channelClick.chart},plotOptions:{bar:{distributed:true,columnWidth:'52%'}},colors:marketingChannelStats.map(r=>r.cac>r.avgTicket?'#ef4444':'#22c55e'),xaxis:{...ct.xaxis,categories:marketingChannelStats.map(r=>r.name)},legend:{...ct.legend,show:true,position:'bottom' as const},tooltip:{y:{formatter:(v:number)=>fmt(v)}}}} series={[{name:'CAC',data:marketingChannelStats.map(r=>Math.round(r.cac))},{name:'Ticket medio canal',data:marketingChannelStats.map(r=>Math.round(r.avgTicket))}]} type="bar" height={240}/>
          </div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">03 Funil Lead {'->'} Consulta (%)</span></div><div className="chart-card-body">
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <ReactApexChart options={{...ct,chart:{type:'bar'},plotOptions:{bar:{horizontal:true,barHeight:'58%'}},colors:['#ff5a1f'],xaxis:{...ct.xaxis,max:100},legend:{show:false}}} series={[{name:'Conversao %',data:(()=>{const l=marketingProWeeks[marketingProWeeks.length-1]; if(!l||!l.leadsTotal) return [{x:'Leads',y:100}]; return [{x:'Leads',y:100},{x:'Contato',y:+((l.contacts/l.leadsTotal)*100).toFixed(1)},{x:'Agendamento',y:+((l.booked/l.leadsTotal)*100).toFixed(1)},{x:'Comparecimento',y:+((l.attended/l.leadsTotal)*100).toFixed(1)}];})()}]} type="bar" height={220}/>
              <ReactApexChart options={{...ct,chart:{type:'bar'},plotOptions:{bar:{horizontal:true,distributed:true,barHeight:'58%'}},colors:['#64748b','#f97316','#ef4444'],xaxis:{...ct.xaxis,max:100},legend:{show:false}}} series={[{name:'Perda %',data:(()=>{const l=marketingProWeeks[marketingProWeeks.length-1]; if(!l) return []; const a=l.leadsTotal?100-(l.contacts/l.leadsTotal)*100:0; const b=l.contacts?100-(l.booked/l.contacts)*100:0; const c=l.booked?100-(l.attended/l.booked)*100:0; return [{x:'Lead->Contato',y:+a.toFixed(1)},{x:'Contato->Agend',y:+b.toFixed(1)},{x:'Agend->Consulta',y:+c.toFixed(1)}];})()}]} type="bar" height={220}/>
            </div>
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">04 LTV / LTV:CAC</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{type:'bar'},plotOptions:{bar:{columnWidth:'48%'}},colors:['#22c55e','#3b82f6','#ef4444'],xaxis:{...ct.xaxis,categories:marketingChannelStats.map(r=>r.name)},legend:{...ct.legend,show:true,position:'bottom' as const},tooltip:{y:{formatter:(v:number, ctx?: any)=>ctx?.seriesIndex === 2 ? `${v.toFixed(1)}x` : fmt(v)}}}} series={[{name:'LTV',data:marketingChannelStats.map(r=>Math.round(r.ltv))},{name:'CAC',data:marketingChannelStats.map(r=>Math.round(r.cac))},{name:'LTV:CAC x10',data:marketingChannelStats.map(r=>+(r.ltvCac*10).toFixed(1))}]} type="bar" height={240}/>
          </div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">05 ROI por Canal (%)</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,...channelClick,chart:{...ct.chart,type:'bar',...channelClick.chart},plotOptions:{bar:{horizontal:true,distributed:true,borderRadius:4}},colors:marketingChannelStats.map(r=>r.roi<0?'#ef4444':r.roi<200?'#eab308':'#22c55e'),xaxis:{...ct.xaxis},legend:{show:false}}} series={[{name:'ROI %',data:[...marketingChannelStats].sort((a,b)=>b.roi-a.roi).map(r=>({x:r.name,y:+r.roi.toFixed(1)}))}]} type="bar" height={230}/>
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">06 Velocidade do Funil (dias)</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{...ct.chart,type:'line'},stroke:{curve:'smooth',width:[3,2,2]},colors:['#8b5cf6','#eab308','#ef4444'],xaxis:{...ct.xaxis,categories:marketingChannelStats.map(r=>r.name)},legend:{...ct.legend,show:true,position:'bottom' as const}}} series={[{name:'Dias ate 1a consulta',data:marketingChannelStats.map(r=>+r.speedDays.toFixed(1))},{name:'P2 10d',data:marketingChannelStats.map(()=>10)},{name:'P1 15d',data:marketingChannelStats.map(()=>15)}]} type="line" height={230}/>
          </div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">07 Waterfall Variacao de Receita</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{type:'bar'},plotOptions:{bar:{colors:{ranges:[{from:-999999,to:-1,color:'#ef4444'},{from:0,to:999999,color:'#22c55e'}]},columnWidth:'55%'}},xaxis:{type:'category' as const},legend:{show:false},dataLabels:{enabled:true,formatter:(v:number)=>fmt(v)},tooltip:{y:{formatter:(v:number)=>fmt(v)}}}} series={[{name:'Waterfall',data:(()=>{const cur=marketingProWeeks[marketingProWeeks.length-1]; const prev=marketingProWeeks[marketingProWeeks.length-2]; const prevRev=prev?.revenue ?? 0; const curRev=cur?.revenue ?? 0; const delta=curRev-prevRev; const vol=delta*0.35; const preco=delta*0.22; const mix=delta*0.16; const noShow=-Math.abs(delta*0.11); const ret=delta-(vol+preco+mix+noShow); return [{x:'Receita t-1',y:Math.round(prevRev)},{x:'Volume',y:Math.round(vol)},{x:'Preco',y:Math.round(preco)},{x:'Mix',y:Math.round(mix)},{x:'No-show',y:Math.round(noShow)},{x:'Retencao',y:Math.round(ret)},{x:'Receita t',y:Math.round(curRev)}];})()}]} type="bar" height={240}/>
          </div></div>
        </div>
      </>)}
      {/* ===== INTEGRAÇÕES ===== */}
      {activeTab === 4 && (<>
        <div className="section-header"><h2><span className="orange-bar" /> Integrações</h2></div>
        <div className="overview-row">
          <div className="overview-card"><div className="overview-card-label">Fontes Conectadas</div><div className="overview-card-value">6</div><div className="overview-card-info"><div className="dot" style={{background:'var(--green)'}}/><span>Ativas</span></div></div>
          <div className="overview-card"><div className="overview-card-label">Última Sync</div><div className="overview-card-value" style={{fontSize:16}}>Há 5 min</div></div>
          <div className="overview-card"><div className="overview-card-label">Registros</div><div className="overview-card-value">{kpis.total.toLocaleString()}</div></div>
          <div className="overview-card"><div className="overview-card-label">Erros</div><div className="overview-card-value" style={{color:'var(--green)'}}>0</div></div>
        </div>
        <div className="detail-section"><div className="detail-section-header">🔗 Status das Integrações</div><div className="detail-section-body"><table className="data-table"><thead><tr><th>Sistema</th><th>Status</th><th>Última Sync</th><th>Registros</th></tr></thead><tbody>
          <tr><td>ERP Financeiro</td><td><span className="chart-card-badge green" style={{display:'inline-block'}}>OK</span></td><td>5 min</td><td>{kpis.realized}</td></tr>
          <tr><td>Agenda Digital</td><td><span className="chart-card-badge green" style={{display:'inline-block'}}>OK</span></td><td>2 min</td><td>{kpis.total}</td></tr>
          <tr><td>CRM Marketing</td><td><span className="chart-card-badge green" style={{display:'inline-block'}}>OK</span></td><td>10 min</td><td>{kpis.leads}</td></tr>
          <tr><td>NPS Platform</td><td><span className="chart-card-badge green" style={{display:'inline-block'}}>OK</span></td><td>15 min</td><td>{kpis.promoters+kpis.neutrals+kpis.detractors}</td></tr>
          <tr><td>Google Analytics</td><td><span className="chart-card-badge green" style={{display:'inline-block'}}>OK</span></td><td>3 min</td><td>{kpis.leads}</td></tr>
          <tr><td>WhatsApp API</td><td><span className="chart-card-badge green" style={{display:'inline-block'}}>OK</span></td><td>1 min</td><td>{Math.round(kpis.total*0.3)}</td></tr>
        </tbody></table></div></div>
      </>)}

      {/* ===== OPERACAO & EXPERIENCIA ===== */}
      {activeTab === 5 && (<>
        <div className="section-header"><h2><span className="orange-bar" /> Operacao & Experiencia</h2></div>
        <div className="overview-row">
          <div className="overview-card"><div className="overview-card-label">NPS</div><div className="overview-card-value" style={{color:kpis.avgNPS>=8?'var(--green)':'var(--yellow)'}}>{kpis.avgNPS.toFixed(1)}</div></div>
          <div className="overview-card"><div className="overview-card-label">Espera</div><div className="overview-card-value">{kpis.avgWait.toFixed(0)} min</div></div>
          <div className="overview-card"><div className="overview-card-label">Retorno 90d</div><div className="overview-card-value">{(opsProByProfessional.reduce((s,r)=>s+r.return90,0)/Math.max(1,opsProByProfessional.length)).toFixed(1)}%</div></div>
          <div className="overview-card"><div className="overview-card-label">SLA Lead</div><div className="overview-card-value">{(receptionSLARanking.reduce((s,r)=>s+r.slaH,0)/Math.max(1,receptionSLARanking.length)).toFixed(1)}h</div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">01 NPS por Profissional (0-10)</span><span style={{fontSize:10,color:'var(--text-muted)'}}>Barra + tendencia mensal</span></div><div className="chart-card-body">
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <ReactApexChart options={{...ct,...profClick,chart:{...ct.chart,type:'bar',...profClick.chart},plotOptions:{bar:{distributed:true,borderRadius:4}},colors:opsProByProfessional.map(p=>p.avgNPS<7.5?'#ef4444':'#22c55e'),xaxis:{...ct.xaxis,categories:opsProByProfessional.map(p=>p.name)},legend:{show:false},annotations:{yaxis:[{y:8,borderColor:'#22c55e',strokeDashArray:4,label:{text:'Meta 8.0',style:{color:'#fff',background:'#22c55e'}}},{y:7.5,borderColor:'#ef4444',strokeDashArray:4,label:{text:'P1 7.5',style:{color:'#fff',background:'#ef4444'}}}]}}} series={[{name:'NPS',data:opsProByProfessional.map(p=>+p.avgNPS.toFixed(1))}]} type="bar" height={220}/>
              <ReactApexChart options={{...ct,chart:{...ct.chart,type:'line'},stroke:{curve:'smooth',width:[3,2]},colors:['#3b82f6','#22c55e'],xaxis:{...ct.xaxis,categories:opsProTrend.map(t=>t.label)},legend:{...ct.legend,show:true,position:'bottom' as const}}} series={[{name:'NPS geral',data:opsProTrend.map(t=>+t.nps.toFixed(1))},{name:'Meta',data:opsProTrend.map(()=>8)}]} type="line" height={220}/>
            </div>
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">02 Espera por Medico (min)</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,...profClick,chart:{...ct.chart,type:'bar',...profClick.chart},plotOptions:{bar:{horizontal:true,distributed:true,borderRadius:4}},colors:opsProByProfessional.map(p=>p.waitByDoctor>30?'#ef4444':p.waitByDoctor>20?'#eab308':'#22c55e'),xaxis:{...ct.xaxis},legend:{show:false},annotations:{xaxis:[{x:12,borderColor:'#22c55e',strokeDashArray:4,label:{text:'Meta 12',style:{color:'#fff',background:'#22c55e'}}},{x:20,borderColor:'#eab308',strokeDashArray:4,label:{text:'P2 20',style:{color:'#111',background:'#eab308'}}},{x:30,borderColor:'#ef4444',strokeDashArray:4,label:{text:'P1 30',style:{color:'#fff',background:'#ef4444'}}}]}}} series={[{name:'Espera',data:opsProByProfessional.map(p=>({x:p.name,y:p.waitByDoctor}))}]} type="bar" height={230}/>
          </div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">03 Retorno / Fidelizacao 90d (%)</span><span style={{fontSize:10,color:'var(--text-muted)'}}>Cohort por medico + procedimento</span></div><div className="chart-card-body">
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <ReactApexChart options={{...ct,chart:{type:'bar'},plotOptions:{bar:{columnWidth:'48%',distributed:true}},colors:['#ff5a1f','#45a29e','#3b82f6'],xaxis:{...ct.xaxis,categories:opsProByProfessional.map(p=>p.name)},legend:{show:false},annotations:{yaxis:[{y:40,borderColor:'#22c55e',strokeDashArray:4,label:{text:'Meta 40%',style:{color:'#fff',background:'#22c55e'}}}]}}} series={[{name:'Retorno 90d',data:opsProByProfessional.map(p=>+p.return90.toFixed(1))}]} type="bar" height={220}/>
              <ReactApexChart options={{...ct,chart:{type:'bar'},plotOptions:{bar:{horizontal:true,distributed:true,borderRadius:4}},colors:opsCohortByProcedure.map(p=>p.return90<15?'#ef4444':p.return90<25?'#eab308':'#22c55e'),xaxis:{...ct.xaxis},legend:{show:false}}} series={[{name:'Cohort proc 90d',data:opsCohortByProcedure.map(p=>({x:p.name,y:+p.return90.toFixed(1)}))}]} type="bar" height={220}/>
            </div>
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">04 SLA Resposta ao Lead (horas)</span><span style={{fontSize:10,color:'var(--text-muted)'}}>Ranking individual recepcao</span></div><div className="chart-card-body">
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <ReactApexChart options={{...ct,chart:{...ct.chart,type:'line'},stroke:{curve:'smooth',width:[3,2,2]},colors:['#8b5cf6','#eab308','#ef4444'],xaxis:{...ct.xaxis,categories:opsProTrend.map(t=>t.label)},legend:{...ct.legend,show:true,position:'bottom' as const}}} series={[{name:'SLA lead (h)',data:opsProTrend.map(t=>t.slaLeadH)},{name:'P2 2h',data:opsProTrend.map(()=>2)},{name:'P1 4h',data:opsProTrend.map(()=>4)}]} type="line" height={220}/>
              <ReactApexChart options={{...ct,chart:{type:'bar'},plotOptions:{bar:{horizontal:true,distributed:true,borderRadius:4}},colors:receptionSLARanking.map(r=>r.slaH>4?'#ef4444':r.slaH>2?'#eab308':'#22c55e'),xaxis:{...ct.xaxis},legend:{show:false}}} series={[{name:'SLA por recepcao (h)',data:receptionSLARanking.map(r=>({x:r.name,y:r.slaH}))}]} type="bar" height={220}/>
            </div>
          </div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">05 Produtividade por Area (% meta)</span><span style={{fontSize:10,color:'var(--text-muted)'}}>Radar + barra agrupada</span></div><div className="chart-card-body">
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <ReactApexChart options={{...ct,chart:{type:'radar'},xaxis:{categories:areaProductivity.map(a=>a.area)},yaxis:{show:false},colors:['#22c55e']}} series={[{name:'Score composto',data:areaProductivity.map(a=>a.score)}]} type="radar" height={220}/>
              <ReactApexChart options={{...ct,chart:{type:'bar'},plotOptions:{bar:{columnWidth:'46%'}},colors:['#3b82f6','#22c55e','#f97316'],xaxis:{...ct.xaxis,categories:areaProductivity.map(a=>a.area)},legend:{...ct.legend,show:true,position:'bottom' as const},annotations:{yaxis:[{y:85,borderColor:'#22c55e',strokeDashArray:4,label:{text:'Meta 85%',style:{color:'#fff',background:'#22c55e'}}},{y:75,borderColor:'#eab308',strokeDashArray:4,label:{text:'P2 75',style:{color:'#111',background:'#eab308'}}},{y:60,borderColor:'#ef4444',strokeDashArray:4,label:{text:'P1 60',style:{color:'#fff',background:'#ef4444'}}}]}}} series={[{name:'Produtividade',data:areaProductivity.map(a=>a.produtividade)},{name:'Qualidade',data:areaProductivity.map(a=>a.qualidade)},{name:'Aderencia',data:areaProductivity.map(a=>a.aderencia)}]} type="bar" height={220}/>
            </div>
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">06 Cancelamentos com Motivo (%)</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{...ct.chart,type:'line'},stroke:{curve:'smooth',width:[3,2]},colors:['#f59e0b','#22c55e'],xaxis:{...ct.xaxis,categories:opsProTrend.map(t=>t.label)},legend:{...ct.legend,show:true,position:'bottom' as const}}} series={[{name:'% com motivo',data:opsProTrend.map(t=>+t.cancelWithReasonPct.toFixed(1))},{name:'Meta 80%',data:opsProTrend.map(()=>80)}]} type="line" height={220}/>
          </div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">07 Status de Checklists / Rotinas (%)</span><span style={{fontSize:10,color:'var(--text-muted)'}}>Barra de progresso por area</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{type:'bar'},plotOptions:{bar:{horizontal:true,distributed:true,borderRadius:4,barHeight:'56%'}},colors:checklistByArea.map(r=>r.pct<70?'#eab308':r.pct<90?'#3b82f6':'#22c55e'),xaxis:{...ct.xaxis,max:100},legend:{show:false}}} series={[{name:'Checklists %',data:checklistByArea.map(r=>({x:`${r.area} (${r.role})`,y:+r.pct.toFixed(1)}))}]} type="bar" height={220}/>
          </div></div>
        </div>
      </>)}
      {/* ===== EQUIPE ===== */}
      {activeTab === 6 && (<>
        <div className="section-header"><h2><span className="orange-bar" /> Equipe</h2></div>
        <div className="chart-card" style={{ marginBottom: 16 }}>
          <div className="chart-card-header">
            <span className="chart-card-title">Adicionar membro da equipe</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Cadastro manual para compor tabela e rankings</span>
          </div>
          <div className="chart-card-body" style={{ padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
              {[
                { key: 'name', label: 'Nome', placeholder: 'Ex.: Dra. Paula' },
                { key: 'role', label: 'Area / funcao', placeholder: 'Ex.: Recepcao' },
                { key: 'realized', label: 'Consultas', placeholder: '92' },
                { key: 'grossRevenue', label: 'Receita', placeholder: '60600' },
                { key: 'avgTicket', label: 'Ticket medio', placeholder: '659' },
                { key: 'avgNPS', label: 'NPS', placeholder: '8.1' },
                { key: 'noShowRate', label: 'No-show %', placeholder: '9.4' },
                { key: 'occupancyRate', label: 'Ocupacao %', placeholder: '64.2' },
                { key: 'avgWait', label: 'Espera min', placeholder: '18' },
              ].map((field) => (
                <label key={field.key} style={{ display: 'grid', gap: 6, color: 'var(--text-secondary)', fontSize: 12 }}>
                  <span>{field.label}</span>
                  <input
                    value={teamMemberForm[field.key as keyof TeamMemberForm]}
                    onChange={(event) => handleTeamMemberFormChange(field.key as keyof TeamMemberForm, event.target.value)}
                    placeholder={field.placeholder}
                    style={{
                      width: '100%',
                      borderRadius: 12,
                      border: '1px solid rgba(249, 115, 22, 0.18)',
                      background: 'rgba(15, 23, 42, 0.55)',
                      color: 'var(--text-primary)',
                      padding: '10px 12px',
                      outline: 'none',
                    }}
                  />
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                Os dados adicionados aqui entram na tabela e nos gráficos desta aba.
              </span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {editingManualTeamMemberIndex !== null && (
                  <button
                    type="button"
                    onClick={handleCancelTeamMemberEdit}
                    style={{
                      border: '1px solid rgba(148, 163, 184, 0.24)',
                      borderRadius: 999,
                      background: 'transparent',
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                      padding: '10px 16px',
                      cursor: 'pointer',
                    }}
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleAddTeamMember}
                  style={{
                    border: 'none',
                    borderRadius: 999,
                    background: '#f97316',
                    color: '#111827',
                    fontWeight: 700,
                    padding: '10px 16px',
                    cursor: 'pointer',
                  }}
                >
                  {editingManualTeamMemberIndex === null ? 'Adicionar membro' : 'Salvar alteraÃ§Ãµes'}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="detail-section"><div className="detail-section-header">👥 Performance da Equipe</div><div className="detail-section-body"><table className="data-table"><thead><tr><th>Profissional</th><th>Consultas</th><th>Receita</th><th>{ lang === "EN" ? "Avg Ticket" : lang === "ES" ? "Ticket Promedio" : "Ticket Médio" }</th><th>NPS</th><th>No-Show</th><th>Ocupação</th><th>Espera</th></tr></thead><tbody>
          {displayedTeamMembers.map((p, idx)=>{ const visibleBaseCount = displayedTeamMembers.length - manualTeamMembers.length; const isManual = idx >= visibleBaseCount; const manualIndex = idx - visibleBaseCount; return <tr key={`${p.name}-${idx}`} style={{cursor:'default'}}><td style={{fontWeight:600}}>{p.name}</td><td>{p.realized}</td><td>{fmt(p.grossRevenue)}</td><td>{fmt(p.avgTicket)}</td><td style={{color:p.avgNPS>=8?'var(--green)':'var(--yellow)',fontWeight:700}}>{p.avgNPS.toFixed(1)}</td><td style={{color:p.noShowRate<=10?'var(--green)':'var(--red)',fontWeight:700}}>{p.noShowRate.toFixed(1)}%</td><td>{p.occupancyRate.toFixed(1)}%</td><td>{p.avgWait.toFixed(0)} min</td><td><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button type="button" onClick={(event)=>{event.stopPropagation(); if (isManual) { handleEditManualTeamMember(manualIndex); } else { handleEditBaseTeamMember(p.name); }}} style={{border:'1px solid rgba(59,130,246,0.28)',borderRadius:999,background:'transparent',color:'#3b82f6',padding:'6px 10px',cursor:'pointer',fontSize:11,fontWeight:700}}>Editar</button><button type="button" onClick={(event)=>{event.stopPropagation(); if (isManual) { handleDeleteManualTeamMember(manualIndex); } else { handleDeleteBaseTeamMember(p.name); }}} style={{border:'1px solid rgba(239,68,68,0.28)',borderRadius:999,background:'transparent',color:'#ef4444',padding:'6px 10px',cursor:'pointer',fontSize:11,fontWeight:700}}>Excluir</button></div></td></tr>; })}
        </tbody></table></div></div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">Ranking Receita</span><span style={{fontSize:10,color:'var(--text-muted)'}}>👆 Clique</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{...ct.chart,type:'bar'},plotOptions:{bar:{horizontal:true,distributed:true}},colors:displayedTeamMembers.map((_, idx)=>['#ff5a1f','#45a29e','#3b82f6','#22c55e','#f59e0b','#8b5cf6'][idx % 6]),xaxis:{...ct.xaxis,categories:displayedTeamMembers.map(p=>p.name)},legend:{show:false}}} series={[{name:'Receita',data:displayedTeamMembers.map(p=>Math.round(p.grossRevenue))}]} type="bar" height={200}/>
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">Ranking NPS</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{...ct.chart,type:'bar'},plotOptions:{bar:{horizontal:true,distributed:true}},colors:displayedTeamMembers.map((p)=>p.avgNPS>=8?'#22c55e':p.avgNPS>=7.5?'#eab308':'#ef4444'),xaxis:{...ct.xaxis,categories:displayedTeamMembers.map(p=>p.name)},legend:{show:false}}} series={[{name:'NPS',data:displayedTeamMembers.map(p=>+p.avgNPS.toFixed(1))}]} type="bar" height={200}/>
          </div></div>
        </div>
      </>)}
    </div>
  );
}

export default memo(ProDashboard);
