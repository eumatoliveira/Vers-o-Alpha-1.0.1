export function getChartTheme(theme: 'dark' | 'light' | 'night', visualScale: 'normal' | 'large' | 'xl' = 'normal'): any {
  const isDark = theme === 'dark' || theme === 'night';
  const axisFontSize = visualScale === 'xl' ? '17px' : visualScale === 'large' ? '16px' : '15px';
  const legendFontSize = visualScale === 'xl' ? '17px' : visualScale === 'large' ? '16px' : '15px';
  const strokeWidth = visualScale === 'xl' ? 3.2 : visualScale === 'large' ? 2.8 : 2.5;
  return {
    chart: {
      background: 'transparent',
      fontFamily: '"Plus Jakarta Sans", sans-serif',
      foreColor: theme === 'night' ? '#e8decf' : isDark ? '#cbd5e1' : '#475569',
      toolbar: { show: false },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800,
        dynamicAnimation: { enabled: true, speed: 350 },
      },
    },
    theme: { mode: theme },
    grid: {
      borderColor: isDark ? '#2a2a2a' : '#e5e7eb',
      strokeDashArray: 3,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
      padding: { top: 0, right: 0, bottom: 0, left: 4 },
    },
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth' as const, width: strokeWidth },
    xaxis: {
      labels: { style: { colors: theme === 'night' ? '#d9ccb8' : isDark ? '#cbd5e1' : '#64748b', fontSize: axisFontSize, fontFamily: '"Plus Jakarta Sans"' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: { style: { colors: theme === 'night' ? '#d9ccb8' : isDark ? '#cbd5e1' : '#64748b', fontSize: axisFontSize, fontFamily: '"Plus Jakarta Sans"' } },
    },
    tooltip: { theme: theme },
    colors: ['#ff5a1f', '#45a29e', '#3b82f6', '#eab308', '#ef4444'],
    legend: {
      labels: { colors: theme === 'night' ? '#efe4d3' : isDark ? '#e2e8f0' : '#475569' },
      fontSize: legendFontSize,
      fontFamily: '"Plus Jakarta Sans"',
    },
  };
}

// Keep backward compat
export const chartTheme = getChartTheme('dark');
export const darkChartOptions = getChartTheme('dark');
