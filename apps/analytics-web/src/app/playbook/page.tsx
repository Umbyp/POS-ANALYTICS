'use client';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Info,
  RefreshCw,
} from 'lucide-react';
import { api, cn } from '@/lib/api';
import { useStoreId } from '@/components/DashboardShell';
import { PageIntro } from '@/components/PageIntro';
import { useT, useLang } from '@/lib/i18n';

const PRIORITY_META: Record<
  string,
  { labelKey: string; tone: string; bg: string; border: string; icon: any; iconColor: string }
> = {
  high: {
    labelKey: 'pb.priority.high',
    tone: 'text-danger',
    bg: 'bg-danger/5',
    border: 'border-l-danger border-danger/30',
    icon: AlertTriangle,
    iconColor: 'text-danger',
  },
  medium: {
    labelKey: 'pb.priority.medium',
    tone: 'text-warning',
    bg: 'bg-warning/5',
    border: 'border-l-warning border-warning/30',
    icon: AlertCircle,
    iconColor: 'text-warning',
  },
  low: {
    labelKey: 'pb.priority.low',
    tone: 'text-muted-foreground',
    bg: 'bg-card',
    border: 'border-l-border border-border',
    icon: Info,
    iconColor: 'text-primary',
  },
};

export default function PlaybookPage() {
  const t = useT();
  const { lang } = useLang();
  const storeId = useStoreId();
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['playbook', storeId, lang],
    queryFn: () => api.get('/api/playbook', { params: { store_id: storeId } }).then((r) => r.data),
    enabled: !!storeId,
    refetchInterval: 5 * 60_000,
  });

  const actions = data?.actions || [];
  const summary = data?.summary || {};
  const highCount = actions.filter((a: any) => a.priority === 'high').length;
  const mediumCount = actions.filter((a: any) => a.priority === 'medium').length;
  const lowCount = actions.filter((a: any) => a.priority === 'low').length;

  // Group actions by priority for cleaner layout
  const grouped = useMemo(() => {
    return {
      high: actions.filter((a: any) => a.priority === 'high'),
      medium: actions.filter((a: any) => a.priority === 'medium'),
      low: actions.filter((a: any) => a.priority === 'low'),
    };
  }, [actions]);

  if (error) {
    return (
      <div className="p-6 space-y-5 max-w-4xl">
        <PageIntro title={t('pb.title')} whatItTells={t('pb.subtitle')} howToUse={[]} />
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-medium">{t('pb.cantConnect')}</div>
            <div className="text-muted-foreground mt-1">{t('pb.startAnalyticsApi')}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <PageIntro
        title={t('pb.title')}
        whatItTells={t('pb.subtitle')}
        howToUse={[t('pb.bulletHigh'), t('pb.bulletMedium'), t('pb.bulletLow')]}
        tip={t('pb.updateHint')}
      />

      {/* Summary header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          {highCount === 0 && mediumCount === 0 && lowCount === 0 ? (
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 className="w-4 h-4" />
              {t('pb.allClear')}
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              {highCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-danger/10 text-danger text-xs font-medium">
                  <AlertTriangle className="w-3 h-3" /> {t('pb.priority.high')} {highCount}
                </span>
              )}
              {mediumCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-warning/10 text-warning text-xs font-medium">
                  <AlertCircle className="w-3 h-3" /> {t('pb.priority.medium')} {mediumCount}
                </span>
              )}
              {lowCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-muted-foreground text-xs font-medium">
                  <Info className="w-3 h-3" /> {t('pb.priority.low')} {lowCount}
                </span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card hover:bg-card-hover text-xs"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} /> {t('pb.refresh')}
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="shimmer h-24 rounded-lg" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && actions.length === 0 && (
        <div className="bg-card border border-border rounded-lg p-10 text-center">
          <CheckCircle2 className="w-12 h-12 mx-auto text-success mb-3 opacity-60" />
          <div className="font-semibold mb-1">{t('pb.allDone')}</div>
          <div className="text-sm text-muted-foreground">
            {t('pb.checkBackLater')}
          </div>
        </div>
      )}

      {/* Grouped actions */}
      {(['high', 'medium', 'low'] as const).map((prio) => {
        const list = grouped[prio];
        if (list.length === 0) return null;
        const meta = PRIORITY_META[prio];
        const PrioIcon = meta.icon;

        return (
          <div key={prio} className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <PrioIcon className={cn('w-4 h-4', meta.iconColor)} />
              <h3 className={cn('text-xs font-semibold uppercase tracking-wider', meta.tone)}>
                {t(meta.labelKey)}
              </h3>
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">{list.length} {t('pb.items')}</span>
            </div>

            {list.map((a: any, i: number) => (
              <div
                key={`${prio}-${i}`}
                className={cn(
                  'bg-card border rounded-lg p-4 border-l-[3px]',
                  meta.border,
                  meta.bg
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="text-xl shrink-0">{a.icon}</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm">{a.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      {a.description}
                    </p>
                    {a.action && (
                      <div className="mt-3 pt-3 border-t border-border/60 flex items-start gap-2 text-sm">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-0.5 shrink-0">
                          {t('pb.do')}
                        </span>
                        <span className="text-foreground/90">{a.action}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
