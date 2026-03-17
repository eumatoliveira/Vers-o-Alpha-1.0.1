import { Filters } from '../data/mockData';
import { useTranslation } from '../i18n';

interface FilterOptions {
  channels: string[];
  professionals: string[];
  procedures: string[];
  units: string[];
  statuses: string[];
  severities: string[];
}

interface FilterBarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  showUnit?: boolean;
  options?: FilterOptions;
}

const defaultOptions: FilterOptions = {
  channels: [],
  professionals: [],
  procedures: [],
  units: [],
  statuses: ['Realizada', 'No-Show', 'Cancelada', 'Confirmada'],
  severities: ['P1', 'P2', 'P3'],
};

export default function FilterBar({ filters, onChange, showUnit = false, options = defaultOptions }: FilterBarProps) {
  const { t } = useTranslation();
  const orderedChannelOptions = [
    { value: "Indicacao", label: t("Indicação") },
    { value: "Google", label: "Google" },
    { value: "Instagram", label: "Instagram" },
    { value: "Facebook", label: "Facebook" },
    { value: "Whatsapp", label: "Whatsapp" },
    { value: "OUTROS", label: t("Outros") },
  ];

  const update = (key: keyof Filters, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  const severityLabelByValue: Record<string, string> = {
    P1: t("P1 (Meta)"),
    P2: t("P2 (Atenção. Ação < 7 dias)"),
    P3: t("P3 (Crítico. Ação < 24h)"),
  };

  const clear = () => {
    onChange({
      period: '30d', channel: '', professional: '', procedure: '',
      status: '', unit: '', severity: '',
    });
  };

  return (
    <div className="filter-bar">
      <div className="filter-bar-title">
        <span>{t('Filtros')}</span>
        <span className="filter-info-wrap">
          <button type="button" className="filter-info-btn" aria-label={t('Sobre filtros')}>i</button>
          <span className="filter-info-popover" role="tooltip">
            {t('Use os filtros para segmentar KPIs e gráficos por período, canal, profissional, procedimento, metas/alertas')}
          </span>
        </span>
      </div>
      <div className={`filter-row ${showUnit ? 'with-unit' : 'no-unit'}`}>
        <select className="filter-select filter-period" value={filters.period} onChange={e => update('period', e.target.value)} aria-label={t('Período')}>
          <option value="7d">{t('7 dias')}</option>
          <option value="15d">{t('15 dias')}</option>
          <option value="30d">{t('30 dias')}</option>
          <option value="3m">{t('3 meses')}</option>
          <option value="6m">{t('6 meses')}</option>
          <option value="1 ano">{t('12 meses')}</option>
        </select>

        <span className="filter-clear-text" onClick={clear}>{t('Limpar')}</span>

        <select className="filter-select filter-channel" value={filters.channel} onChange={e => update('channel', e.target.value)}>
          <option value="">{t('Canal')}</option>
          {orderedChannelOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <select className="filter-select filter-professional" value={filters.professional} onChange={e => update('professional', e.target.value)}>
          <option value="">{t('Profissionais')}</option>
          {options.professionals.map(p => <option key={p} value={p}>{t(p)}</option>)}
        </select>

        <select className="filter-select filter-procedure" value={filters.procedure} onChange={e => update('procedure', e.target.value)}>
          <option value="">{t('Procedimento')}</option>
          {options.procedures.map(p => <option key={p} value={p}>{t(p)}</option>)}
        </select>

        {showUnit && <select className="filter-select filter-unit" value={filters.unit} onChange={e => update('unit', e.target.value)}>
          <option value="">{t('Unidade (todas)')}</option>
          {options.units.map(u => <option key={u} value={u}>{t(u)}</option>)}
        </select>}

        <select className="filter-select filter-severity" value={filters.severity} onChange={e => update('severity', e.target.value)}>
          <option value="">{t('Metas/Alertas')}</option>
          {options.severities.map((s) => (
            <option key={s} value={s}>{severityLabelByValue[s] ?? s}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
