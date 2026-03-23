import { useMemo, useCallback, memo, useState } from 'react';
import ReactApexChart from 'react-apexcharts';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTranslation } from '../i18n';
import { getChartTheme } from '../utils/chartOptions';
import FilterBar from './FilterBar';
import IntegrationSection from './IntegrationSection';
import { AgendaNoShowModule } from './modules/AgendaNoShowModule';
import { FinanceiroModule } from './modules/FinanceiroModule';
import { MarketingModule } from './modules/MarketingModule';
import { OperacaoUXModule } from './modules/OperacaoUXModule';
import { AIAssistantModule } from './modules/AIAssistantModule';
import {
  type Appointment, Filters, getAllAppointments, applyFilters, computeKPIs,
  computeByProfessional, computeByChannel, computeByProcedure,
  computeWeeklyTrend, getFilterOptions,
} from '../data/mockData';

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
type ProfessionalRow = ReturnType<typeof computeByProfessional>[number];

const KPI_INFO: Record<string, { formula: string; explanation: string }> = {
  ocupacao:     { formula: 'Ocupação (%) = Consultas realizadas ÷ Capacidade disponível × 100', explanation: 'Some as consultas realizadas no período, some a capacidade disponível dos slots/profissionais/unidades e divida realizadas por capacidade.' },
  noshow:       { formula: 'No-Show (%) = No-Shows ÷ Total agendado × 100', explanation: 'Conte os pacientes que não compareceram sem aviso prévio e divida pelo total de agendamentos do período.' },
  confirmacoes: { formula: 'Confirmações (%) = Confirmados ÷ Total agendado × 100', explanation: 'Pacientes que responderam "sim" à confirmação (WhatsApp, ligação ou sistema) divididos pelo total de agendamentos.' },
  leadtime:     { formula: 'Lead Time = Média dos dias entre solicitação e consulta realizada', explanation: 'Para cada agendamento, calcule a diferença em dias entre a data do pedido e a data da consulta. Some tudo e divida pelo número de agendamentos.' },
  faturamento:  { formula: 'Faturamento Bruto = Soma de todos os recebimentos no período', explanation: 'Some todos os valores recebidos (consultas, procedimentos, convênios) sem descontar nenhuma despesa.' },
  margem:       { formula: 'Margem (%) = (Receita Líquida − Despesas Totais) ÷ Receita Líquida × 100', explanation: 'Receita líquida é o bruto menos glosas, cancelamentos e inadimplência. Despesas totais incluem fixas e variáveis. Divida o lucro pela receita líquida.' },
  inadimplencia:{ formula: 'Inadimplência (%) = Valor não recebido ÷ Valor total emitido × 100', explanation: 'Some os valores emitidos (notas/cobranças) e subtraia o que foi efetivamente recebido. Divida a diferença pelo total emitido.' },
  despesasfixas:{ formula: 'Despesas Fixas (%) = Total de Despesas Fixas ÷ Receita Líquida × 100', explanation: 'Some aluguel, folha, contratos e outros custos que não variam com o volume. Divida pela receita líquida do período.' },
  leads:        { formula: 'Leads = Soma de todos os contatos iniciais no período', explanation: 'Conte todos os novos contatos recebidos por canal (WhatsApp, Instagram, Google, indicação etc.) no período selecionado.' },
  conversao:    { formula: 'Conversão (%) = Agendamentos efetivados ÷ Leads recebidos × 100', explanation: 'De todos os leads que entraram em contato, quantos chegaram a marcar uma consulta? Divida agendamentos por leads.' },
  cpl:          { formula: 'CPL = Investimento em marketing ÷ Leads gerados', explanation: 'Some o total investido em anúncios, agência e produção no período e divida pelo número de leads captados.' },
  roi:          { formula: 'ROI (%) = (Receita atribuída − Custo do canal) ÷ Custo do canal × 100', explanation: 'Para cada canal, some a receita gerada pelos pacientes captados, subtraia o custo e divida pelo custo. 200% significa R$3 de retorno para cada R$1 investido.' },
  nps:          { formula: 'NPS (0–10) = (% Promotores − % Detratores) × 10', explanation: 'Notas 9–10 são promotores; 0–6 são detratores; 7–8 são neutros. Subtraia % detratores de % promotores e converta para escala 0–10.' },
  espera:       { formula: 'Espera média = Soma dos tempos de espera ÷ Total de atendimentos', explanation: 'Registre o tempo entre chegada do paciente e início do atendimento para cada consulta. Some todos e divida pelo número de atendimentos.' },
  retorno:      { formula: 'Retorno (%) = Pacientes que retornaram ÷ Total atendidos × 100', explanation: 'Conte quantos pacientes atendidos voltaram em uma segunda consulta dentro da janela (30, 90 ou 180 dias). Divida pelo total atendido no período.' },
  sla:          { formula: 'SLA = Soma dos tempos de resposta ÷ Total de leads respondidos', explanation: 'Para cada lead, calcule o tempo entre o primeiro contato e a primeira resposta da equipe. Some tudo e divida pelo número de leads atendidos.' },
};

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

