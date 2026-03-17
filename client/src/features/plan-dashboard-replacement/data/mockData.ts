/* =======================================================================
   MOCK DATA ENGINE - Dados simulados filtraveis
   Cada registro tem dimensoes: profissional, canal, unidade, procedimento,
   status. Os filtros aplicam sobre isso para gerar KPIs e series dinamicas.
   ======================================================================= */
import {
  calcBreakEven,
  calcCustoEstimadoNoShow,
  calcDespesasFixasReceita,
  calcInadimplenciaRate,
  calcLeadTimeDias,
  calcPerdaCapacidadeNaoRecuperavel,
  calcReceitaLiquida,
  calcTaxaConfirmacoes,
  calcTaxaOcupacao,
} from "@shared/controlTowerRules";
import type { ControlTowerFact } from "@shared/types";

export interface Appointment {
  date: string; // YYYY-MM-DD
  weekday: string; // Mon, Tue, ...
  professional: string;
  channel: string; // Instagram, Google, Indicacao, Organico, Telefone, Presencial
  unit: string; // Jardins, Paulista
  procedure: string; // Botox, Preenchimento, Laser, Peeling, Limpeza
  status: string; // Realizada, No-Show, Cancelada, Confirmada
  severity: string; // P1, P2, P3
  revenue: number;
  cost: number;
  nps: number | null;
  waitMinutes: number;
  isReturn: boolean;
  leadSource: string;
  cac: number;
  slotCapacity: number;
  wasConfirmed: boolean;
  firstContactAt: string;
  confirmedAt: string | null;
  scheduledAt: string;
  firstResponseAt: string | null;
  cancellationHoursBefore: number | null;
  cancellationLoss: number;
  inadimplenciaLoss: number;
  estornoLoss: number;
  fixedExpenseAllocated: number;
  adSpend: number;
  isNewPatient: boolean;
}

export interface Filters {
  period: string;
  channel: string;
  professional: string;
  procedure: string;
  status: string;
  unit: string;
  severity: string;
}

export const defaultFilters: Filters = {
  period: "30d",
  channel: "",
  professional: "",
  procedure: "",
  status: "",
  unit: "",
  severity: "",
};

const professionals = ["Dr. Silva", "Dra. Ana", "Dr. Costa"];
const channels = ["Instagram", "Google", "Indicacao", "Organico", "Telefone", "Presencial"];
const units = ["Jardins", "Paulista"];
const procedures = ["Botox", "Preenchimento", "Laser", "Peeling", "Limpeza"];
const statuses = ["Realizada", "No-Show", "Cancelada", "Confirmada"];
const severities = ["P1", "P2", "P3"];
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type FilterOptionKey = "channel" | "professional" | "procedure" | "unit" | "status" | "severity";

