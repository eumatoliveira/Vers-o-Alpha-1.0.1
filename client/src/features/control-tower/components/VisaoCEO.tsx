import { useMemo } from "react";
import { m } from "framer-motion";
import type { ControlTowerFact, ControlTowerFilterState } from "@shared/types";
import {
  calcBreakEven,
  calcEbitdaNormalizada,
  calcReceitaLiquida,
  calcRevPas,
} from "@shared/controlTowerRules";
import type { Language } from "@/i18n";
import type { ControlTowerLocale } from "@/lib/controlTowerLocale";
import { formatCurrency, formatPercent } from "../utils/formatters";
import { MetricCard, Panel } from "./shared";
import FormulaTooltip from "./FormulaTooltip";

interface VisaoCEOProps {
  language: Language;
  locale: ControlTowerLocale;
  facts: ControlTowerFact[];
  onDrillDown: (partial: Partial<ControlTowerFilterState>) => void;
}

export default function VisaoCEO({ language, locale, facts, onDrillDown }: VisaoCEOProps) {
  const metrics = useMemo(() => {
    const receitaBruta = facts.reduce((sum, row) => sum + row.entries, 0);
    const cancelamentos = facts.filter(row => row.status === "cancelado").reduce((sum, row) => sum + row.entries, 0);
    const inadimplencia = facts.filter(row => row.status === "noshow").reduce((sum, row) => sum + row.ticketMedio * 0.35, 0);
    const estornos = facts.filter(row => row.status === "cancelado").reduce((sum, row) => sum + row.ticketMedio * 0.08, 0);
    const faturamentoLiquido = calcReceitaLiquida(receitaBruta, cancelamentos, inadimplencia, estornos);

    const custos = facts.reduce((sum, row) => sum + row.exits, 0);
    const lucroOperacional = receitaBruta - custos;
    const depreciacao = receitaBruta * 0.03;
    const ajustesProLabore = receitaBruta * 0.015;
    const ebitdaNorm = calcEbitdaNormalizada(lucroOperacional, depreciacao, ajustesProLabore);
    const margemEbitda = receitaBruta === 0 ? 0 : (ebitdaNorm / receitaBruta) * 100;

    const receitaTotal = facts.reduce((sum, row) => sum + row.revenueValue, 0);
    const slotsDisponiveis = facts.reduce((sum, row) => sum + row.slotsAvailable, 0);
    const revpas = calcRevPas(receitaTotal, slotsDisponiveis);

    const ticketMedio = facts.length === 0 ? 0 : facts.reduce((sum, row) => sum + row.ticketMedio, 0) / facts.length;
    const custosFixos = custos * 0.55;
    const custoVariavelMedio = facts.length === 0 ? 0 : facts.reduce((sum, row) => sum + row.custoVariavel, 0) / facts.length;
    const margemContribuicaoPct = ticketMedio === 0 ? 0 : ((ticketMedio - custoVariavelMedio) / ticketMedio) * 100;
    const breakEven = calcBreakEven(custosFixos, ticketMedio, margemContribuicaoPct);

    const noshowRate = facts.length === 0 ? 0 : (facts.filter(row => row.status === "noshow").length / facts.length) * 100;
    const idleRate = slotsDisponiveis === 0 ? 0 : (facts.reduce((sum, row) => sum + row.slotsEmpty, 0) / slotsDisponiveis) * 100;
    const cac = facts.length === 0 ? 0 : custos / Math.max(1, facts.filter(row => row.status === "realizado").length);
    const receitaEfficiency = receitaBruta === 0 ? 0 : (faturamentoLiquido / receitaBruta) * 100;
    const revpasFill = ticketMedio === 0 ? 0 : (revpas / ticketMedio) * 100;

    return {
      faturamentoLiquido,
      margemEbitda,
      revpas,
      breakEven,
      noshowRate,
      idleRate,
      cac,
      breakEvenGauge: Math.min(100, breakEven),
      receitaEfficiency: Math.max(0, Math.min(100, receitaEfficiency)),
      ebitdaFill: Math.max(0, Math.min(100, margemEbitda)),
      revpasFill: Math.max(0, Math.min(100, revpasFill)),
    };
  }, [facts]);

  const noShowSeverity = metrics.noshowRate > 25 ? "critical" : metrics.noshowRate > 15 ? "warning" : "neutral";
  const idleSeverity = metrics.idleRate > 28 ? "warning" : "neutral";
  const cacSeverity = metrics.cac > Math.max(1, metrics.revpas * 6) ? "warning" : "neutral";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard
          label={locale.ceo.liquidRevenue}
          value={formatCurrency(metrics.faturamentoLiquido)}
          metricKey="faturamento_liquido"
          language={language}
          onClick={() => onDrillDown({ status: "realizado" })}
          fillPercent={metrics.receitaEfficiency}
          emphasis={metrics.receitaEfficiency >= 45 ? "positive" : "warning"}
        />
        <MetricCard
          label={locale.ceo.ebitdaNorm}
          value={formatPercent(metrics.margemEbitda)}
          metricKey="margem_ebitda_normalizada"
          language={language}
          fillPercent={metrics.ebitdaFill}
          emphasis={metrics.margemEbitda >= 25 ? "positive" : "warning"}
        />
        <MetricCard
          label={locale.ceo.revpas}
          value={formatCurrency(metrics.revpas)}
          metricKey="revpas"
          language={language}
          fillPercent={metrics.revpasFill}
          emphasis={metrics.revpasFill >= 40 ? "positive" : "warning"}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title={locale.ceo.leakMap} metricKey="mapa_vazamentos_noshow" language={language}>
          <div className="grid gap-3 sm:grid-cols-3">
            <m.button
              type="button"
              onClick={() => onDrillDown({ status: "noshow" })}
              className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-left"
              animate={noShowSeverity === "critical" ? { boxShadow: ["0 0 0 rgba(239,68,68,0.15)", "0 0 18px rgba(239,68,68,0.35)", "0 0 0 rgba(239,68,68,0.15)"] } : undefined}
              transition={noShowSeverity === "critical" ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : undefined}
            >
              <div className="mb-2 flex justify-end">
                <FormulaTooltip metricKey="mapa_vazamentos_noshow" language={language} />
              </div>
              <p className="text-xs text-slate-400">{locale.ceo.noShow}</p>
              <p className={`text-xl font-semibold ${noShowSeverity === "critical" ? "text-red-300" : "text-amber-300"}`}>{formatPercent(metrics.noshowRate)}</p>
            </m.button>

            <m.button
              type="button"
              onClick={() => onDrillDown({ status: "agendado" })}
              className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-left"
              animate={idleSeverity === "warning" ? { opacity: [0.86, 1, 0.86] } : undefined}
              transition={idleSeverity === "warning" ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : undefined}
            >
              <div className="mb-2 flex justify-end">
                <FormulaTooltip metricKey="mapa_vazamentos_ociosidade" language={language} />
              </div>
              <p className="text-xs text-slate-400">{locale.ceo.idle}</p>
              <p className="text-xl font-semibold text-yellow-300">{formatPercent(metrics.idleRate)}</p>
            </m.button>

            <m.button
              type="button"
              onClick={() => onDrillDown({ channel: "meta" })}
              className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-left"
              animate={cacSeverity === "warning" ? { y: [0, -2, 0] } : undefined}
              transition={cacSeverity === "warning" ? { duration: 2.1, repeat: Infinity, ease: "easeInOut" } : undefined}
            >
              <div className="mb-2 flex justify-end">
                <FormulaTooltip metricKey="mapa_vazamentos_cac" language={language} />
              </div>
              <p className="text-xs text-slate-400">{locale.ceo.cac}</p>
              <p className="text-xl font-semibold text-cyan-300">{formatCurrency(metrics.cac)}</p>
            </m.button>
          </div>
        </Panel>

        <Panel title={locale.ceo.breakEven} metricKey="break_even" language={language}>
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
              <span>{locale.ceo.breakEven}</span>
              <span>{metrics.breakEven.toFixed(1)}</span>
            </div>
            <div className="h-4 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-lime-400"
                style={{ width: `${metrics.breakEvenGauge}%` }}
              />
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
