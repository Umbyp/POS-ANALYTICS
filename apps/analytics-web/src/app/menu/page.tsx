'use client';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, AlertCircle, TrendingUp, Crown, Tag, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { api, formatCurrency } from '@/lib/api';
import { useStoreId } from '@/components/DashboardShell';
import { PageIntro } from '@/components/PageIntro';
import { InsightBanner, BannerAction } from '@/components/InsightBanner';
import { rowsToCsv, downloadCsv } from '@/lib/export';

// Plain-language labels instead of Stars/Dogs/Puzzles jargon
const QUADRANT_META: Record<
  string,
  {
    label: string;
    color: string;
    bg: string;
    border: string;
    oneLine: string;
    action: string;
    actionVerb: string;
    icon: any;
  }
> = {
  Star: {
    label: 'Stars',
    color: 'text-success',
    bg: 'bg-success/10',
    border: 'border-success/40',
    oneLine: 'High profit + sells well',
    action: 'Keep and promote as a signature — tag it "Popular" / post nice photos on social',
    actionVerb: 'Keep',
    icon: Crown,
  },
  Puzzle: {
    label: 'Potential',
    color: 'text-primary',
    bg: 'bg-primary/10',
    border: 'border-primary/40',
    oneLine: 'High profit but low sales',
    action: 'Push awareness — feature it on the menu, add to combos, 10% off at first',
    actionVerb: 'Promote',
    icon: TrendingUp,
  },
  Plowhorse: {
    label: 'Sells well, low margin',
    color: 'text-warning',
    bg: 'bg-warning/10',
    border: 'border-warning/40',
    oneLine: 'High sales + low per-unit profit',
    action: 'Raise price 5–10฿ or cut ingredient cost — customers already buy it, a small tweak adds a lot of profit',
    actionVerb: 'Reprice',
    icon: Tag,
  },
  Dog: {
    label: 'Drop candidates',
    color: 'text-danger',
    bg: 'bg-danger/10',
    border: 'border-danger/40',
    oneLine: 'Low sales + low profit',
    action: 'Consider removing / rebranding — simplifies the kitchen and avoids expiring stock',
    actionVerb: 'Consider dropping',
    icon: Trash2,
  },
};