function uniqueDimensionValues(data: Appointment[], key: FilterOptionKey, fallback: string[]) {
  if (data.length === 0) {
    return fallback;
  }

  const values = Array.from(
    new Set(
      data
        .map((row) => row[key])
        .filter((value): value is string => Boolean(value && value.trim())),
    ),
  ).sort((a, b) => a.localeCompare(b));

  return values.length > 0 ? values : fallback;
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function buildIsoDateTime(dateStr: string, hour: number, minute: number) {
  return `${dateStr}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`;
}

function generateAppointments(): Appointment[] {
  const rng = seededRandom(42);
  const appointments: Appointment[] = [];
  const baseDate = new Date(2026, 1, 1); // Feb 1, 2026

  for (let day = 0; day < 90; day++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() - day);
    const dateStr = date.toISOString().split("T")[0];
    const wd = weekdays[date.getDay() === 0 ? 6 : date.getDay() - 1];
    const appointmentsPerDay = Math.floor(rng() * 8) + 10;

    for (let i = 0; i < appointmentsPerDay; i++) {
      const professional = professionals[Math.floor(rng() * professionals.length)];
      const channel = channels[Math.floor(rng() * channels.length)];
      const unit = units[Math.floor(rng() * units.length)];
      const procedure = procedures[Math.floor(rng() * procedures.length)];
      const statusRoll = rng();
      const status = statusRoll < 0.75 ? "Realizada" : statusRoll < 0.87 ? "No-Show" : statusRoll < 0.94 ? "Cancelada" : "Confirmada";
      const severity = severities[Math.floor(rng() * severities.length)];
      const ticketBase =
        procedure === "Botox"
          ? 850
          : procedure === "Preenchimento"
            ? 1200
            : procedure === "Laser"
              ? 650
              : procedure === "Peeling"
                ? 280
                : 180;
      const revenue = status === "Realizada" ? ticketBase * (0.8 + rng() * 0.4) : 0;
      const cost = revenue * (0.3 + rng() * 0.2);
      const nps = status === "Realizada" ? Math.round((6 + rng() * 4) * 10) / 10 : null;
      const waitMinutes = Math.floor(5 + rng() * 30);
      const isReturn = rng() < 0.38;
      const isNewPatient = rng() < 0.44;
      const slotCapacity = 1 + (rng() < 0.22 ? 1 : 0);
      const wasConfirmed = status !== "Cancelada" || rng() < 0.55;
      const scheduledAt = buildIsoDateTime(dateStr, 8 + Math.floor(rng() * 9), rng() < 0.5 ? 0 : 30);

      const firstContactDate = new Date(scheduledAt);
      firstContactDate.setDate(firstContactDate.getDate() - (1 + Math.floor(rng() * 8)));
      firstContactDate.setHours(9 + Math.floor(rng() * 4), Math.floor(rng() * 2) * 30, 0, 0);
      const firstContactAt = firstContactDate.toISOString();

      const confirmedDate = wasConfirmed ? new Date(scheduledAt) : null;
      if (confirmedDate) {
        confirmedDate.setDate(confirmedDate.getDate() - Math.floor(rng() * 3));
        confirmedDate.setHours(10 + Math.floor(rng() * 6), Math.floor(rng() * 2) * 30, 0, 0);
      }

      const firstResponseDate = new Date(firstContactAt);
      firstResponseDate.setMinutes(firstResponseDate.getMinutes() + 20 + Math.floor(rng() * 280));
      const firstResponseAt = firstResponseDate.toISOString();

      const cancellationHoursBefore = status === "Cancelada" ? Math.floor(rng() * 48) : null;
      const cancellationLoss = status === "Cancelada" ? ticketBase * (0.4 + rng() * 0.35) : 0;
      const inadimplenciaLoss = status === "Realizada" ? revenue * (0.01 + rng() * 0.05) : 0;
      const estornoLoss = status === "Realizada" ? revenue * (0.005 + rng() * 0.02) : 0;
      const fixedExpenseAllocated = status === "Realizada" ? revenue * (0.18 + rng() * 0.14) : ticketBase * 0.04;
      const cacBase =
        channel === "Instagram"
          ? 210
          : channel === "Google"
            ? 245
            : channel === "Indicacao"
              ? 85
              : channel === "Organico"
                ? 35
                : channel === "Telefone"
                  ? 50
                  : 30;
      const cac = cacBase * (0.7 + rng() * 0.6);
      const adSpend = ["Instagram", "Google"].includes(channel) ? cac * (0.75 + rng() * 0.35) : cac * 0.18;

      appointments.push({
        date: dateStr,
        weekday: wd,
        professional,
        channel,
        unit,
        procedure,
        status,
        severity,
        revenue,
        cost,
        nps,
        waitMinutes,
        isReturn,
        leadSource: channel,
        cac,
        slotCapacity,
        wasConfirmed,
        firstContactAt,
        confirmedAt: confirmedDate?.toISOString() ?? null,
        scheduledAt,
        firstResponseAt,
        cancellationHoursBefore,
        cancellationLoss,
        inadimplenciaLoss,
        estornoLoss,
        fixedExpenseAllocated,
        adSpend,
        isNewPatient,
      });
    }
  }

  return appointments;
}

let _allAppointments: Appointment[] | null = null;

export function getAllAppointments(): Appointment[] {
  if (!_allAppointments) {
    _allAppointments = generateAppointments();
  }
  return _allAppointments;
}

function periodToDays(period: Filters["period"]) {
  if (period === "7d") return 7;
  if (period === "15d") return 15;
  if (period === "30d") return 30;
  if (period === "3m") return 90;
  if (period === "6m") return 180;
  if (period === "1 ano") return 365;
  return 30;
}

