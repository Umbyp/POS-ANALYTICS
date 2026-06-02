'use client';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Download, Copy, MessageSquare, Sparkles, AlertCircle } from 'lucide-react';
import { api, formatCurrency } from '@/lib/api';
import { useStoreId } from '@/components/DashboardShell';
import { PageIntro } from '@/components/PageIntro';
import { InsightBanner, BannerAction } from '@/components/InsightBanner';
import { rowsToCsv, downloadCsv, copyToClipboard } from '@/lib/export';

// Friendly labels for each RFM segment, plus a concrete playbook
const SEGMENT_TRANSLATIONS: Record<
  string,
  { label: string; desc: string; playbook: string; smsTemplate?: string }
> = {
  Champion: {
    label: 'VIP customers',
    desc: 'Visit often, spend a lot, bought recently',
    playbook: 'Thank them personally + early access to new promos + special gifts — keep them around for the long run',
    smsTemplate: 'Thank you {name} for always supporting {store} 🙏 Enjoy a special 15% off for your birthday — just show this SMS',
  },
  Loyal: {
    label: 'Regulars',
    desc: 'Come back regularly, attached to the store',
    playbook: 'Send special promos + ask for reviews/referrals + invite to the loyalty program',
    smsTemplate: '🎉 Thanks for being a regular! Get a free [item] when you spend ฿200, through the end of this month',
  },
  'Big Spender': {
    label: 'Big spenders',
    desc: 'Spend a lot per visit, but maybe not often',
    playbook: 'Offer premium items + gifts for large orders — encourage more frequent visits',
    smsTemplate: 'Hosting an event/party? We have a special set for you {name} — 10% off orders over ฿1,000',
  },
  New: {
    label: 'New customers',
    desc: 'Just bought for the first time — get them to return',
    playbook: 'Send a 2nd-visit coupon within 7 days — boosts return rate to 30–40%',
    smsTemplate: 'Welcome {name}! 🎁 ฿50 off your next visit — valid for 14 days',
  },
  Promising: {
    label: 'Promising',
    desc: 'Visited 2–3 times, becoming a regular',
    playbook: 'Invite them to sign up + send personalized recommendations',
    smsTemplate: 'Join {store} today and get a free [item] + earn points: ฿1 = 1 point',
  },
  'At Risk': {
    label: 'At risk',
    desc: "Haven't visited in 3–6 months — win them back fast",
    playbook: 'Send a strong coupon (20–30% off) now — wait too long and they may not return',
    smsTemplate: 'We miss you {name}! We saved a special deal for you — 20% off next time, show this SMS in store',
  },
  Hibernating: {
    label: 'Long gone',
    desc: "Haven't visited in 6–12 months — try a win-back coupon",
    playbook: 'Win-back campaign 30–40% off + a gift — last try; if they don\'t return, drop from the list',
    smsTemplate: '{name}, come back 💕 30% off just for you, one-time use within 30 days',
  },
  Lost: {
    label: 'Likely churned',
    desc: 'No visit in over a year — keep or let go',
    playbook: 'On a tight budget? Drop them for now — keep only the ones who used to spend a lot',
  },
  'Never Bought': {
    label: 'Never purchased',
    desc: 'In the system but no orders',
    playbook: 'Send an intro offer + explain what other customers love',
  },
};

