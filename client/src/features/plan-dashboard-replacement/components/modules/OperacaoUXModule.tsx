import { useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend, ScatterChart, Scatter, ZAxis, Cell, PieChart, Pie,
} from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import type { Appointment, Filters } from '../../data/mockData';
import type { KPISummary } from '../../data/dashboardTypes';

const C = {
  red:    '#E24B4A',
  amber:  '#EF9F27',
  green:  '#1D9E75',
  blue:   '#378ADD',
  purple: '#7F77DD',
  gray:   '#888780',
};

const TS = { contentStyle:{ background:'var(--tooltip-bg,#1f2937)', border:'none', borderRadius:8, fontSize:12, color:'var(--text-primary,#fff)' }, itemStyle:{ color:'var(--text-secondary,#9ca3af)' } };
const TK = { fill:'var(--text-muted,#9ca3af)', fontSize:10 };
const GR = { stroke:'var(--chart-grid,#e5e7eb)', strokeOpacity:0.5, strokeDasharray:'3 3' };

function fmtK(v: number) { return v >= 1000 ? `R$${(v/1000).toFixed(1)}k` : `R$${v.toFixed(0)}`; }
function fmtPct(v: number) { return `${v.toFixed(1)}%`; }
function toTooltipNumber(v: ValueType | undefined) { return typeof v === 'number' ? v : typeof v === 'string' ? Number(v) || 0 : 0; }

function PriorityBadge({ priority }: { priority: 'P1'|'P2'|'P3'|'OK' }) {
  const cls = priority === 'P3' ? 'red' : priority === 'P2' ? 'yellow' : 'green';
  const label = priority === 'P3' ? 'Crítico' : priority === 'P2' ? 'Alerta' : 'Bom';
  return <span className={`chart-card-badge ${cls}`}>{label}</span>;
}

interface CardProps {
  title: string; subtitle?: string; note?: string;
  priority?: 'P1'|'P2'|'P3'|'OK'; fullWidth?: boolean; kpiValue?: string;
  children: React.ReactNode;
}
function ChartCard({ title, subtitle, note, priority, fullWidth, kpiValue, children }: CardProps) {
  return (
    <div className="chart-card" style={fullWidth ? { gridColumn:'1/-1' } : {}}>
      <div className="chart-card-header">
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span className="chart-card-title">{title}</span>
            {priority && <PriorityBadge priority={priority} />}
            {kpiValue && <span style={{ fontSize:20, fontWeight:700, color:'var(--text-primary)', marginLeft:4 }}>{kpiValue}</span>}
          </div>
          {subtitle && <span style={{ fontSize:11, color:'var(--text-muted)', marginTop:4, display:'block' }}>{subtitle}</span>}
        </div>
      </div>
      <div className="chart-card-body">
        {children}
        {note && <p style={{ fontSize:11, color:'var(--text-muted)', marginTop:8, lineHeight:1.5 }}>{note}</p>}
      </div>
    </div>
  );
}

interface WeekBucketLight { label: string; weekKey?: string; return90d?: number; return180d?: number; }

interface Props {
  opsWeeks: WeekBucketLight[];
  filtered: Appointment[];
  kpis: KPISummary;
  byProf: Array<{ name: string; avgNPS: number; avgWait: number; margin: number; realized: number; grossRevenue: number }>;
  filters: Filters;
  showTargets: boolean;
  plan?: 'ESSENTIAL' | 'PRO' | 'ENTERPRISE';
}

const THRESHOLDS = {
  nps:    { p1: 8.5, p2: 7.5 },   // P1 ≥8.5 | P2 7.5–8.5 | P3 <7.5
  wait:   { p1: 12,  p2: 25  },   // P1 <12min | P2 12–25min | P3 >25min
  return: { p1: 40,  p2: 25  },   // P1 ≥40% | P2 25–40% | P3 <25%
  sla:    { p1: 1,   p2: 4   },   // P1 <1h | P2 1–4h | P3 >4h
};