export function getFilterReferenceDate(data: Appointment[], fallback = new Date()) {
  const latestTimestamp = data.reduce<number | null>((latest, row) => {
    const rowTimestamp = new Date(`${row.date}T12:00:00`).getTime();
    if (!Number.isFinite(rowTimestamp)) {
      return latest;
    }
    if (latest === null || rowTimestamp > latest) {
      return rowTimestamp;
    }
    return latest;
  }, null);

  return latestTimestamp ? new Date(latestTimestamp) : fallback;
}

export function applyFilters(data: Appointment[], filters: Filters): Appointment[] {
  let filtered = [...data];

  const referenceDate = getFilterReferenceDate(data);
  const cutoff = new Date(referenceDate);
  cutoff.setDate(cutoff.getDate() - periodToDays(filters.period));
  const cutoffStr = cutoff.toISOString().split("T")[0];
  filtered = filtered.filter((a) => a.date >= cutoffStr);

  if (filters.channel) {
    if (filters.channel === "OUTROS") {
      const otherChannelAliases = new Set(["OUTROS", "Outros", "Organico", "Telefone", "Presencial"]);
      filtered = filtered.filter((a) => otherChannelAliases.has(a.channel));
    } else if (filters.channel === "Facebook") {
      const facebookAliases = new Set(["Facebook", "Organico"]);
      filtered = filtered.filter((a) => facebookAliases.has(a.channel));
    } else if (filters.channel === "Whatsapp") {
      const whatsappAliases = new Set(["Whatsapp", "WhatsApp", "Telefone"]);
      filtered = filtered.filter((a) => whatsappAliases.has(a.channel));
    } else if (filters.channel === "Indicacao") {
      const indicationAliases = new Set(["Indicacao", "Indicação"]);
      filtered = filtered.filter((a) => indicationAliases.has(a.channel));
    } else {
      filtered = filtered.filter((a) => a.channel === filters.channel);
    }
  }
  if (filters.professional) filtered = filtered.filter((a) => a.professional === filters.professional);
  if (filters.procedure) filtered = filtered.filter((a) => a.procedure === filters.procedure);
  if (filters.status) filtered = filtered.filter((a) => a.status === filters.status);
  if (filters.unit) filtered = filtered.filter((a) => a.unit === filters.unit);
  if (filters.severity) filtered = filtered.filter((a) => a.severity === filters.severity);

  return filtered;
}

/* ======== COMPUTED METRICS ======== */

