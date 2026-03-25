"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import type { DashboardViewDefinition } from "@/features/admin-dashboard/types";
import { useAdminDashboardStore } from "@/features/admin-dashboard/store/useAdminDashboardStore";

type ChartCardProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  height?: number;
};

function parseMoney(value: string) {
  const normalized = value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const numeric = Number.parseFloat(normalized || "0");
  return value.includes("mil") ? numeric * 1000 : numeric;
}

function parseNumber(value: string) {
  const normalized = value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  return Number.parseFloat(normalized || "0");
}

function getKpi(view: DashboardViewDefinition, moduleId: string, kpiId: string) {
  return view.modules.find((module) => module.id === moduleId)?.kpis.find((kpi) => kpi.id === kpiId);
}

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseFloat(value) || 0;
  return 0;
}

function formatCompactCurrency(value: number) {
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(1).replace(".", ",")} mil`;
  }

  return `R$ ${Math.round(value)}`;
}

type FunnelPoint = { etapa: string; valor: number; color: string };
type WeightedPoint = { semana: string; pipeline: number; meta: number; acv: number };
type CyclePoint = { produto: string; dias: number; color: string };
type OsVsAdvisoryPoint = { eixo: string; atual: number; meta: number };

function tooltipNumber(value: ValueType | undefined) {
  return toNumber(value);
}

function funnelStage(entry: unknown) {
  return String((entry as FunnelPoint | undefined)?.etapa ?? "");
}

function weightedWeek(entry: unknown) {
  return String((entry as WeightedPoint | undefined)?.semana ?? "");
}

function cycleProduct(entry: unknown) {
  return String((entry as CyclePoint | undefined)?.produto ?? "");
}

function advisoryAxis(entry: unknown) {
  return String((entry as OsVsAdvisoryPoint | undefined)?.eixo ?? "");
}

function ChartCard({
  eyebrow = "Painel superior",
  title,
  subtitle,
  children,
  height = 280,
}: ChartCardProps) {
  return (
    <div
      data-glx-chart-card="true"
      data-glx-chart-title={title}
      data-glx-chart-subtitle={subtitle ?? ""}
      className="rounded-[28px] border border-[#e8edf5] bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)] transition-shadow duration-200 hover:shadow-[0_24px_48px_rgba(15,23,42,0.08)]"
    >
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">{eyebrow}</p>
        <h3 className="text-[1.25rem] font-semibold tracking-[-0.04em] text-[#0f172a]">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm leading-6 text-[#667085]">{subtitle}</p> : null}
      </div>

      <div style={{ height }}>{children}</div>
    </div>
  );
}

export function PipelineChartsGrid({ view }: { view: DashboardViewDefinition }) {
  const chartFilter = useAdminDashboardStore((state) => state.chartFilter);
  const setChartFilter = useAdminDashboardStore((state) => state.setChartFilter);
  const setProduct = useAdminDashboardStore((state) => state.setProduct);
  const leadsTotais = parseNumber(getKpi(view, "topo-funil", "leads-totais")?.currentValue ?? "0");
  const leadsQuentes = parseNumber(getKpi(view, "topo-funil", "leads-quentes")?.currentValue ?? "0");
  const callsQualificacao = parseNumber(getKpi(view, "topo-funil", "calls-qualificacao")?.currentValue ?? "0");
  const callsFechamento = parseNumber(getKpi(view, "fechamento", "calls-fechamento")?.currentValue ?? "0");
  const taxaLeadQuente = parseNumber(getKpi(view, "topo-funil", "taxa-lead-quente")?.currentValue ?? "0");
  const taxaLeadCall = parseNumber(getKpi(view, "topo-funil", "taxa-lead-call")?.currentValue ?? "0");
  const taxaQualifFechamento = parseNumber(getKpi(view, "fechamento", "taxa-qualif-fechamento")?.currentValue ?? "0");
  const taxaFechamentoContrato = parseNumber(getKpi(view, "fechamento", "taxa-fechamento-contrato")?.currentValue ?? "0");
  const cicloLeadContrato = parseNumber(getKpi(view, "fechamento", "ciclo-lead-contrato")?.currentValue ?? "0");
  const pipelinePonderado = parseMoney(getKpi(view, "consolidada", "pipeline-ponderado")?.currentValue ?? "0");
  const acvMedio = parseMoney(getKpi(view, "consolidada", "acv-medio")?.currentValue ?? "0");
  const setupsAndamento = parseNumber(getKpi(view, "consolidada", "setups-andamento")?.currentValue ?? "0");
  const osStartMrr12 = parseNumber(getKpi(view, "operation-system", "os-start-mrr12")?.currentValue ?? "0");
  const osProMrr12 = parseNumber(getKpi(view, "operation-system", "os-pro-mrr12")?.currentValue ?? "0");
  const renovacaoAdvisory = parseNumber(getKpi(view, "advisory", "renovacao-advisory")?.currentValue ?? "0");

  const contratos = Math.max(1, Math.round((callsFechamento * taxaFechamentoContrato) / 100));
  const targetMrr = Math.round(pipelinePonderado / 3);

  const funnelData = [
    { etapa: "Leads", valor: leadsTotais, color: "#2563eb" },
    { etapa: "Leads quentes", valor: leadsQuentes, color: "#22c55e" },
    { etapa: "Calls qualif.", valor: callsQualificacao, color: "#f97316" },
    { etapa: "Calls fech.", valor: callsFechamento, color: "#f59e0b" },
    { etapa: "Contratos", valor: contratos, color: "#0f172a" },
  ];

  const weightedData = [
    { semana: "S-5", pipeline: 298000, meta: targetMrr * 3, acv: 19000 },
    { semana: "S-4", pipeline: 325000, meta: targetMrr * 3, acv: 20200 },
    { semana: "S-3", pipeline: 351000, meta: targetMrr * 3, acv: 20800 },
    { semana: "S-2", pipeline: 384000, meta: targetMrr * 3, acv: 21400 },
    { semana: "S-1", pipeline: 421000, meta: targetMrr * 3, acv: 21900 },
    { semana: "Atual", pipeline: pipelinePonderado, meta: targetMrr * 3, acv: acvMedio },
  ];

  const leadSourceData = [
    { name: "Pipedrive", value: 18, color: "#f97316" },
    { name: "LinkedIn", value: 11, color: "#0f172a" },
    { name: "Indicacao", value: 9, color: "#22c55e" },
    { name: "Outbound", value: 8, color: "#38bdf8" },
  ];

  const conversionData = [
    { etapa: "Lead -> Quente", atual: taxaLeadQuente, meta: 35 },
    { etapa: "Quente -> Call", atual: taxaLeadCall, meta: 60 },
    { etapa: "Qualif. -> Fech.", atual: taxaQualifFechamento, meta: 70 },
    { etapa: "Fech. -> Contrato", atual: taxaFechamentoContrato, meta: 40 },
  ];

  const cycleData = [
    { produto: "OS", dias: 27, color: "#f59e0b" },
    { produto: "Advisory", dias: 18, color: "#fb923c" },
  ];

  const osVsAdvisoryData = [
    { eixo: "OS Start", atual: osStartMrr12, meta: 80 },
    { eixo: "OS Pro", atual: osProMrr12, meta: 80 },
    { eixo: "Advisory", atual: renovacaoAdvisory, meta: 75 },
    { eixo: "Setups", atual: setupsAndamento * 20, meta: 40 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard
          title="Funil Executivo"
          subtitle="Blocos 1 e 2: entrada de leads, aquecimento comercial, calls e contratos."
          height={320}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={funnelData} barGap={16}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf2f7" />
              <XAxis dataKey="etapa" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
              <Tooltip formatter={(value: ValueType | undefined) => [`${Math.round(tooltipNumber(value))}`, "Volume"]} />
              <Legend />
              <Bar
                isAnimationActive
                animationDuration={250}
                animationEasing="ease-out"
                dataKey="valor"
                name="Volume atual"
                radius={[8, 8, 0, 0]}
                onClick={(entry) => {
                  const etapa = funnelStage(entry);
                  const stageMap: Record<string, string> = {
                    Leads: "Lead",
                    "Leads quentes": "Lead Quente",
                    "Calls qualif.": "Call Qualificacao",
                    "Calls fech.": "Call Fechamento",
                    Contratos: "Proposta enviada",
                  };
                  setChartFilter({
                    dimension: "stage",
                    value: stageMap[etapa] ?? etapa,
                    label: `Etapa ${etapa}`,
                  });
                }}
              >
                {funnelData.map((entry) => (
                  <Cell
                    key={entry.etapa}
                    fill={entry.color}
                    fillOpacity={!chartFilter || chartFilter.value === entry.etapa || chartFilter.label === `Etapa ${entry.etapa}` ? 1 : 0.45}
                    style={{ cursor: "pointer" }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Pipeline Ponderado"
          subtitle="Bloco 5: serie semanal respeitando as probabilidades do briefing e o alvo de 3x meta."
          height={320}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weightedData}>
              <defs>
                <linearGradient id="pipelineFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.24} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf2f7" />
              <XAxis dataKey="semana" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#64748b", fontSize: 12 }}
                tickFormatter={(value) => `${Math.round(toNumber(value) / 1000)}k`}
              />
              <Tooltip formatter={(value: ValueType | undefined, name: NameType | undefined) => [formatCompactCurrency(tooltipNumber(value)), name === "pipeline" ? "Pipeline" : "Referencia"]} />
              <Legend />
              <ReferenceLine y={targetMrr * 3} stroke="#10b981" strokeDasharray="4 4" label="Meta 3x" />
              <Area
                isAnimationActive
                animationDuration={250}
                animationEasing="ease-out"
                type="monotone"
                dataKey="pipeline"
                name="Pipeline ponderado"
                stroke="#2563eb"
                fill="url(#pipelineFill)"
                strokeWidth={3}
                onClick={(entry) => {
                  const semana = weightedWeek(entry) || "Atual";
                  setChartFilter({ dimension: "month", value: semana, label: `Semana ${semana}` });
                }}
              />
              <Line
                isAnimationActive
                animationDuration={1200}
                animationBegin={120}
                animationEasing="ease-out"
                type="monotone"
                dataKey="acv"
                name="ACV medio"
                stroke="#f97316"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <ChartCard
          title="Leads por Origem"
          subtitle="Bloco 1: leitura visual do topo do funil por canal dominante."
          eyebrow="Detalhe"
          height={250}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip formatter={(value: ValueType | undefined) => [`${Math.round(tooltipNumber(value))}`, "Leads"]} />
              <Legend />
              <Pie
                isAnimationActive
                animationDuration={1000}
                animationEasing="ease-out"
                data={leadSourceData}
                dataKey="value"
                nameKey="name"
                innerRadius={48}
                outerRadius={82}
                paddingAngle={3}
                onClick={(entry) =>
                  setChartFilter({
                    dimension: "source",
                    value: String(entry?.name ?? ""),
                    label: `Origem ${String(entry?.name ?? "")}`,
                  })
                }
              >
                {leadSourceData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={entry.color}
                    fillOpacity={!chartFilter || chartFilter.value === entry.name ? 1 : 0.4}
                    style={{ cursor: "pointer" }}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Conversao por Etapa"
          subtitle="Blocos 1 e 2: atual vs meta nas conversoes criticas do funil."
          eyebrow="Detalhe"
          height={250}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={conversionData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf2f7" />
              <XAxis dataKey="etapa" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} domain={[0, 100]} />
              <Tooltip formatter={(value: ValueType | undefined) => [`${Math.round(tooltipNumber(value))}%`, "Taxa"]} />
              <Legend />
              <Bar
                isAnimationActive
                animationDuration={900}
                animationEasing="ease-out"
                dataKey="atual"
                name="Atual"
                fill="#f97316"
                radius={[8, 8, 0, 0]}
                onClick={(entry) =>
                  setChartFilter({
                    dimension: "stage",
                    value:
                      funnelStage(entry).includes("Fech.")
                        ? "Proposta enviada"
                        : funnelStage(entry).includes("Qualif.")
                          ? "Call Fechamento"
                          : "Call Qualificacao",
                    label: `Conversao ${funnelStage(entry)}`,
                  })
                }
              />
              <Line isAnimationActive animationDuration={1100} animationBegin={100} animationEasing="ease-out" type="monotone" dataKey="meta" name="Meta" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Ciclo Medio Lead > Contrato"
          subtitle="Bloco 2: comparar OS x Advisory para localizar gargalo comercial."
          eyebrow="Detalhe"
          height={250}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cycleData} barGap={16}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf2f7" />
              <XAxis dataKey="produto" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
              <Tooltip formatter={(value: ValueType | undefined) => [`${Math.round(tooltipNumber(value))} dias`, "Ciclo"]} />
              <Legend />
              <Bar
                isAnimationActive
                animationDuration={250}
                animationEasing="ease-out"
                dataKey="dias"
                name="Dias"
                radius={[8, 8, 0, 0]}
                onClick={(entry) => {
                  const produto = cycleProduct(entry).toUpperCase() === "ADVISORY" ? "ADVISORY" : "OS";
                  setProduct(produto as "OS" | "ADVISORY");
                  setChartFilter({ dimension: "product", value: produto, label: `Produto ${produto}` });
                }}
              >
                {cycleData.map((entry) => (
                  <Cell key={entry.produto} fill={entry.color} style={{ cursor: "pointer" }} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="OS vs Advisory"
          subtitle="Blocos 3 e 4: recorrencia do OS versus renovacao e base ativa do Advisory."
          eyebrow="Detalhe"
          height={250}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={osVsAdvisoryData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf2f7" />
              <XAxis dataKey="eixo" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
              <Tooltip formatter={(value: ValueType | undefined, _name: NameType | undefined, item) => [`${Math.round(tooltipNumber(value))}${item?.dataKey === "atual" ? "%" : ""}`, item?.dataKey === "meta" ? "Meta" : "Atual"]} />
              <Legend />
              <Bar
                isAnimationActive
                animationDuration={900}
                animationEasing="ease-out"
                dataKey="atual"
                name="Atual"
                fill="#14b8a6"
                radius={[8, 8, 0, 0]}
                onClick={(entry) => {
                  const eixo = advisoryAxis(entry);
                  if (eixo.includes("Advisory")) {
                    setProduct("ADVISORY");
                    setChartFilter({ dimension: "product", value: "ADVISORY", label: "Produto ADVISORY" });
                    return;
                  }
                  setProduct("OS");
                  setChartFilter({ dimension: "product", value: "OS", label: `Produto ${eixo.includes("Setups") ? "OS Setup" : "OS"}` });
                }}
              />
              <Line isAnimationActive animationDuration={1080} animationBegin={100} animationEasing="ease-out" type="monotone" dataKey="meta" name="Meta" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
