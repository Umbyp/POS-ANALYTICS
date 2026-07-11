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
import { useT, useLang } from '@/lib/i18n';

const TYPE_STYLE: Record<string, { icon: any; color: string; bg: string }> = {
  BUNDLE: { icon: ShoppingBasket, color: 'text-primary', bg: 'bg-primary/10 border-primary/30' },
  HAPPY_HOUR: { icon: Clock, color: 'text-warning', bg: 'bg-warning/10 border-warning/30' },
  WINBACK: { icon: UserPlus, color: 'text-danger', bg: 'bg-danger/10 border-danger/30' },
  PRICE_UP: { icon: TrendingUp, color: 'text-success', bg: 'bg-success/10 border-success/30' },
  PROMOTE: { icon: Sparkles, color: 'text-primary', bg: 'bg-primary/10 border-primary/30' },
};

export default function PromotionsPage() {
  const t = useT();
  const { lang } = useLang();
  const storeId = useStoreId();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [copyMsg, setCopyMsg] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['promo-recommend', storeId, lang],
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
    if (ok) showToast(t('promo.configCopied'));
  };

  if (error) {
    return (
      <div className="p-6 space-y-5 max-w-4xl">
        <PageIntro
          title={t('promo.title')}
          whatItTells={t('promo.whatItTellsShort')}
          howToUse={[]}
        />
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-medium">{t('promo.cantConnect')}</div>
            <div className="text-muted-foreground mt-1">{t('promo.startAnalyticsApi')}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <PageIntro
        title={t('promo.title')}
        whatItTells={t('promo.subtitle')}
        howToUse={[t('promo.tip1'), t('promo.tip2'), t('promo.tip3')]}
        tip={t('promo.footnote')}
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
          <div className="font-medium mb-1">{t('promo.noSuggestionsYet')}</div>
          <div className="text-sm text-muted-foreground max-w-md mx-auto">
            {t('promo.noSuggestionsDesc')}
          </div>
        </div>
      )}

      {/* Suggestion cards */}
      <div className="space-y-3">
        {suggestions.map((s: any, i: number) => {
          const style = TYPE_STYLE[s.type] || { icon: Tag, color: 'text-foreground', bg: 'bg-muted' };
          const meta = { ...style, label: t(`promo.type.${s.type}`, s.type) };
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
                      {t('promo.whyRecommended')}
                    </div>
                    <div className="text-sm leading-relaxed">{s.reason}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                      {t('promo.expectedImpact')}
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
                        <Copy className="w-3.5 h-3.5" /> {t('promo.copyConfig')}
                      </button>
                      <button
                        onClick={() => setExpanded(isOpen ? null : i)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border hover:bg-card-hover text-xs font-medium"
                      >
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                        {t('promo.howToSetUp')}
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
                      {t('promo.steps')}
                    </div>
                    <ol className="text-sm space-y-1.5 list-decimal list-inside leading-relaxed">
                      <li>{t('promo.step1')}</li>
                      <li>{t('promo.step2')}</li>
                      <li>{t('promo.step3')}</li>
                      <li>{t('promo.step4')}</li>
                    </ol>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {t('promo.valuesToEnter')}
                      </div>
                      <button
                        onClick={() => copyConfig(s.config)}
                        className="text-[11px] text-primary hover:underline flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" /> {t('cust.copy')}
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
