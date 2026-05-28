'use client';
import { ReactNode } from 'react';
import { Lightbulb, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/api';

type Tone = 'info' | 'good' | 'warning' | 'critical';

const TONE_STYLES: Record<Tone, { bg: string; border: string; icon: any; iconColor: string }> = {
  info:     { bg: 'bg-primary/5',   border: 'border-primary/30',   icon: Lightbulb,      iconColor: 'text-primary' },
  good:     { bg: 'bg-success/5',   border: 'border-success/30',   icon: CheckCircle2,   iconColor: 'text-success' },
  warning:  { bg: 'bg-warning/5',   border: 'border-warning/30',   icon: TrendingUp,     iconColor: 'text-warning' },
  critical: { bg: 'bg-danger/5',    border: 'border-danger/30',    icon: AlertTriangle,  iconColor: 'text-danger' },
};

/**
 * Insight banner — surfaces the *one thing* a user should do based on the data
 * on the current page. Always has a clear headline + concrete action.
 *
 *   <InsightBanner
 *     tone="warning"
 *     title="ลูกค้า 12 คนกำลังจะหาย"
 *     description="ไม่กลับมาเกิน 60 วัน — แนะนำส่ง SMS ส่วนลด 10%"
 *     actions={<Button>...</Button>}
 *   />
 */
export function InsightBanner({
  tone = 'info',
  title,
  description,
  actions,
  metric,
}: {
  tone?: Tone;
  title: string;
  description: string | ReactNode;
  actions?: ReactNode;
  /** Big number / KPI on the right */
  metric?: { label: string; value: string };
}) {
  const meta = TONE_STYLES[tone];
  const Icon = meta.icon;

  return (
    <div className={cn('rounded-lg border p-4 flex flex-col sm:flex-row gap-4 items-start', meta.bg, meta.border)}>
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', meta.bg, 'border', meta.border)}>
        <Icon className={cn('w-5 h-5', meta.iconColor)} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-xs text-muted-foreground leading-relaxed mt-0.5">{description}</div>
        {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
      </div>

      {metric && (
        <div className="text-right shrink-0 sm:border-l sm:border-border sm:pl-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{metric.label}</div>
          <div className={cn('text-2xl font-bold tabular-nums mt-0.5', meta.iconColor)}>{metric.value}</div>
        </div>
      )}
    </div>
  );
}

/**
 * Pre-styled action button used inside InsightBanner.actions
 */
export function BannerAction({
  children,
  onClick,
  variant = 'primary',
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'outline';
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50',
        variant === 'primary'
          ? 'bg-primary text-primary-foreground hover:bg-primary-600 shadow-sm'
          : 'bg-card border border-border hover:bg-card-hover text-foreground'
      )}
    >
      {children}
    </button>
  );
}
