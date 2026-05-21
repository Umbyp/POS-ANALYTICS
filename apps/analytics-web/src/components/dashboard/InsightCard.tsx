'use client';
import { cn } from '@/lib/api';

const SEVERITY_COLOR: Record<string, string> = {
  INFO: 'bg-primary',
  WARNING: 'bg-warning',
  CRITICAL: 'bg-danger',
  GOOD: 'bg-success',
};

export function InsightCard({ insight }: { insight: any; delay?: number }) {
  const dot = SEVERITY_COLOR[insight.severity] || 'bg-muted-foreground';
  return (
    <div className="flex items-start gap-3 p-3 rounded-md bg-card-hover/40 border border-border">
      <span className={cn('w-1.5 h-1.5 rounded-full mt-2 shrink-0', dot)} />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{insight.title}</div>
        {insight.description && (
          <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {insight.description}
          </div>
        )}
      </div>
    </div>
  );
}
