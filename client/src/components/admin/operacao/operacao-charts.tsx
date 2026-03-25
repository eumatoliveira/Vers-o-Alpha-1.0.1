"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  RadialBar,
  RadialBarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { ChartContainer, type ChartConfig as UiChartConfig } from "@/components/ui/chart";
import { useAdminDashboardStore } from "@/features/admin-dashboard/store/useAdminDashboardStore";

type ChartCardProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  height?: number;
};

type OperacaoChartsProps = {
  mrrAtual: number;
  crescimentoMrrAtual: number;
  newMrrAtual: number;
  churnMrrAtual: number;
  margemAtual: number;
  capacidadeAtual: number;
  slaAtual: number;
  npsAtual: number;
};

type MonthPoint = {
  mes: string;
};

type RevenuePoint = MonthPoint & {
  mrr: number;
  forecast: number;
};

type GrowthPoint = MonthPoint & {
  crescimento: number;
};

type NewVsChurnPoint = MonthPoint & {
  newMRR: number;
  churnMRR: number;
};

type RevenueCompositionPoint = MonthPoint & {
  mrr: number;
  setup: number;
  advisory: number;
  oneTime: number;
};

type MarginPoint = MonthPoint & {
  margem: number;
};

type HealthPoint = {
  cliente: string;
  health: number;
  nps: number;
};

type CapacityPoint = {
  semana: string;
  capacidade: number;
  sla: number;
};

function ChartCard({ title, subtitle, children, height = 280 }: ChartCardProps) {
  return (
    <div
      data-glx-chart-card="true"
      data-glx-chart-title={title}
      data-glx-chart-subtitle={subtitle ?? ""}
      className="rounded-[28px] border border-[#e8edf5] bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)] transition-shadow duration-200 hover:shadow-[0_24px_48px_rgba(15,23,42,0.08)]"
    >
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">Painel</p>
        <h3 className="text-[1.25rem] font-semibold tracking-[-0.04em] text-[#0f172a]">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm leading-6 text-[#667085]">{subtitle}</p> : null}
      </div>

      <div style={{ height }}>{children}</div>
    </div>
  );
}

function currency(value: number) {
  return `R$ ${value.toLocaleString("pt-BR")}`;
}

function toNumber(value: ValueType | undefined) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return 0;
}

function monthLabel(entry: unknown) {
  return String((entry as MonthPoint | undefined)?.mes ?? "");
}

function clientLabel(entry: unknown) {
  return String((entry as HealthPoint | undefined)?.cliente ?? "");
}

function weekLabel(entry: unknown) {
  return String((entry as CapacityPoint | undefined)?.semana ?? "");
}

const mrrChartConfig = {
  mrr: { label: "MRR", color: "#f97316" },
  forecast: { label: "Forecast", color: "#94a3b8" },
} satisfies UiChartConfig;

const newVsChurnConfig = {
  newMRR: { label: "New MRR", color: "#10b981" },
  churnMRR: { label: "Churn MRR", color: "#f97316" },
} satisfies UiChartConfig;

const revenueCompositionConfig = {
  mrr: { label: "MRR", color: "#0f172a" },
  setup: { label: "Setup", color: "#f97316" },
  advisory: { label: "Advisory", color: "#38bdf8" },
  oneTime: { label: "One-time", color: "#cbd5e1" },
} satisfies UiChartConfig;

const marginConfig = {
  margem: { label: "Margem", color: "#6366f1" },
} satisfies UiChartConfig;

const healthConfig = {
  value: { label: "NPS", color: "#10b981" },
  health: { label: "Health Score", color: "#10b981" },
} satisfies UiChartConfig;

const capacityConfig = {
  capacidade: { label: "Capacidade", color: "#0ea5e9" },
  sla: { label: "SLA", color: "#f97316" },
} satisfies UiChartConfig;

const growthConfig = {
  crescimento: { label: "Crescimento MRR", color: "#2563eb" },
} satisfies UiChartConfig;

