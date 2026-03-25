import type { DashboardModule, DashboardViewDefinition } from "../../types";
import { decodeDashboardText } from "../../text";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

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

function formatCompactCurrency(value: number) {
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(1).replace(".", ",")} mil`;
  }

  return `R$ ${Math.round(value)}`;
}

function toNumber(value: ValueType | undefined) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseFloat(value) || 0;
  return 0;
}

function ChartCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-[28px] border border-[#e8edf5] bg-white p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)] lg:p-6">
      <div className="mb-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#ff7a1a]">{eyebrow}</div>
        <h3 className="mt-2 text-[1.2rem] font-semibold tracking-[-0.04em] text-[#0f172a]">{title}</h3>
        <p className="mt-2 text-sm leading-7 text-[#667085]">{description}</p>
      </div>
      {children}
    </article>
  );
}

function ModuleLegend({
  module,
  highlightKpis,
}: {
  module: DashboardModule;
  highlightKpis: string[];
}) {
  const highlighted = module.kpis.filter((kpi) => highlightKpis.includes(kpi.id));

  return (
    <div className="grid gap-3">
      {highlighted.map((kpi) => (
        <div key={kpi.id} className="rounded-[20px] border border-[#edf2f7] bg-[#fbfdff] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[#0f172a]">{decodeDashboardText(kpi.name)}</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-[#94a3b8]">{decodeDashboardText(kpi.source)}</div>
            </div>
            <div className="rounded-full border border-[#ffe1b6] bg-[#fff8ee] px-3 py-1 text-xs font-semibold text-[#a96500]">
              {decodeDashboardText(kpi.currentValue)}
            </div>
          </div>
          <p className="mt-3 text-xs leading-6 text-[#667085]">
            <strong className="text-[#0f172a]">Cálculo:</strong> {decodeDashboardText(kpi.formula)}
          </p>
          <div className="mt-3 grid gap-2 text-xs leading-5 text-[#667085] md:grid-cols-3">
            <div className="rounded-[16px] border border-[#cfeedd] bg-[#f3fbf6] px-3 py-2">
              <strong className="text-[#177245]">Verde:</strong> {decodeDashboardText(kpi.thresholds.green)}
            </div>
            <div className="rounded-[16px] border border-[#ffe3bc] bg-[#fff8ef] px-3 py-2">
              <strong className="text-[#a96500]">Amarelo:</strong> {decodeDashboardText(kpi.thresholds.yellow)}
            </div>
            <div className="rounded-[16px] border border-[#ffd2d2] bg-[#fff2f2] px-3 py-2">
              <strong className="text-[#bc3d3d]">Vermelho:</strong> {decodeDashboardText(kpi.thresholds.red)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function OperationsChartsPanel({
  view,
  activeModuleId,
}: {
  view: DashboardViewDefinition;
  activeModuleId?: string;
}) {
  const revenueData = [
    { name: "MRR", value: parseMoney(getKpi(view, "receita-mrr", "mrr-total")?.currentValue ?? "0"), color: "#ff7a1a" },
    { name: "New MRR", value: parseMoney(getKpi(view, "receita-mrr", "new-mrr")?.currentValue ?? "0"), color: "#22c55e" },
    { name: "Churn MRR", value: parseMoney(getKpi(view, "receita-mrr", "churn-mrr")?.currentValue ?? "0"), color: "#ef4444" },
    { name: "Forecast 3m", value: parseMoney(getKpi(view, "receita-mrr", "forecast-mrr-3m")?.currentValue ?? "0"), color: "#3b82f6" },
  ];

  const retentionData = [
    { name: "Clientes ativos", value: parseNumber(getKpi(view, "clientes-retencao", "clientes-ativos")?.currentValue ?? "0"), target: 34 },
    { name: "Churn rate", value: parseNumber(getKpi(view, "clientes-retencao", "churn-rate")?.currentValue ?? "0"), target: 3 },
    { name: "NPS", value: parseNumber(getKpi(view, "clientes-retencao", "nps-clientes")?.currentValue ?? "0"), target: 8.5 },
    { name: "Entregas prazo", value: parseNumber(getKpi(view, "clientes-retencao", "entregas-no-prazo")?.currentValue ?? "0"), target: 95 },
    { name: "Health score", value: parseNumber(getKpi(view, "clientes-retencao", "health-score")?.currentValue ?? "0"), target: 8 },
    { name: "Indicacao", value: parseNumber(getKpi(view, "clientes-retencao", "taxa-indicacao")?.currentValue ?? "0"), target: 30 },
  ];

  const financeData = [
    { name: "Receita", value: parseMoney(getKpi(view, "financeiro-interno", "receita-total-mensal")?.currentValue ?? "0"), color: "#22c55e" },
    { name: "Fluxo", value: parseMoney(getKpi(view, "financeiro-interno", "fluxo-caixa-projetado")?.currentValue ?? "0"), color: "#3b82f6" },
    { name: "CAC", value: parseMoney(getKpi(view, "financeiro-interno", "cac")?.currentValue ?? "0"), color: "#f59e0b" },
    { name: "Receita/h", value: parseNumber(getKpi(view, "financeiro-interno", "receita-por-hora")?.currentValue ?? "0"), color: "#8b5cf6" },
  ];

  const capacityData = [
    { name: "Capacidade", value: parseNumber(getKpi(view, "capacidade-operacao", "utilizacao-capacidade")?.currentValue ?? "0"), color: "#ff7a1a" },
    { name: "Horas/cliente", value: parseNumber(getKpi(view, "capacidade-operacao", "horas-por-cliente-semana")?.currentValue ?? "0") * 15, color: "#06b6d4" },
    { name: "SLA resposta", value: parseNumber(getKpi(view, "capacidade-operacao", "sla-resposta-clientes")?.currentValue ?? "0") * 15, color: "#eab308" },
  ];

  const modules = {
    "receita-mrr": {
      eyebrow: "Modulo 1",
      title: "Receita & MRR",
      description: "Gráfico de colunas para comparar base recorrente, expansão, churn e forecast no mesmo eixo financeiro.",
      legendTitle: "Legenda de leitura",
      legendText: "Use esse gráfico para ver se o crescimento recorrente está compensando perdas e sustentando o forecast dos próximos 3 meses.",
      highlightKpis: ["mrr-total", "crescimento-mrr", "new-mrr", "churn-mrr", "forecast-mrr-3m"],
      chart: (
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueData} barGap={18}>
              <CartesianGrid stroke="#edf2f7" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(value) => `${Math.round(value / 1000)}k`} tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value: ValueType | undefined) => formatCompactCurrency(toNumber(value))} />
              <Legend />
              <Bar dataKey="value" name="Valor atual" radius={[8, 8, 0, 0]}>
                {revenueData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ),
    },
    "clientes-retencao": {
      eyebrow: "Modulo 2",
      title: "Clientes & Retencao",
      description: "Gráfico combinado de barras e linha para confrontar indicadores de retenção com suas metas de referência.",
      legendTitle: "Legenda de leitura",
      legendText: "As barras mostram o valor atual de cada KPI-chave do módulo. A linha mostra a meta operacional de referência, sem alterar a regra de negócio original.",
      highlightKpis: ["clientes-ativos", "churn-rate", "nps-clientes", "entregas-no-prazo", "health-score", "taxa-indicacao"],
      chart: (
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={retentionData}>
              <CartesianGrid stroke="#edf2f7" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" name="Valor atual" fill="#ff7a1a" radius={[8, 8, 0, 0]} />
              <Line type="monotone" dataKey="target" name="Meta de referência" stroke="#0f172a" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ),
    },
    "financeiro-interno": {
      eyebrow: "Modulo 3",
      title: "Financeiro Interno",
      description: "Barras horizontais para leitura direta de caixa, receita, CAC e produtividade econômica sem misturar escalas visuais desnecessárias.",
      legendTitle: "Legenda de leitura",
      legendText: "Receita total e fluxo mostram porte e liquidez. CAC e receita por hora ajudam a validar eficiência econômica da operação.",
      highlightKpis: ["receita-total-mensal", "margem-liquida", "cac", "fluxo-caixa-projetado", "inadimplencia", "receita-por-hora"],
      chart: (
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={financeData} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid stroke="#edf2f7" horizontal={false} />
              <XAxis type="number" tickFormatter={(value) => `${Math.round(value / 1000)}k`} tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={86} tick={{ fill: "#526070", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value: ValueType | undefined, _name: NameType | undefined, item) => item?.payload?.name === "Receita/h" ? `R$ ${Math.round(toNumber(value))}/h` : formatCompactCurrency(toNumber(value))} />
              <Legend />
              <Bar dataKey="value" name="Valor atual" radius={[0, 8, 8, 0]}>
                {financeData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ),
    },
    "capacidade-operacao": {
      eyebrow: "Modulo 4",
      title: "Capacidade & Operacao",
      description: "Área + linha para reforçar pressão operacional, ocupação e velocidade de resposta com leitura simples para gestão.",
      legendTitle: "Legenda de leitura",
      legendText: "Capacidade é o principal termômetro. Horas por cliente e SLA mostram quando a operação começa a perder escalabilidade e experiência.",
      highlightKpis: ["utilizacao-capacidade", "horas-por-cliente-semana", "sla-resposta-clientes"],
      chart: (
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={capacityData}>
              <CartesianGrid stroke="#edf2f7" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value: ValueType | undefined, _name: NameType | undefined, item) => item?.payload?.name === "Capacidade" ? `${Math.round(toNumber(value))}%` : `${(toNumber(value) / 15).toFixed(1)} h`} />
              <Legend />
              <Area type="monotone" dataKey="value" name="Pressão operacional" stroke="#ff7a1a" fill="#ffedd5" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ),
    },
  } as const;

  const selectedModule = modules[(activeModuleId as keyof typeof modules) ?? "receita-mrr"] ?? modules["receita-mrr"];
  const selectedModuleData = view.modules.find((module) => module.id === (activeModuleId ?? "receita-mrr")) ?? view.modules[0];

  return (
    <section className="space-y-5">
      <div className="rounded-[28px] border border-[#e8edf5] bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)] lg:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#94a3b8]">Leitura visual da operacao</div>
            <h2 className="mt-2 text-[1.9rem] font-semibold tracking-[-0.05em] text-[#0f172a]">{selectedModule.title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-[#667085]">
              {selectedModule.description}
            </p>
          </div>
          <div className="rounded-[22px] border border-[#ffe1b6] bg-[#fff8ee] px-4 py-3 text-xs font-medium leading-6 text-[#a96500]">
            Gráfico do submódulo com legenda e cálculo preservando 100% da regra de negócio atual.
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.9fr)]">
        <ChartCard
          eyebrow={selectedModule.eyebrow}
          title={selectedModule.title}
          description={selectedModule.legendText}
        >
          {selectedModule.chart}
        </ChartCard>

        <ChartCard
          eyebrow="Legenda"
          title={selectedModule.legendTitle}
          description="Explicação de cálculo, faixa de semáforo e leitura executiva do submódulo selecionado."
        >
          <ModuleLegend module={selectedModuleData} highlightKpis={[...selectedModule.highlightKpis]} />
        </ChartCard>
      </div>
    </section>
  );
}