const PROCEDURES = ['Consulta Padrão', 'Retorno', 'Avaliação Inicial', 'Proc. Cirúrgico', 'Exame'];
const PROCEDURE_MARGIN = [32, 24, 45, 52, 38];
const PROCEDURE_TICKET = [180, 120, 250, 1200, 320];

export function OperacaoUXModule({ opsWeeks, filtered, kpis, byProf, showTargets, plan = 'ESSENTIAL' }: Props) {
  const isPro = plan === 'PRO' || plan === 'ENTERPRISE';

  // KPI 26 — NPS donut (Promotores / Neutros / Detratores)
  const npsValue = kpis.avgNPS;
  const npsScores = filtered.map(a => (a as any).nps as number | null).filter((n): n is number => n !== null);
  const npsPromoters  = npsScores.filter(n => n >= 9).length;
  const npsNeutrals   = npsScores.filter(n => n >= 7 && n < 9).length;
  const npsDetractors = npsScores.filter(n => n < 7).length;
  const npsTotal = npsPromoters + npsNeutrals + npsDetractors || 1;
  const npsDonutData = [
    { name: 'Promotores', value: npsPromoters,  color: C.green },
    { name: 'Neutros',    value: npsNeutrals,   color: C.amber },
    { name: 'Detratores', value: npsDetractors, color: C.red   },
  ];
  const npsTrend = opsWeeks.map((w, i) => ({ label: w.label, nps: +(npsValue + (i - opsWeeks.length/2) * 0.1).toFixed(1) }));
  const npsColor = npsValue >= 8.5 ? C.green : npsValue >= 7 ? C.amber : C.red;

  // KPI 27 — NPS by professional
  const npsByProf = useMemo(() =>
    byProf.map(p => ({
      name: p.name.replace('Dr. ','Dr.').replace('Dra. ','Dra.'),
      nps: +p.avgNPS.toFixed(1),
    })).sort((a,b) => b.nps - a.nps),
    [byProf],
  );

  // KPI 28 — Wait time
  const waitSeries = opsWeeks.map((w, i) => ({ label: w.label, value: +(kpis.avgWait + Math.sin(i) * 2).toFixed(1) }));

  // KPI 29 — Return rate + by channel
  const returnSeries = opsWeeks.map(w => ({
    label: w.label,
    r90: w.return90d ?? +(kpis.returnRate * 0.85),
    r180: w.return180d ?? +(kpis.returnRate),
  }));
  const returnByChannel = [
    { name: 'Indicação', rate: 65 }, { name: 'Presencial', rate: 52 },
    { name: 'Google', rate: 41 },   { name: 'Telefone', rate: 35 },
    { name: 'Instagram', rate: 28 },
  ];

  // KPI 30 — SLA response distribution
  const slaBuckets = [
    { range: '<15min', pct: 38, fill: C.green },
    { range: '15-30min', pct: 25, fill: C.green, fillOpacity: 0.7 },
    { range: '30-60min', pct: 15, fill: C.amber },
    { range: '1-2h',    pct: 12, fill: C.red },
    { range: '2-4h',    pct: 7,  fill: C.red },
    { range: '>4h',     pct: 3,  fill: C.red },
  ];
  const slaHours = kpis.slaLeadHours || 1.5;
  const slaOutOfTarget = slaBuckets.slice(3).reduce((s, b) => s + b.pct, 0);

  // KPI 31 — Margin by procedure (full width)
  const marginByProc = PROCEDURES.map((name, i) => ({
    name,
    margin: PROCEDURE_MARGIN[i],
    absolute: Math.round(PROCEDURE_TICKET[i] * PROCEDURE_MARGIN[i] / 100),
    fill: PROCEDURE_MARGIN[i] >= 40 ? C.green : PROCEDURE_MARGIN[i] >= 30 ? C.amber : C.red,
  })).sort((a,b) => b.margin - a.margin);

  // KPI 32 — Margin by doctor + scatter
  const marginByDoc = byProf.map(p => ({
    name: p.name.replace('Dr. ','Dr.').replace('Dra. ','Dra.'),
    margin: +p.margin.toFixed(1),
    volume: p.realized,
    revenue: p.grossRevenue,
    fill: p.margin >= 0 ? C.green : C.red,
  })).sort((a,b) => b.margin - a.margin);

  // Funções de prioridade derivadas de THRESHOLDS (editável acima)
  const npsPriority    = (v: number): 'P1'|'P2'|'P3'|'OK' => v >= THRESHOLDS.nps.p1    ? 'P1' : v >= THRESHOLDS.nps.p2    ? 'P2' : 'P3';
  const waitPriority   = (v: number): 'P1'|'P2'|'P3'|'OK' => v <= THRESHOLDS.wait.p1   ? 'P1' : v <= THRESHOLDS.wait.p2   ? 'P2' : 'P3';
  const returnPriority = (v: number): 'P1'|'P2'|'P3'|'OK' => v >= THRESHOLDS.return.p1 ? 'P1' : v >= THRESHOLDS.return.p2 ? 'P2' : 'P3';
  const slaPriority    = (v: number): 'P1'|'P2'|'P3'|'OK' => v <= THRESHOLDS.sla.p1    ? 'P1' : v <= THRESHOLDS.sla.p2    ? 'P2' : 'P3';


  return (
    <div className="chart-grid">
      {/* KPI 26 — NPS donut */}
      <ChartCard title="NPS Geral (0–10)" kpiValue={npsValue.toFixed(1)} priority={npsPriority(npsValue)}
        subtitle="Satisfação geral dos pacientes. Meta > 8,5.">
        {/* Gauge semicircular */}
        <div style={{ position:'relative', height:92 }}>
          <ResponsiveContainer width="100%" height={92}>
            <PieChart margin={{ top:0, right:0, bottom:0, left:0 }}>
              <Pie
                data={[{ value: npsValue }, { value: 10 - npsValue }]}
                cx="50%" cy="100%"
                startAngle={180} endAngle={0}
                innerRadius={50} outerRadius={78}
                dataKey="value"
                animationDuration={400}
              >
                <Cell fill={npsColor} />
                <Cell fill="var(--chart-grid,#e5e7eb)" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div style={{ position:'absolute', bottom:6, left:'50%', transform:'translateX(-50%)', textAlign:'center', lineHeight:1, pointerEvents:'none' }}>
            <div style={{ fontSize:22, fontWeight:700, color:npsColor, lineHeight:1 }}>{npsValue.toFixed(1)}</div>
            <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>/ 10</div>
          </div>
        </div>
        {/* Scale labels */}
        <div style={{ display:'flex', justifyContent:'space-between', padding:'0 8px', marginBottom:6 }}>
          <span style={{ fontSize:9, color:C.red }}>0 Crítico</span>
          <span style={{ fontSize:9, color:C.amber }}>7 Alerta</span>
          <span style={{ fontSize:9, color:C.green }}>8,5 Bom</span>
          <span style={{ fontSize:9, color:'var(--text-muted)' }}>10</span>
        </div>
        {/* AreaChart histórico */}
        <ResponsiveContainer width="100%" height={90}>
          <AreaChart data={npsTrend} margin={{ top:4, right:4, left:-28, bottom:0 }}>
            <defs>
              <linearGradient id="npsHistGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={npsColor} stopOpacity={0.25} />
                <stop offset="100%" stopColor={npsColor} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid {...GR} />
            <XAxis dataKey="label" tick={TK} />
            <YAxis tick={TK} domain={[5, 10]} />
            <Tooltip {...TS} formatter={(v: any) => [(v as number).toFixed(1), 'NPS']} />
            <Area type="monotone" dataKey="nps" stroke={npsColor} strokeWidth={2} fill="url(#npsHistGrad)" dot={false} animationDuration={300} />
            <ReferenceLine y={THRESHOLDS.nps.p1} stroke={C.green} strokeDasharray="5 3" strokeWidth={1.5} label={{ value:`P1 ${THRESHOLDS.nps.p1}`, position:'insideTopRight', fill:C.green, fontSize:10 }} />
            <ReferenceLine y={THRESHOLDS.nps.p2} stroke={C.red}   strokeDasharray="4 3" strokeWidth={1}   label={{ value:`P3 ${THRESHOLDS.nps.p2}`, position:'insideBottomRight', fill:C.red, fontSize:10 }} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* KPI 27 — NPS by professional (PRO+) */}
      {isPro && <ChartCard title="NPS por Profissional" subtitle="Avaliação média de satisfação por médico. Meta > 8,0."
        note="Verde ≥ 9. Amarelo 8-9. Vermelho < 8 → requer atenção.">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={npsByProf} layout="vertical" margin={{ top:5, right:50, left:60, bottom:0 }}>
            <CartesianGrid {...GR} />
            <XAxis type="number" tick={TK} domain={[0,10]} />
            <YAxis type="category" dataKey="name" tick={{ fill:'var(--text-primary)', fontSize:11 }} width={60} />
            <Tooltip {...TS} formatter={(v: any) => [(v as number).toFixed(1), 'NPS']} />
            {showTargets && <ReferenceLine x={8} stroke={C.gray} strokeDasharray="4 4" label={{ value:'Meta 8,0 (PRO)', fill:C.gray, fontSize:10 }} />}
            <Bar dataKey="nps" animationDuration={300} radius={[0,4,4,0]}
              label={{ position:'right', formatter:(v:any)=>(v as number).toFixed(1), fill:'var(--text-muted)', fontSize:11 }}>
              {npsByProf.map((entry, i) => <Cell key={i} fill={entry.nps >= 9 ? C.green : entry.nps >= 8 ? C.amber : C.red} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>}

      {/* KPI 28 — Wait time */}
      <ChartCard title="Tempo Médio de Espera (min)" kpiValue={`${kpis.avgWait.toFixed(0)} min`}
        priority={waitPriority(kpis.avgWait)}
        subtitle="Tempo médio que o paciente aguarda para ser atendido. Meta < 12 min."
        note="Verde < 12 min (ótimo). Amarelo 12-20 min (warning). Vermelho > 20 min (crítico).">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={waitSeries} margin={{ top:10, right:10, left:-20, bottom:0 }}>
            <defs>
              <linearGradient id="waitGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.amber} stopOpacity={0.22} />
                <stop offset="100%" stopColor={C.amber} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid {...GR} />
            <XAxis dataKey="label" tick={TK} />
            <YAxis tick={TK} unit=" min" />
            <Tooltip {...TS} formatter={(v: any) => [`${v} min`, 'Espera']} />
            <Area type="monotone" dataKey="value" stroke={C.amber} strokeWidth={2} fill="url(#waitGrad)" animationDuration={300} />
            <ReferenceLine y={THRESHOLDS.wait.p1} stroke={C.green} strokeDasharray="5 3" strokeWidth={1.5} label={{ value:`P1 ${THRESHOLDS.wait.p1}min`, position:'insideTopRight', fill:C.green, fontSize:10 }} />
            <ReferenceLine y={THRESHOLDS.wait.p2} stroke={C.red}   strokeDasharray="4 3" strokeWidth={1}   label={{ value:`P3 ${THRESHOLDS.wait.p2}min`, position:'insideTopRight', fill:C.red,   fontSize:10 }} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* KPI 29 — Return rate */}
      <ChartCard title="Taxa de Retorno / Fidelização (%)" kpiValue={fmtPct(kpis.returnRate)}
        priority={returnPriority(kpis.returnRate)}
        subtitle="% de pacientes que voltaram em até 90 dias. Meta > 40%.">
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={returnSeries} margin={{ top:10, right:10, left:-20, bottom:0 }}>
            <defs>
              <linearGradient id="retGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.green} stopOpacity={0.28} />
                <stop offset="100%" stopColor={C.green} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid {...GR} />
            <XAxis dataKey="label" tick={TK} />
            <YAxis tick={TK} unit="%" domain={[0, 80]} />
            <Tooltip {...TS} formatter={(v: any) => [`${(v as number).toFixed(1)}%`, 'Retorno 90d']} />
            <ReferenceLine y={THRESHOLDS.return.p1} stroke={C.green} strokeDasharray="5 3" strokeWidth={1.5} label={{ value:`P1 ${THRESHOLDS.return.p1}%`, position:'insideTopRight', fill:C.green, fontSize:10 }} />
            <ReferenceLine y={THRESHOLDS.return.p2} stroke={C.red}   strokeDasharray="4 3" strokeWidth={1}   label={{ value:`P3 ${THRESHOLDS.return.p2}%`, position:'insideTopRight', fill:C.red,   fontSize:10 }} />
            <Area type="monotone" dataKey="r90" stroke={C.green} strokeWidth={2} fill="url(#retGrad)" dot={false} animationDuration={300} />
          </AreaChart>
        </ResponsiveContainer>
        {/* Mini-BarChart de coorte */}
        <ResponsiveContainer width="100%" height={75}>
          <BarChart data={returnByChannel} margin={{ top:4, right:4, left:-20, bottom:0 }}>
            <XAxis dataKey="name" tick={{ ...TK, fontSize:9 }} />
            <YAxis tick={TK} domain={[0, 100]} hide />
            <Tooltip {...TS} formatter={(v: any) => [`${v}%`, 'Retorno coorte']} />
            <Bar dataKey="rate" animationDuration={300} radius={[3,3,0,0]}
              label={{ position:'top', formatter:(v:any)=>`${v}%`, fill:'var(--text-muted)', fontSize:9 }}>
              {returnByChannel.map((entry, i) => (
                <Cell key={i} fill={entry.rate >= 40 ? C.green : entry.rate >= 25 ? C.amber : C.red} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* KPI 30 — SLA response */}
      <ChartCard title="SLA de Resposta ao Lead"
        kpiValue={`${slaHours.toFixed(1)}h`}
        priority={slaPriority(slaHours)}
        subtitle="Tempo que a recepção leva para responder ao primeiro contato. Meta < 1h."
        note={`Mediana: ${(slaHours * 0.7).toFixed(0)} min · Fora do SLA: ${slaOutOfTarget}%`}>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={slaBuckets} margin={{ top:10, right:10, left:-10, bottom:0 }}>
            <CartesianGrid {...GR} />
            <XAxis dataKey="range" tick={TK} />
            <YAxis tick={TK} unit="%" />
            <Tooltip {...TS} formatter={(v: ValueType | undefined, name: NameType | undefined) => [
              `${(v as number).toFixed(1)}%`, name === 'pct' ? 'Leads respondidos' : 'Tendência',
            ]} />
            <ReferenceLine x="1-2h" stroke={C.green} strokeDasharray="5 3" strokeWidth={1.5} label={{ value:'P1 <1h', position:'insideTopRight', fill:C.green, fontSize:10 }} />
            <ReferenceLine x=">4h"  stroke={C.red}   strokeDasharray="4 3" strokeWidth={1}   label={{ value:'P3 >4h', position:'insideTopRight', fill:C.red,   fontSize:10 }} />
            <Bar dataKey="pct" name="pct" animationDuration={300} radius={[4,4,0,0]}>
              {slaBuckets.map((entry, i) => <Cell key={i} fill={entry.fill} fillOpacity={entry.fillOpacity ?? 1} />)}
            </Bar>
            <Line type="monotone" dataKey="pct" name="Tendência" stroke={C.blue} strokeWidth={2}
              dot={{ r:3, fill:C.blue, strokeWidth:0 }} animationDuration={300} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* KPI 31 — Margin by procedure (PRO+, full width) */}
      {isPro && <ChartCard title="Margem por Procedimento (%)" fullWidth
        subtitle="% de margem líquida por tipo de procedimento. Meta > 30%."
        note="Verde ≥ 40% · Amarelo 30-39% · Vermelho < 30%">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={marginByProc} layout="vertical" margin={{ top:5, right:80, left:100, bottom:0 }}>
            <CartesianGrid {...GR} />
            <XAxis type="number" tick={TK} unit="%" domain={[0,70]} />
            <YAxis type="category" dataKey="name" tick={{ fill:'var(--text-primary)', fontSize:11 }} width={100} />
            <Tooltip {...TS} formatter={(v: any, n: any, props: any) => [
              n === 'margin' ? `${v}% · R$${props.payload.absolute}/proc` : fmtK(v as number), n === 'margin' ? 'Margem' : 'Valor',
            ]} />
            {showTargets && <ReferenceLine x={30} stroke={C.gray} strokeDasharray="4 4" label={{ value:'Meta 30%', fill:C.gray, fontSize:10 }} />}
            <Bar dataKey="margin" animationDuration={300} radius={[0,4,4,0]}
              label={{ position:'right', formatter:(v:any)=>`${v}%`, fill:'var(--text-muted)', fontSize:11 }}>
              {marginByProc.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>}

      {/* KPI 32 — Margin by doctor + scatter (PRO+) */}
      {isPro && <ChartCard title="Margem por Médico (%)" fullWidth
        subtitle="Contribuição de margem e volume por profissional."
        note="Barras = margem %. Gráfico de dispersão = volume × margem (tamanho = receita total).">
        <div style={{ display:'flex', gap:20, height:220 }}>
          <div style={{ flex:'0 0 55%' }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={marginByDoc} layout="vertical" margin={{ top:5, right:50, left:65, bottom:0 }}>
                <CartesianGrid {...GR} />
                <XAxis type="number" tick={TK} unit="%" />
                <YAxis type="category" dataKey="name" tick={{ fill:'var(--text-primary)', fontSize:11 }} width={65} />
                <Tooltip {...TS} formatter={(v: any, n: any, props: any) => [`${(v as number).toFixed(1)}% · R$${(props.payload.revenue/1000).toFixed(0)}k`, 'Margem']} />
                {showTargets && <ReferenceLine x={0} stroke={C.gray} strokeWidth={1} />}
                <Bar dataKey="margin" animationDuration={300} radius={[0,4,4,0]}
                  label={{ position:'right', formatter:(v:any)=>`${(v as number).toFixed(1)}%`, fill:'var(--text-muted)', fontSize:10 }}>
                  {marginByDoc.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ flex:1 }}>
            <ResponsiveContainer width="100%" height={220}>
              <ScatterChart margin={{ top:10, right:10, left:10, bottom:20 }}>
                <CartesianGrid {...GR} />
                <XAxis dataKey="volume" name="Consultas" tick={TK} label={{ value:'Consultas', position:'insideBottom', fill:'var(--text-muted)', fontSize:10, offset:-10 }} />
                <YAxis dataKey="margin" name="Margem %" tick={TK} unit="%" />
                <ZAxis dataKey="revenue" range={[40, 300]} />
                <Tooltip {...TS} content={({ payload }) => {
                  if (!payload?.length) return null;
                  const d = payload[0]?.payload;
                  if (!d) return null;
                  return (
                    <div style={{ ...TS.contentStyle, padding:'8px 12px' }}>
                      <div style={{ fontWeight:600, marginBottom:4 }}>{d.name}</div>
                      <div>{d.volume} consultas</div>
                      <div>Margem: {d.margin.toFixed(1)}%</div>
                      <div>Receita: {fmtK(d.revenue)}</div>
                    </div>
                  );
                }} />
                <Scatter data={marginByDoc} animationDuration={300}>
                  {marginByDoc.map((entry, i) => <Cell key={i} fill={entry.fill} fillOpacity={0.8} />)}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </ChartCard>}

    </div>
  );
}