export default function MenuEngineeringPage() {
  const storeId = useStoreId();
  const { data, isLoading, error } = useQuery({
    queryKey: ['menu-eng', storeId],
    queryFn: () =>
      api.get('/api/menu-engineering', { params: { store_id: storeId, days: 30 } }).then((r) => r.data),
    enabled: !!storeId,
  });

  const items = data?.items || [];
  const summary = data?.summary || {};
  const grouped: Record<string, any[]> = useMemo(() => {
    const g: Record<string, any[]> = { Star: [], Plowhorse: [], Puzzle: [], Dog: [] };
    for (const item of items) g[item.quadrant]?.push(item);
    // Sort each group by profit desc
    for (const k of Object.keys(g)) {
      g[k].sort((a, b) => (b.profit || 0) - (a.profit || 0));
    }
    return g;
  }, [items]);

  // Generate the most actionable banner based on data
  const banner = useMemo(() => {
    if (items.length === 0) return null;
    const plowhorses = grouped.Plowhorse || [];
    const dogs = grouped.Dog || [];
    const puzzles = grouped.Puzzle || [];

    // Highest opportunity = plowhorse (sell-well-but-low-margin)
    if (plowhorses.length >= 2) {
      const topPlow = plowhorses[0];
      const potentialUplift = plowhorses
        .slice(0, 3)
        .reduce((s, p) => s + (p.qty_sold || 0) * 5, 0); // 5 baht price bump x sold qty
      return {
        tone: 'warning' as const,
        title: `${plowhorses.length} items sell well but have low margin`,
        description: (
          <>
            Raising the price by 5฿ on the top 3 (starting with <strong>{topPlow.name}</strong>) could add about{' '}
            <strong>{formatCurrency(potentialUplift)}/month</strong> in profit with little impact on sales.
          </>
        ),
        metric: { label: 'Extra revenue/mo', value: `+${formatCurrency(potentialUplift)}` },
      };
    }

    if (dogs.length >= 3) {
      return {
        tone: 'critical' as const,
        title: `${dogs.length} items aren't making money`,
        description:
          "Low sales + low profit — consider removing or rebranding them to simplify the kitchen.",
      };
    }

    if (puzzles.length >= 2) {
      return {
        tone: 'info' as const,
        title: `${puzzles.length} high-profit items few people know about`,
        description:
          'Feature them on the menu, post on social, add to combos — high profit per plate, they just need visibility.',
      };
    }

    return {
      tone: 'good' as const,
      title: 'Your menu is well balanced',
      description: 'You have both star items and high-potential ones — keep the quality up and explore new trends.',
    };
  }, [items, grouped]);

  const exportAll = () => {
    const rows = items.map((i: any) => ({
      name: i.name,
      quadrant: QUADRANT_META[i.quadrant]?.label || i.quadrant,
      action: QUADRANT_META[i.quadrant]?.actionVerb || '',
      qty_sold: i.qty_sold,
      revenue: i.revenue,
      profit: i.profit,
      profit_margin_pct: i.profit_margin ? (i.profit_margin * 100).toFixed(1) : '',
    }));
    const csv = rowsToCsv(rows, [
      { label: 'Item', value: (r: any) => r.name },
      { label: 'Group', value: (r: any) => r.quadrant },
      { label: 'Action', value: (r: any) => r.action },
      { label: 'Sold (units)', value: (r: any) => r.qty_sold },
      { label: 'Revenue', value: (r: any) => r.revenue },
      { label: 'Profit', value: (r: any) => r.profit },
      { label: 'Margin (%)', value: (r: any) => r.profit_margin_pct },
    ]);
    downloadCsv(`menu-engineering-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  if (error) {
    return (
      <div className="p-6 space-y-5 max-w-screen-xl">
        <PageIntro
          title="Menu performance"
          whatItTells="See which items sell well and which actually make money"
          howToUse={[]}
        />
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-medium">Can&apos;t connect to the Analytics service</div>
            <div className="text-muted-foreground mt-1">Start analytics-api on port 8000 first</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-screen-xl">
      <PageIntro
        title="Menu performance"
        whatItTells="Splits every item into 4 groups by 2 axes — sells well or not, and high profit or not — so you instantly know what to do with each"
        howToUse={[
          'Read the tip box above — it tells you where to start',
          'Open the "Sells well, low margin" group — a 5–10฿ price bump usually works',
          'For the "Potential" group → run a promo or feature it on the menu',
          'Export CSV to bring to a meeting or share with the kitchen team',
        ]}
        tip={`Based on the last 30 days of sales · items selling more than ${
          summary.pop_threshold?.toFixed(0) || '?'
        } units = "sells well"`}
      />

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-3">
          <div className="shimmer h-24 rounded-lg" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="shimmer h-24 rounded-lg" />
            ))}
          </div>
        </div>
      )}

      {/* Insight banner */}
      {banner && !isLoading && (
        <InsightBanner
          tone={banner.tone}
          title={banner.title}
          description={banner.description}
          metric={banner.metric}
          actions={
            <>
              <Link href="/promotions">
                <BannerAction>
                  <Tag className="w-3.5 h-3.5" /> Create promotion
                </BannerAction>
              </Link>
              <BannerAction variant="outline" onClick={exportAll}>
                <Download className="w-3.5 h-3.5" /> Export all
              </BannerAction>
            </>
          }
        />
      )}

      {/* Quadrant summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['Star', 'Puzzle', 'Plowhorse', 'Dog'] as const).map((q) => {
          const meta = QUADRANT_META[q];
          const count = grouped[q].length;
          const Icon = meta.icon;
          return (
            <div key={q} className={`rounded-lg border p-4 ${meta.bg} ${meta.border}`}>
              <div className={`flex items-center gap-1.5 text-xs uppercase tracking-wider font-semibold ${meta.color}`}>
                <Icon className="w-3.5 h-3.5" />
                {meta.label}
              </div>
              <div className="text-2xl font-semibold tabular-nums mt-1.5">{count}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{meta.oneLine}</div>
            </div>
          );
        })}
      </div>

      {/* Detail per quadrant */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(['Star', 'Puzzle', 'Plowhorse', 'Dog'] as const).map((q) => {
          const meta = QUADRANT_META[q];
          const list = grouped[q] || [];
          const Icon = meta.icon;
          return (
            <div key={q} className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-md flex items-center justify-center ${meta.bg} ${meta.border} border`}
                  >
                    <Icon className={`w-4 h-4 ${meta.color}`} />
                  </div>
                  <div>
                    <h3 className={`text-sm font-semibold ${meta.color}`}>{meta.label}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{meta.oneLine}</p>
                  </div>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {list.length} items
                </span>
              </div>

              <div className="bg-muted/40 rounded-md p-2.5 mb-3 text-xs leading-relaxed">
                <span className="font-medium text-foreground">{meta.actionVerb}: </span>
                <span className="text-muted-foreground">{meta.action}</span>
              </div>

              {list.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">
                  No items in this group
                </p>
              ) : (
                <div className="space-y-1 max-h-80 overflow-y-auto scrollbar-thin">
                  {list.map((item: any) => {
                    const margin = item.profit_margin
                      ? (item.profit_margin * 100).toFixed(0)
                      : null;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 px-2 py-2 rounded hover:bg-card-hover/40"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{item.name}</div>
                          <div className="text-[10px] text-muted-foreground tabular-nums">
                            Sold {item.qty_sold}× · {formatCurrency(item.revenue || 0)}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-semibold tabular-nums">
                            {formatCurrency(item.profit || 0)}
                          </div>
                          {margin && (
                            <div className="text-[10px] text-muted-foreground tabular-nums">
                              {margin}% margin
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer export */}
      {items.length > 0 && (
        <div className="text-center pt-2">
          <button
            onClick={exportAll}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Download className="w-3.5 h-3.5" /> Export all to CSV ({items.length} items)
          </button>
        </div>
      )}
    </div>
  );
}
