import { describe, expect, it } from "vitest";

import {
  applyFilters,
  computeByUnit,
  computeKPIs,
  controlTowerFactsToAppointments,
  getFilterReferenceDate,
  type Appointment,
  type Filters,
} from "./mockData";
import type { ControlTowerFact } from "@shared/types";

const makeAppointment = (overrides: Partial<Appointment>): Appointment => ({
  date: "2026-03-01",
  weekday: "Mon",
  professional: "Dr. Silva",
  channel: "Google",
  unit: "Jardins",
  procedure: "Botox",
  status: "Realizada",
  severity: "P2",
  revenue: 1000,
  cost: 350,
  nps: 9,
  waitMinutes: 10,
  isReturn: false,
  leadSource: "Google",
  cac: 120,
  slotCapacity: 1,
  wasConfirmed: true,
  firstContactAt: "2026-02-27T09:00:00.000Z",
  confirmedAt: "2026-02-28T09:00:00.000Z",
  scheduledAt: "2026-03-01T09:00:00.000Z",
  firstResponseAt: "2026-02-27T10:00:00.000Z",
  cancellationHoursBefore: null,
  cancellationLoss: 0,
  inadimplenciaLoss: 0,
  estornoLoss: 0,
  fixedExpenseAllocated: 0,
  adSpend: 0,
  isNewPatient: true,
  ...overrides,
});

const baseFilters: Filters = {
  period: "30d",
  channel: "",
  professional: "",
  procedure: "",
  status: "",
  unit: "",
  severity: "",
};

describe("plan dashboard filters", () => {
  it("anchors relative periods to the latest dataset date instead of a hardcoded calendar date", () => {
    const rows = [
      makeAppointment({ date: "2025-01-01", unit: "Jardins" }),
      makeAppointment({ date: "2025-01-20", unit: "Paulista" }),
    ];

    const filtered = applyFilters(rows, { ...baseFilters, period: "7d" });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.date).toBe("2025-01-20");
  });

  it("applies unit and severity filters together", () => {
    const rows = [
      makeAppointment({ unit: "Jardins", severity: "P1", professional: "Dra. Ana" }),
      makeAppointment({ unit: "Paulista", severity: "P1", professional: "Dr. Costa" }),
      makeAppointment({ unit: "Jardins", severity: "P3", professional: "Dr. Silva" }),
    ];

    const filtered = applyFilters(rows, {
      ...baseFilters,
      period: "1 ano",
      unit: "Jardins",
      severity: "P1",
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.unit).toBe("Jardins");
    expect(filtered[0]?.severity).toBe("P1");
  });
});

describe("enterprise unit aggregation", () => {
  it("builds the network rows only from units present in the filtered dataset", () => {
    const rows = [
      makeAppointment({ unit: "Jardins", revenue: 1000 }),
      makeAppointment({ unit: "Jardins", revenue: 1200 }),
      makeAppointment({ unit: "Paulista", revenue: 800 }),
    ];

    const aggregated = computeByUnit(rows);

    expect(aggregated.map((row) => row.name)).toEqual(["Jardins", "Paulista"]);
    expect(aggregated[0]?.total).toBe(2);
    expect(aggregated[1]?.total).toBe(1);
  });
});

