import { useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, PieChart, Pie, ScatterChart, Scatter, ZAxis, Cell, Legend,
} from 'recharts';
import type { Appointment, Filters } from '../../data/mockData';
import type { KPISummary } from '../../data/dashboardTypes';

const C = {
  red:    '#E24B4A',
  amber:  '#EF9F27',
  green:  '#1D9E75',
  blue:   '#378ADD',
  purple: '#7F77DD',
  gray:   '#888780',
  channels: {
    Instagram: '#E24B4A',
    Google:    '#378ADD',
    Indicacao: '#EF9F27',
    Organico:  '#1D9E75',
    Telefone:  '#7F77DD',
    Presencial:'#888780',
  } as Record<string,string>,
};

const TS = { contentStyle: { background:'var(--tooltip-bg,#1f2937)', border:'none', borderRadius:8, fontSize:12, color:'var(--text-primary,#fff)' }, itemStyle:{ color:'var(--text-secondary,#9ca3af)' } };
const TK = { fill:'var(--text-muted,#9ca3af)', fontSize:10 };
const GR = { stroke:'var(--chart-grid,#e5e7eb)', strokeOpacity:0.5, strokeDasharray:'3 3' };

function fmtK(v: number) { return v >= 1000 ? `R$${(v/1000).toFixed(1)}k` : `R$${v.toFixed(0)}`; }
function fmtPct(v: number) { return `${v.toFixed(1)}%`; }

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

interface WeeklyBucketLight { label: string; [key: string]: unknown; }

interface Props {
  weeklyData: WeeklyBucketLight[];
  filtered: Appointment[];
  kpis: KPISummary;
  filters: Filters;
  showTargets: boolean;
  plan?: 'ESSENTIAL' | 'PRO' | 'ENTERPRISE';
}

const CHANNELS = ['Instagram', 'Google', 'Indicacao', 'Organico', 'Telefone', 'Presencial'];
const CHANNEL_CPL: Record<string,number> = { Instagram: 32, Google: 25, Indicacao: 8, Organico: 15, Telefone: 18, Presencial: 12 };
const CHANNEL_CAC: Record<string,number> = { Instagram: 195, Google: 145, Indicacao: 45, Organico: 55, Telefone: 78, Presencial: 65 };
const CHANNEL_LTV: Record<string,number> = { Instagram: 420, Google: 580, Indicacao: 840, Organico: 640, Telefone: 720, Presencial: 780 };
const CHANNEL_ROI: Record<string,number> = { Instagram: 142, Google: 248, Indicacao: 620, Organico: 390, Telefone: 485, Presencial: 520 };

