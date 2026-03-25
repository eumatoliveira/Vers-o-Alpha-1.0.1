import type { DashboardModule, DashboardViewDefinition } from "../../types";
import { decodeDashboardText } from "../../text";
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

function BlockLegend({
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
            <strong className="text-[#0f172a]">Calculo:</strong> {decodeDashboardText(kpi.formula)}
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

export function PipelineChartsPanel({
  view,
  activeBlockId,
}: {
  view: DashboardViewDefinition;
  activeBlockId?: string;
}) {
  const topFunnelData = [
    { name: "Leads", value: parseNumber(getKpi(view, "topo-funil", "leads-totais")?.currentValue ?? "0"), color: "#3b82f6" },
    { name: "Quentes", value: parseNumber(getKpi(view, "topo-funil", "leads-quentes")?.currentValue ?? "0"), color: "#22c55e" },
    { name: "Calls qualif.", value: parseNumber(getKpi(view, "topo-funil", "calls-qualificacao")?.currentValue ?? "0"), color: "#ff7a1a" },
  ];

  const closingData = [
    { stage: "Qualif. -> Fech.", taxa: parseNumber(getKpi(view, "fechamento", "taxa-qualif-fechamento")?.currentValue ?? "0"), meta: 70 },
    { stage: "Fech. -> Contrato", taxa: parseNumber(getKpi(view, "fechamento", "taxa-fechamento-contrato")?.currentValue ?? "0"), meta: 40 },
    { stage: "Ciclo (dias)", taxa: parseNumber(getKpi(view, "fechamento", "ciclo-lead-contrato")?.currentValue ?? "0"), meta: 21 },
  ];

  const osData = [
    { name: "Diagnosticos", atual: parseNumber(getKpi(view, "operation-system", "diagnosticos-os")?.currentValue ?? "0"), meta: 4 },
    { name: "Setups", atual: parseNumber(getKpi(view, "operation-system", "setups-fechados-os")?.currentValue ?? "0"), meta: 3 },
    { name: "Diag -> Setup", atual: parseNumber(getKpi(view, "operation-system", "taxa-diagnostico-setup")?.currentValue ?? "0"), meta: 70 },
    { name: "Setup -> MRR", atual: parseNumber(getKpi(view, "operation-system", "taxa-setup-mrr")?.currentValue ?? "0"), meta: 80 },
    { name: "OS Start", atual: parseNumber(getKpi(view, "operation-system", "os-start-mrr12")?.currentValue ?? "0"), meta: 80 },
    { name: "OS Pro", atual: parseNumber(getKpi(view, "operation-system", "os-pro-mrr12")?.currentValue ?? "0"), meta: 80 },
  ];

  const advisoryData = [
    { name: "Fechados", value: parseNumber(getKpi(view, "advisory", "advisory-fechados")?.currentValue ?? "0"), color: "#ff7a1a" },
    { name: "Ativos", value: parseNumber(getKpi(view, "advisory", "advisory-ativos")?.currentValue ?? "0"), color: "#3b82f6" },
    { name: "Renovacao %", value: parseNumber(getKpi(view, "advisory", "renovacao-advisory")?.currentValue ?? "0"), color: "#22c55e" },
  ];

  const consolidatedData = [
    { name: "Pipeline Ponderado", value: parseMoney(getKpi(view, "consolidada", "pipeline-ponderado")?.currentValue ?? "0"), color: "#ff7a1a" },
    { name: "ACV", value: parseMoney(getKpi(view, "consolidada", "acv-medio")?.currentValue ?? "0"), color: "#8b5cf6" },
    { name: "Setups andamento", value: parseNumber(getKpi(view, "consolidada", "setups-andamento")?.currentValue ?? "0") * 30000, color: "#22c55e" },
  ];

  const blocks = {
    "topo-funil": {
      eyebrow: "Bloco 1",
      title: "Topo do Funil",
      description: "Grafico de colunas para acompanhar entrada de leads, aquecimento e passagem para call de qualificacao.",
      legendText: "Leitura do volume no topo do funil comum a OS e Advisory. O foco e ver abastecimento, qualidade e passagem para call.",
      highlightKpis: ["leads-totais", "leads-quentes", "taxa-lead-quente", "calls-qualificacao", "taxa-lead-call"],
      chart: (
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topFunnelData} barGap={18}>
              <CartesianGrid stroke="#edf2f7" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value: ValueType | undefined) => `${Math.round(toNumber(value))}`} />
              <Legend />
              <Bar dataKey="value" name="Volume atual" radius={[8, 8, 0, 0]}>
                {topFunnelData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ),
    },
    fechamento: {
      eyebrow: "Bloco 2",
      title: "Fechamento",
      description: "Grafico combinado para confrontar as taxas de conversao e o ciclo medio contra as metas do bloco.",
      legendText: "Mantem a leitura do fechamento sem alterar os cortes de meta. Barra mostra o atual e linha mostra a meta de referencia do KPI.",
      highlightKpis: ["calls-fechamento", "taxa-qualif-fechamento", "taxa-fechamento-contrato", "ciclo-lead-contrato"],
      chart: (
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={closingData}>
              <CartesianGrid stroke="#edf2f7" vertical={false} />
              <XAxis dataKey="stage" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value: ValueType | undefined, name: NameType | undefined) => {
                const numericValue = toNumber(value);
                return name === "Meta" ? `${Math.round(numericValue)}` : `${Math.round(numericValue)}${name === "Atual" && numericValue < 100 ? "%" : ""}`;
              }} />
              <Legend />
              <Bar dataKey="taxa" name="Atual" fill="#ff7a1a" radius={[8, 8, 0, 0]} />
              <Line type="monotone" dataKey="meta" name="Meta" stroke="#22c55e" strokeWidth={3} dot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ),
    },
    "operation-system": {
      eyebrow: "Bloco 3",
      title: "Operation System (OS) - Start / Pro",
      description: "Grafico de area e linha para mostrar o funil do produto com diagnostico, setup e recorrencia em MRR 12 meses.",
      legendText: "Esse bloco precisa clareza de conversao e permanencia. A serie atual e comparada com as metas sem mudar nenhuma formula do briefing.",
      highlightKpis: ["diagnosticos-os", "setups-fechados-os", "taxa-diagnostico-setup", "taxa-setup-mrr", "os-start-mrr12", "os-pro-mrr12"],
      chart: (
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={osData}>
              <CartesianGrid stroke="#edf2f7" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value: ValueType | undefined) => {
                const numericValue = toNumber(value);
                return `${Math.round(numericValue)}${numericValue <= 100 ? "%" : ""}`;
              }} />
              <Legend />
              <Area type="monotone" dataKey="atual" name="Atual" stroke="#ff7a1a" fill="#ffedd5" strokeWidth={3} />
              <Line type="monotone" dataKey="meta" name="Meta" stroke="#0f172a" strokeWidth={2} dot={{ r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ),
    },
    advisory: {
      eyebrow: "Bloco 4",
      title: "Advisory - Board / Scale",
      description: "Barras horizontais para diferenciar rapidamente entrada, base ativa e renovacao do produto consultivo.",
      legendText: "Aqui a leitura e mais direta: novos fechamentos, base ativa e renovacao. O desenho privilegia comparacao limpa e executiva.",
      highlightKpis: ["advisory-fechados", "advisory-ativos", "renovacao-advisory"],
      chart: (
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={advisoryData} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid stroke="#edf2f7" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={94} tick={{ fill: "#526070", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value: ValueType | undefined, _name: NameType | undefined, item) => item?.payload?.name === "Renovacao %" ? `${Math.round(toNumber(value))}%` : `${Math.round(toNumber(value))}`} />
              <Legend />
              <Bar dataKey="value" name="Valor atual" radius={[0, 8, 8, 0]}>
                {advisoryData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ),
    },
    consolidada: {
      eyebrow: "Bloco 5",
      title: "Visao Consolidada",
      description: "Cards executivos com barra de progresso para os tres indicadores que respondem a garantia de crescimento futuro.",
      legendText: "Camada final de leitura. Pipeline Ponderado, ACV e Setups em Andamento resumem a qualidade do crescimento futuro sem mudar os criterios do briefing.",
      highlightKpis: ["pipeline-ponderado", "acv-medio", "setups-andamento"],
      chart: (
        <div className="grid gap-4 lg:grid-cols-3">
          {consolidatedData.map((item) => (
            <div key={item.name} className="rounded-[24px] border border-[#edf2f7] bg-[#fbfdff] p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#94a3b8]">{decodeDashboardText(item.name)}</div>
              <div className="mt-4 text-[2rem] font-semibold tracking-[-0.06em] text-[#0f172a]">
                {item.name === "Setups andamento" ? Math.round(item.value / 30000) : formatCompactCurrency(item.value)}
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#edf2f7]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, item.name === "Setups andamento" ? (item.value / 120000) * 100 : (item.value / 462000) * 100)}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ),
    },
  } as const;

  const selectedBlock = blocks[(activeBlockId as keyof typeof blocks) ?? "topo-funil"] ?? blocks["topo-funil"];
  const selectedModuleData = view.modules.find((module) => module.id === (activeBlockId ?? "topo-funil")) ?? view.modules[0];

  return (
    <section className="space-y-5">
      <div className="rounded-[28px] border border-[#e8edf5] bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)] lg:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#94a3b8]">Leitura visual do pipeline</div>
            <h2 className="mt-2 text-[1.9rem] font-semibold tracking-[-0.05em] text-[#0f172a]">{selectedBlock.title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-[#667085]">{selectedBlock.description}</p>
          </div>
          <div className="rounded-[22px] border border-[#ffe1b6] bg-[#fff8ee] px-4 py-3 text-xs font-medium leading-6 text-[#a96500]">
            Grafico do subbotao com legenda e calculo preservando 100% da regra de negocio atual.
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.9fr)]">
        <ChartCard eyebrow={selectedBlock.eyebrow} title={selectedBlock.title} description={selectedBlock.legendText}>
          {selectedBlock.chart}
        </ChartCard>

        <ChartCard eyebrow="Legenda" title="Explicacao do bloco" description="Formula, limites de semaforo e leitura objetiva do subbotao selecionado.">
          <BlockLegend module={selectedModuleData} highlightKpis={[...selectedBlock.highlightKpis]} />
        </ChartCard>
      </div>
    </section>
  );
}