export default function CustomersPage() {
  const storeId = useStoreId();
  const [selectedSeg, setSelectedSeg] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['rfm', storeId],
    queryFn: () => api.get('/api/segments/rfm', { params: { store_id: storeId } }).then((r) => r.data),
    enabled: !!storeId,
  });

  const { data: clv } = useQuery({
    queryKey: ['clv', storeId],
    queryFn: () => api.get('/api/segments/clv', { params: { store_id: storeId } }).then((r) => r.data),
    enabled: !!storeId,
  });

  const segments = data?.segments || [];
  const customers = data?.customers || [];
  const summary = data?.summary || {};

  const filtered = useMemo(
    () => (selectedSeg ? customers.filter((c: any) => c.segment === selectedSeg) : customers),
    [customers, selectedSeg]
  );

  const atRiskList = useMemo(
    () => customers.filter((c: any) => c.segment === 'At Risk' || c.segment === 'Hibernating'),
    [customers]
  );

  const showCopyToast = (text: string) => {
    setCopyToast(text);
    setTimeout(() => setCopyToast(''), 2500);
  };

  const exportFiltered = () => {
    const rows = filtered.map((c: any) => ({
      name: c.name,
      phone: c.phone || '',
      email: c.email || '',
      segment: SEGMENT_TRANSLATIONS[c.segment]?.label || c.segment,
      visits: c.frequency,
      total_spent: c.monetary,
      last_visit_days_ago: c.recency_days ?? '',
      points: c.points,
    }));
    const csv = rowsToCsv(rows, [
      { label: 'Name', value: (r: any) => r.name },
      { label: 'Phone', value: (r: any) => r.phone },
      { label: 'Email', value: (r: any) => r.email },
      { label: 'Segment', value: (r: any) => r.segment },
      { label: 'Visits', value: (r: any) => r.visits },
      { label: 'Total spent', value: (r: any) => r.total_spent },
      { label: 'Last visit (days ago)', value: (r: any) => r.last_visit_days_ago },
      { label: 'Points', value: (r: any) => r.points },
    ]);
    const segPart = selectedSeg ? `-${selectedSeg}` : '-all';
    downloadCsv(`customers${segPart}-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    showCopyToast(`Exported ${rows.length} customers`);
  };

  const copySmsTemplate = async (segment: string) => {
    const tpl = SEGMENT_TRANSLATIONS[segment]?.smsTemplate;
    if (!tpl) return;
    const ok = await copyToClipboard(tpl);
    if (ok) showCopyToast('SMS message copied');
  };

  const copyPhoneList = async () => {
    const phones = filtered.map((c: any) => c.phone).filter(Boolean).join(', ');
    if (!phones) return;
    const ok = await copyToClipboard(phones);
    if (ok) showCopyToast(`Copied ${phones.split(',').length} phone numbers`);
  };

  return (
    <div className="p-6 space-y-5 max-w-screen-xl">
      <PageIntro
        title="Customers"
        whatItTells="Auto-groups customers from 3 signals: how often they visit, how much they spend, and how recently they bought (RFM)"
        howToUse={[
          'Check "What to do next" in the yellow box below — it tells you who to focus on first',
          'Click a group → see the list + copy an SMS message / Export CSV for a campaign',
          'Focus on "At risk" + "Long gone" — highest ROI since they already know your store',
        ]}
        tip="Tip: run an SMS campaign every 2 weeks for the At-risk group"
      />

      {/* Error state */}
      {error && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-medium">Can&apos;t connect to the Analytics service</div>
            <div className="text-muted-foreground mt-1">
              Run{' '}
              <code className="bg-card border border-border px-1.5 py-0.5 rounded text-xs">
                cd apps/analytics-api &amp;&amp; uvicorn app.main:app --port 8000
              </code>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="shimmer h-24 rounded-lg" />
          ))}
        </div>
      )}

      {/* Top-priority action banner — tells the user what to do first */}
      {!isLoading && atRiskList.length > 0 && (
        <InsightBanner
          tone="warning"
          title={`${atRiskList.length} customers are slipping away`}
          description={
            <>
              Customers in <strong>At risk + Long gone</strong> who haven&apos;t returned in 3+ months —{' '}
              send an SMS coupon now and 15–25% may come back (vs ~2% for new customers).
            </>
          }
          metric={{ label: 'Customers', value: String(atRiskList.length) }}
          actions={
            <>
              <BannerAction
                onClick={() => {
                  setSelectedSeg('At Risk');
                  document.getElementById('customer-table')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <Sparkles className="w-3.5 h-3.5" /> View At-risk list
              </BannerAction>
              <BannerAction variant="outline" onClick={() => copySmsTemplate('At Risk')}>
                <MessageSquare className="w-3.5 h-3.5" /> Copy SMS message
              </BannerAction>
            </>
          }
        />
      )}

      {/* CLV stats */}
      {clv && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Total customers" value={clv.total_customers.toString()} />
          <Stat label="Avg spend / customer" value={formatCurrency(clv.avg_clv)} />
          <Stat label="VIP" value={(summary.champions || 0).toString()} tone="success" />
          <Stat label="At risk" value={(summary.at_risk || 0).toString()} tone="warning" />
        </div>
      )}

      {/* Segments — list of cards, friendly */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Pick a group to see the list
          </div>
          {selectedSeg && (
            <button
              onClick={() => setSelectedSeg(null)}
              className="text-xs text-primary hover:underline"
            >
              Clear filter
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
          <button
            onClick={() => setSelectedSeg(null)}
            className={`text-left p-3 rounded-lg border transition-colors ${
              !selectedSeg
                ? 'border-primary bg-primary/5'
                : 'border-border bg-card hover:bg-card-hover/60'
            }`}
          >
            <div className="text-xs text-muted-foreground">All</div>
            <div className="text-xl font-semibold tabular-nums mt-1">{summary.total || customers.length}</div>
            <div className="text-[10px] text-muted-foreground mt-1">All customer groups</div>
          </button>
          {segments.map((s: any) => {
            const t = SEGMENT_TRANSLATIONS[s.segment] || { label: s.segment, desc: s.action };
            return (
              <button
                key={s.segment}
                onClick={() => setSelectedSeg(s.segment === selectedSeg ? null : s.segment)}
                className={`text-left p-3 rounded-lg border transition-colors relative ${
                  selectedSeg === s.segment
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card hover:bg-card-hover/60'
                }`}
                style={{ borderLeft: `3px solid ${s.color}` }}
              >
                <div className="text-xs text-muted-foreground">{t.label}</div>
                <div className="text-xl font-semibold tabular-nums mt-1">{s.count}</div>
                <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{t.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Playbook + actions for selected segment */}
      {selectedSeg && SEGMENT_TRANSLATIONS[selectedSeg] && (
        <div className="bg-card border border-primary/40 rounded-lg p-4 space-y-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
              What to do with this group
            </div>
            <div className="text-sm">{SEGMENT_TRANSLATIONS[selectedSeg].playbook}</div>
          </div>

          {SEGMENT_TRANSLATIONS[selectedSeg].smsTemplate && (
            <div className="bg-muted/50 rounded-md p-3 border border-border">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <MessageSquare className="w-3 h-3" /> Sample SMS message
                </div>
                <button
                  onClick={() => copySmsTemplate(selectedSeg)}
                  className="text-[11px] text-primary hover:underline flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" /> Copy
                </button>
              </div>
              <div className="text-sm text-foreground/90 font-mono leading-relaxed">
                {SEGMENT_TRANSLATIONS[selectedSeg].smsTemplate}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1.5">
                {`Replace {name} with the customer's name · {store} with your store name`}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Customer table */}
      <div id="customer-table" className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-medium">
            Customer list
            {selectedSeg && (
              <span className="text-muted-foreground ml-1.5">
                · {SEGMENT_TRANSLATIONS[selectedSeg]?.label || selectedSeg}
              </span>
            )}
            <span className="ml-2 text-xs text-muted-foreground">({filtered.length} people)</span>
          </h3>
          <div className="flex gap-2">
            <button
              onClick={copyPhoneList}
              disabled={filtered.length === 0}
              className="text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border hover:bg-card-hover disabled:opacity-50"
            >
              <Copy className="w-3.5 h-3.5" /> Copy all phone numbers
            </button>
            <button
              onClick={exportFiltered}
              disabled={filtered.length === 0}
              className="text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary-600 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-sm">
            <thead className="bg-card-hover/40 text-xs text-muted-foreground sticky top-0">
              <tr>
                <th className="px-4 py-2.5 text-left">Name</th>
                <th className="px-4 py-2.5 text-left">Group</th>
                <th className="px-4 py-2.5 text-right">Visits</th>
                <th className="px-4 py-2.5 text-right">Total spent</th>
                <th className="px-4 py-2.5 text-right">Last visit</th>
                <th className="px-4 py-2.5 text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((c: any) => {
                const t = SEGMENT_TRANSLATIONS[c.segment] || { label: c.segment };
                return (
                  <tr key={c.id} className="border-t border-border hover:bg-card-hover/40">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{c.name}</div>
                      {c.phone && (
                        <div className="text-[10px] text-muted-foreground tabular-nums">
                          {c.phone}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs">{t.label}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{c.frequency}×</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                      {formatCurrency(c.monetary)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                      {c.recency_days != null ? `${c.recency_days} days ago` : 'Never'}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{c.points}</td>
                  </tr>
                );
              })}
              {filtered.length > 200 && (
                <tr>
                  <td colSpan={6} className="px-4 py-2.5 text-xs text-muted-foreground text-center">
                    Showing 200 of {filtered.length} — use Export CSV to see all
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating toast */}
      {copyToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background px-4 py-2 rounded-lg shadow-lg text-sm">
          {copyToast}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'warning';
}) {
  return (
    <div
      className={`bg-card border rounded-lg p-4 ${
        tone === 'warning'
          ? 'border-warning/60'
          : tone === 'success'
          ? 'border-success/60'
          : 'border-border'
      }`}
    >
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-metric-md mt-1.5 tabular-nums">{value}</div>
    </div>
  );
}