export function computeKPIs(data: Appointment[]) {
  const total = data.length;
  const realized = data.filter((a) => a.status === "Realizada");
  const noShows = data.filter((a) => a.status === "No-Show");
  const canceled = data.filter((a) => a.status === "Cancelada");
  const confirmed = data.filter((a) => a.wasConfirmed);
  const cancellationsUnder24h = canceled.filter((a) => (a.cancellationHoursBefore ?? Infinity) < 24);

  const grossRevenue = realized.reduce((sum, row) => sum + row.revenue, 0);
  const totalCost = realized.reduce((sum, row) => sum + row.cost, 0);
  const cancellationLoss = data.reduce((sum, row) => sum + row.cancellationLoss, 0);
  const inadimplenciaLoss = data.reduce((sum, row) => sum + row.inadimplenciaLoss, 0);
  const estornoLoss = data.reduce((sum, row) => sum + row.estornoLoss, 0);
  const fixedExpenses = data.reduce((sum, row) => sum + row.fixedExpenseAllocated, 0);
  const capacityAvailable = data.reduce((sum, row) => sum + row.slotCapacity, 0);
  const netRevenue = Math.max(0, calcReceitaLiquida(grossRevenue, cancellationLoss, inadimplenciaLoss, estornoLoss));
  const ebitda = netRevenue - totalCost - fixedExpenses;
  const margin = netRevenue > 0 ? (ebitda / netRevenue) * 100 : 0;
  const avgTicket = realized.length > 0 ? grossRevenue / realized.length : 0;
  const noShowRate = total > 0 ? (noShows.length / total) * 100 : 0;
  const occupancyRate = calcTaxaOcupacao(realized.length, capacityAvailable);
  const cancelRate = total > 0 ? (canceled.length / total) * 100 : 0;
  const confirmationRate = calcTaxaConfirmacoes(confirmed.length, total);
  const lostCapacityRate = calcPerdaCapacidadeNaoRecuperavel(noShows.length, cancellationsUnder24h.length, total);
  const noShowEstimatedCost = calcCustoEstimadoNoShow(noShows.length, avgTicket);

  const npsScores = realized.map((a) => a.nps).filter((n): n is number => n !== null);
  const avgNPS = npsScores.length > 0 ? npsScores.reduce((sum, score) => sum + score, 0) / npsScores.length : 0;
  const avgWait = realized.length > 0 ? realized.reduce((sum, row) => sum + row.waitMinutes, 0) / realized.length : 0;
  const returnRate = realized.length > 0 ? (realized.filter((row) => row.isReturn).length / realized.length) * 100 : 0;
  const totalAdSpend = data.reduce((sum, row) => sum + row.adSpend, 0);
  const convertedNewPatients = realized.filter((row) => row.isNewPatient).length;
  const avgCAC = convertedNewPatients > 0 ? totalAdSpend / convertedNewPatients : 0;
  const leads = data.filter((row) => row.isNewPatient).length;
  const cpl = leads > 0 ? totalAdSpend / leads : 0;
  const inadimplenciaRate = calcInadimplenciaRate(inadimplenciaLoss, grossRevenue);
  const fixedExpenseRatio = calcDespesasFixasReceita(fixedExpenses, netRevenue);

  const confirmedWithDates = confirmed.filter((row) => row.confirmedAt);
  const leadTimeTotalDays = confirmedWithDates.reduce((sum, row) => {
    const diffMs = new Date(row.confirmedAt as string).getTime() - new Date(row.firstContactAt).getTime();
    return Number.isFinite(diffMs) && diffMs > 0 ? sum + (diffMs / 86_400_000) : sum;
  }, 0);
  const leadTimeDays = calcLeadTimeDias(leadTimeTotalDays, confirmedWithDates.length);

  const respondedRows = confirmed.filter((row) => row.firstResponseAt);
  const slaLeadHours =
    respondedRows.reduce((sum, row) => {
      const diffMs = new Date(row.firstResponseAt as string).getTime() - new Date(row.firstContactAt).getTime();
      return Number.isFinite(diffMs) && diffMs > 0 ? sum + (diffMs / 3_600_000) : sum;
    }, 0) / Math.max(1, respondedRows.length);

  const avgVariableCost = realized.length > 0 ? totalCost / realized.length : 0;
  const contributionMarginPercent = avgTicket > 0 ? ((avgTicket - avgVariableCost) / avgTicket) * 100 : 0;
  const breakEven = calcBreakEven(fixedExpenses, avgTicket, contributionMarginPercent);

  return {
    total,
    realized: realized.length,
    noShows: noShows.length,
    canceled: canceled.length,
    grossRevenue,
    netRevenue,
    totalCost,
    fixedExpenses,
    margin,
    ebitda,
    avgTicket,
    noShowRate,
    occupancyRate,
    cancelRate,
    confirmationRate,
    lostCapacityRate,
    noShowEstimatedCost,
    leadTimeDays,
    inadimplenciaRate,
    fixedExpenseRatio,
    breakEven,
    avgNPS,
    avgWait,
    returnRate,
    avgCAC,
    leads,
    cpl,
    capacityAvailable,
    totalAdSpend,
    cancellationLoss,
    inadimplenciaLoss,
    estornoLoss,
    slaLeadHours,
    promoters: npsScores.filter((n) => n >= 9).length,
    neutrals: npsScores.filter((n) => n >= 7 && n < 9).length,
    detractors: npsScores.filter((n) => n < 7).length,
    complaints: Math.max(0, Math.floor(npsScores.filter((n) => n < 5).length * 0.3)),
  };
}

export function computeByProfessional(data: Appointment[]) {
  return uniqueDimensionValues(data, "professional", professionals).map((professional) => {
    const filtered = data.filter((row) => row.professional === professional);
    return { name: professional, ...computeKPIs(filtered) };
  });
}

export function computeByChannel(data: Appointment[]) {
  return uniqueDimensionValues(data, "channel", channels).map((channel) => {
    const filtered = data.filter((row) => row.channel === channel);
    return { name: channel, ...computeKPIs(filtered) };
  });
}

export function computeByProcedure(data: Appointment[]) {
  return uniqueDimensionValues(data, "procedure", procedures).map((procedure) => {
    const filtered = data.filter((row) => row.procedure === procedure);
    return { name: procedure, ...computeKPIs(filtered) };
  });
}

