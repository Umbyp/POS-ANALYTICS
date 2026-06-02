'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Loader2,
  AlertCircle,
  Tag,
  Copy,
  ChevronDown,
  Sparkles,
  ShoppingBasket,
  Clock,
  UserPlus,
  TrendingUp,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useStoreId } from '@/components/DashboardShell';
import { PageIntro } from '@/components/PageIntro';
import { copyToClipboard } from '@/lib/export';

const TYPE_META: Record<
  string,
  { label: string; icon: any; color: string; bg: string }
> = {
  BUNDLE: {
    label: 'Bundle / Combo',
    icon: ShoppingBasket,
    color: 'text-primary',
    bg: 'bg-primary/10 border-primary/30',
  },
  HAPPY_HOUR: {
    label: 'Happy hour',
    icon: Clock,
    color: 'text-warning',
    bg: 'bg-warning/10 border-warning/30',
  },
  WINBACK: {
    label: 'Win back customers',
    icon: UserPlus,
    color: 'text-danger',
    bg: 'bg-danger/10 border-danger/30',
  },
  PRICE_UP: {
    label: 'Price increase',
    icon: TrendingUp,
    color: 'text-success',
    bg: 'bg-success/10 border-success/30',
  },
  PROMOTE: {
    label: 'Promote item',
    icon: Sparkles,
    color: 'text-primary',
    bg: 'bg-primary/10 border-primary/30',
  },
};

export default function PromotionsPage() {
  const storeId = useStoreId();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [copyMsg, setCopyMsg] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['promo-recommend', storeId],
    queryFn: () =>
      api.get('/api/promotions/recommend', { params: { store_id: storeId } }).then((r) => r.data),
    enabled: !!storeId,
  });

  const suggestions = data?.suggestions || [];

  const showToast = (text: string) => {
    setCopyMsg(text);
    setTimeout(() => setCopyMsg(''), 2500);
  };

  const copyConfig = async (config: any) => {
    const json = JSON.stringify(config, null, 2);
    const ok = await copyToClipboard(json);
    if (ok) showToast('Promotion config copied');
  };

  if (error) {
    return (
      <div className="p-6 space-y-5 max-w-4xl">
        <PageIntro
          title="Promotion ideas"
          whatItTells="AI reviews your store data and suggests promotions likely to work"
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
    <div className="p-6 space-y-5 max-w-4xl">
      <PageIntro
        title="Promotion ideas"
        whatItTells="AI reviews your store data and suggests promotions likely to work — with the reasoning and expected impact"
        howToUse={[
          'Read a suggestion → click "How to set it up" → copy the JSON config',
          'Go to POS Settings → Promotions → create a new promotion from the copied values',
          'Try one or two at a time, then compare sales week-over-week',
        ]}
        tip="Uses your real sales data — the longer you collect, the sharper the suggestions"
      />

      {isLoading && (
        <div className="space-y-3">
          <div className="shimmer h-32 rounded-lg" />
          <div className="shimmer h-32 rounded-lg" />
          <div className="shimmer h-32 rounded-lg" />
        </div>
      )}

      {!isLoading && suggestions.length === 0 && (
        <div className="bg-card border border-border rounded-lg p-10 text-center">
          <Sparkles className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <div className="font-medium mb-1">No suggestions yet</div>
          <div className="text-sm text-muted-foreground max-w-md mx-auto">
            Needs at least 2–4 weeks of sales data. Keep collecting,
            or check back once the store has been running for a while.
          </div>
        </div>
      )}

      {/* Suggestion cards */}
      <div className="space-y-3">
        {suggestions.map((s: any, i: number) => {
          const meta = TYPE_META[s.type] || {
            label: s.type,
            icon: Tag,
            color: 'text-foreground',
            bg: 'bg-muted',
          };
          const Icon = meta.icon;
          const isOpen = expanded === i;

          return (
            <div key={i} className="bg-card border border-border rounded-lg overflow-hidden">
              {/* Header */}
              <div className="p-5">
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${meta.bg}`}
                  >
                    <Icon className={`w-5 h-5 ${meta.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[10px] uppercase tracking-wider font-semibold ${meta.color}`}>
                      {meta.label}
                    </div>
                    <h3 className="text-base font-semibold mt-0.5">{s.title}</h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                      Why recommended
                    </div>
                    <div className="text-sm leading-relaxed">{s.reason}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                      Expected impact
                    </div>
                    <div className="text-sm text-success font-medium">{s.estimated_impact}</div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                  {s.config && (
                    <>
                      <button
                        onClick={() => copyConfig(s.config)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary-600 text-xs font-medium"
                      >
                        <Copy className="w-3.5 h-3.5" /> Copy config
                      </button>
                      <button
                        onClick={() => setExpanded(isOpen ? null : i)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border hover:bg-card-hover text-xs font-medium"
                      >
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                        How to set it up
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Expanded config + walkthrough */}
              {isOpen && s.config && (
                <div className="border-t border-border bg-muted/30 p-5 space-y-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                      Steps
                    </div>
                    <ol className="text-sm space-y-1.5 list-decimal list-inside leading-relaxed">
                      <li>Open POS → Settings → Promotions</li>
                      <li>Click &quot;Add promotion&quot;</li>
                      <li>Fill in the values below (copy each field from the JSON)</li>
                      <li>Save, then test it on the POS screen</li>
                    </ol>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Values to enter
                      </div>
                      <button
                        onClick={() => copyConfig(s.config)}
                        className="text-[11px] text-primary hover:underline flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" /> Copy
                      </button>
                    </div>
                    <pre className="text-[11px] bg-card border border-border rounded-md p-3 overflow-x-auto font-mono">
                      {JSON.stringify(s.config, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Toast */}
      {copyMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background px-4 py-2 rounded-lg shadow-lg text-sm">
          {copyMsg}
        </div>
      )}
    </div>
  );
}
