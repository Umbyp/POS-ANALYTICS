'use client';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, AlertCircle, TrendingUp, Crown, Tag, Trash2, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { api, formatCurrency } from '@/lib/api';
import { useStoreId } from '@/components/DashboardShell';
import { PageIntro } from '@/components/PageIntro';
import { InsightBanner, BannerAction } from '@/components/InsightBanner';
import { rowsToCsv, downloadCsv } from '@/lib/export';
import { useT, useLang } from '@/lib/i18n';

/**
 * Explains a quadrant placement using the item's own numbers vs this store's
 * actual thresholds — not abstract theory, so a non-business-literate owner
 * can see exactly why (e.g. "45 units, above your 20-unit bar").
 */
function explainWhy(item: any, quadrant: string, summary: any, lang: 'th' | 'en'): string {
  const qty = item.qty_sold;
  const popTh = Math.round(summary.pop_threshold || 0);
  const profit = Math.round(item.profit_per_unit || 0);
  const profitTh = Math.round(summary.profit_threshold || 0);

  if (lang === 'th') {
    switch (quadrant) {
      case 'Star':
        return `ขายได้ ${qty} ชิ้นใน 30 วัน (มากกว่าเกณฑ์ขายดีของร้านคุณที่ ${popTh} ชิ้น) และกำไรต่อชิ้น ${profit} บาท (สูงกว่าค่ากลางร้านคุณที่ ${profitTh} บาท) — ขายดีและกำไรดีทั้งคู่ จึงจัดเป็นดาวเด่น`;
      case 'Puzzle':
        return `กำไรต่อชิ้น ${profit} บาท (สูงกว่าค่ากลางร้านคุณที่ ${profitTh} บาท) แต่ขายได้แค่ ${qty} ชิ้นใน 30 วัน (ต่ำกว่าเกณฑ์ขายดีที่ ${popTh} ชิ้น) — กำไรดีแต่คนยังสั่งน้อย`;
      case 'Plowhorse':
        return `ขายได้ ${qty} ชิ้นใน 30 วัน (มากกว่าเกณฑ์ขายดีที่ ${popTh} ชิ้น) แต่กำไรต่อชิ้นแค่ ${profit} บาท (ต่ำกว่าค่ากลางร้านคุณที่ ${profitTh} บาท) — ขายดีแต่ได้กำไรน้อยต่อชิ้น`;
      default:
        return `ขายได้แค่ ${qty} ชิ้นใน 30 วัน (ต่ำกว่าเกณฑ์ขายดีที่ ${popTh} ชิ้น) และกำไรต่อชิ้นก็แค่ ${profit} บาท (ต่ำกว่าค่ากลางร้านคุณที่ ${profitTh} บาท) — ทั้งขายน้อยและกำไรน้อย`;
    }
  }
  switch (quadrant) {
    case 'Star':
      return `Sold ${qty} units in 30 days (above your store's "sells well" threshold of ${popTh}) and profit per unit is ${profit}฿ (above your store's median of ${profitTh}฿) — sells well AND profitable, so it's a Star.`;
    case 'Puzzle':
      return `Profit per unit is ${profit}฿ (above your store's median of ${profitTh}฿) but only ${qty} units sold in 30 days (below the "sells well" threshold of ${popTh}) — good margin, just needs more orders.`;
    case 'Plowhorse':
      return `Sold ${qty} units in 30 days (above the "sells well" threshold of ${popTh}) but profit per unit is only ${profit}฿ (below your store's median of ${profitTh}฿) — sells well but thin margin.`;
    default:
      return `Only ${qty} units sold in 30 days (below the "sells well" threshold of ${popTh}) and profit per unit is just ${profit}฿ (below your store's median of ${profitTh}฿) — low sales and low margin.`;
  }
}

const QUADRANT_STYLE: Record<
  string,
  { color: string; bg: string; border: string; icon: any }
