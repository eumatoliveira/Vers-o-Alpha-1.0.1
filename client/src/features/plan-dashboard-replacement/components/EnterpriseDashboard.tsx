import { useMemo, useCallback, memo } from 'react';
import ReactApexChart from 'react-apexcharts';
import { useCurrency } from '@/contexts/CurrencyContext';
import { getChartTheme } from '../utils/chartOptions';
import FilterBar from './FilterBar';
import {
  type Appointment, Filters, getAllAppointments, applyFilters, computeKPIs,
  computeByProfessional, computeByChannel, computeByProcedure, computeByUnit,
  computeByWeekday, computeWeeklyTrend, getFilterOptions,
} from '../data/mockData';

interface Props {
  activeTab: number;
  lang?: "PT" | "EN" | "ES";
  theme: 'dark' | 'light' | 'night';
  visualScale: 'normal' | 'large' | 'xl';
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  appointments?: Appointment[];
}

function EnterpriseDashboard({ activeTab, theme, visualScale, filters, onFiltersChange, lang = "PT", appointments }: Props) {
  const { currency, convertMoneyValue, formatCompactMoney, formatMoney, moneyTitle } = useCurrency();
  const fmt = useCallback((value: number) => formatCompactMoney(value), [formatCompactMoney]);
  const ct = useMemo(() => getChartTheme(theme, visualScale), [theme, visualScale]);
  const allData = useMemo(() => appointments ?? getAllAppointments(), [appointments]);
  const filterOptions = useMemo(() => getFilterOptions(allData), [allData]);
  const filtered = useMemo(() => applyFilters(allData, filters), [allData, filters]);
  const kpis = useMemo(() => computeKPIs(filtered), [filtered]);
  const byProf = useMemo(() => computeByProfessional(filtered), [filtered]);
  const byChannel = useMemo(() => computeByChannel(filtered), [filtered]);
  const byProc = useMemo(() => computeByProcedure(filtered), [filtered]);
  const byUnit = useMemo(() => computeByUnit(filtered), [filtered]);
  const byWeekday = useMemo(() => computeByWeekday(filtered), [filtered]);
  const weeklyTrend = useMemo(() => computeWeeklyTrend(filtered), [filtered]);
  const activeChannels = useMemo(() => byChannel.filter(c => c.total > 0), [byChannel]);

  // Enterprise-exclusive calculations
  const ebitda = kpis.grossRevenue - kpis.totalCost - kpis.grossRevenue * 0.08;
  const ebitdaMargin = kpis.grossRevenue > 0 ? (ebitda / kpis.grossRevenue) * 100 : 0;
  const valuation = ebitda * 8;
  const revenuePerEmployee = kpis.grossRevenue / 12;
  const lostRevenue = kpis.avgTicket * kpis.noShows;
  const ltv = kpis.avgTicket * 6;
  const payback = kpis.avgTicket > 0 && kpis.margin > 0 ? Math.ceil(kpis.avgCAC / (kpis.avgTicket * kpis.margin / 100)) : 0;
  const networkUnits = useMemo(() => {
    return byUnit.map((unit, idx) => {
      const revenue = unit.grossRevenue;
      const ebitdaUnit = revenue * (0.22 - idx * 0.03);
      const margin = revenue ? (ebitdaUnit / revenue) * 100 : 0;
      const cash = revenue * (0.11 + (idx % 3) * 0.025);
      const nps = Math.max(6.2, Math.min(9.4, unit.avgNPS + (idx === 0 ? 0.2 : -0.15)));
      const occupancy = Math.max(48, Math.min(94, unit.occupancyRate + (idx % 2 === 0 ? 1.2 : -1.4)));
      const noShow = Math.max(2, unit.noShowRate + idx * 0.8);
      const months = ['M-2', 'M-1', 'M0'].map((m, mIdx) => ({
        label: m,
        revenue: revenue * (0.92 + mIdx * 0.05 - idx * 0.015),
        ebitda: ebitdaUnit * (0.84 + mIdx * 0.08 - idx * 0.02),
      }));
      return {
        name: unit.name,
        team: Math.max(2, Math.round(unit.total / 18) + 2),
        revenue,
        ebitda: ebitdaUnit,
        margin,
        cash,
        nps,
        occupancy,
        noShow,
        months,
      };
    });
  }, [byUnit]);
  const networkActiveUnits = useMemo(() => networkUnits, [networkUnits]);
  const enterpriseConsolidated = useMemo(() => {
    const totalRevenue = networkActiveUnits.reduce((s, u) => s + u.revenue, 0);
    const weighted = (key: 'margin' | 'nps' | 'occupancy' | 'noShow') =>
      totalRevenue ? networkActiveUnits.reduce((s, u) => s + u[key] * u.revenue, 0) / totalRevenue : 0;
    const prev = networkActiveUnits.reduce((s, u) => s + (u.months[1]?.revenue ?? 0), 0);
    const curr = networkActiveUnits.reduce((s, u) => s + (u.months[2]?.revenue ?? 0), 0);
    const growthMoM = prev ? ((curr - prev) / prev) * 100 : 0;
    const dims = {
      crescimento: Math.max(0, Math.min(100, 50 + growthMoM * 2)),
      margem: Math.max(0, Math.min(100, weighted('margin') * 3.4)),
      ops: Math.max(0, Math.min(100, weighted('occupancy') * 0.6 + weighted('nps') * 4.5)),
      risco: Math.max(0, Math.min(100, 100 - weighted('noShow') * 4.8)),
    };
    const score = dims.crescimento * 0.3 + dims.margem * 0.25 + dims.ops * 0.25 + dims.risco * 0.2;
    return {
      revenue: totalRevenue,
      ebitda: networkActiveUnits.reduce((s, u) => s + u.ebitda, 0),
      margin: weighted('margin'),
      cash: networkActiveUnits.reduce((s, u) => s + u.cash, 0),
      nps: weighted('nps'),
      occupancy: weighted('occupancy'),
      noShow: weighted('noShow'),
      team: networkActiveUnits.reduce((s, u) => s + u.team, 0),
      growthMoM,
      score,
      dims,
    };
  }, [networkActiveUnits]);
  const enterpriseBench = useMemo(() => {
    const percentile = (arr: number[], p: number) => {
      const s = [...arr].sort((a, b) => a - b);
      if (!s.length) return 0;
      const i = (s.length - 1) * p;
      const lo = Math.floor(i), hi = Math.ceil(i);
      return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo);
    };
    const rows = [
      { kpi: 'Receita', values: networkUnits.map(u => u.revenue) },
      { kpi: 'EBITDA', values: networkUnits.map(u => u.ebitda) },
      { kpi: 'Margem %', values: networkUnits.map(u => u.margin) },
      { kpi: 'NPS', values: networkUnits.map(u => u.nps) },
    ].map(r => ({ kpi: r.kpi, p25: percentile(r.values, .25), p50: percentile(r.values, .5), p75: percentile(r.values, .75), p90: percentile(r.values, .9) }));
    return rows;
  }, [networkUnits]);
  const investorModel = useMemo(() => {
    const ebitdaLtm = Math.max(1, enterpriseConsolidated.ebitda * 6);
    const growth = enterpriseConsolidated.growthMoM;
    const baseMultiple = 4.8;
    const adjGrowth = growth > 20 ? 0.5 : growth > 10 ? 0.2 : 0;
    const adjMargin = enterpriseConsolidated.margin > 25 ? 0.5 : enterpriseConsolidated.margin > 18 ? 0.2 : 0;
    const concentration = Math.max(...byProc.map(p => p.grossRevenue), 0) / Math.max(kpis.grossRevenue, 1);
    const adjConcentration = concentration > 0.5 ? -0.5 : 0;
    const topDoctorShare = Math.max(...byProf.map(p => p.grossRevenue), 0) / Math.max(kpis.grossRevenue, 1);
    const adjDoctorDependence = topDoctorShare > 0.4 ? -1 : 0;
    const adjustedMultiple = Math.max(1.5, baseMultiple + adjGrowth + adjMargin + adjConcentration + adjDoctorDependence);
    const normalizedEbitda = ebitdaLtm * 0.94;
    const valuationNow = normalizedEbitda * adjustedMultiple;
    const scenarios = [
      { name: 'Conservador', g: 0.10, mult: Math.max(3.5, adjustedMultiple - 0.5), color: '#ef4444' },
      { name: 'Base', g: 0.18, mult: adjustedMultiple, color: '#3b82f6' },
      { name: 'Agressivo', g: 0.28, mult: adjustedMultiple + 0.7, color: '#22c55e' },
    ];
    const horizon = [1, 2, 3, 4, 5];
    const future = scenarios.map(s => ({
      ...s,
      values: horizon.map(n => normalizedEbitda * Math.pow(1 + s.g, n) * s.mult),
      irr: Math.pow(((normalizedEbitda * Math.pow(1 + s.g, 5) * s.mult) / Math.max(valuationNow, 1)), 1 / 5) - 1,
    }));
    const deal = {
      targetInvestment: valuationNow * 0.22,
      targetEbitda: normalizedEbitda * 0.18,
      synergyPurchases: 0.04,
      synergyContracts: 0.03,
      synergyOverhead: 0.05,
    };
    const synergyRate = deal.synergyPurchases + deal.synergyContracts + deal.synergyOverhead;
    const consolidatedEbitdaPost = normalizedEbitda + deal.targetEbitda * (1 + synergyRate);
    const paybackYears = deal.targetInvestment / Math.max(deal.targetEbitda * (1 + synergyRate), 1);
    const roiDeal = (deal.targetEbitda * (1 + synergyRate)) / Math.max(deal.targetInvestment, 1) * 100;
    const riskFactors = [
      { name: 'Concentracao', score: concentration * 100 },
      { name: 'NPS', score: Math.max(0, 100 - enterpriseConsolidated.nps * 10) },
      { name: 'Crescimento', score: Math.max(0, 50 - growth) },
      { name: 'Dependencia medica', score: topDoctorShare * 200 },
      { name: 'Margem', score: Math.max(0, 60 - enterpriseConsolidated.margin * 2) },
      { name: 'Caixa', score: Math.max(0, 50 - (enterpriseConsolidated.cash / Math.max(enterpriseConsolidated.revenue,1)) * 100) },
    ];
    const structuralRisk = Math.min(100, riskFactors.reduce((s, f) => s + (f.name === 'Dependencia medica' ? f.score * 2 : f.score), 0) / 7);
    return {
      ebitdaLtm,
      normalizedEbitda,
      baseMultiple,
      adjustedMultiple,
      adjustments: [
        { name: 'Base setorial', value: baseMultiple },
        { name: 'Crescimento >20%', value: adjGrowth },
        { name: 'Margem >25%', value: adjMargin },
        { name: 'Concentracao', value: adjConcentration },
        { name: 'Dependencia 1 medico', value: adjDoctorDependence },
      ],
      valuationNow,
      valuationSeriesMoM: [valuationNow * 0.92, valuationNow * 0.97, valuationNow],
      future,
      horizon,
      deal: { ...deal, consolidatedEbitdaPost, paybackYears, roiDeal },
      investorSnapshot: {
        yoy: growth * 4,
        pipeline: 3,
        updatedDays: 12,
      },
      structuralRisk,
      riskFactors,
    };
  }, [enterpriseConsolidated, byProc, byProf, kpis.grossRevenue]);

  const drillProf = useCallback((idx: number) => {
    const name = byProf[idx]?.name;
    if (name) onFiltersChange({ ...filters, professional: filters.professional === name ? '' : name });
  }, [byProf, filters, onFiltersChange]);

  const drillChannel = useCallback((idx: number) => {
    const name = activeChannels[idx]?.name;
    if (name) onFiltersChange({ ...filters, channel: filters.channel === name ? '' : name });
  }, [activeChannels, filters, onFiltersChange]);

  const drillProc = useCallback((idx: number) => {
    const name = byProc[idx]?.name;
    if (name) onFiltersChange({ ...filters, procedure: filters.procedure === name ? '' : name });
  }, [byProc, filters, onFiltersChange]);

  const profClick = useMemo(() => ({ chart: { events: { dataPointSelection: (_e: any, _c: any, cfg: any) => drillProf(cfg.dataPointIndex) } } }), [drillProf]);
  const channelClick = useMemo(() => ({ chart: { events: { dataPointSelection: (_e: any, _c: any, cfg: any) => drillChannel(cfg.dataPointIndex) } } }), [drillChannel]);
  const procClick = useMemo(() => ({ chart: { events: { dataPointSelection: (_e: any, _c: any, cfg: any) => drillProc(cfg.dataPointIndex) } } }), [drillProc]);

  return (
    <div className="animate-fade-in" key={activeTab}>
      <FilterBar filters={filters} onChange={onFiltersChange} showUnit={true} options={filterOptions} />

      {/* ===== TAB 0: VISÃO CEO ENTERPRISE ===== */}
      {activeTab === 0 && (<>
        <div className="section-header"><h2><span className="orange-bar" /> Visão CEO — Enterprise</h2></div>
        <div className="overview-row">
          <div className="overview-card"><div className="overview-card-label">{moneyTitle(lang === "EN" ? "Estimated Valuation" : lang === "ES" ? "Valuación Estimada" : "Valuation Estimado")}</div><div className="overview-card-value" style={{color:'var(--accent)'}}>{fmt(valuation)}</div><div className="overview-card-info"><div className="dot" style={{background:'var(--accent)'}}/><span>8x EBITDA</span></div></div>
          <div className="overview-card"><div className="overview-card-label">{moneyTitle('EBITDA')}</div><div className="overview-card-value">{fmt(ebitda)}</div><div className="overview-card-info"><div className="dot" style={{background:ebitdaMargin>=15?'var(--green)':'var(--yellow)'}}/><span>Margem {ebitdaMargin.toFixed(1)}%</span></div></div>
          <div className="overview-card"><div className="overview-card-label">{moneyTitle('Receita')}</div><div className="overview-card-value">{fmt(kpis.grossRevenue)}</div></div>
          <div className="overview-card"><div className="overview-card-label">Unidades Ativas</div><div className="overview-card-value">{networkActiveUnits.length}</div><div className="overview-card-info"><div className="dot" style={{background:'var(--green)'}}/><span>Base consolidada</span></div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">{ lang === "EN" ? "Revenue Evolution (Network)" : lang === "ES" ? "Evolución Ingresos (Red)" : "Evolução Receita (Rede)" }</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{...ct.chart,type:'area'},fill:{type:'gradient',gradient:{shadeIntensity:1,opacityFrom:0.4,opacityTo:0}},colors:['#ff5a1f','#45a29e'],xaxis:{...ct.xaxis,categories:weeklyTrend.map(w=>w.label)},legend:{...ct.legend,show:true,position:'bottom' as const}}} series={[{name:'Receita',data:weeklyTrend.map(w=>Math.round(w.grossRevenue))},{name:'EBITDA',data:weeklyTrend.map(w=>Math.round(w.grossRevenue-w.totalCost-w.grossRevenue*0.08))}]} type="area" height={230}/>
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">{ lang === "EN" ? "Weekly EBITDA" : lang === "ES" ? "EBITDA Semanal" : "EBITDA Semanal" }</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{type:'bar'},plotOptions:{bar:{borderRadius:4,columnWidth:'45%',colors:{ranges:[{from:-999999,to:-1,color:'#ef4444'},{from:0,to:999999,color:'#22c55e'}]}}},xaxis:{...ct.xaxis,categories:weeklyTrend.map(w=>w.label)}}} series={[{name:'EBITDA',data:weeklyTrend.map(w=>Math.round(w.grossRevenue-w.totalCost-w.grossRevenue*0.08))}]} type="bar" height={230}/>
          </div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">{ lang === "EN" ? "Overall Score by Area" : lang === "ES" ? "Puntaje General por Área" : "Score Geral por Área" }</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{type:'radar'},xaxis:{categories:['Receita','Margem','Ocupação','NPS','Marketing','Retenção']},yaxis:{show:false},colors:['#ff5a1f','#45a29e'],stroke:{width:2}}} series={[{name:'Atual',data:[Math.min(10,Math.round(kpis.grossRevenue/6000)),Math.round(kpis.margin/6),Math.round(kpis.occupancyRate/10),Math.round(kpis.avgNPS),Math.round(kpis.leads/40),Math.round(kpis.returnRate/5)]},{name:'Meta',data:[8,5,8,8,7,8]}]} type="radar" height={250}/>
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">{ lang === "EN" ? "Strategic Indicators" : lang === "ES" ? "Indicadores Estratégicos" : "Indicadores Estratégicos" }</span></div><div className="chart-card-body" style={{padding:14}}>
            <table className="data-table"><thead><tr><th>Indicador</th><th>Valor</th><th>Meta</th><th>Status</th></tr></thead><tbody>
              <tr><td>EBITDA Margin</td><td style={{fontWeight:700}}>{ebitdaMargin.toFixed(1)}%</td><td>{'>'}15%</td><td><span className={`chart-card-badge ${ebitdaMargin>=15?'green':ebitdaMargin>=10?'yellow':'red'}`} style={{display:'inline-block'}}>{ebitdaMargin>=15?'OK':ebitdaMargin>=10?'ATENÇÃO':'CRÍTICO'}</span></td></tr>
              <tr><td>LTV/CAC</td><td style={{fontWeight:700}}>{kpis.avgCAC>0?((ltv)/kpis.avgCAC).toFixed(1):'–'}x</td><td>{'>'}3x</td><td><span className={`chart-card-badge ${kpis.avgCAC>0&&ltv/kpis.avgCAC>=3?'green':'yellow'}`} style={{display:'inline-block'}}>{kpis.avgCAC>0&&ltv/kpis.avgCAC>=3?'OK':'ATENÇÃO'}</span></td></tr>
              <tr><td>Ocupação</td><td style={{fontWeight:700}}>{kpis.occupancyRate.toFixed(1)}%</td><td>{'>'}75%</td><td><span className={`chart-card-badge ${kpis.occupancyRate>=75?'green':'yellow'}`} style={{display:'inline-block'}}>{kpis.occupancyRate>=75?'OK':'ATENÇÃO'}</span></td></tr>
              <tr><td>NPS</td><td style={{fontWeight:700}}>{kpis.avgNPS.toFixed(1)}</td><td>{'>'}8.0</td><td><span className={`chart-card-badge ${kpis.avgNPS>=8?'green':'yellow'}`} style={{display:'inline-block'}}>{kpis.avgNPS>=8?'OK':'ATENÇÃO'}</span></td></tr>
              <tr><td>Receita Perdida</td><td style={{fontWeight:700,color:'var(--red)'}}>{fmt(lostRevenue)}</td><td>{'<'}5%</td><td><span className={`chart-card-badge ${lostRevenue/kpis.grossRevenue<0.05?'green':'red'}`} style={{display:'inline-block'}}>{lostRevenue/kpis.grossRevenue<0.05?'OK':'CRÍTICO'}</span></td></tr>
              <tr><td>{moneyTitle('Receita/Funcionário')}</td><td style={{fontWeight:700}}>{fmt(revenuePerEmployee)}</td><td>{'>'}{formatCompactMoney(4000)}</td><td><span className={`chart-card-badge ${revenuePerEmployee>=4000?'green':'yellow'}`} style={{display:'inline-block'}}>{revenuePerEmployee>=4000?'OK':'ATENÇÃO'}</span></td></tr>
            </tbody></table>
          </div></div>
        </div>

        <div className="section-header"><h2><span className="orange-bar" /> Alertas e Ação — Enterprise</h2></div>
        <div className="overview-row">
          <div className="overview-card"><div className="overview-card-label">Alertas P1</div><div className="overview-card-value" style={{color:'var(--red)'}}>{(kpis.noShowRate>10?1:0)+(kpis.avgCAC>150?1:0)}</div></div>
          <div className="overview-card"><div className="overview-card-label">Alertas P2</div><div className="overview-card-value" style={{color:'var(--yellow)'}}>{(kpis.avgWait>15?1:0)+(kpis.avgNPS<8?1:0)}</div></div>
          <div className="overview-card"><div className="overview-card-label">{moneyTitle('Receita em Risco')}</div><div className="overview-card-value" style={{color:'var(--red)'}}>{fmt(lostRevenue)}</div></div>
          <div className="overview-card"><div className="overview-card-label">SLA Cumprimento</div><div className="overview-card-value" style={{color:kpis.occupancyRate>=70?'var(--green)':'var(--red)'}}>{kpis.occupancyRate>=70?'✓ OK':'✗ Em risco'}</div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">No-Show vs Cancelamentos</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{type:'bar'},plotOptions:{bar:{borderRadius:4,columnWidth:'40%'}},colors:['#eab308','#ef4444'],xaxis:{...ct.xaxis,categories:weeklyTrend.map(w=>w.label)},legend:{...ct.legend,show:true,position:'bottom' as const}}} series={[{name:'No-Show',data:weeklyTrend.map(w=>w.noShows)},{name:'Cancelados',data:weeklyTrend.map(w=>w.canceled)}]} type="bar" height={230}/>
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">Heatmap Espera (Prof × Dia)</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{type:'heatmap'},colors:['#ff5a1f'],dataLabels:{enabled:true},plotOptions:{heatmap:{shadeIntensity:0.5,colorScale:{ranges:[{from:0,to:15,color:'#22c55e',name:'OK'},{from:16,to:25,color:'#eab308',name:'Atenção'},{from:26,to:60,color:'#ef4444',name:'Crítico'}]}}}}} series={byProf.map(p=>({name:p.name,data:byWeekday.map(w=>({x:w.name,y:Math.round(w.avgWait+(p.avgWait-kpis.avgWait)*0.5)}))}))} type="heatmap" height={200}/>
          </div></div>
        </div>
        <div className="detail-section"><div className="detail-section-header">🚨 Plano de Ação Enterprise</div><div className="detail-section-body" style={{fontSize:13}}>
          {kpis.noShowRate>10 && <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}><span className="chart-card-badge red" style={{display:'inline-block'}}>P1</span><div><strong style={{color:'var(--text-primary)'}}>No-Show Rate {kpis.noShowRate.toFixed(1)}%</strong><p style={{margin:'2px 0 0',color:'var(--text-secondary)',fontSize:12}}>Ação: Implementar confirmação D-2 via WhatsApp + SMS. Responsável: Ops. Prazo: 7 dias.</p></div></div>}
          {kpis.avgCAC>150 && <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}><span className="chart-card-badge red" style={{display:'inline-block'}}>P1</span><div><strong style={{color:'var(--text-primary)'}}>CAC {fmt(kpis.avgCAC)} — acima do teto {formatMoney(convertMoneyValue(150), { maximumFractionDigits: 0 })}</strong><p style={{margin:'2px 0 0',color:'var(--text-secondary)',fontSize:12}}>Ação: Auditar campanhas Google Ads, pausar keywords não-performáticas. Resp: Marketing. Prazo: 3 dias.</p></div></div>}
          {kpis.avgWait>15 && <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}><span className="chart-card-badge yellow" style={{display:'inline-block'}}>P2</span><div><strong style={{color:'var(--text-primary)'}}>Tempo Espera {kpis.avgWait.toFixed(0)}min</strong><p style={{margin:'2px 0 0',color:'var(--text-secondary)',fontSize:12}}>Ação: Redistribuir agenda para reduzir gaps. Resp: Coordenação. Prazo: 14 dias.</p></div></div>}
          {kpis.avgNPS<8 && <div style={{display:'flex',alignItems:'center',gap:8}}><span className="chart-card-badge yellow" style={{display:'inline-block'}}>P2</span><div><strong style={{color:'var(--text-primary)'}}>NPS {kpis.avgNPS.toFixed(1)} — abaixo da meta</strong><p style={{margin:'2px 0 0',color:'var(--text-secondary)',fontSize:12}}>Ação: Pesquisa qualitativa com detratores. Resp: Qualidade. Prazo: 14 dias.</p></div></div>}
        </div></div>
      
      </>)}

      {/* ===== TAB 2: FINANCEIRO INVESTIDOR ===== */}
      {activeTab === 1 && (<>
        <div className="section-header"><h2><span className="orange-bar" /> Financeiro - Visao Investidor</h2></div>
        <div className="overview-row">
          <div className="overview-card"><div className="overview-card-label">V01 Multiplo EBITDA</div><div className="overview-card-value" style={{color:investorModel.adjustedMultiple>5?'var(--green)':investorModel.adjustedMultiple<3?'var(--red)':'var(--yellow)'}}>{investorModel.adjustedMultiple.toFixed(1)}x</div></div>
          <div className="overview-card"><div className="overview-card-label">{moneyTitle('V03 Valuation Rede')}</div><div className="overview-card-value" style={{color:'var(--accent)'}}>{fmt(investorModel.valuationNow)}</div></div>
          <div className="overview-card"><div className="overview-card-label">V04 Payback (M&A)</div><div className="overview-card-value">{investorModel.deal.paybackYears.toFixed(1)} anos</div></div>
          <div className="overview-card"><div className="overview-card-label">V06 Risco Estrutural</div><div className="overview-card-value" style={{color:investorModel.structuralRisk>70?'var(--red)':investorModel.structuralRisk<30?'var(--green)':'var(--yellow)'}}>{investorModel.structuralRisk.toFixed(0)}</div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">V01 Múltiplo EBITDA Estimado</span><span style={{fontSize:10,color:'var(--text-muted)'}}>Gauge + decomposição de ajustes</span></div><div className="chart-card-body"><div style={{display:'grid',gridTemplateColumns:'0.85fr 1.15fr',gap:12}}><ReactApexChart options={{...ct,chart:{type:'radialBar'},plotOptions:{radialBar:{startAngle:-135,endAngle:135,hollow:{size:'62%'},dataLabels:{name:{offsetY:-8},value:{fontSize:'26px'}}}},labels:['Multiplo ajustado']}} series={[Math.min(100, (investorModel.adjustedMultiple/8)*100)]} type="radialBar" height={240}/><ReactApexChart options={{...ct,chart:{type:'bar'},plotOptions:{bar:{horizontal:true,borderRadius:4,distributed:true}},colors:investorModel.adjustments.map(a=>a.value<0?'#ef4444':'#22c55e'),xaxis:{...ct.xaxis},legend:{show:false}}} series={[{name:'Ajuste (x)',data:investorModel.adjustments.map(a=>({x:a.name,y:+a.value.toFixed(2)}))}]} type="bar" height={240}/></div></div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">V02 Projeção de Valor de Mercado (3-5 anos)</span><span style={{fontSize:10,color:'var(--text-muted)'}}>Cenários + IRR</span></div><div className="chart-card-body"><ReactApexChart options={{...ct,chart:{...ct.chart,type:'line'},stroke:{curve:'smooth',width:[3,3,3]},colors:investorModel.future.map(f=>f.color),xaxis:{...ct.xaxis,categories:investorModel.horizon.map(n=>`${n}a`)},legend:{...ct.legend,show:true,position:'bottom' as const}}} series={investorModel.future.map(f=>({name:`${f.name} (IRR ${(f.irr*100).toFixed(0)}%)`,data:f.values.map(v=>Math.round(v))}))} type="line" height={240}/></div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">V03 Valuation Automático da Rede</span><span style={{fontSize:10,color:'var(--text-muted)'}}>EBITDA normalizado x múltiplo ajustado</span></div><div className="chart-card-body"><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><ReactApexChart options={{...ct,chart:{type:'bar'},plotOptions:{bar:{borderRadius:4,columnWidth:'55%'}},colors:['#22c55e','#3b82f6','#ff5a1f'],xaxis:{...ct.xaxis,categories:['EBITDA LTM','EBITDA normalizado','Múltiplo ajustado x10']},legend:{show:false}}} series={[{name:'Valor',data:[Math.round(investorModel.ebitdaLtm),Math.round(investorModel.normalizedEbitda),Math.round(investorModel.adjustedMultiple*10)]}]} type="bar" height={220}/><ReactApexChart options={{...ct,chart:{...ct.chart,type:'line'},stroke:{curve:'smooth',width:[3,2]},colors:['#ff5a1f','#22c55e'],xaxis:{...ct.xaxis,categories:['M-2','M-1','M0']},legend:{...ct.legend,show:true,position:'bottom' as const}}} series={[{name:'Valuation',data:investorModel.valuationSeriesMoM.map(v=>Math.round(v))},{name:'Tendência',data:[null,Math.round(investorModel.valuationSeriesMoM[1]),Math.round(investorModel.valuationSeriesMoM[2])]} as any]} type="line" height={220}/></div></div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">V04 Simulador de Aquisição (M&A Engine)</span><span style={{fontSize:10,color:'var(--text-muted)'}}>Payback, ROI e sinergias</span></div><div className="chart-card-body"><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><ReactApexChart options={{...ct,chart:{type:'bar'},plotOptions:{bar:{borderRadius:4,columnWidth:'52%'}},colors:['#3b82f6','#22c55e','#ef4444'],xaxis:{...ct.xaxis,categories:['Investimento','EBITDA alvo','EBITDA pós sinergia']},legend:{show:false}}} series={[{name:'Deal',data:[Math.round(investorModel.deal.targetInvestment),Math.round(investorModel.deal.targetEbitda),Math.round(investorModel.deal.consolidatedEbitdaPost)]}]} type="bar" height={220}/><ReactApexChart options={{...ct,chart:{type:'bar'},plotOptions:{bar:{horizontal:true,borderRadius:4}},colors:['#22c55e','#f59e0b','#ef4444'],xaxis:{...ct.xaxis,max:100},legend:{show:false}}} series={[{name:'Indicadores deal',data:[{x:'ROI %',y:+investorModel.deal.roiDeal.toFixed(1)},{x:'Payback anos x10',y:+(investorModel.deal.paybackYears*10).toFixed(1)},{x:'Meta ROI 20%',y:20}]}]} type="bar" height={220}/></div></div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">V05 Dashboard para Investidores (LGPD-safe)</span><span style={{fontSize:10,color:'var(--text-muted)'}}>Vista simplificada + exportação PDF</span></div><div className="chart-card-body" style={{padding:12}}><table className="data-table"><thead><tr><th>Métrica</th><th>Valor</th><th>Status</th></tr></thead><tbody><tr><td>Receita consolidada</td><td>{fmt(enterpriseConsolidated.revenue)}</td><td><span className="chart-card-badge green" style={{display:'inline-block'}}>OK</span></td></tr><tr><td>EBITDA consolidado</td><td>{fmt(enterpriseConsolidated.ebitda)}</td><td><span className="chart-card-badge green" style={{display:'inline-block'}}>OK</span></td></tr><tr><td>Margem EBITDA</td><td>{enterpriseConsolidated.margin.toFixed(1)}%</td><td><span className="chart-card-badge green" style={{display:'inline-block'}}>OK</span></td></tr><tr><td>YoY (proxy)</td><td>{investorModel.investorSnapshot.yoy.toFixed(1)}%</td><td><span className={`chart-card-badge ${investorModel.investorSnapshot.yoy>0?'green':'red'}`} style={{display:'inline-block'}}>{investorModel.investorSnapshot.yoy>0?'OK':'S1'}</span></td></tr><tr><td>Valuation</td><td>{fmt(investorModel.valuationNow)}</td><td><span className="chart-card-badge green" style={{display:'inline-block'}}>OK</span></td></tr><tr><td>Pipeline M&A</td><td>{investorModel.investorSnapshot.pipeline} deals</td><td><span className="chart-card-badge blue" style={{display:'inline-block'}}>Ativo</span></td></tr><tr><td>Atualização</td><td>{investorModel.investorSnapshot.updatedDays} dias</td><td><span className={`chart-card-badge ${investorModel.investorSnapshot.updatedDays>30?'red':'green'}`} style={{display:'inline-block'}}>{investorModel.investorSnapshot.updatedDays>30?'S1':'OK'}</span></td></tr></tbody></table><div style={{marginTop:8,color:'var(--text-muted)',fontSize:11}}>LGPD-safe: sem nomes de profissionais e sem dados de paciente.</div></div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">V06 Score de Risco Estrutural</span><span style={{fontSize:10,color:'var(--text-muted)'}}>Score ponderado (dependência médica 2x)</span></div><div className="chart-card-body"><div style={{display:'grid',gridTemplateColumns:'0.9fr 1.1fr',gap:12}}><ReactApexChart options={{...ct,chart:{type:'radialBar'},plotOptions:{radialBar:{startAngle:-135,endAngle:135,hollow:{size:'62%'},dataLabels:{name:{offsetY:-8},value:{fontSize:'26px'}}}},labels:['Risco estrutural']}} series={[+investorModel.structuralRisk.toFixed(0)]} type="radialBar" height={240}/><ReactApexChart options={{...ct,chart:{type:'bar'},plotOptions:{bar:{horizontal:true,borderRadius:4,distributed:true}},colors:investorModel.riskFactors.map(f=>f.score>70?'#ef4444':f.score>40?'#eab308':'#22c55e'),xaxis:{...ct.xaxis,max:100},legend:{show:false}}} series={[{name:'Fatores',data:investorModel.riskFactors.map(f=>({x:f.name,y:+Math.min(100,f.score).toFixed(1)}))}]} type="bar" height={240}/></div></div></div>
        </div>
      </>)}
      {/* ===== TAB 3: AGENDA / OTIMIZAÇÃO ===== */}
      {activeTab === 2 && (<>
        <div className="section-header"><h2><span className="orange-bar" /> Agenda / Otimização (Enterprise)</h2></div>
        <div className="overview-row">
          <div className="overview-card"><div className="overview-card-label">Total</div><div className="overview-card-value">{kpis.total}</div></div>
          <div className="overview-card"><div className="overview-card-label">Ocupação</div><div className="overview-card-value">{kpis.occupancyRate.toFixed(1)}%</div></div>
          <div className="overview-card"><div className="overview-card-label">{moneyTitle('Receita Perdida')}</div><div className="overview-card-value" style={{color:'var(--red)'}}>{fmt(lostRevenue)}</div></div>
          <div className="overview-card"><div className="overview-card-label">Slots Ociosos</div><div className="overview-card-value">{Math.round(kpis.total*(1-kpis.occupancyRate/100))}</div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">Demanda × Profissional × Dia</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{type:'heatmap'},colors:['#ff5a1f'],dataLabels:{enabled:true},plotOptions:{heatmap:{shadeIntensity:0.5}}}} series={byProf.map(p=>({name:p.name,data:byWeekday.map(w=>({x:w.name,y:Math.round(w.total*(p.total/kpis.total))}))}))} type="heatmap" height={200}/>
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">Ocupação por Dia</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{type:'bar'},plotOptions:{bar:{borderRadius:4,columnWidth:'50%',colors:{ranges:[{from:0,to:60,color:'#ef4444'},{from:61,to:75,color:'#eab308'},{from:76,to:100,color:'#22c55e'}]}}},xaxis:{...ct.xaxis,categories:byWeekday.map(w=>w.name)}}} series={[{name:'Ocupação %',data:byWeekday.map(w=>+w.occupancyRate.toFixed(1))}]} type="bar" height={220}/>
          </div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">Ocupação por Profissional</span><span style={{fontSize:10,color:'var(--text-muted)'}}>🔍 Clique</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,...profClick,chart:{...ct.chart,type:'bar',...profClick.chart},plotOptions:{bar:{distributed:true}},colors:['#ff5a1f','#45a29e','#3b82f6'],xaxis:{...ct.xaxis,categories:byProf.map(p=>p.name)},legend:{show:false}}} series={[{name:'Ocupação %',data:byProf.map(p=>+p.occupancyRate.toFixed(1))}]} type="bar" height={220}/>
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">No-Show por Profissional</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,...profClick,chart:{...ct.chart,type:'bar',...profClick.chart},plotOptions:{bar:{distributed:true}},colors:['#ef4444','#eab308','#ff5a1f'],xaxis:{...ct.xaxis,categories:byProf.map(p=>p.name)},legend:{show:false}}} series={[{name:'No-Show %',data:byProf.map(p=>+p.noShowRate.toFixed(1))}]} type="bar" height={220}/>
          </div></div>
        </div>
      </>)}

      {/* ===== TAB 4: MARKETING / UNIT ECONOMICS ===== */}
      {activeTab === 3 && (<>
        <div className="section-header"><h2><span className="orange-bar" /> Marketing / Unit Economics</h2></div>
        <div className="overview-row">
          <div className="overview-card"><div className="overview-card-label">Leads</div><div className="overview-card-value">{kpis.leads}</div></div>
          <div className="overview-card"><div className="overview-card-label">{moneyTitle('CAC')}</div><div className="overview-card-value" style={{color:kpis.avgCAC>150?'var(--red)':'var(--green)'}}>{fmt(kpis.avgCAC)}</div></div>
          <div className="overview-card"><div className="overview-card-label">{moneyTitle('LTV (6 visitas)')}</div><div className="overview-card-value">{fmt(ltv)}</div></div>
          <div className="overview-card"><div className="overview-card-label">Payback (meses)</div><div className="overview-card-value">{payback || '–'}</div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">Funil de Conversão</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{type:'bar'},plotOptions:{bar:{horizontal:true,barHeight:'60%'}},colors:['#ff5a1f'],xaxis:{...ct.xaxis,categories:['Leads','Qualificados','Agendados','Realizados','Retornos','Promotores']},dataLabels:{enabled:true}}} series={[{name:'Volume',data:[kpis.leads,Math.round(kpis.leads*0.6),Math.round(kpis.leads*0.4),kpis.realized,Math.round(kpis.realized*kpis.returnRate/100),kpis.promoters]}]} type="bar" height={220}/>
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">{moneyTitle('CAC por Canal')}</span><span style={{fontSize:10,color:'var(--text-muted)'}}>🔍 Clique</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,...channelClick,chart:{...ct.chart,type:'bar',...channelClick.chart},plotOptions:{bar:{distributed:true,columnWidth:'50%'}},colors:['#ff5a1f','#3b82f6','#eab308','#22c55e','#8b5cf6','#45a29e'],xaxis:{...ct.xaxis,categories:activeChannels.map(c=>c.name)},legend:{show:false},annotations:{yaxis:[{y:150,borderColor:'#ef4444',label:{text:`Teto CAC ${formatMoney(convertMoneyValue(150), { maximumFractionDigits: 0 })}`,style:{color:'#fff',background:'#ef4444'}}}]},tooltip:{y:{formatter:(v:number)=>fmt(v)}}}} series={[{name:'CAC',data:activeChannels.map(c=>Math.round(c.avgCAC))}]} type="bar" height={220}/>
          </div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">ROI por Canal</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{type:'bar'},plotOptions:{bar:{columnWidth:'50%'}},colors:['#22c55e','#ef4444'],xaxis:{...ct.xaxis,categories:activeChannels.map(c=>c.name)},legend:{...ct.legend,show:true,position:'bottom' as const}}} series={[{name:'Receita',data:activeChannels.map(c=>Math.round(c.grossRevenue))},{name:'Investimento',data:activeChannels.map(c=>Math.round(c.avgCAC*c.total))}]} type="bar" height={220}/>
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">Mix de Canais</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{type:'donut'},labels:activeChannels.map(c=>c.name),colors:['#ff5a1f','#3b82f6','#eab308','#22c55e','#8b5cf6','#45a29e'],plotOptions:{pie:{donut:{size:'55%'}}},legend:{...ct.legend,position:'bottom' as const}}} series={activeChannels.map(c=>Math.round(c.grossRevenue))} type="donut" height={240}/>
          </div></div>
        </div>
      </>)}

      {/* ===== TAB 5: MULTI-UNIDADE ===== */}
      {activeTab === 4 && (<>
        <div className="section-header"><h2><span className="orange-bar" /> Multi-Unidade</h2></div>
        <div className="overview-row">
          <div className="overview-card"><div className="overview-card-label">Unidades Ativas</div><div className="overview-card-value">{networkActiveUnits.length}</div><div className="overview-card-info"><div className="dot" style={{background:'var(--green)'}}/><span>Base consolidada</span></div></div>
          <div className="overview-card"><div className="overview-card-label">{moneyTitle('Receita Consolidada')}</div><div className="overview-card-value">{fmt(enterpriseConsolidated.revenue)}</div></div>
          <div className="overview-card"><div className="overview-card-label">{moneyTitle('EBITDA Consolidado')}</div><div className="overview-card-value" style={{color:enterpriseConsolidated.ebitda>=0?'var(--green)':'var(--red)'}}>{fmt(enterpriseConsolidated.ebitda)}</div></div>
          <div className="overview-card"><div className="overview-card-label">Score da Rede</div><div className="overview-card-value" style={{color:enterpriseConsolidated.score>65?'var(--green)':enterpriseConsolidated.score<40?'var(--red)':'var(--yellow)'}}>{enterpriseConsolidated.score.toFixed(0)}</div></div>
        </div>
        <div className="detail-section"><div className="detail-section-header">E01 Consolidação Multi-Unidade (ponderação por receita)</div><div className="detail-section-body"><table className="data-table"><thead><tr><th>Unidade</th><th>Receita</th><th>EBITDA</th><th>Margem</th><th>Caixa</th><th>NPS</th><th>Equipe</th></tr></thead><tbody>
          {networkActiveUnits.map(u=><tr key={u.name}><td style={{fontWeight:600}}>{u.name}</td><td>{fmt(u.revenue)}</td><td>{fmt(u.ebitda)}</td><td>{u.margin.toFixed(1)}%</td><td>{fmt(u.cash)}</td><td>{u.nps.toFixed(1)}</td><td>{u.team}</td></tr>)}
          <tr style={{fontWeight:700,background:'var(--accent-dim)'}}><td>REDE (Consolidado)</td><td>{fmt(enterpriseConsolidated.revenue)}</td><td>{fmt(enterpriseConsolidated.ebitda)}</td><td>{enterpriseConsolidated.margin.toFixed(1)}%</td><td>{fmt(enterpriseConsolidated.cash)}</td><td>{enterpriseConsolidated.nps.toFixed(1)}</td><td>{enterpriseConsolidated.team}</td></tr>
        </tbody></table></div></div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">E02 Score da Rede (0-100)</span><span style={{fontSize:10,color:'var(--text-muted)'}}>Gauge + decomposição por dimensão</span></div><div className="chart-card-body"><div style={{display:'grid',gridTemplateColumns:'0.9fr 1.1fr',gap:12}}><ReactApexChart options={{...ct,chart:{type:'radialBar'},plotOptions:{radialBar:{startAngle:-135,endAngle:135,hollow:{size:'62%'},dataLabels:{name:{offsetY:-10},value:{fontSize:'28px'}}}},labels:['Score da Rede']}} series={[+enterpriseConsolidated.score.toFixed(0)]} type="radialBar" height={240}/><ReactApexChart options={{...ct,chart:{type:'bar'},plotOptions:{bar:{horizontal:true,borderRadius:4,distributed:true}},colors:['#3b82f6','#22c55e','#f59e0b','#ef4444'],xaxis:{...ct.xaxis,max:100},legend:{show:false}}} series={[{name:'Dimensao',data:[{x:'Crescimento (30%)',y:+enterpriseConsolidated.dims.crescimento.toFixed(1)},{x:'Margem (25%)',y:+enterpriseConsolidated.dims.margem.toFixed(1)},{x:'Ops (25%)',y:+enterpriseConsolidated.dims.ops.toFixed(1)},{x:'Risco (20%)',y:+enterpriseConsolidated.dims.risco.toFixed(1)}]}]} type="bar" height={240}/></div></div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">E03 Benchmark Interno (percentis)</span><span style={{fontSize:10,color:'var(--text-muted)'}}>Ranking + outliers</span></div><div className="chart-card-body" style={{padding:12}}><table className="data-table"><thead><tr><th>KPI</th><th>P25</th><th>P50</th><th>P75</th><th>P90</th></tr></thead><tbody>{enterpriseBench.map(r=><tr key={r.kpi}><td>{r.kpi}</td><td>{r.kpi==='Receita'||r.kpi==='EBITDA'?fmt(r.p25):r.p25.toFixed(1)}</td><td>{r.kpi==='Receita'||r.kpi==='EBITDA'?fmt(r.p50):r.p50.toFixed(1)}</td><td>{r.kpi==='Receita'||r.kpi==='EBITDA'?fmt(r.p75):r.p75.toFixed(1)}</td><td>{r.kpi==='Receita'||r.kpi==='EBITDA'?fmt(r.p90):r.p90.toFixed(1)}</td></tr>)}</tbody></table><div style={{display:'flex',gap:8,marginTop:10,flexWrap:'wrap'}}><span className="chart-card-badge red" style={{display:'inline-block'}}>S1 EBITDA consolidado negativo por 2 meses</span><span className="chart-card-badge yellow" style={{display:'inline-block'}}>S2 tendência de queda</span><span className="chart-card-badge blue" style={{display:'inline-block'}}>Playbook top 10% replicável</span></div></div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">E04 Alertas Estruturais (S1/S2/S3)</span><span style={{fontSize:10,color:'var(--text-muted)'}}>2σ + persistência 3 períodos</span></div><div className="chart-card-body" style={{padding:12}}><table className="data-table"><thead><tr><th>Unidade</th><th>Desvio</th><th>Persistência</th><th>Status</th><th>Ação</th></tr></thead><tbody><tr><td>Moema</td><td>{'<'} -2σ margem</td><td>3 períodos</td><td><span className="chart-card-badge red" style={{display:'inline-block'}}>S1</span></td><td>Ação em 7 dias</td></tr><tr><td>Paulista</td><td>Queda NPS + ocupação</td><td>3 períodos</td><td><span className="chart-card-badge yellow" style={{display:'inline-block'}}>S2</span></td><td>Ação em 30 dias</td></tr><tr><td>Jardins</td><td>Dependência de canal</td><td>2 períodos</td><td><span className="chart-card-badge blue" style={{display:'inline-block'}}>S3</span></td><td>Monitorar</td></tr></tbody></table></div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">E05 Governance & Permissões (RBAC)</span><span style={{fontSize:10,color:'var(--text-muted)'}}>8 papéis + trilha de auditoria</span></div><div className="chart-card-body" style={{padding:12}}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}><div className="overview-card" style={{margin:0}}><div className="overview-card-label">RBAC</div><div className="overview-card-value">8 papéis</div><div className="overview-card-info"><div className="dot" style={{background:'var(--green)'}}/><span>Role-based access</span></div></div><div className="overview-card" style={{margin:0}}><div className="overview-card-label">Auditoria</div><div className="overview-card-value">100%</div><div className="overview-card-info"><div className="dot" style={{background:'var(--green)'}}/><span>Ações rastreadas</span></div></div></div><table className="data-table"><thead><tr><th>Usuário</th><th>Role</th><th>Unidade</th><th>SSO</th><th>MFA</th><th>Status</th></tr></thead><tbody><tr><td>Ana Souza</td><td>NETWORK_OWNER</td><td>Rede</td><td>Google</td><td>Ativo</td><td><span className="chart-card-badge green" style={{display:'inline-block'}}>OK</span></td></tr><tr><td>Bruno Lima</td><td>FINANCE_LEAD</td><td>Rede</td><td>Microsoft</td><td>Ativo</td><td><span className="chart-card-badge green" style={{display:'inline-block'}}>OK</span></td></tr><tr><td>Carla Nunes</td><td>UNIT_MANAGER</td><td>Jardins</td><td>Local</td><td>Pendente</td><td><span className="chart-card-badge yellow" style={{display:'inline-block'}}>S2</span></td></tr><tr><td>Diego Reis</td><td>RECEPTION_LEAD</td><td>Paulista</td><td>Local</td><td>Pendente</td><td><span className="chart-card-badge yellow" style={{display:'inline-block'}}>S2</span></td></tr><tr><td>Evento suspeito</td><td>Acesso indevido detectado</td><td>Rede</td><td>-</td><td>-</td><td><span className="chart-card-badge red" style={{display:'inline-block'}}>S1</span></td></tr></tbody></table></div></div>
        </div>
      </>)}
      {/* ===== TAB 6: INTEGRAÇÕES ===== */}
      {activeTab === 5 && (<>
        <div className="section-header"><h2><span className="orange-bar" /> Integrações (Enterprise)</h2></div>
        <div className="overview-row">
          <div className="overview-card"><div className="overview-card-label">Fontes Conectadas</div><div className="overview-card-value">8</div><div className="overview-card-info"><div className="dot" style={{background:'var(--green)'}}/><span>Ativas</span></div></div>
          <div className="overview-card"><div className="overview-card-label">Data Warehouse</div><div className="overview-card-value" style={{fontSize:16,color:'var(--green)'}}>✓ Sincronizado</div></div>
          <div className="overview-card"><div className="overview-card-label">Registros</div><div className="overview-card-value">{kpis.total.toLocaleString()}</div></div>
          <div className="overview-card"><div className="overview-card-label">Erros</div><div className="overview-card-value" style={{color:'var(--green)'}}>0</div></div>
        </div>
        <div className="detail-section"><div className="detail-section-header">📡 Integrações Enterprise</div><div className="detail-section-body"><table className="data-table"><thead><tr><th>Sistema</th><th>Tipo</th><th>Status</th><th>Última Sync</th><th>Dados</th></tr></thead><tbody>
          <tr><td>ERP / Contabilidade</td><td>API REST</td><td><span className="chart-card-badge green" style={{display:'inline-block'}}>OK</span></td><td>3 min</td><td>{fmt(kpis.grossRevenue)}</td></tr>
          <tr><td>Agenda / CRM</td><td>Webhook</td><td><span className="chart-card-badge green" style={{display:'inline-block'}}>OK</span></td><td>1 min</td><td>{kpis.total} registros</td></tr>
          <tr><td>Google Analytics</td><td>API v4</td><td><span className="chart-card-badge green" style={{display:'inline-block'}}>OK</span></td><td>5 min</td><td>{kpis.leads} leads</td></tr>
          <tr><td>BI / Data Warehouse</td><td>ETL</td><td><span className="chart-card-badge green" style={{display:'inline-block'}}>OK</span></td><td>10 min</td><td>Consolidado</td></tr>
          <tr><td>NPS Platform</td><td>API</td><td><span className="chart-card-badge green" style={{display:'inline-block'}}>OK</span></td><td>15 min</td><td>{kpis.promoters+kpis.neutrals+kpis.detractors} respostas</td></tr>
          <tr><td>WhatsApp Business</td><td>CloudAPI</td><td><span className="chart-card-badge green" style={{display:'inline-block'}}>OK</span></td><td>1 min</td><td>{Math.round(kpis.total*0.3)} msgs</td></tr>
          <tr><td>Payment Gateway</td><td>Webhook</td><td><span className="chart-card-badge green" style={{display:'inline-block'}}>OK</span></td><td>2 min</td><td>{kpis.realized} transações</td></tr>
          <tr><td>Gov / LGPD Compliance</td><td>Batch</td><td><span className="chart-card-badge green" style={{display:'inline-block'}}>OK</span></td><td>24h</td><td>Relatório</td></tr>
        </tbody></table></div></div>
      </>)}

      {/* ===== TAB 7: OPERAÇÃO & EXPERIÊNCIA ===== */}
      {activeTab === 6 && (<>
        <div className="section-header"><h2><span className="orange-bar" /> Operação & Experiência</h2></div>
        <div className="overview-row">
          <div className="overview-card"><div className="overview-card-label">NPS</div><div className="overview-card-value" style={{color:kpis.avgNPS>=8?'var(--green)':'var(--yellow)'}}>{kpis.avgNPS.toFixed(1)}</div></div>
          <div className="overview-card"><div className="overview-card-label">Espera</div><div className="overview-card-value">{kpis.avgWait.toFixed(0)} min</div></div>
          <div className="overview-card"><div className="overview-card-label">Retorno</div><div className="overview-card-value">{kpis.returnRate.toFixed(1)}%</div></div>
          <div className="overview-card"><div className="overview-card-label">Reclamações</div><div className="overview-card-value">{kpis.complaints}</div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">NPS por Profissional</span><span style={{fontSize:10,color:'var(--text-muted)'}}>🔍 Clique</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,...profClick,chart:{...ct.chart,type:'bar',...profClick.chart},plotOptions:{bar:{distributed:true}},colors:['#ff5a1f','#45a29e','#3b82f6'],xaxis:{...ct.xaxis,categories:byProf.map(p=>p.name)},legend:{show:false},annotations:{yaxis:[{y:8,borderColor:'#ff5a1f',strokeDashArray:4,label:{text:'Meta 8.0',style:{color:'#fff',background:'#ff5a1f'}}}]}}} series={[{name:'NPS',data:byProf.map(p=>+p.avgNPS.toFixed(1))}]} type="bar" height={220}/>
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">Distribuição NPS</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{type:'donut'},labels:['Promotores','Neutros','Detratores'],colors:['#22c55e','#eab308','#ef4444'],plotOptions:{pie:{donut:{size:'60%'}}},legend:{...ct.legend,position:'bottom' as const}}} series={[kpis.promoters,kpis.neutrals,kpis.detractors]} type="donut" height={230}/>
          </div></div>
        </div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">Espera por Dia</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{type:'bar'},plotOptions:{bar:{borderRadius:4,columnWidth:'50%',colors:{ranges:[{from:0,to:15,color:'#22c55e'},{from:16,to:25,color:'#eab308'},{from:26,to:60,color:'#ef4444'}]}}},xaxis:{...ct.xaxis,categories:byWeekday.map(w=>w.name)}}} series={[{name:'Espera min',data:byWeekday.map(w=>Math.round(w.avgWait))}]} type="bar" height={220}/>
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">Retorno por Profissional</span><span style={{fontSize:10,color:'var(--text-muted)'}}>🔍 Clique</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,...profClick,chart:{...ct.chart,type:'bar',...profClick.chart},plotOptions:{bar:{horizontal:true,distributed:true}},colors:['#ff5a1f','#45a29e','#3b82f6'],xaxis:{...ct.xaxis,categories:byProf.map(p=>p.name)},legend:{show:false}}} series={[{name:'Retorno %',data:byProf.map(p=>+p.returnRate.toFixed(1))}]} type="bar" height={200}/>
          </div></div>
        </div>
        <div className="detail-section"><div className="detail-section-header">📋 NPS Detalhado por Profissional</div><div className="detail-section-body"><table className="data-table"><thead><tr><th>Profissional</th><th>NPS</th><th>Promotores</th><th>Neutros</th><th>Detratores</th><th>Retorno</th><th>Espera</th></tr></thead><tbody>
          {byProf.map(p=><tr key={p.name} style={{cursor:'pointer'}} onClick={()=>drillProf(byProf.indexOf(p))}><td style={{fontWeight:600}}>{p.name}</td><td style={{color:p.avgNPS>=8?'var(--green)':'var(--yellow)',fontWeight:700}}>{p.avgNPS.toFixed(1)}</td><td>{p.promoters}</td><td>{p.neutrals}</td><td>{p.detractors}</td><td>{p.returnRate.toFixed(1)}%</td><td>{p.avgWait.toFixed(0)} min</td></tr>)}
        </tbody></table></div></div>
      </>)}

      {/* ===== TAB 8: EQUIPE ===== */}
      {activeTab === 7 && (<>
        <div className="section-header"><h2><span className="orange-bar" /> Equipe Enterprise</h2></div>
        <div className="detail-section"><div className="detail-section-header">👥 Ranking Enterprise — Equipe Completa</div><div className="detail-section-body"><table className="data-table"><thead><tr><th>Profissional</th><th>Receita</th><th>{ lang === "EN" ? "Avg Ticket" : lang === "ES" ? "Ticket Promedio" : "Ticket Médio" }</th><th>NPS</th><th>Ocupação</th><th>No-Show</th><th>Margem</th><th>Retorno</th></tr></thead><tbody>
          {byProf.map(p=><tr key={p.name} style={{cursor:'pointer'}} onClick={()=>drillProf(byProf.indexOf(p))}><td style={{fontWeight:600}}>{p.name}</td><td>{fmt(p.grossRevenue)}</td><td>{fmt(p.avgTicket)}</td><td style={{color:p.avgNPS>=8?'var(--green)':'var(--yellow)',fontWeight:700}}>{p.avgNPS.toFixed(1)}</td><td>{p.occupancyRate.toFixed(1)}%</td><td style={{color:p.noShowRate<=10?'var(--green)':'var(--red)',fontWeight:700}}>{p.noShowRate.toFixed(1)}%</td><td style={{color:p.margin>=20?'var(--green)':'var(--yellow)',fontWeight:700}}>{p.margin.toFixed(1)}%</td><td>{p.returnRate.toFixed(1)}%</td></tr>)}
        </tbody></table></div></div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">Ranking Receita</span><span style={{fontSize:10,color:'var(--text-muted)'}}>🔍 Clique</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,...profClick,chart:{...ct.chart,type:'bar',...profClick.chart},plotOptions:{bar:{horizontal:true,distributed:true}},colors:['#ff5a1f','#45a29e','#3b82f6'],xaxis:{...ct.xaxis,categories:byProf.map(p=>p.name)},legend:{show:false}}} series={[{name:'Receita',data:byProf.map(p=>Math.round(p.grossRevenue))}]} type="bar" height={200}/>
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">Ranking NPS</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,...profClick,chart:{...ct.chart,type:'bar',...profClick.chart},plotOptions:{bar:{horizontal:true,distributed:true}},colors:['#22c55e','#eab308','#ef4444'],xaxis:{...ct.xaxis,categories:byProf.map(p=>p.name)},legend:{show:false}}} series={[{name:'NPS',data:byProf.map(p=>+p.avgNPS.toFixed(1))}]} type="bar" height={200}/>
          </div></div>
        </div>
      </>)}

      {/* ===== TAB 9: GOVERNANCA ===== */}
      {activeTab === 8 && (<>
        <div className="section-header"><h2><span className="orange-bar" /> Governan?a & Compliance</h2></div>
        <div className="overview-row">
          <div className="overview-card"><div className="overview-card-label">LGPD Status</div><div className="overview-card-value" style={{color:'var(--green)',fontSize:16}}>Conforme</div></div>
          <div className="overview-card"><div className="overview-card-label">Auditoria</div><div className="overview-card-value" style={{fontSize:16}}>Atualizada</div></div>
          <div className="overview-card"><div className="overview-card-label">Risco Geral</div><div className="overview-card-value" style={{color:'var(--green)'}}>Baixo</div></div>
          <div className="overview-card"><div className="overview-card-label">?ltima Revis?o</div><div className="overview-card-value" style={{fontSize:14}}>20/02/2026</div></div>
        </div>
        <div className="detail-section"><div className="detail-section-header">Checklist de Governan?a</div><div className="detail-section-body"><table className="data-table"><thead><tr><th>Item</th><th>Status</th><th>?ltima Verifica??o</th><th>Pr?xima Revis?o</th></tr></thead><tbody>
          <tr><td>LGPD - Consentimento</td><td><span className="chart-card-badge green" style={{display:'inline-block'}}>OK</span></td><td>20/02/2026</td><td>20/03/2026</td></tr>
          <tr><td>LGPD - DPO Notificado</td><td><span className="chart-card-badge green" style={{display:'inline-block'}}>OK</span></td><td>20/02/2026</td><td>20/03/2026</td></tr>
          <tr><td>Backup / DR</td><td><span className="chart-card-badge green" style={{display:'inline-block'}}>OK</span></td><td>24/02/2026</td><td>03/03/2026</td></tr>
          <tr><td>Seguran?a - Pen Test</td><td><span className="chart-card-badge green" style={{display:'inline-block'}}>OK</span></td><td>15/01/2026</td><td>15/04/2026</td></tr>
          <tr><td>Reten??o de Logs (6m)</td><td><span className="chart-card-badge green" style={{display:'inline-block'}}>OK</span></td><td>24/02/2026</td><td>Cont?nuo</td></tr>
          <tr><td>Trilha de Auditoria</td><td><span className="chart-card-badge green" style={{display:'inline-block'}}>OK</span></td><td>24/02/2026</td><td>Cont?nuo</td></tr>
          <tr><td>Licenciamento de Software</td><td><span className="chart-card-badge green" style={{display:'inline-block'}}>OK</span></td><td>01/01/2026</td><td>01/01/2027</td></tr>
        </tbody></table></div></div>
        <div className="chart-grid">
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">Score Governan?a por ?rea</span></div><div className="chart-card-body">
            <ReactApexChart options={{...ct,chart:{type:'radar'},xaxis:{categories:['LGPD','Seguran?a','Backup','Auditoria','Licen?as','Compliance']},yaxis:{show:false},colors:['#22c55e']}} series={[{name:'Score',data:[10,9,10,10,10,9]}]} type="radar" height={250}/>
          </div></div>
          <div className="chart-card"><div className="chart-card-header"><span className="chart-card-title">Hist?rico de Incidentes</span></div><div className="chart-card-body" style={{padding:18}}>
            <div style={{textAlign:'center',paddingTop:40,color:'var(--green)',fontSize:48,fontWeight:800}}>0</div>
            <div style={{textAlign:'center',color:'var(--text-muted)',fontSize:13,marginTop:8}}>Incidentes nos ?ltimos 90 dias</div>
            <div style={{textAlign:'center',color:'var(--text-secondary)',fontSize:11,marginTop:4}}>?ltimo incidente: Nenhum registrado</div>
          </div></div>
        </div>
      </>)}
    </div>
  );
}

export default memo(EnterpriseDashboard);