function ProDashboard({ activeTab, theme, visualScale, filters, onFiltersChange, lang = "PT", appointments, integrationHealth }: Props) {
  const { formatCompactMoney, moneyTitle } = useCurrency();
  const { t } = useTranslation();
  const fmt = useCallback((value: number) => formatCompactMoney(value), [formatCompactMoney]);
  const ct = useMemo(() => getChartTheme(theme, visualScale), [theme, visualScale]);
  const allData = useMemo(() => appointments ?? getAllAppointments(), [appointments]);
  const filterOptions = useMemo(() => getFilterOptions(allData), [allData]);
  const filtered = useMemo(() => applyFilters(allData, filters), [allData, filters]);
  const kpis = useMemo(() => computeKPIs(filtered), [filtered]);
  const byProf = useMemo(() => computeByProfessional(filtered), [filtered]);
  const byChannel = useMemo(() => computeByChannel(filtered), [filtered]);
  const byProc = useMemo(() => computeByProcedure(filtered), [filtered]);
  const weeklyTrend = useMemo(() => computeWeeklyTrend(filtered), [filtered]);
  const [teamMemberForm, setTeamMemberForm] = useState<TeamMemberForm>(EMPTY_TEAM_MEMBER_FORM);
  const [manualTeamMembers, setManualTeamMembers] = useState<ProfessionalRow[]>([]);
  const [editingManualTeamMemberIndex, setEditingManualTeamMemberIndex] = useState<number | null>(null);
  const [editingBaseTeamMemberName, setEditingBaseTeamMemberName] = useState<string | null>(null);
  const [deletedBaseTeamMemberNames, setDeletedBaseTeamMemberNames] = useState<string[]>([]);
  const [baseTeamMemberOverrides, setBaseTeamMemberOverrides] = useState<Record<string, ProfessionalRow>>({});
  const [kpiModal, setKpiModal] = useState<{ title: string; formula: string; explanation: string } | null>(null);
  const openKpiModal = useCallback((title: string, kpiKey: string) => {
    const info = KPI_INFO[kpiKey];
    if (info) setKpiModal({ title, ...info });
  }, []);
  const activeChannels = useMemo(() => byChannel.filter(c => c.total > 0), [byChannel]);
  const displayedTeamMembers = useMemo(() => [
    ...byProf
      .filter((member) => !deletedBaseTeamMemberNames.includes(member.name))
      .map((member) => baseTeamMemberOverrides[member.name] ?? member),
    ...manualTeamMembers,
  ], [baseTeamMemberOverrides, byProf, deletedBaseTeamMemberNames, manualTeamMembers]);
  const sortedFiltered = useMemo(() => [...filtered].sort((a,b) => a.date.localeCompare(b.date)), [filtered]);
  const agendaWeeksForModule = useMemo(() => {
    const buckets = new Map<string, typeof filtered>();
    sortedFiltered.forEach((row) => {
      const key = weekKey(row.date);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(row);
    });
    return Array.from(buckets.entries()).sort((a,b)=>a[0].localeCompare(b[0])).slice(-8).map(([key, rows], idx) => {
      const total = rows.length;
      const realized = rows.filter(r => r.status === 'Realizada').length;
      const noShows = rows.filter(r => r.status === 'No-Show').length;
      const canceled = rows.filter(r => r.status === 'Cancelada').length;
      const confirmed = rows.filter(r => r.status === 'Confirmada').length;
      const weeklyTarget = Math.max(16, Math.round(total * 0.85));
      const cancelNoticeRate = canceled ? Math.min(92, Math.max(22, 52 + idx * 4 - (canceled % 3) * 2)) : 0;
      const leadTimeDays = total ? rows.reduce((s, r, i) => s + 0.9 + (r.waitMinutes/60)*0.9 + (i%4)*0.45, 0) / total : 0;
      const d = new Date(key + 'T00:00:00');
      const label = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
      return { label, weekKey: key, total, realized, noShows, canceled, confirmed, noShowRate: total ? (noShows/total)*100 : 0, occupancyRate: total ? (realized/Math.max(total, Math.ceil(total*1.04)))*100 : 0, confirmationRate: total ? (confirmed/total)*100 : 0, cancelNoticeRate, weeklyTarget, leadTimeDays };
    });
  }, [sortedFiltered]);
  const financeWeeksForModule = useMemo(() => {
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
      return { label: w.label, gross, net, cancelLoss, delinquency, chargebacks, conventionGlosas, netPctGross: gross > 0 ? (net / gross) * 100 : 0, marginPct: net > 0 ? (profit / net) * 100 : 0, ticketAvg: w.avgTicket, ticketBenchmark: 700 + (idx % 2) * 35, delinquencyPct: gross > 0 ? (delinquency / gross) * 100 : 0, fixedPct: net > 0 ? (fixedExpenses / net) * 100 : 0, receiptsCount: Math.max(1, w.realized), consultations: Math.max(1, w.realized), d20ProgressPct: 62 + idx * 4, d20ThresholdPct: 80 };
    });
  }, [weeklyTrend]);
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
  const agingReceivables = useMemo(() => {
    const gross = Math.max(1, kpis.grossRevenue);
    const totalRecv = gross * 0.42;
    const f0_30 = totalRecv * 0.58;
    const f31_60 = totalRecv * 0.25;
    const f61_90 = totalRecv * 0.11;
    const f90p = totalRecv - f0_30 - f31_60 - f61_90;
    return { totalRecv, buckets: [{ label: '0-30d', value: f0_30 }, { label: '31-60d', value: f31_60 }, { label: '61-90d', value: f61_90 }, { label: '>90d', value: f90p }] };
  }, [kpis.grossRevenue]);
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
  const receptionSLARanking = useMemo(() => {
    const names = ['Julia (Recepcao)', 'Marina (Recepcao)', 'Paula (Recepcao)'];
    return names.map((name, idx) => ({
      name,
      slaH: +(0.8 + idx * 1.1 + (idx === 2 ? 2.4 : 0)).toFixed(1),
      leadsResponded: Math.max(10, Math.round(kpis.leads / 3) + idx * 3),
    }));
  }, [kpis.leads]);
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

  const showFilterBar = activeTab !== 6;

  return (
    <div className="animate-fade-in" key={activeTab}>
      {showFilterBar ? <FilterBar filters={filters} onChange={onFiltersChange} options={filterOptions} /> : null}

      {/* ===== VISÃO CEO PRO — SCORE CARDS ===== */}
      {activeTab === 0 && (() => {
        const CL = { green:'#1D9E75', amber:'#EF9F27', red:'#E24B4A' };
        // color helper: inverted=true means lower is better
        const cl = (v:number, good:number, warn:number, inverted=false): string =>
          inverted ? (v <= good ? CL.green : v <= warn ? CL.amber : CL.red)
                   : (v >= good ? CL.green : v >= warn ? CL.amber : CL.red);

        // Period-aware label suffix — translated via i18n
        const pSuffix = t(filters.period === '7d'  ? '/ Semana'
                        : filters.period === '15d' ? '/ Quinzena'
                        : filters.period === '30d' ? '/ Mês'
                        : filters.period === '3m'  ? '/ Trimestre'
                        : filters.period === '6m'  ? '/ Semestre'
                        : '/ Ano');
        const periodReturnLabel = filters.period === '7d'  ? '7 Dias'
                                : filters.period === '15d' ? '15 Dias'
                                : filters.period === '30d' ? '30 Dias'
                                : filters.period === '3m'  ? '3 Meses'
                                : filters.period === '6m'  ? '6 Meses'
                                : '12 Meses';

        const convLeadToAppt = (() => {
          const latest = marketingProWeeks[marketingProWeeks.length - 1];
          return latest?.leadsTotal > 0 ? (latest.booked / latest.leadsTotal) * 100 : 0;
        })();
        const selectedRoi = filters.channel
          ? (marketingChannelStats.find(c => c.name === filters.channel) ?? null)
          : null;
        const totalSpend   = marketingChannelStats.reduce((s, c) => s + c.spend,   0);
        const totalRevenue = marketingChannelStats.reduce((s, c) => s + c.revenue, 0);
        const totalRoi     = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;
        const activeRoi    = selectedRoi?.roi ?? totalRoi;
        const activeRoiLabel = filters.channel ? filters.channel : 'Total';
        const roiColor = activeRoi >= 200 ? CL.green : activeRoi >= 100 ? CL.amber : CL.red;
        const roiLabel = `${activeRoi.toFixed(0)}% (${activeRoiLabel})`;

        const cols = [
          {
            icon: '📋', title: t('Agenda & No-Show'),
            cards: [
              { label:t('Taxa de Ocupação (%)'),              value:`${kpis.occupancyRate.toFixed(1)}%`,      color:cl(kpis.occupancyRate,80,60),                              desc:t('Meta > 80% — agenda preenchida?'),           kpiKey:'ocupacao' },
              { label:t('Taxa de No-Show (%)'),               value:`${kpis.noShowRate.toFixed(1)}%`,         color:cl(kpis.noShowRate,8,12,true),                             desc:t('Meta < 8% — 1 em cada 12 pode faltar'),      kpiKey:'noshow' },
              { label:t('Confirmações Realizadas (%)'),        value:`${kpis.confirmationRate.toFixed(1)}%`,   color:cl(kpis.confirmationRate,85,70),                           desc:t('Meta > 85% — pacientes confirmaram?'),       kpiKey:'confirmacoes' },
              { label:t('Lead Time do Agendamento (dias)'),    value:`${kpis.leadTimeDays.toFixed(1)}d`,       color:cl(kpis.leadTimeDays,3,7,true),                            desc:t('Meta < 3 dias de espera'),                   kpiKey:'leadtime' },
            ],
          },
          {
            icon: '💰', title: t('Financeiro'),
            cards: [
              { label:`${moneyTitle('Faturamento Bruto')} ${pSuffix}`, value:fmt(kpis.grossRevenue),          color:CL.amber,                                                  desc:t('Total recebido no período'),                 kpiKey:'faturamento' },
              { label:t('Margem Líquida (%)'),                 value:`${kpis.margin.toFixed(1)}%`,            color:cl(kpis.margin,25,15),                                     desc:t('Meta > 20% — seu lucro real por R$100'),     kpiKey:'margem' },
              { label:t('Inadimplência (%)'),                  value:`${kpis.inadimplenciaRate.toFixed(1)}%`, color:cl(kpis.inadimplenciaRate,4,8,true),                       desc:t('Meta < 4% — quem não pagou?'),               kpiKey:'inadimplencia' },
              { label:t('Despesas Fixas / Receita (%)'),       value:`${kpis.fixedExpenseRatio.toFixed(1)}%`, color:cl(kpis.fixedExpenseRatio,45,55,true),                     desc:t('Meta < 45% — custo fixo sobre receita'),     kpiKey:'despesasfixas' },
            ],
          },
          {
            icon: '🚀', title: t('Marketing & Captação'),
            cards: [
              { label:`${t('Leads Gerados')} ${pSuffix}`,      value:`${kpis.leads}`,                         color:kpis.leads>=80?CL.green:kpis.leads>=40?CL.amber:CL.red,   desc:t('Novos interessados — crescendo?'),            kpiKey:'leads' },
              { label:t('Conversão Lead → Agendamento (%)'),   value:`${convLeadToAppt.toFixed(1)}%`,         color:cl(convLeadToAppt,22,15),                                  desc:t('Meta > 25% — quantos viraram consulta?'),    kpiKey:'conversao' },
              { label:t('CPL — Custo por Paciente'),           value:fmt(kpis.cpl),                           color:cl(kpis.cpl,kpis.avgTicket/4,kpis.avgTicket*0.6,true),    desc:t('Custo por novo paciente captado'),            kpiKey:'cpl' },
              { label:t('ROI Total e por Canal (%)'),            value:roiLabel,                                color:roiColor,                                                  desc:filters.channel ? `Canal: ${filters.channel}` : t('Meta > 200% — marketing compensa?'), kpiKey:'roi' },
            ],
          },
          {
            icon: '⚙️', title: t('Operação & UX'),
            cards: [
              { label:t('NPS Geral (0–10)'),                   value:`${kpis.avgNPS.toFixed(1)}`,             color:cl(kpis.avgNPS,8.5,7),                                     desc:t('Meta > 8,5 — paciente indicaria você?'),     kpiKey:'nps' },
              { label:t('Tempo Médio de Espera (min)'),        value:`${kpis.avgWait.toFixed(0)} min`,        color:cl(kpis.avgWait,12,20,true),                               desc:t('Meta < 12 min em sala de espera'),            kpiKey:'espera' },
              { label:`${t('Taxa de Retorno')} ${periodReturnLabel} (%)`, value:`${kpis.returnRate.toFixed(1)}%`, color:cl(kpis.returnRate,40,25), desc:`${t('Meta > 40% — paciente voltou em')} ${periodReturnLabel}?`, kpiKey:'retorno' },
              { label:t('SLA de Resposta ao Lead (h)'),        value:`${kpis.slaLeadHours.toFixed(2)}h`,      color:cl(kpis.slaLeadHours,1,2,true),                            desc:t('Meta < 1h para responder o paciente'),       kpiKey:'sla' },
            ],
          },
        ];

        return (<>
          <div className="section-header"><h2><span className="orange-bar" /> Visão CEO — Painel Executivo Completo</h2></div>
          <div className="kpi-ceo-grid" style={{ marginBottom: 8 }}>
            {cols.map(col => (
              <div key={col.title}>
                {/* Column header */}
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12, paddingBottom:8, borderBottom:'1px solid var(--border-card,#e5e7eb)' }}>
                  <span style={{ fontSize:13 }}>{col.icon}</span>
                  <span style={{ fontSize:10, fontWeight:700, letterSpacing:1, color:'var(--text-muted)', textTransform:'uppercase' }}>{col.title}</span>
                </div>
                {/* Score cards */}
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {col.cards.map(card => (
                    <div key={card.label} onClick={() => openKpiModal(card.label, card.kpiKey)} style={{
                      background:'var(--panel-bg,#fff)',
                      borderRadius:12,
                      boxShadow:'0 2px 8px rgba(0,0,0,0.06)',
                      border:'1px solid var(--border-card,#e5e7eb)',
                      borderTop:`4px solid ${card.color}`,
                      padding:'14px 16px',
                      transition:'box-shadow 200ms ease',
                      cursor:'pointer',
                      position:'relative',
                    }}>
                      <span style={{position:'absolute',top:8,right:10,fontSize:13,color:'var(--text-muted)',opacity:0.45}}>?</span>
                      <div style={{ fontSize:10, fontWeight:700, letterSpacing:0.8, color:'var(--text-muted)', textTransform:'uppercase', marginBottom:8, lineHeight:1.3 }}>
                        {card.label}
                      </div>
                      <div style={{ fontSize:28, fontWeight:800, color:card.color, lineHeight:1.1, marginBottom:6, wordBreak:'break-word' }}>
                        {card.value}
                      </div>
                      <div style={{ fontSize:11, color:'var(--text-muted)', lineHeight:1.4 }}>
                        {card.desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>);
      })()}

      {/* ===== FINANCEIRO AVANCADO ===== */}
      {activeTab === 2 && (<>
        <div className="section-header"><h2><span className="orange-bar" /> Financeiro Avançado</h2></div>
        <div className="overview-row">
          <div className="overview-card"><div className="overview-card-label">{moneyTitle('EBITDA')}</div><div className="overview-card-value">{fmt(financeAdvWeeks[financeAdvWeeks.length - 1]?.ebitda ?? 0)}</div></div>
          <div className="overview-card"><div className="overview-card-label">Margem EBITDA</div><div className="overview-card-value" style={{ color: (financeAdvWeeks[financeAdvWeeks.length - 1]?.ebitdaMargin ?? 0) >= 20 ? 'var(--green)' : 'var(--yellow)' }}>{(financeAdvWeeks[financeAdvWeeks.length - 1]?.ebitdaMargin ?? 0).toFixed(1)}%</div></div>
          <div className="overview-card"><div className="overview-card-label">{moneyTitle("Aging >90d")}</div><div className="overview-card-value">{fmt(agingReceivables.buckets.find((b) => b.label === '>90d')?.value ?? 0)}</div></div>
          <div className="overview-card"><div className="overview-card-label">{moneyTitle('Break-even')}</div><div className="overview-card-value">{fmt(breakEven.breakEvenRevenue)}</div></div>
        </div>
        <FinanceiroModule financeWeeks={financeWeeksForModule} filtered={filtered} kpis={kpis} filters={filters} showTargets={filters.severity !== ''} plan="PRO" />
      </>)}
      {/* ===== AGENDA / OTIMIZAÇÃO ===== */}
      {activeTab === 1 && (<>
        <div className="section-header"><h2><span className="orange-bar" /> Agenda & No-Show</h2></div>
        {(() => {
          const G = 'var(--green)', Y = 'var(--yellow)', R = 'var(--red)';
          const noShowCount   = filtered.filter(a => a.status === 'No-Show').length;
          const cancelCount   = filtered.filter(a => a.status === 'Cancelada').length;
          const lostCapRate   = kpis.total > 0 ? ((noShowCount + cancelCount) / kpis.total) * 100 : 0;
          const costNoShow    = noShowCount * kpis.avgTicket;
          const periodDays    = filters.period === '7d' ? 7 : filters.period === '15d' ? 15
                              : filters.period === '3m' ? 90 : filters.period === '6m' ? 180
                              : filters.period === '1 ano' ? 365 : 30;
          const periodMult    = periodDays / 30;
          const costP1Scaled  = 2000 * periodMult;
          const costP3Scaled  = 5000 * periodMult;
          const topChannel    = (() => {
            const counts = new Map<string, number>();
            filtered.forEach(a => counts.set(a.channel, (counts.get(a.channel) ?? 0) + 1));
            return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
          })();

          const cards = [
            {
              label: 'Taxa de No-Show (%)',
              value: `${kpis.noShowRate.toFixed(1)}%`,
              color: kpis.noShowRate < 8 ? G : kpis.noShowRate < 15 ? Y : R,
              meta: 'P1 < 8% | P2 8–15% | P3 > 15%',
            },
            {
              label: 'Custo Estimado do No-Show',
              value: fmt(costNoShow),
              color: costNoShow < costP1Scaled ? G : costNoShow < costP3Scaled ? Y : R,
              meta: `${noShowCount} no-shows × ticket médio`,
            },
            {
              label: 'Taxa de Ocupação (%)',
              value: `${kpis.occupancyRate.toFixed(1)}%`,
              color: kpis.occupancyRate >= 80 ? G : kpis.occupancyRate >= 65 ? Y : R,
              meta: 'P1 > 80% | P2 65–80% | P3 < 65%',
            },
            {
              label: 'Confirmações Realizadas (%)',
              value: `${kpis.confirmationRate.toFixed(1)}%`,
              color: kpis.confirmationRate >= 85 ? G : kpis.confirmationRate >= 70 ? Y : R,
              meta: 'P1 > 85% | P2 70–85% | P3 < 70%',
            },
            {
              label: 'Consultas Realizadas',
              value: String(kpis.realized),
              color: kpis.occupancyRate >= 80 ? G : kpis.occupancyRate >= 65 ? Y : R,
              meta: `de ${kpis.total} agendados`,
            },
            {
              label: 'Perda de Capacidade não Recuperável (%)',
              value: `${lostCapRate.toFixed(1)}%`,
              color: lostCapRate < 8 ? G : lostCapRate < 15 ? Y : R,
              meta: 'No-shows + cancelamentos ÷ total',
            },
            {
              label: 'Total de Agendamentos',
              value: String(kpis.total),
              color: G,
              meta: 'Total agendado no período',
            },
            {
              label: 'Canal de Aquisição (Top)',
              value: topChannel ? topChannel[0] : '—',
              color: G,
              meta: topChannel ? `${topChannel[1]} agendamentos pelo canal principal` : 'Sem dados',
            },
            {
              label: 'Lead Time do Agendamento',
              value: `${kpis.leadTimeDays.toFixed(1)}d`,
              color: kpis.leadTimeDays < 3 ? G : kpis.leadTimeDays < 7 ? Y : R,
              meta: 'P1 < 3d | P2 3–7d | P3 > 7d',
            },
          ];

          return (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(190px, 1fr))', gap:10, marginBottom:16 }}>
              {cards.map(card => (
                <div key={card.label} className="overview-card" style={{ borderTop:`3px solid ${card.color}`, padding:'12px 14px' }}>
                  <div className="overview-card-label" style={{ fontSize:10, marginBottom:6 }}>{card.label}</div>
                  <div className="overview-card-value" style={{ color:card.color, fontSize:24, lineHeight:1.1 }}>{card.value}</div>
                  <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:4, lineHeight:1.3 }}>{card.meta}</div>
                </div>
              ))}
            </div>
          );
        })()}
        <AgendaNoShowModule agendaWeeks={agendaWeeksForModule} filtered={filtered} kpis={kpis} filters={filters} showTargets={filters.severity !== ''} plan="PRO" />
      </>)}
      {/* ===== MARKETING / UNIT ECONOMICS ===== */}
      {activeTab === 3 && (<>
        <div className="section-header"><h2><span className="orange-bar" /> Marketing & Captação</h2></div>
        <div className="overview-row">
          <div className="overview-card"><div className="overview-card-label">Leads</div><div className="overview-card-value">{marketingProWeeks[marketingProWeeks.length-1]?.leadsTotal ?? 0}</div></div>
          <div className="overview-card"><div className="overview-card-label">{moneyTitle('CAC Médio')}</div><div className="overview-card-value" style={{color:'var(--green)'}}>{fmt(marketingChannelStats.reduce((s,r)=>s+r.cac,0)/Math.max(1,marketingChannelStats.length))}</div></div>
          <div className="overview-card"><div className="overview-card-label">{moneyTitle('LTV Médio')}</div><div className="overview-card-value">{fmt(marketingChannelStats.reduce((s,r)=>s+r.ltv,0)/Math.max(1,marketingChannelStats.length))}</div></div>
          <div className="overview-card"><div className="overview-card-label">LTV/CAC</div><div className="overview-card-value" style={{color:(marketingChannelStats.reduce((s,r)=>s+r.ltvCac,0)/Math.max(1,marketingChannelStats.length))>=3?'var(--green)':'var(--yellow)'}}>{(marketingChannelStats.reduce((s,r)=>s+r.ltvCac,0)/Math.max(1,marketingChannelStats.length)).toFixed(1)}x</div></div>
        </div>
        <MarketingModule weeklyData={weeklyTrend} filtered={filtered} kpis={kpis} filters={filters} showTargets={filters.severity !== ''} plan="PRO" />
      </>)}
      {/* ===== INTEGRAÇÕES ===== */}
      {activeTab === 6 && (
        <IntegrationSection
          plan="PRO"
          totalRecords={kpis.total}
          leads={kpis.leads}
          realized={kpis.realized}
          integrationHealth={integrationHealth}
        />
      )}
      {activeTab === -1 && (<>
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

      {/* ===== OPERAÇÃO & UX ===== */}
      {activeTab === 4 && (<>
        <div className="section-header"><h2><span className="orange-bar" /> Operação & UX</h2></div>
        <div className="overview-row">
          <div className="overview-card"><div className="overview-card-label">NPS</div><div className="overview-card-value" style={{color:kpis.avgNPS>=8?'var(--green)':'var(--yellow)'}}>{kpis.avgNPS.toFixed(1)}</div></div>
          <div className="overview-card"><div className="overview-card-label">Espera</div><div className="overview-card-value">{kpis.avgWait.toFixed(0)} min</div></div>
          <div className="overview-card"><div className="overview-card-label">Retorno 90d</div><div className="overview-card-value">{(opsProByProfessional.reduce((s,r)=>s+r.return90,0)/Math.max(1,opsProByProfessional.length)).toFixed(1)}%</div></div>
          <div className="overview-card"><div className="overview-card-label">SLA Lead</div><div className="overview-card-value">{(receptionSLARanking.reduce((s,r)=>s+r.slaH,0)/Math.max(1,receptionSLARanking.length)).toFixed(1)}h</div></div>
        </div>
        <OperacaoUXModule opsWeeks={agendaWeeksForModule} filtered={filtered} kpis={kpis} byProf={byProf} filters={filters} showTargets={filters.severity !== ''} plan="PRO" />
      </>)}
      {/* ===== CORPO CLÍNICO ===== */}
      {activeTab === 5 && (<>
        <div className="section-header"><h2><span className="orange-bar" /> Corpo Clínico</h2></div>
        <div className="chart-card" style={{ marginBottom: 16 }}>
          <div className="chart-card-header">
            <span className="chart-card-title">Adicionar membro da equipe</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Cadastro manual para compor tabela e rankings</span>
          </div>
          <div className="chart-card-body" style={{ padding: 16 }}>
            <div className="form-grid-4">
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
                {(editingManualTeamMemberIndex !== null || editingBaseTeamMemberName !== null) && (
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
                  {(editingManualTeamMemberIndex !== null || editingBaseTeamMemberName !== null) ? 'Salvar alterações' : 'Adicionar membro'}
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

      {/* ===== FLOATING AI ASSISTANT ===== */}
      <AIAssistantModule kpis={kpis} fmt={fmt} />

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

export default memo(ProDashboard);
