'use client';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/api';

interface KpiCardProps {
  label: string;
  value: string;
  change?: number;
  /** Tiny inline sparkline data (last 7-14 points), optional */
  sparkline?: number[];
  icon?: React.ReactNode;  // ignored — kept for backward compatibility
  accent?: string;
  delay?: number;
}

export function KpiCard({ label, value, change, sparkline, icon, accent }: KpiCardProps) {
  const hasChange = change !== undefined && change !== null;
  const positive = (change ?? 0) > 0.1;
  const negative = (change ?? 0) < -0.1;
  const TrendIcon = positive ? TrendingUp : negative ? TrendingDown : Minus;

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col shadow-card hover:shadow-card-hover transition-shadow">
      {/* Top row: icon chip + trend badge (Power-BI style tile) */}
      <div className="flex items-center justify-between gap-2 mb-3">
        {icon ? (
          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', accent || 'bg-primary/10 text-primary')}>
            {icon}
          </div>
        ) : (
          <span />
        )}
        {hasChange && (
          <div
            className={cn(
              'flex items-center gap-0.5 text-[11px] font-semibold tabular-nums px-2 py-1 rounded-full',
              positive
                ? 'bg-success/10 text-success'
                : negative
                ? 'bg-danger/10 text-danger'
                : 'bg-muted text-muted-foreground'
            )}
          >
            <TrendIcon className="w-3 h-3" />
            {positive ? '+' : ''}
            {(change ?? 0).toFixed(1)}%
          </div>
        )}
      </div>

      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-metric-md mt-1 tabular-nums truncate font-semibold">{value}</div>

      {/* Sparkline */}
      {sparkline && sparkline.length >= 2 && (
        <Sparkline data={sparkline} positive={positive} negative={negative} />
      )}

      {hasChange && (
        <div className="text-[10px] text-muted-foreground mt-1.5">vs previous period</div>
      )}
    </div>
  );
}

function Sparkline({ data, positive, negative }: { data: number[]; positive: boolean; negative: boolean }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const W = 100;
  const H = 24;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - ((v - min) / range) * (H - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const color = positive ? '#16A34A' : negative ? '#DC2626' : '#94A3B8';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-6 mt-2 opacity-70" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export function KpiSkeleton() {
  return <div className="shimmer rounded-lg h-28" />;
}