export function MarketingModule({ weeklyData, filtered, kpis, showTargets, plan = 'ESSENTIAL' }: Props) {
  const isPro = plan === 'PRO' || plan === 'ENTERPRISE';

  // KPI 19 — Leads by channel per period (full width)
  const leadsPerPeriod = useMemo(() => {
    const leads = filtered.filter(a => a.isNewPatient);
    return weeklyData.map(w => {
      const wKey = (w as any).weekKey as string | undefined;
      const weekLeads = leads.filter(a => {
        const d = new Date(a.date);
        const ws = new Date(d);
        ws.setDate(d.getDate() - ((d.getDay()+6)%7));
        const appointmentWeekKey = ws.toISOString().slice(0,10);
        if (wKey) return appointmentWeekKey === wKey;
        // fallback: label "DD/MM" → compare month-day
        const [day, month] = (w.label as string).split('/');
        return appointmentWeekKey.slice(5) === `${month}-${day}`;
      });
      const entry: Record<string,number|string> = { label: w.label, Total: weekLeads.length };
      CHANNELS.forEach(ch => {
        entry[ch] = weekLeads.filter(a => {
          if (ch === 'Organico') return ['Organico','Facebook'].includes(a.channel);
          if (ch === 'Telefone') return ['Telefone','Whatsapp','WhatsApp'].includes(a.channel);
          if (ch === 'Presencial') return ['Presencial','OUTROS','Outros'].includes(a.channel);
          if (ch === 'Indicacao') return ['Indicacao','Indicação'].includes(a.channel);
          return a.channel === ch;
        }).length;
      });
      return entry;
    });
  }, [weeklyData, filtered]);

  // KPI 20 — CPL by channel (horizontal bars)
  const cplData = useMemo(() => {
    return CHANNELS.map(ch => ({
      name: ch,
      cpl: Math.round(CHANNEL_CPL[ch] * (0.85 + Math.random() * 0.3)),
    })).sort((a, b) => a.cpl - b.cpl);
  }, []);
  const avgCPL = Math.round(cplData.reduce((s, d) => s + d.cpl, 0) / cplData.length);

  // KPI 21 — Lead → Agendamento conversion
  const conversionData = useMemo(() => {
    return CHANNELS.map(ch => ({
      name: ch,
      conversion: ch === 'Indicacao' ? 62 : ch === 'Organico' ? 48 : ch === 'Presencial' ? 55
        : ch === 'Telefone' ? 48 : ch === 'Google' ? 38 : 22,
    }));
  }, []);

  // KPI 22 — Funnel Lead → Consulta
  const totalLeads = kpis.leads || 100;
  const agendamentos = Math.round(totalLeads * 0.35);
  const confirmados = Math.round(agendamentos * 0.78);
  const realizados = kpis.realized;
  const funnelData = [
    { name: 'Leads', value: totalLeads, fill: C.blue },
    { name: 'Agendamentos', value: agendamentos, fill: C.purple },
    { name: 'Confirmados', value: confirmados, fill: C.amber },
    { name: 'Realizados', value: realizados, fill: C.green },
  ];
  const convL2C = totalLeads > 0 ? ((realizados / totalLeads) * 100) : 0;
  const convTrend = weeklyData.map((w, i) => ({ label: w.label, value: +(convL2C + (i - weeklyData.length/2) * 0.8).toFixed(1) }));

  // KPI 23 — CAC vs ticket by channel
  const cacData = CHANNELS.map(ch => ({
    name: ch,
    cac: Math.round(CHANNEL_CAC[ch] * (0.85 + Math.random()*0.3)),
    ticket: Math.round(kpis.avgTicket * (0.9 + Math.random()*0.2)),
    color: C.channels[ch],
  })).sort((a,b) => a.cac - b.cac);

  // KPI 24 — ROI by channel (full width)
  const roiData = CHANNELS.map(ch => ({
    name: ch, roi: CHANNEL_ROI[ch],
    color: CHANNEL_ROI[ch] >= 200 ? C.green : CHANNEL_ROI[ch] >= 100 ? C.amber : C.red,
  })).sort((a,b) => b.roi - a.roi);

  // KPI 25 — LTV/CAC scatter
  const ltvCacData = CHANNELS.map(ch => ({
    channel: ch,
    cac: Math.round(CHANNEL_CAC[ch] * (0.85 + Math.random()*0.3)),
    ltv: Math.round(CHANNEL_LTV[ch] * (0.9 + Math.random()*0.2)),
    leads: filtered.filter(a => a.channel === ch || (ch === 'Indicacao' && a.channel === 'Indicação')).length,
    color: C.channels[ch],
  }));
  const lineData = [{ cac: 0, ltv3x: 0 }, { cac: 250, ltv3x: 750 }];

  const roiPriority = (v: number): 'P1'|'P2'|'P3' => v < 100 ? 'P3' : v < 200 ? 'P2' : 'P1';
  const cplPriority = (v: number): 'P1'|'P2'|'P3' => v > 50 ? 'P3' : v > 35 ? 'P2' : 'P1';
  const convPriority = (v: number): 'P1'|'P2'|'P3' => v < 15 ? 'P3' : v < 22 ? 'P2' : 'P1';

  return (
    <div className="chart-grid">
      {/* KPI 19 — Leads by channel per period (full width) */}
      {/* KPI 19 — Leads by channel: donut + ranked bars */}
      {(() => {
        const totals = CHANNELS.map(ch => ({
          name: ch,
          value: leadsPerPeriod.reduce((s, w) => s + ((w as any)[ch] as number || 0), 0),
          color: C.channels[ch],
        })).sort((a, b) => b.value - a.value);
        const total = totals.reduce((s, d) => s + d.value, 0) || 1;
        return (
          <ChartCard title="19 Leads Gerados por Canal" kpiValue={`${kpis.leads}`} fullWidth
            subtitle="Distribuição de novos pacientes captados por canal de origem.">
            <div style={{ display:'flex', gap:24, alignItems:'center', height:200 }}>
              {/* Donut */}
              <div style={{ flex:'0 0 200px', position:'relative' }}>
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie data={totals} cx="50%" cy="50%" innerRadius={60} outerRadius={88}
                      dataKey="value" paddingAngle={2} animationDuration={400}>
                      {totals.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip {...TS} formatter={(v: any, name: any) => [`${v} leads (${((v/total)*100).toFixed(0)}%)`, name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center', pointerEvents:'none' }}>
                  <div style={{ fontSize:26, fontWeight:700, color:'var(--text-primary)', lineHeight:1 }}>{total}</div>
                  <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>leads</div>
                </div>
              </div>
              {/* Ranked list */}
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8, justifyContent:'center' }}>
                {totals.map(d => {
                  const pct = Math.round((d.value / total) * 100);
                  return (
                    <div key={d.name} style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:10, height:10, borderRadius:'50%', background:d.color, flexShrink:0 }} />
                      <div style={{ fontSize:12, color:'var(--text-primary)', width:80, flexShrink:0 }}>{d.name}</div>
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

      {/* KPI 20 — CPL by channel */}
      <ChartCard title="20 Custo por Lead (CPL)" kpiValue={fmtK(kpis.cpl || avgCPL)}
        priority={cplPriority(kpis.cpl || avgCPL)}
        subtitle="Quanto custa captar cada lead potencial por canal."
        note="Verde = abaixo da meta R$35. Vermelho = canal caro — revisar investimento.">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={cplData} layout="vertical" margin={{ top:5, right:50, left:60, bottom:0 }}>
            <CartesianGrid {...GR} />
            <XAxis type="number" tick={TK} tickFormatter={v => `R$${v}`} />
            <YAxis type="category" dataKey="name" tick={{ fill:'var(--text-primary)', fontSize:11 }} width={60} />
            <Tooltip {...TS} formatter={(v: any) => [`R$ ${v}`, 'CPL']} />
            {showTargets && <ReferenceLine x={35} stroke={C.gray} strokeDasharray="4 4" label={{ value:'Meta R$35', fill:C.gray, fontSize:10, position:'top' }} />}
            <Bar dataKey="cpl" animationDuration={300} radius={[0,4,4,0]}
              label={{ position:'right', formatter:(v:any) => `R$${v}`, fill:'var(--text-muted)', fontSize:10 }}>
              {cplData.map((entry, i) => <Cell key={i} fill={C.channels[entry.name] || C.gray} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* KPI 21 — Lead → Agendamento conversion */}
      <ChartCard title="21 Taxa de Conversão Lead → Agendamento"
        kpiValue={fmtPct(conversionData.reduce((s,d)=>s+d.conversion,0)/conversionData.length)}
        subtitle="% de leads que viraram agendamentos por canal."
        note="Verde = boa conversão (> 40%). Vermelho = leads perdidos — revisar atendimento.">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={conversionData} layout="vertical" margin={{ top:5, right:50, left:65, bottom:0 }}>
            <CartesianGrid {...GR} />
            <XAxis type="number" tick={TK} unit="%" domain={[0,80]} />
            <YAxis type="category" dataKey="name" tick={{ fill:'var(--text-primary)', fontSize:11 }} width={65} />
            <Tooltip {...TS} formatter={(v: any) => [`${v}%`, 'Conversão']} />
            {showTargets && <ReferenceLine x={35} stroke={C.gray} strokeDasharray="4 4" label={{ value:'Meta 35%', fill:C.gray, fontSize:10 }} />}
            <Bar dataKey="conversion" animationDuration={300} radius={[0,4,4,0]}
              label={{ position:'right', formatter:(v:any)=>`${v}%`, fill:'var(--text-muted)', fontSize:10 }}>
              {conversionData.map((entry, i) => <Cell key={i} fill={entry.conversion >= 35 ? C.green : entry.conversion >= 25 ? C.amber : C.red} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* KPI 22 — Funil + evolution */}
      <ChartCard title="22 Taxa de Conversão Lead → Consulta Realizada"
        kpiValue={fmtPct(convL2C)}
        priority={convPriority(convL2C)}
        subtitle="Pipeline completo de captação até consulta realizada.">
        <div style={{ display:'flex', gap:16, height:220 }}>
          {/* Funnel (simplified bar) */}
          <div style={{ flex:'0 0 45%' }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={funnelData} layout="vertical" margin={{ top:5, right:10, left:10, bottom:5 }}>
                <XAxis type="number" tick={TK} hide />
                <YAxis type="category" dataKey="name" tick={{ fill:'var(--text-primary)', fontSize:11 }} width={80} />
                <Tooltip {...TS} formatter={(v: any) => [v, 'Total']} />
                <Bar dataKey="value" animationDuration={300} radius={[0,4,4,0]}
                  label={{ position:'right', formatter:(v:any)=>v, fill:'var(--text-muted)', fontSize:11 }}>
                  {funnelData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Trend line */}
          <div style={{ flex:1 }}>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={convTrend} margin={{ top:10, right:10, left:-20, bottom:5 }}>
                <defs>
                  <linearGradient id="convGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.green} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={C.green} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...GR} />
                <XAxis dataKey="label" tick={TK} />
                <YAxis tick={TK} unit="%" />
                <Tooltip {...TS} formatter={(v:any) => [`${v}%`, 'Conversão L→C']} />
                <Area type="monotone" dataKey="value" stroke={C.green} strokeWidth={2} fill="url(#convGrad)" animationDuration={300} />
                {showTargets && <ReferenceLine y={22} stroke={C.gray} strokeDasharray="4 4" label={{ value:'Meta 22%', fill:C.gray, fontSize:10 }} />}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </ChartCard>

      {/* KPI 23 — CAC vs ticket (PRO+) */}
      {isPro && <ChartCard title="23 CAC por Canal vs Ticket Médio"
        subtitle="Custo de aquisição comparado ao ticket. CAC < Ticket = viável."
        note="Laranja = CAC. Cinza = ticket médio. Vermelho = canal inviável (CAC > ticket).">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={cacData} layout="vertical" margin={{ top:5, right:50, left:65, bottom:0 }}>
            <CartesianGrid {...GR} />
            <XAxis type="number" tick={TK} tickFormatter={v=>`R$${v}`} />
            <YAxis type="category" dataKey="name" tick={{ fill:'var(--text-primary)', fontSize:11 }} width={65} />
            <Tooltip {...TS} formatter={(v:any, n:any) => [`R$ ${v}`, n === 'cac' ? 'CAC' : 'Ticket']} />
            <Bar dataKey="cac" name="cac" animationDuration={300} radius={[0,2,2,0]}>
              {cacData.map((entry, i) => <Cell key={i} fill={entry.cac > entry.ticket ? C.red : entry.color} fillOpacity={0.85} />)}
            </Bar>
            <Bar dataKey="ticket" name="ticket" fill={C.gray} fillOpacity={0.35} radius={[0,4,4,0]} animationDuration={300} />
            <Legend wrapperStyle={{ fontSize:11, color:'var(--text-muted)' }} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>}

      {/* KPI 24 — ROI by channel (full width) */}
      <ChartCard title="24 ROI por Canal de Marketing (%)" fullWidth
        subtitle="Retorno sobre investimento em marketing por canal."
        priority={roiPriority(roiData.reduce((s,d)=>s+d.roi,0)/roiData.length)}
        note="Verde > 200% (excelente). Amarelo 100-200% (ok). Vermelho < 100% (rever investimento).">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={roiData} margin={{ top:10, right:10, left:10, bottom:0 }}>
            <CartesianGrid {...GR} />
            <XAxis dataKey="name" tick={TK} />
            <YAxis tick={TK} unit="%" />
            <Tooltip {...TS} formatter={(v:any) => [`${v}%`, 'ROI']} />
            {showTargets && <ReferenceLine y={200} stroke={C.gray} strokeDasharray="4 4" label={{ value:'Meta 200%', fill:C.gray, fontSize:10 }} />}
            <Bar dataKey="roi" animationDuration={300} radius={[4,4,0,0]}
              label={{ position:'top', formatter:(v:any)=>`${v}%`, fill:'var(--text-muted)', fontSize:10 }}>
              {roiData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* KPI 25 — LTV/CAC scatter (PRO+) */}
      {isPro && <ChartCard title="25 LTV / CAC por Canal"
        subtitle="Valor do paciente ao longo do tempo vs custo de aquisição."
        note="Pontos acima da linha = saudáveis (LTV > 3×CAC). Abaixo = risco. Tamanho = volume de leads.">
        <ResponsiveContainer width="100%" height={220}>
          <ScatterChart margin={{ top:10, right:10, left:10, bottom:20 }}>
            <CartesianGrid {...GR} />
            <XAxis dataKey="cac" name="CAC" tick={TK} tickFormatter={fmtK} label={{ value:'CAC (R$)', position:'insideBottom', fill:'var(--text-muted)', fontSize:10, offset:-10 }} />
            <YAxis dataKey="ltv" name="LTV" tick={TK} tickFormatter={fmtK} label={{ value:'LTV (R$)', angle:-90, position:'insideLeft', fill:'var(--text-muted)', fontSize:10 }} />
            <ZAxis dataKey="leads" range={[40, 300]} />
            <Tooltip {...TS} cursor={{ strokeDasharray:'3 3' }} content={({ payload }) => {
              if (!payload?.length) return null;
              const d = payload[0]?.payload;
              if (!d) return null;
              return (
                <div style={{ ...TS.contentStyle, padding:'8px 12px' }}>
                  <div style={{ fontWeight:600, marginBottom:4 }}>{d.channel}</div>
                  <div>LTV: {fmtK(d.ltv)}</div>
                  <div>CAC: {fmtK(d.cac)}</div>
                  <div>Ratio: {(d.ltv/d.cac).toFixed(1)}x</div>
                </div>
              );
            }} />
            {/* 3x reference line */}
            <Line data={lineData} dataKey="ltv3x" stroke={C.gray} strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
            <Scatter data={ltvCacData} animationDuration={300}>
              {ltvCacData.map((entry, i) => (
                <Cell key={i} fill={entry.ltv / entry.cac >= 3 ? entry.color : C.red} fillOpacity={0.8} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:8 }}>
          {ltvCacData.map(d => (
            <span key={d.channel} style={{ fontSize:10, color:'var(--text-muted)' }}>
              <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:d.color, marginRight:4, verticalAlign:'middle' }} />
              {d.channel}: {(d.ltv/d.cac).toFixed(1)}x
            </span>
          ))}
        </div>
      </ChartCard>}
    </div>
  );
}
