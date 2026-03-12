import { describe, expect, it } from "vitest";
import {
  calcBreakEven,
  calcCCC,
  calcCGN,
  calcCustoEstimadoNoShow,
  calcCustoOportunidade,
  calcDespesasFixasReceita,
  calcEbitdaNormalizada,
  calcImpactoFinanceiro,
  calcFaturamentoLiquido,
  calcInadimplenciaRate,
  calcLeadTimeDias,
  calcLtvCacRatio,
  calcLtvLiquido,
  calcMargemPorMinuto,
  calcNps,
  calcNrr,
  calcPerdaCapacidadeNaoRecuperavel,
  calcPaybackCac,
  calcReceitaLiquida,
  calcRoi,
  calcRevPas,
  calcRevPasDropPercent,
  calcTaxaConfirmacoes,
  calcTaxaOcupacao,
  detectRevPasDrop7d,
  enterprise,
} from "@shared/controlTowerRules";
import type { ControlTowerFact } from "@shared/types";

function makeFact(partial: Partial<ControlTowerFact>): ControlTowerFact {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    channel: "meta",
    professional: "Ana",
    procedure: "Consulta",
    status: "realizado",
    entries: 500,
    exits: 180,
    slotsAvailable: 20,
    slotsEmpty: 4,
    ticketMedio: 380,
    custoVariavel: 120,
    durationMinutes: 45,
    materialList: ["resina"],
    waitMinutes: 15,
    npsScore: 88,
    baseOldRevenueCurrent: 20000,
    baseOldRevenuePrevious: 24000,
    revenueValue: 320,
    ...partial,
  };
}

describe("enterprise math rules", () => {
  it("executes the base financial formulas deterministically", () => {
    expect(calcFaturamentoLiquido(10000, 1200, 300)).toBe(8500);
    expect(calcReceitaLiquida(10000, 1200, 300, 200)).toBe(8300);
    expect(calcEbitdaNormalizada(2500, 400, 100)).toBe(3000);
    expect(calcRevPas(4500, 30)).toBe(150);
    expect(calcBreakEven(12000, 400)).toBe(30);
    expect(calcBreakEven(12000, 400, 40)).toBe(75);
    expect(calcTaxaOcupacao(24, 30)).toBe(80);
    expect(calcTaxaConfirmacoes(34, 40)).toBe(85);
    expect(calcPerdaCapacidadeNaoRecuperavel(3, 1, 40)).toBe(10);
    expect(calcCustoEstimadoNoShow(8, 350)).toBe(2800);
    expect(calcLeadTimeDias(18, 6)).toBe(3);
    expect(calcCCC(35, 12, 20)).toBe(27);
    expect(calcCGN(18000, 4000, 7000)).toBe(15000);
    expect(calcInadimplenciaRate(300, 10000)).toBe(3);
    expect(calcDespesasFixasReceita(4500, 10000)).toBe(45);
    expect(calcCustoOportunidade(8, 350)).toBe(2800);
    expect(calcMargemPorMinuto(900, 300, 60)).toBe(10);
    expect(calcPaybackCac(600, 150)).toBe(4);
    expect(calcLtvLiquido(500, 4, 3, 350, 200)).toBe(5450);
    expect(calcLtvCacRatio(6000, 1500)).toBe(4);
    expect(calcNrr(108000, 100000)).toBe(108);
    expect(calcNps(70, 10, 100)).toBe(60);
    expect(calcRoi(6000, 2000)).toBe(200);
  });

  it("guards divisions by zero in ratio-based formulas", () => {
    expect(calcRevPas(4500, 0)).toBe(0);
    expect(calcBreakEven(12000, 0)).toBe(0);
    expect(calcBreakEven(12000, 400, 0)).toBe(0);
    expect(calcMargemPorMinuto(900, 300, 0)).toBe(0);
    expect(calcPaybackCac(600, 0)).toBe(0);
    expect(calcNrr(108000, 0)).toBe(0);
    expect(calcNps(70, 10, 0)).toBe(0);
    expect(calcLtvCacRatio(4000, 0)).toBe(0);
  });

  it("calculates financial impact strictly", () => {
    expect(calcImpactoFinanceiro(12, 420)).toBe(5040);
  });

  it("detects RevPAS drop in 7 days", () => {
    const drop = calcRevPasDropPercent(65, 100);
    expect(drop).toBeCloseTo(35, 5);
    expect(detectRevPasDrop7d(65, 100)).toBe(true);
    expect(detectRevPasDrop7d(90, 100)).toBe(false);
  });

  it("classifies P1 alerts when critical thresholds are crossed", () => {
    const facts: ControlTowerFact[] = [
      ...Array.from({ length: 8 }, (_, idx) =>
        makeFact({
          id: `old-${idx}`,
          timestamp: new Date(Date.now() - (8 - idx) * 86_400_000).toISOString(),
          revenueValue: 600,
          slotsAvailable: 10,
          slotsEmpty: 1,
          status: "realizado",
          entries: 900,
          exits: 600,
        })),
      ...Array.from({ length: 7 }, (_, idx) =>
        makeFact({
          id: `new-${idx}`,
          timestamp: new Date(Date.now() - idx * 86_400_000).toISOString(),
          revenueValue: 90,
          slotsAvailable: 10,
          slotsEmpty: 12,
          status: "noshow",
          entries: 200,
          exits: 260,
        })),
    ];

    const snapshot = enterprise.buildSnapshot(facts);
    const alerts = enterprise.evaluateAlerts(snapshot);

    expect(snapshot.taxaNoshow).toBeGreaterThan(25);
    expect(snapshot.impactoFinanceiro).toBeGreaterThan(5000);
    expect(snapshot.revpasDropPercent).toBeGreaterThan(15);
    expect(alerts.some(alert => alert.severity === "P1")).toBe(true);
  });
});