describe("dashboard KPI calculations", () => {
  it("computes the consolidated KPI snapshot from appointment rows using the PDF business rules", () => {
    const rows = [
      makeAppointment({
        status: "Realizada",
        revenue: 1000,
        cost: 300,
        nps: 10,
        waitMinutes: 10,
        isReturn: true,
        slotCapacity: 2,
        adSpend: 150,
        fixedExpenseAllocated: 80,
        inadimplenciaLoss: 50,
      }),
      makeAppointment({
        status: "Realizada",
        revenue: 500,
        cost: 200,
        nps: 8,
        waitMinutes: 20,
        isReturn: false,
        slotCapacity: 1,
        firstContactAt: "2026-02-26T09:00:00.000Z",
        confirmedAt: "2026-02-27T09:00:00.000Z",
        firstResponseAt: "2026-02-26T10:00:00.000Z",
        adSpend: 90,
        fixedExpenseAllocated: 40,
        estornoLoss: 20,
      }),
      makeAppointment({
        status: "No-Show",
        revenue: 0,
        cost: 0,
        nps: null,
        waitMinutes: 0,
        slotCapacity: 1,
        firstContactAt: "2026-02-26T09:00:00.000Z",
        confirmedAt: "2026-02-28T09:00:00.000Z",
        firstResponseAt: "2026-02-26T11:00:00.000Z",
        adSpend: 60,
        fixedExpenseAllocated: 10,
        channel: "Organico",
      }),
      makeAppointment({
        status: "Cancelada",
        revenue: 0,
        cost: 0,
        nps: null,
        waitMinutes: 0,
        slotCapacity: 1,
        wasConfirmed: false,
        confirmedAt: null,
        cancellationHoursBefore: 12,
        cancellationLoss: 120,
        fixedExpenseAllocated: 20,
        adSpend: 0,
        isNewPatient: false,
        channel: "Telefone",
      }),
    ];

    const kpis = computeKPIs(rows);

    expect(kpis.total).toBe(4);
    expect(kpis.realized).toBe(2);
    expect(kpis.noShows).toBe(1);
    expect(kpis.canceled).toBe(1);
    expect(kpis.grossRevenue).toBe(1500);
    expect(kpis.netRevenue).toBe(1310);
    expect(kpis.totalCost).toBe(500);
    expect(kpis.fixedExpenses).toBe(150);
    expect(kpis.ebitda).toBe(660);
    expect(kpis.margin).toBeCloseTo(50.3817, 3);
    expect(kpis.avgTicket).toBe(750);
    expect(kpis.noShowRate).toBe(25);
    expect(kpis.occupancyRate).toBe(40);
    expect(kpis.cancelRate).toBe(25);
    expect(kpis.confirmationRate).toBe(75);
    expect(kpis.lostCapacityRate).toBe(50);
    expect(kpis.noShowEstimatedCost).toBe(750);
    expect(kpis.avgNPS).toBe(9);
    expect(kpis.avgWait).toBe(15);
    expect(kpis.returnRate).toBe(50);
    expect(kpis.avgCAC).toBe(150);
    expect(kpis.leads).toBe(3);
    expect(kpis.cpl).toBe(100);
    expect(kpis.inadimplenciaRate).toBeCloseTo(3.3333, 3);
    expect(kpis.fixedExpenseRatio).toBeCloseTo(11.4504, 3);
    expect(kpis.leadTimeDays).toBeCloseTo(1.3333, 3);
    expect(kpis.slaLeadHours).toBeCloseTo(1.3333, 3);
    expect(kpis.breakEven).toBeCloseTo(0.3, 3);
    expect(kpis.promoters).toBe(1);
    expect(kpis.neutrals).toBe(1);
    expect(kpis.detractors).toBe(0);
  });
});

describe("control tower facts mapping", () => {
  it("maps API-style control tower facts into appointment rows consumable by the dashboard", () => {
    const facts: ControlTowerFact[] = [
      {
        id: "fact-1",
        timestamp: "2026-03-10T10:00:00.000Z",
        channel: "Google",
        professional: "Dra. Ana",
        procedure: "Botox",
        status: "realizado",
        unit: "Jardins",
        entries: 1200,
        exits: 300,
        slotsAvailable: 8,
        slotsEmpty: 1,
        ticketMedio: 600,
        custoVariavel: 100,
        durationMinutes: 45,
        materialList: ["seringa"],
        waitMinutes: 12,
        npsScore: 9,
        baseOldRevenueCurrent: 50000,
        baseOldRevenuePrevious: 42000,
        revenueValue: 1200,
      },
      {
        id: "fact-2",
        timestamp: "2026-03-11T11:00:00.000Z",
        channel: "Instagram",
        professional: "Dr. Silva",
        procedure: "Laser",
        status: "noshow",
        unit: "Paulista",
        entries: 0,
        exits: 90,
        slotsAvailable: 5,
        slotsEmpty: 2,
        ticketMedio: 400,
        custoVariavel: 80,
        durationMinutes: 30,
        materialList: [],
        waitMinutes: 0,
        npsScore: 0,
        baseOldRevenueCurrent: 20000,
        baseOldRevenuePrevious: 22000,
        revenueValue: 0,
      },
    ];

    const appointments = controlTowerFactsToAppointments(facts);

    expect(appointments).toHaveLength(2);
    expect(appointments[0]).toMatchObject({
      date: "2026-03-10",
      professional: "Dra. Ana",
      channel: "Google",
      unit: "Jardins",
      status: "Realizada",
      revenue: 1200,
      cost: 300,
      nps: 9,
      isReturn: true,
      cac: 150,
      slotCapacity: 8,
      wasConfirmed: true,
      adSpend: 100,
    });
    expect(appointments[1]).toMatchObject({
      date: "2026-03-11",
      professional: "Dr. Silva",
      channel: "Instagram",
      unit: "Paulista",
      status: "No-Show",
      revenue: 0,
      cost: 90,
      nps: null,
      isReturn: false,
      cac: 120,
      slotCapacity: 5,
      wasConfirmed: true,
      inadimplenciaLoss: 140,
    });
  });
});

describe("getFilterReferenceDate", () => {
  it("returns the latest appointment date when data exists", () => {
    const rows = [
      makeAppointment({ date: "2026-02-10" }),
      makeAppointment({ date: "2026-02-24" }),
    ];

    expect(getFilterReferenceDate(rows).toISOString().slice(0, 10)).toBe("2026-02-24");
  });
});
