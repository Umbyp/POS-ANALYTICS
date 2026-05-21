'use client';
import { cn } from '@/lib/api';

interface KpiCardProps {
  label: string;
  value: string;
  change?: number;
  icon?: React.ReactNode;  // ignored — kept for backward compatibility
  accent?: string;
  delay?: number;
}

export function KpiCard({ label, value, change }: KpiCardProps) {
  const positive = (change ?? 0) >= 0;
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-metric-md mt-1.5 tabular-nums truncate">{value}</div>
      {change !== undefined && (
        <div className="text-xs mt-2 tabular-nums">
          <span
            className={cn(
              'font-medium',
              positive ? 'text-success' : 'text-danger'
            )}
          >
            {positive ? '+' : ''}{change.toFixed(1)}%
          </span>
          <span className="text-muted-foreground ml-1.5">vs ช่วงก่อน</span>
        </div>
      )}
    </div>
  );
}

export function KpiSkeleton() {
  return <div className="shimmer rounded-lg h-28" />;
}