> = {
  Star: { color: 'text-success', bg: 'bg-success/10', border: 'border-success/40', icon: Crown },
  Puzzle: { color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/40', icon: TrendingUp },
  Plowhorse: { color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/40', icon: Tag },
  Dog: { color: 'text-danger', bg: 'bg-danger/10', border: 'border-danger/40', icon: Trash2 },
};

function useQuadrantMeta() {
  const t = useT();
  return (q: string) => ({
    ...QUADRANT_STYLE[q],
    label: t(`menu.q.${q}.label`),
    oneLine: t(`menu.q.${q}.oneLine`),
    action: t(`menu.q.${q}.action`),
    actionVerb: t(`menu.q.${q}.actionVerb`),
  });
}

export default function MenuEngineeringPage() {
  const t = useT();
  const { lang } = useLang();
  const quadrantMeta = useQuadrantMeta();
  const storeId = useStoreId();
  const [explainId, setExplainId] = useState<string | null>(null);
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
        title: `${plowhorses.length} ${t('menu.plowBannerTitleSuffix')}`,
        description: (
          <>
            {t('menu.plowBannerDesc1')} <strong>{topPlow.name}</strong>{t('menu.plowBannerDesc2')}{' '}
            <strong>{formatCurrency(potentialUplift)}</strong>{t('menu.plowBannerDesc3')}
          </>
        ),
        metric: { label: t('menu.extraRevenueMo'), value: `+${formatCurrency(potentialUplift)}` },
      };
    }

    if (dogs.length >= 3) {
      return {
        tone: 'critical' as const,
        title: `${dogs.length} ${t('menu.dogBannerTitleSuffix')}`,
        description: t('menu.dogBannerDesc'),
      };
    }

    if (puzzles.length >= 2) {
      return {
        tone: 'info' as const,
        title: `${puzzles.length} ${t('menu.puzzleBannerTitleSuffix')}`,
        description: t('menu.puzzleBannerDesc'),
      };
    }

    return {
      tone: 'good' as const,
      title: t('menu.balancedTitle'),
      description: t('menu.balancedDesc'),
    };
  }, [items, grouped, t]);

  const exportAll = () => {
    const rows = items.map((i: any) => ({
      name: i.name,
      quadrant: quadrantMeta(i.quadrant)?.label || i.quadrant,
      action: quadrantMeta(i.quadrant)?.actionVerb || '',
      qty_sold: i.qty_sold,
      revenue: i.revenue,
      profit: i.profit,
      profit_margin_pct: i.margin != null ? i.margin.toFixed(1) : '',
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
          title={t('menu.title')}
          whatItTells={t('menu.whatItTells')}
          howToUse={[]}
        />
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-medium">{t('menu.cantConnect')}</div>
            <div className="text-muted-foreground mt-1">{t('menu.startAnalyticsApi')}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-screen-xl">
      <PageIntro
        title={t('menu.title')}
        whatItTells={t('menu.subtitle')}
        howToUse={[t('menu.tip1'), t('menu.tip2'), t('menu.tip3'), t('menu.tip4')]}
        tip={`${t('menu.tipBase')} ${summary.pop_threshold?.toFixed(0) || '?'} ${t('menu.tipSuffix')}`}
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
                  <Tag className="w-3.5 h-3.5" /> {t('menu.createPromo')}
                </BannerAction>
              </Link>
              <BannerAction variant="outline" onClick={exportAll}>
                <Download className="w-3.5 h-3.5" /> {t('menu.exportAll')}
              </BannerAction>
            </>
          }
        />
      )}

      {/* Quadrant summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['Star', 'Puzzle', 'Plowhorse', 'Dog'] as const).map((q) => {
          const meta = quadrantMeta(q);
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
          const meta = quadrantMeta(q);
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
                  {list.length} {t('menu.items')}
                </span>
              </div>

              <div className="bg-muted/40 rounded-md p-2.5 mb-3 text-xs leading-relaxed">
                <span className="font-medium text-foreground">{meta.actionVerb}: </span>
                <span className="text-muted-foreground">{meta.action}</span>
              </div>

              {list.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">
                  {t('menu.noItemsInGroup')}
                </p>
              ) : (
                <div className="space-y-1 max-h-80 overflow-y-auto scrollbar-thin">
                  {list.map((item: any) => {
                    const margin = item.margin != null ? item.margin.toFixed(0) : null;
                    const isOpen = explainId === item.id;
                    return (
                      <div key={item.id} className="rounded hover:bg-card-hover/40">
                        <div className="flex items-center justify-between gap-3 px-2 py-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{item.name}</div>
                            <div className="text-[10px] text-muted-foreground tabular-nums">
                              {t('menu.sold')} {item.qty_sold}× · {formatCurrency(item.revenue || 0)}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-semibold tabular-nums">
                              {formatCurrency(item.profit || 0)}
                            </div>
                            {margin && (
                              <div className="text-[10px] text-muted-foreground tabular-nums">
                                {margin}{t('menu.marginSuffix')}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => setExplainId(isOpen ? null : item.id)}
                            className="shrink-0 text-muted-foreground/60 hover:text-primary transition-colors p-1 -m-1"
                            title={t('menu.why.toggle')}
                            aria-label={t('menu.why.toggle')}
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {isOpen && (
                          <div className="mx-2 mb-2 px-2.5 py-2 rounded-md bg-muted/50 text-[11px] text-muted-foreground leading-relaxed">
                            {explainWhy(item, q, summary, lang)}
                          </div>
                        )}
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
            <Download className="w-3.5 h-3.5" /> {t('menu.exportAllCsv')} ({items.length} {t('menu.items')})
          </button>
        </div>
      )}
    </div>
  );
}
