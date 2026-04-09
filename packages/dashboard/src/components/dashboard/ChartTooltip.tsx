import type { TooltipProps } from 'recharts';
import { DARK_THEME, LIGHT_THEME } from '@/lib/chart-theme';

interface ChartTooltipProps extends TooltipProps<number, string> {
  isDark: boolean;
  valueFormatter?: (value: number) => string;
}

export function ChartTooltip({ active, payload, label, isDark, valueFormatter }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const theme = isDark ? DARK_THEME : LIGHT_THEME;
  const format = valueFormatter ?? ((v: number) => v.toLocaleString());

  return (
    <div
      style={{
        backgroundColor: theme.tooltipBg,
        border: `1px solid ${theme.tooltipBorder}`,
        color: theme.tooltipText,
        borderRadius: '8px',
        padding: '10px 14px',
        fontSize: '13px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      }}
    >
      <p style={{ margin: '0 0 6px', fontWeight: 500, opacity: 0.7, fontSize: '12px' }}>
        {label}
      </p>
      {payload.map((entry, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: i > 0 ? '4px' : 0,
          }}
        >
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: entry.color,
              flexShrink: 0,
            }}
          />
          <span style={{ opacity: 0.7 }}>{entry.name}</span>
          <span style={{ marginLeft: 'auto', fontWeight: 600 }}>
            {format(entry.value as number)}
          </span>
        </div>
      ))}
    </div>
  );
}
