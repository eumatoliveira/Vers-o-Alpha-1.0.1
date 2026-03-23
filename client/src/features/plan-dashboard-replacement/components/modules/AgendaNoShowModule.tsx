import { useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line, LineChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell, Legend, PieChart, Pie,
} from 'recharts';
import type { Appointment, Filters } from '../../data/mockData';
import type { WeekBucket, KPISummary } from '../../data/dashboardTypes';

// ─── Limiares P1/P2/P3 — podem ser sobrescritos via setup ────────────────────
export const AGENDA_THRESHOLDS = {
  noShow:      { p1: 8,    p3: 15   },   // %  inverted: <p1 ✓ | p1-p3 ⚠ | >p3 ✗
  occupancy:   { p1: 80,   p3: 65   },   // %  normal:   >p1 ✓ | p3-p1 ⚠ | <p3 ✗
  confirm:     { p1: 85,   p3: 70   },   // %  normal
  leadTime:    { p1: 3,    p2: 5,  p3: 7 }, // dias inverted
  consultPct:  { p2: 80              },   // % da meta: ≥100 P1 | 80-99 P2 | <80 P3
  channelDrop: { p2: 20,   p3: 35   },   // % queda: <p2 P1 | p2-p3 P2 | >p3 P3
  noShowCost:  { p1: 2000, p3: 5000 },   // R$/mês inverted
  lostCap:     { p1: 8,    p3: 15   },   // % inverted
};
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  red:    '#E24B4A', redFill:    'rgba(226,75,74,0.10)',
  amber:  '#EF9F27', amberFill:  'rgba(239,159,39,0.10)',
  green:  '#1D9E75', greenFill:  'rgba(29,158,117,0.10)',
  blue:   '#378ADD', blueFill:   'rgba(55,138,221,0.10)',
  purple: '#7F77DD',
  gray:   '#888780',
  channels: {
    Instagram:  '#E24B4A',
    Google:     '#378ADD',
    Indicação:  '#EF9F27',
    Facebook:   '#1D9E75',
    Whatsapp:   '#7F77DD',
    Outros:     '#888780',
  } as Record<string,string>,
};

const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'var(--tooltip-bg, #1f2937)',
    border: 'none',
    borderRadius: 8,
    fontSize: 12,
    color: 'var(--text-primary, #fff)',
  },
  itemStyle: { color: 'var(--text-secondary, #9ca3af)' },
};

const TICK_STYLE = { fill: 'var(--text-muted, #9ca3af)', fontSize: 10 };
const GRID_STYLE = { stroke: 'var(--chart-grid, #e5e7eb)', strokeOpacity: 0.5, strokeDasharray: '3 3' };

interface BadgeProps { priority: 'P1' | 'P2' | 'P3' | 'OK' }
function PriorityBadge({ priority }: BadgeProps) {
  const cls = priority === 'P3' ? 'red' : priority === 'P2' ? 'yellow' : 'green';
  const label = priority === 'P3' ? 'Crítico' : priority === 'P2' ? 'Alerta' : 'Bom';
  return <span className={`chart-card-badge ${cls}`}>{label}</span>;
}

interface CardProps {
  title: string;
  subtitle?: string;
  note?: string;
  priority?: 'P1' | 'P2' | 'P3' | 'OK';
  fullWidth?: boolean;
  kpiValue?: string;
  children: React.ReactNode;
}
function ChartCard({ title, subtitle, note, priority, fullWidth, kpiValue, children }: CardProps) {
  return (
    <div className="chart-card" style={fullWidth ? { gridColumn: '1 / -1' } : {}}>
      <div className="chart-card-header">
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="chart-card-title">{title}</span>
            {priority && <PriorityBadge priority={priority} />}
            {kpiValue && (
              <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginLeft: 4 }}>
                {kpiValue}
              </span>
            )}
          </div>
          {subtitle && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
              {subtitle}
            </span>
          )}
        </div>
      </div>
      <div className="chart-card-body">
        {children}
        {note && (
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5 }}>{note}</p>
        )}
      </div>
    </div>
  );
}

interface Props {
  agendaWeeks: WeekBucket[];
  filtered: Appointment[];
  kpis: KPISummary;
  filters: Filters;
  showTargets: boolean;
  plan?: 'ESSENTIAL' | 'PRO' | 'ENTERPRISE';
}