export function OperacaoChartsGrid({
  mrrAtual,
  crescimentoMrrAtual,
  newMrrAtual,
  churnMrrAtual,
  margemAtual,
  capacidadeAtual,
  slaAtual,
  npsAtual,
}: OperacaoChartsProps) {
  const chartFilter = useAdminDashboardStore((state) => state.chartFilter);
  const setChartFilter = useAdminDashboardStore((state) => state.setChartFilter);
  const mrrEvolutionData = [
    { mes: "Jan", mrr: 98000, forecast: 95000 },
    { mes: "Fev", mrr: 105000, forecast: 101000 },
    { mes: "Mar", mrr: 112000, forecast: 109000 },
    { mes: "Abr", mrr: 118000, forecast: 115000 },
    { mes: "Mai", mrr: 126000, forecast: 121000 },
    { mes: "Jun", mrr: mrrAtual, forecast: Math.max(mrrAtual - 5800, 0) },
  ];

  const newVsChurnData = [
    { mes: "Jan", newMRR: 22000, churnMRR: 4000 },
    { mes: "Fev", newMRR: 18000, churnMRR: 6000 },
    { mes: "Mar", newMRR: 25000, churnMRR: 7000 },
    { mes: "Abr", newMRR: 21000, churnMRR: 9000 },
    { mes: "Mai", newMRR: 27000, churnMRR: 8000 },
    { mes: "Jun", newMRR: newMrrAtual, churnMRR: churnMrrAtual },
  ];

  const growthData = [
    { mes: "Jan", crescimento: 11.2 },
    { mes: "Fev", crescimento: 12.8 },
    { mes: "Mar", crescimento: 14.1 },
    { mes: "Abr", crescimento: 13.6 },
    { mes: "Mai", crescimento: 15.2 },
    { mes: "Jun", crescimento: crescimentoMrrAtual },
  ];

  const revenueCompositionData = [
    { mes: "Jan", mrr: 98000, setup: 12000, advisory: 8000, oneTime: 4000 },
    { mes: "Fev", mrr: 105000, setup: 9000, advisory: 12000, oneTime: 3000 },
    { mes: "Mar", mrr: 112000, setup: 14000, advisory: 10000, oneTime: 6000 },
    { mes: "Abr", mrr: 118000, setup: 8000, advisory: 9000, oneTime: 5000 },
    { mes: "Mai", mrr: 126000, setup: 12000, advisory: 11000, oneTime: 4000 },
    { mes: "Jun", mrr: mrrAtual, setup: 16000, advisory: 13000, oneTime: 5000 },
  ];

  const marginData = [
    { mes: "Jan", margem: 28 },
    { mes: "Fev", margem: 31 },
    { mes: "Mar", margem: 29 },
    { mes: "Abr", margem: 34 },
    { mes: "Mai", margem: 30 },
    { mes: "Jun", margem: margemAtual },
  ];

  const healthScoreData = [
    { cliente: "Clik Job", health: 4.8, nps: 6.8 },
    { cliente: "Velloz", health: 5.9, nps: 7.1 },
    { cliente: "Kronos", health: 6.3, nps: 7.8 },
    { cliente: "Nativa", health: 7.4, nps: 8.4 },
    { cliente: "Aster", health: 8.1, nps: 9.0 },
  ];

  const capacitySlaData = [
    { semana: "S1", capacidade: 72, sla: 1.8 },
    { semana: "S2", capacidade: 81, sla: 2.1 },
    { semana: "S3", capacidade: 88, sla: 2.9 },
    { semana: "S4", capacidade: capacidadeAtual, sla: slaAtual },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard title="Evolucao MRR" subtitle="Linha principal para saude recorrente e tendencia mensal">
          <ChartContainer config={mrrChartConfig} className="h-full w-full">
            <AreaChart data={mrrEvolutionData}>
              <defs>
                <linearGradient id="mrrFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mes" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip formatter={(value: ValueType | undefined) => [currency(toNumber(value)), ""]} />
              <Area
                isAnimationActive
                animationDuration={250}
                animationEasing="ease-out"
                type="monotone"
                dataKey="mrr"
                stroke="#f97316"
                fill="url(#mrrFill)"
                strokeWidth={3}
                onClick={(entry) => {
                  const mes = monthLabel(entry);
                  setChartFilter({ dimension: "month", value: mes, label: `Mes ${mes}` });
                }}
              />
              <Line isAnimationActive animationDuration={250} animationEasing="ease-out" type="monotone" dataKey="forecast" stroke="#94a3b8" strokeDasharray="5 5" dot={false} strokeWidth={2} />
            </AreaChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard title="Crescimento MRR (%)" subtitle="Leitura mensal da velocidade de crescimento da base recorrente">
          <ChartContainer config={growthConfig} className="h-full w-full">
            <LineChart data={growthData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mes" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} domain={[0, 20]} />
              <Tooltip formatter={(value: ValueType | undefined) => [`${toNumber(value).toFixed(1)}%`, "Crescimento"]} />
              <ReferenceLine y={15} stroke="#10b981" strokeDasharray="4 4" label="Meta 15%" />
              <Line
                isAnimationActive
                animationDuration={250}
                animationEasing="ease-out"
                type="monotone"
                dataKey="crescimento"
                stroke="#2563eb"
                strokeWidth={3}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                onClick={(entry) => {
                  const mes = monthLabel(entry);
                  setChartFilter({ dimension: "month", value: mes, label: `Mes ${mes}` });
                }}
              />
            </LineChart>
          </ChartContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <ChartCard title="New MRR vs Churn MRR" subtitle="Comparacao direta entre crescimento conquistado e receita perdida" height={250}>
          <ChartContainer config={newVsChurnConfig} className="h-full w-full">
            <BarChart data={newVsChurnData} barGap={8}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mes" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip formatter={(value: ValueType | undefined) => [currency(toNumber(value)), ""]} />
              <Bar
                isAnimationActive
                animationDuration={250}
                animationEasing="ease-out"
                dataKey="newMRR"
                name="New MRR"
                fill="#10b981"
                radius={[8, 8, 0, 0]}
                onClick={(entry) => {
                  const mes = monthLabel(entry);
                  setChartFilter({ dimension: "month", value: mes, label: `New MRR ${mes}` });
                }}
              />
              <Bar
                isAnimationActive
                animationDuration={250}
                
                animationEasing="ease-out"
                dataKey="churnMRR"
                name="Churn MRR"
                fill="#f97316"
                radius={[8, 8, 0, 0]}
                onClick={(entry) => {
                  const mes = monthLabel(entry);
                  setChartFilter({ dimension: "month", value: mes, label: `Churn MRR ${mes}` });
                }}
              />
            </BarChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard title="Composicao da Receita" subtitle="MRR + setup + advisory + receitas one-time" height={250}>
          <ChartContainer config={revenueCompositionConfig} className="h-full w-full">
            <BarChart data={revenueCompositionData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mes" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip formatter={(value: ValueType | undefined) => [currency(toNumber(value)), ""]} />
              <Bar isAnimationActive animationDuration={250} animationEasing="ease-out" dataKey="mrr" stackId="a" fill="#0f172a" radius={[6, 6, 0, 0]} onClick={(entry) => { const mes = monthLabel(entry); setChartFilter({ dimension: "month", value: mes, label: `Receita ${mes}` }); }} />
              <Bar isAnimationActive animationDuration={250}  animationEasing="ease-out" dataKey="setup" stackId="a" fill="#f97316" onClick={(entry) => { const mes = monthLabel(entry); setChartFilter({ dimension: "month", value: mes, label: `Setup ${mes}` }); }} />
              <Bar isAnimationActive animationDuration={250}  animationEasing="ease-out" dataKey="advisory" stackId="a" fill="#38bdf8" onClick={(entry) => { const mes = monthLabel(entry); setChartFilter({ dimension: "month", value: mes, label: `Advisory ${mes}` }); }} />
              <Bar isAnimationActive animationDuration={250}  animationEasing="ease-out" dataKey="oneTime" stackId="a" fill="#cbd5e1" onClick={(entry) => { const mes = monthLabel(entry); setChartFilter({ dimension: "month", value: mes, label: `One-time ${mes}` }); }} />
            </BarChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard title="Margem Liquida" subtitle="Meta operacional destacada em linha de referencia" height={250}>
          <ChartContainer config={marginConfig} className="h-full w-full">
            <LineChart data={marginData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mes" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} domain={[0, 50]} />
              <Tooltip formatter={(value: ValueType | undefined) => [`${toNumber(value)}%`, "Margem"]} />
              <ReferenceLine y={35} stroke="#10b981" strokeDasharray="4 4" label="Meta 35%" />
              <Line
                isAnimationActive
                animationDuration={250}
                animationEasing="ease-out"
                type="monotone"
                dataKey="margem"
                stroke="#6366f1"
                strokeWidth={3}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                onClick={(entry) => {
                  const mes = monthLabel(entry);
                  setChartFilter({ dimension: "month", value: mes, label: `Margem ${mes}` });
                }}
              />
            </LineChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard title="NPS e Health Score" subtitle="NPS executivo + clientes com pior score de saude" height={250}>
          <div className="grid h-full grid-cols-1 gap-4 md:grid-cols-[140px_1fr]">
            <div className="flex items-center justify-center">
              <ChartContainer config={healthConfig} className="h-full w-full">
                <RadialBarChart
                  innerRadius="65%"
                  outerRadius="100%"
                  barSize={14}
                  data={[{ name: "NPS", value: npsAtual * 10, fill: "#10b981" }]}
                  startAngle={90}
                  endAngle={-270}
                >
                <RadialBar
                  background
                  dataKey="value"
                  isAnimationActive
                  animationDuration={250}
                  animationEasing="ease-out"
                  onClick={() => setChartFilter({ dimension: "client", value: "NPS", label: "Recorte NPS" })}
                />
                  <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-slate-900 text-xl font-bold">
                    {npsAtual.toFixed(1)}
                  </text>
                </RadialBarChart>
              </ChartContainer>
            </div>

            <ChartContainer config={healthConfig} className="h-full w-full">
              <BarChart data={healthScoreData} layout="vertical" margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 10]} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="cliente" tickLine={false} axisLine={false} width={72} />
                <Tooltip formatter={(value: ValueType | undefined) => [toNumber(value), "Health Score"]} />
                <Bar
                  isAnimationActive
                  animationDuration={250}
                  animationEasing="ease-out"
                  dataKey="health"
                  radius={[0, 8, 8, 0]}
                  onClick={(entry) => {
                    const cliente = clientLabel(entry);
                    setChartFilter({ dimension: "client", value: cliente, label: `Cliente ${cliente}` });
                  }}
                >
                  {healthScoreData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.health < 5 ? "#ef4444" : entry.health < 7 ? "#f59e0b" : "#10b981"}
                      fillOpacity={!chartFilter || chartFilter.value === entry.cliente ? 1 : 0.45}
                      style={{ cursor: "pointer" }}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>
        </ChartCard>

        <ChartCard title="Capacidade e Operacao" subtitle="Barra de utilizacao da capacidade + leitura atual de SLA" height={250}>
          <div className="flex h-full flex-col justify-between">
            <div>
              <div className="mb-3 flex items-center justify-between text-sm font-medium text-[#0f172a]">
                <span>Utilizacao de Capacidade</span>
                <span>{capacidadeAtual}%</span>
              </div>
              <div className="h-4 overflow-hidden rounded-full bg-[#edf2f7]">
                <div
                  style={{ width: `${Math.max(0, Math.min(capacidadeAtual, 100))}%`, transition: "width 0.3s ease" }}
                  className="h-full rounded-full bg-[#0ea5e9] cursor-pointer"
                  onClick={() =>
                    setChartFilter({
                      dimension: "capacityBand",
                      value: capacidadeAtual >= 85 ? "Alta capacidade" : capacidadeAtual >= 70 ? "Faixa ideal" : "Baixa capacidade",
                      label: `Capacidade ${capacidadeAtual}%`,
                    })
                  }
                />
              </div>
              <div className="mt-2 text-xs text-[#667085]">Faixa ideal: 70% a 85% | Atenção acima de 85%</div>
            </div>

            <ChartContainer config={capacityConfig} className="h-[120px] w-full">
              <ComposedChart data={capacitySlaData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="semana" tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} domain={[0, 6]} />
                <Tooltip formatter={(value: ValueType | undefined, name: NameType | undefined) => [name === "sla" ? `${toNumber(value).toFixed(1)}h` : `${toNumber(value)}%`, ""]} />
                <Line
                  isAnimationActive
                  animationDuration={250}
                  
                  animationEasing="ease-out"
                  yAxisId="right"
                  type="monotone"
                  dataKey="sla"
                  stroke="#f97316"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  onClick={(entry) => {
                    const semana = weekLabel(entry);
                    setChartFilter({ dimension: "month", value: semana, label: `SLA ${semana}` });
                  }}
                />
              </ComposedChart>
            </ChartContainer>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