export function computeByUnit(data: Appointment[]) {
  return uniqueDimensionValues(data, "unit", units).map((unit) => {
    const filtered = data.filter((row) => row.unit === unit);
    return { name: unit, ...computeKPIs(filtered) };
  });
}

export function computeByWeekday(data: Appointment[]) {
  return weekdays.map((weekday) => {
    const filtered = data.filter((row) => row.weekday === weekday);
    return { name: weekday, ...computeKPIs(filtered) };
  });
}

export function computeWeeklyTrend(data: Appointment[]) {
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) return [];

  const weeks: Array<{ label: string; data: Appointment[] }> = [];
  let currentWeek: Appointment[] = [];
  let weekStart = sorted[0].date;

  for (const row of sorted) {
    const daysDiff = (new Date(row.date).getTime() - new Date(weekStart).getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff >= 7) {
      weeks.push({ label: `S${weeks.length + 1}`, data: currentWeek });
      currentWeek = [];
      weekStart = row.date;
    }
    currentWeek.push(row);
  }

  if (currentWeek.length > 0) {
    weeks.push({ label: `S${weeks.length + 1}`, data: currentWeek });
  }

  return weeks.slice(-8).map((week) => ({
    label: week.label,
    ...computeKPIs(week.data),
  }));
}

export function getFilterOptions(data: Appointment[]) {
  return {
    channels: uniqueDimensionValues(data, "channel", channels),
    professionals: uniqueDimensionValues(data, "professional", professionals),
    procedures: uniqueDimensionValues(data, "procedure", procedures),
    units: uniqueDimensionValues(data, "unit", units),
    statuses: uniqueDimensionValues(data, "status", statuses),
    severities: uniqueDimensionValues(data, "severity", severities),
  };
}

export { professionals, channels, units, procedures, statuses, severities };

function mapStatus(status: ControlTowerFact["status"]): Appointment["status"] {
  if (status === "realizado") return "Realizada";
  if (status === "noshow") return "No-Show";
  if (status === "cancelado") return "Cancelada";
  return "Confirmada";
}

function mapWeekday(timestamp: string) {
  const day = new Date(timestamp).getDay();
  return weekdays[day === 0 ? 6 : day - 1] ?? "Mon";
}

function mapSeverity(fact: ControlTowerFact): Appointment["severity"] {
  if (fact.status === "noshow") return "P1";
  if (fact.status === "cancelado" || fact.waitMinutes > 25) return "P2";
  return "P3";
}

export function controlTowerFactsToAppointments(facts: ControlTowerFact[]): Appointment[] {
  return facts.map((fact) => ({
    date: fact.timestamp.slice(0, 10),
    weekday: mapWeekday(fact.timestamp),
    professional: fact.professional,
    channel: fact.channel,
    unit: fact.unit || "Principal",
    procedure: fact.procedure,
    status: mapStatus(fact.status),
    severity: mapSeverity(fact),
    revenue: fact.status === "realizado" ? fact.entries : 0,
    cost: fact.exits,
    nps: fact.npsScore > 10 ? Math.round((fact.npsScore / 10) * 10) / 10 : fact.npsScore || null,
    waitMinutes: fact.waitMinutes,
    isReturn: fact.baseOldRevenueCurrent > fact.baseOldRevenuePrevious,
    leadSource: fact.channel,
    cac: fact.custoVariavel > 0 ? fact.custoVariavel * 1.5 : 80,
    slotCapacity: Math.max(1, fact.slotsAvailable),
    wasConfirmed: fact.status !== "cancelado",
    firstContactAt: fact.timestamp,
    confirmedAt: fact.status === "cancelado" ? null : fact.timestamp,
    scheduledAt: fact.timestamp,
    firstResponseAt: fact.timestamp,
    cancellationHoursBefore: fact.status === "cancelado" ? 12 : null,
    cancellationLoss: fact.status === "cancelado" ? fact.ticketMedio : 0,
    inadimplenciaLoss: fact.status === "noshow" ? fact.ticketMedio * 0.35 : 0,
    estornoLoss: 0,
    fixedExpenseAllocated: fact.custoVariavel,
    adSpend: fact.custoVariavel,
    isNewPatient: fact.baseOldRevenueCurrent <= fact.baseOldRevenuePrevious,
  }));
}