export function AgendaNoShowModule({ agendaWeeks, filtered, kpis, filters, showTargets, plan = 'ESSENTIAL' }: Props) {
  const isPro = plan === 'PRO' || plan === 'ENTERPRISE';

  // KPI 1 — No-show rate series
  const noShowSeries = useMemo(
    () => agendaWeeks.map(w => ({ label: w.label, value: +w.noShowRate.toFixed(1) })),
    [agendaWeeks],
  );

  // KPI 3 — Confirmation stacked
  const confirmSeries = useMemo(
    () => agendaWeeks.map(w => ({
      label: w.label,
      confirmed: +w.confirmationRate.toFixed(1),
      notConfirmed: +(100 - w.confirmationRate).toFixed(1),
    })),
    [agendaWeeks],
  );

  // KPI 4 — Consultations vs target
  const consultSeries = useMemo(
    () => agendaWeeks.map(w => ({ label: w.label, realized: w.realized, target: w.weeklyTarget })),
    [agendaWeeks],
  );
  const weeklyTargetAvg = agendaWeeks.length ? Math.round(agendaWeeks.reduce((s, w) => s + w.weeklyTarget, 0) / agendaWeeks.length) : 50;

  // KPI 5 — No-show cost (full width)
  const avgTicket = kpis.avgTicket || 190;
  let accumulated = 0;
  const noShowCostSeries = useMemo(
    () => agendaWeeks.map(w => {
      const monthlyCost = Math.round(w.noShows * avgTicket);
      accumulated += monthlyCost;
      return { label: w.label, monthlyCost, accumulated };
    }),
    [agendaWeeks, avgTicket],
  );

  // KPI 6 — Lost capacity rate
  const lostCapSeries = agendaWeeks.map(w => ({
    label: w.label,
    value: +w.noShowRate.toFixed(1), // proxy for capacity loss
  }));

  // KPI 7 — Lead time bullet chart (valor direto de kpis.leadTimeDays)

  // KPI 8 — Appointments by channel (full width)
  const channelNames = Object.keys(C.channels);
  const channelSeries = useMemo(() => {
    return agendaWeeks.map(w => {
      const weekRows = filtered.filter(a => {
        const d = new Date(a.date);
        const ws = new Date(d);
        ws.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        return ws.toISOString().slice(0, 10) === w.weekKey;
      });
      const entry: Record<string, number | string> = { label: w.label };
      channelNames.forEach(ch => {
        entry[ch] = weekRows.filter(r => {
          if (ch === 'Facebook')  return r.channel === 'Facebook';
          if (ch === 'Whatsapp')  return ['Whatsapp', 'WhatsApp', 'Telefone'].includes(r.channel);
          if (ch === 'Outros')    return ['Outros', 'Presencial'].includes(r.channel);
          if (ch === 'Indicação') return r.channel === 'Indicação';
          return r.channel === ch;
        }).length;
      });
      return entry;
    });
  }, [agendaWeeks, filtered]);

  // Priority helpers — usam AGENDA_THRESHOLDS (configuráveis via setup)
  const T = AGENDA_THRESHOLDS;

  // Multiplicador proporcional ao período selecionado (base = 30d)
  const periodDays = filters.period === '7d' ? 7 : filters.period === '15d' ? 15
                   : filters.period === '3m' ? 90 : filters.period === '6m' ? 180
                   : filters.period === '1 ano' ? 365 : 30;
  const periodMult  = periodDays / 30;
  const costP1 = Math.round(T.noShowCost.p1 * periodMult);
  const costP3 = Math.round(T.noShowCost.p3 * periodMult);
  const fmtCostThr = (v: number) => v >= 1000 ? `R$${(v / 1000 % 1 === 0 ? v / 1000 : (v / 1000).toFixed(1))}k` : `R$${v}`;
  const costP1Label = fmtCostThr(costP1);
  const costP3Label = fmtCostThr(costP3);
  const periodLabel = filters.period === '7d' ? 'semana' : filters.period === '15d' ? 'quinzena'
                    : filters.period === '3m' ? 'trimestre' : filters.period === '6m' ? 'semestre'
                    : filters.period === '1 ano' ? 'ano' : 'mês';

  const noShowPriority   = (v: number) => v > T.noShow.p3    ? 'P3' : v >= T.noShow.p1    ? 'P2' : 'P1';
  const occPriority      = (v: number) => v < T.occupancy.p3 ? 'P3' : v < T.occupancy.p1  ? 'P2' : 'P1';
  const confPriority     = (v: number) => v < T.confirm.p3   ? 'P3' : v < T.confirm.p1    ? 'P2' : 'P1';
  const leadTimePriority = (v: number) => v > T.leadTime.p3  ? 'P3' : v > T.leadTime.p2   ? 'P2' : 'P1';
  const noShowCostPriority = (v: number) => v > costP3 ? 'P3' : v > costP1 ? 'P2' : 'P1';
  const lostCapPriority  = (v: number) => v > T.lostCap.p3   ? 'P3' : v >= T.lostCap.p1   ? 'P2' : 'P1';

  // Consultas: P1 ≥ 100% da meta | P2 80-99% | P3 < 80%
  const totalTarget = agendaWeeks.reduce((s, w) => s + w.weeklyTarget, 0) || 1;
  const consultPct  = (kpis.realized / totalTarget) * 100;
  const consultPriority = consultPct >= 100 ? 'P1' : consultPct >= T.consultPct.p2 ? 'P2' : 'P3';

  // Canal: compara última semana vs média das anteriores (queda %)
  const lastWeekTotal = agendaWeeks.length > 0
    ? (agendaWeeks[agendaWeeks.length - 1].realized + agendaWeeks[agendaWeeks.length - 1].noShows)
    : 0;
  const prevAvgTotal = agendaWeeks.length > 1
    ? agendaWeeks.slice(0, -1).reduce((s, w) => s + w.realized + w.noShows, 0) / (agendaWeeks.length - 1)
    : lastWeekTotal;
  const channelDrop = prevAvgTotal > 0 ? ((prevAvgTotal - lastWeekTotal) / prevAvgTotal) * 100 : 0;
  const channelPriority = channelDrop > T.channelDrop.p3 ? 'P3' : channelDrop > T.channelDrop.p2 ? 'P2' : 'P1';

  // Custo mensal de no-show (última semana × 4 semanas estimado)
  const lastNoShowCost = noShowCostSeries.length ? noShowCostSeries[noShowCostSeries.length - 1].monthlyCost : 0;

  const curConf = agendaWeeks.length ? agendaWeeks[agendaWeeks.length - 1].confirmationRate : kpis.confirmationRate;

  return (
    <div className="chart-grid">
      {/* KPI 1 — No-show Rate */}
      <ChartCard
        title="Taxa de No-show (%)"
        priority={noShowPriority(kpis.noShowRate) as any}
        kpiValue={`${kpis.noShowRate.toFixed(1)}%`}
        subtitle="Pacientes que não compareceram sem cancelar"
        note="Verde < 8% | Amarelo 8-15% | Vermelho > 15%"
      >
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={noShowSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid {...GRID_STYLE} />
            <XAxis dataKey="label" tick={TICK_STYLE} />
            <YAxis tick={TICK_STYLE} unit="%" domain={[0, 30]} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => [`${v}%`, 'No-show']} />
            <ReferenceLine y={8}  stroke={C.green} strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'P1 8%',  fill: C.green, fontSize: 10 }} />
            <ReferenceLine y={15} stroke={C.red}   strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'P3 15%', fill: C.red,   fontSize: 10 }} />
            <Line type="monotone" dataKey="value" stroke={C.red} strokeWidth={2} dot={{ r: 3, fill: C.red }} activeDot={{ r: 5 }} animationDuration={300} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* KPI 2 — Taxa de Ocupação (semicircle gauge + sparkline) */}
      {(() => {
        const occ = kpis.occupancyRate;
        const occColor = occ >= 80 ? C.green : occ >= 60 ? C.amber : C.red;
        const occSparkline = agendaWeeks.map(w => ({ label: w.label, value: +w.occupancyRate.toFixed(1) }));
        return (
          <ChartCard
            title="Taxa de Ocupação"
            priority={occPriority(occ) as any}
            kpiValue={`${occ.toFixed(1)}%`}
            subtitle="Consultas realizadas ÷ capacidade disponível × 100"
          >
            {/* Semicircular gauge */}
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie
                    data={[{ value: occ }, { value: Math.max(0, 100 - occ) }]}
                    startAngle={180} endAngle={0}
                    cx="50%" cy="100%"
                    innerRadius={70} outerRadius={110}
                    paddingAngle={0} dataKey="value"
                    animationDuration={400}
                  >
                    <Cell fill={occColor} />
                    <Cell fill="var(--chart-grid, #e5e7eb)" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Valor central */}
              <div style={{ position:'absolute', bottom:4, left:'50%', transform:'translateX(-50%)', textAlign:'center', pointerEvents:'none' }}>
                <div style={{ fontSize:32, fontWeight:800, color:occColor, lineHeight:1 }}>{occ.toFixed(1)}<span style={{ fontSize:18 }}>%</span></div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>da agenda ocupada</div>
              </div>
            </div>
            {/* Sparkline tendência */}
            <ResponsiveContainer width="100%" height={65}>
              <AreaChart data={occSparkline} margin={{ top:4, right:8, left:-10, bottom:0 }}>
                <defs>
                  <linearGradient id="occGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={occColor} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={occColor} stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={TICK_STYLE} />
                <YAxis tick={TICK_STYLE} unit="%" domain={[50, 100]} tickCount={3} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => [`${v}%`, 'Ocupação']} />
                <ReferenceLine y={80} stroke={C.green} strokeDasharray="3 3" strokeWidth={1.5} label={{ value: 'P1 80%', fill: C.green, fontSize: 10 }} />
                <ReferenceLine y={65} stroke={C.red}   strokeDasharray="3 3" strokeWidth={1.5} label={{ value: 'P3 65%', fill: C.red,   fontSize: 10 }} />
                <Area type="monotone" dataKey="value" stroke={occColor} strokeWidth={2}
                  fill="url(#occGrad)" dot={false} animationDuration={300} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        );
      })()}

      {/* KPI 3 — Confirmation stacked */}
      <ChartCard
        title="Taxa de Confirmações Realizadas (%)"
        priority={confPriority(curConf) as any}
        kpiValue={`${curConf.toFixed(1)}%`}
        subtitle="Agendamentos confirmados antes da consulta"
        note="Verde > 85% | Amarelo 70-85% | Vermelho < 70%"
      >
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={confirmSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid {...GRID_STYLE} />
            <XAxis dataKey="label" tick={TICK_STYLE} />
            <YAxis tick={TICK_STYLE} unit="%" domain={[0, 100]} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Bar dataKey="confirmed" name="Confirmados" stackId="s" fill={C.green} radius={[0, 0, 0, 0]} animationDuration={300} />
            <Bar dataKey="notConfirmed" name="Não confirmados" stackId="s" fill="#F0997B" radius={[4, 4, 0, 0]} animationDuration={300} />
            <ReferenceLine y={85} stroke={C.green} strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'P1 85%', fill: C.green, fontSize: 10 }} />
            <ReferenceLine y={70} stroke={C.red}   strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'P3 70%', fill: C.red,   fontSize: 10 }} />
            <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-muted)' }} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* KPI 4 — Consultations vs target */}
      <ChartCard
        title="Consultas Realizadas vs Meta"
        priority={consultPriority as any}
        kpiValue={`${kpis.realized}`}
        subtitle="Consultas no período comparadas à meta semanal"
        note="Verde ≥ meta | Amarelo 80-99% da meta | Vermelho < 80% da meta"
      >
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={consultSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid {...GRID_STYLE} />
            <XAxis dataKey="label" tick={TICK_STYLE} />
            <YAxis tick={TICK_STYLE} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Bar dataKey="realized" name="Realizadas" fill={C.blue} radius={[4, 4, 0, 0]} animationDuration={300} />
            <ReferenceLine y={weeklyTargetAvg} stroke={C.green} strokeDasharray="4 4" strokeWidth={1.5}
              label={{ value: `P1 ${weeklyTargetAvg}`, position: 'insideTopRight', fill: C.green, fontSize: 10 }} />
            <ReferenceLine y={Math.round(weeklyTargetAvg * 0.8)} stroke={C.red} strokeDasharray="4 4" strokeWidth={1.5}
              label={{ value: `P3 ${Math.round(weeklyTargetAvg * 0.8)}`, position: 'insideBottomRight', fill: C.red, fontSize: 10 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* KPI 5 — No-show cost (PRO+) */}
      {isPro && <ChartCard
        title="Custo Estimado do No-show (R$)"
        priority={noShowCostPriority(lastNoShowCost) as any}
        kpiValue={`R$ ${(lastNoShowCost/1000).toFixed(1)}k`}
        subtitle="Custo mensal e acumulado de consultas perdidas"
        fullWidth
        note={`Verde < ${costP1Label}/${periodLabel} | Amarelo ${costP1Label}–${costP3Label} | Vermelho > ${costP3Label}/${periodLabel}`}
      >
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={noShowCostSeries} margin={{ top: 10, right: 40, left: 10, bottom: 0 }}>
            <CartesianGrid {...GRID_STYLE} />
            <XAxis dataKey="label" tick={TICK_STYLE} />
            <YAxis yAxisId="left" tick={TICK_STYLE} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
            <YAxis yAxisId="right" orientation="right" tick={TICK_STYLE} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: any, name: any) => [
              `R$ ${(v as number).toLocaleString('pt-BR')}`, name === 'monthlyCost' ? 'Custo no período' : 'Acumulado'
            ]} />
            <ReferenceLine yAxisId="left" y={costP1} stroke={C.green} strokeDasharray="4 3" strokeWidth={1.5}
              label={{ value: `P1 ${costP1Label}`, position: 'insideTopRight', fill: C.green, fontSize: 10 }} />
            <ReferenceLine yAxisId="left" y={costP3} stroke={C.red}   strokeDasharray="4 3" strokeWidth={1.5}
              label={{ value: `P3 ${costP3Label}`, position: 'insideTopRight', fill: C.red,   fontSize: 10 }} />
            <Bar yAxisId="left" dataKey="monthlyCost" name="monthlyCost" fill={C.red} fillOpacity={0.7} radius={[4, 4, 0, 0]} animationDuration={300} />
            <Line yAxisId="right" type="monotone" dataKey="accumulated" name="accumulated" stroke="#BA7517" strokeWidth={2} dot={{ r: 3 }} animationDuration={300} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>}

      {/* KPI 6 — Capacity loss (PRO+) */}
      {isPro && <ChartCard
        title="Taxa de Perda de Capacidade não Recuperável (%)"
        priority={lostCapPriority(kpis.noShowRate) as any}
        kpiValue={`${kpis.noShowRate.toFixed(1)}%`}
        subtitle="No-shows + cancelamentos tardios ÷ total de slots"
        note="Verde < 8% | Amarelo 8-15% | Vermelho > 15%"
      >
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={lostCapSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="lcGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.red} stopOpacity={0.22} />
                <stop offset="100%" stopColor={C.red} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid {...GRID_STYLE} />
            <XAxis dataKey="label" tick={TICK_STYLE} />
            <YAxis tick={TICK_STYLE} unit="%" domain={[0, 25]} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => [`${v}%`, 'Perda']} />
            <ReferenceLine y={T.lostCap.p1} stroke={C.green} strokeDasharray="4 3" strokeWidth={1.5}
              label={{ value: 'P1 8%', position: 'insideTopRight', fill: C.green, fontSize: 10 }} />
            <ReferenceLine y={T.lostCap.p3} stroke={C.red}   strokeDasharray="4 3" strokeWidth={1.5}
              label={{ value: 'P3 15%', position: 'insideTopRight', fill: C.red,   fontSize: 10 }} />
            <Area type="monotone" dataKey="value" stroke={C.red} strokeWidth={2} fill="url(#lcGrad)" animationDuration={300} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>}

      {/* KPI 7 — Lead time bullet chart */}
      <ChartCard
        title="Lead Time do Agendamento (dias)"
        priority={leadTimePriority(kpis.leadTimeDays) as any}
        kpiValue={`${kpis.leadTimeDays.toFixed(1)}d`}
        subtitle="Tempo médio entre o contato e a consulta agendada"
        note="Verde < 3d | Amarelo 5-7d | Vermelho > 7d"
      >
        {(() => {
          const MAX = 15;
          const val  = kpis.leadTimeDays;
          const pct  = Math.min(100, (val / MAX) * 100);
          const color = val < T.leadTime.p1 ? C.green : val <= T.leadTime.p3 ? C.amber : C.red;
          const labelLeft = Math.max(3, Math.min(93, pct));
          return (
            <div style={{ padding: '32px 4px 4px', position: 'relative' }}>
              {/* Value label above marker */}
              <div style={{
                position: 'absolute', top: 8,
                left: `${labelLeft}%`, transform: 'translateX(-50%)',
                fontSize: 12, fontWeight: 700, color, whiteSpace: 'nowrap', userSelect: 'none',
              }}>
                {val.toFixed(1)}d
              </div>

              {/* Bullet track */}
              <div style={{ position: 'relative', height: 32, borderRadius: 8 }}>
                {/* Colored zones: P1 green 0-3d | transitional light 3-5d | P2 amber 5-7d | P3 red 7d+ */}
                <div style={{ display: 'flex', height: '100%', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ width: `${(T.leadTime.p1/MAX)*100}%`,                             background: 'rgba(29,158,117,0.22)' }} />
                  <div style={{ width: `${((T.leadTime.p2-T.leadTime.p1)/MAX)*100}%`,             background: 'rgba(239,159,39,0.10)'  }} />
                  <div style={{ width: `${((T.leadTime.p3-T.leadTime.p2)/MAX)*100}%`,             background: 'rgba(239,159,39,0.25)'  }} />
                  <div style={{ flex: 1,                                                           background: 'rgba(226,75,74,0.18)'   }} />
                </div>
                {/* Zone dividers at 3d, 5d, 7d */}
                <div style={{ position:'absolute', top:0, bottom:0, left:`${(T.leadTime.p1/MAX)*100}%`, width:1.5, background:'rgba(29,158,117,0.4)',  pointerEvents:'none' }} />
                <div style={{ position:'absolute', top:0, bottom:0, left:`${(T.leadTime.p2/MAX)*100}%`, width:1.5, background:'rgba(239,159,39,0.5)',  pointerEvents:'none' }} />
                <div style={{ position:'absolute', top:0, bottom:0, left:`${(T.leadTime.p3/MAX)*100}%`, width:1.5, background:'rgba(226,75,74,0.4)',   pointerEvents:'none' }} />
                {/* Marker */}
                <div style={{
                  position: 'absolute', top: -6, bottom: -6,
                  left: `${pct}%`, transform: 'translateX(-50%)',
                  width: 3, borderRadius: 2, background: color,
                  boxShadow: `0 0 6px ${color}70`,
                }} />
              </div>

              {/* Scale labels */}
              <div style={{ position: 'relative', height: 18, marginTop: 8 }}>
                {[
                  { pos: 0,                            label: '0d',  c: 'var(--text-muted)' },
                  { pos: (T.leadTime.p1/MAX)*100,      label: '3d',  c: C.green  },
                  { pos: (T.leadTime.p2/MAX)*100,      label: '5d',  c: C.amber  },
                  { pos: (T.leadTime.p3/MAX)*100,      label: '7d',  c: C.red    },
                  { pos: 100,                          label: '15d', c: 'var(--text-muted)' },
                ].map(({ pos, label, c }) => (
                  <span key={label} style={{ position:'absolute', left:`${pos}%`, transform:'translateX(-50%)', fontSize:9, color:c, whiteSpace:'nowrap' }}>{label}</span>
                ))}
              </div>
            </div>
          );
        })()}
      </ChartCard>

      {/* KPI 8 — Appointments by channel: donut + ranked bars */}
      {(() => {
        const totals = channelNames.map(ch => ({
          name: ch,
          value: channelSeries.reduce((s, w) => s + ((w as any)[ch] as number || 0), 0),
          color: C.channels[ch],
        })).sort((a, b) => b.value - a.value);
        const total = totals.reduce((s, d) => s + d.value, 0) || 1;
        return (
          <ChartCard
            title="Agendamentos por Canal de Aquisição"
            priority={channelPriority as any}
            subtitle="Distribuição de agendamentos por origem do paciente"
            fullWidth
          >
            <div style={{ display:'flex', gap:32, alignItems:'center', height:200 }}>
              {/* Donut */}
              <div style={{ flex:'0 0 200px', position:'relative' }}>
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie data={totals} cx="50%" cy="50%" innerRadius={60} outerRadius={88}
                      dataKey="value" paddingAngle={2} animationDuration={400}>
                      {totals.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE} formatter={(v: any, name: any) => [`${v} agend. (${Math.round((v/total)*100)}%)`, name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center', pointerEvents:'none' }}>
                  <div style={{ fontSize:26, fontWeight:700, color:'var(--text-primary)', lineHeight:1 }}>{total}</div>
                  <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>agend.</div>
                </div>
              </div>
              {/* Ranked bars */}
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:9, justifyContent:'center' }}>
                {totals.map(d => {
                  const pct = Math.round((d.value / total) * 100);
                  return (
                    <div key={d.name} style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:10, height:10, borderRadius:'50%', background:d.color, flexShrink:0 }} />
                      <div style={{ fontSize:12, color:'var(--text-primary)', width:82, flexShrink:0 }}>{d.name}</div>
                      <div style={{ flex:1, height:8, background:'var(--chart-grid,#e5e7eb)', borderRadius:4, overflow:'hidden' }}>
                        <div style={{ width:`${pct}%`, height:'100%', background:d.color, borderRadius:4, transition:'width 0.4s ease' }} />
                      </div>
                      <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', width:28, textAlign:'right' }}>{d.value}</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)', width:32, textAlign:'right' }}>{pct}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </ChartCard>
        );
      })()}
    </div>
  );
}
