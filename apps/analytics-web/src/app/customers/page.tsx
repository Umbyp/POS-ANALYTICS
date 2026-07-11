'use client';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Download, Copy, MessageSquare, Sparkles, AlertCircle } from 'lucide-react';
import { api, formatCurrency } from '@/lib/api';
import { useStoreId } from '@/components/DashboardShell';
import { PageIntro } from '@/components/PageIntro';
import { InsightBanner, BannerAction } from '@/components/InsightBanner';
import { rowsToCsv, downloadCsv, copyToClipboard } from '@/lib/export';
import { useT } from '@/lib/i18n';

// Maps each RFM segment name to its translation dict key (the segment names
// themselves come from the API in English, e.g. "Big Spender" -> "BigSpender").
const SEGMENT_KEY: Record<string, string> = {
  Champion: 'Champion',
  Loyal: 'Loyal',
  'Big Spender': 'BigSpender',
  New: 'New',
  Promising: 'Promising',
  'At Risk': 'AtRisk',
  Hibernating: 'Hibernating',
  Lost: 'Lost',
  'Never Bought': 'NeverBought',
};

function useSegmentInfo() {
  const t = useT();
  return (segment: string) => {
    const key = SEGMENT_KEY[segment];
    if (!key) return { label: segment, desc: '', playbook: '', smsTemplate: undefined as string | undefined };
    const smsTemplate = t(`seg.${key}.sms`, '');
    return {
      label: t(`seg.${key}.label`, segment),
      desc: t(`seg.${key}.desc`, ''),
      playbook: t(`seg.${key}.playbook`, ''),
      smsTemplate: smsTemplate || undefined,
    };
  };
}

export default function CustomersPage() {
  const t = useT();
  const segmentInfo = useSegmentInfo();
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
      segment: segmentInfo(c.segment).label,
      visits: c.frequency,
      total_spent: c.monetary,
      last_visit_days_ago: c.recency_days ?? '',
      points: c.points,
    }));
    const csv = rowsToCsv(rows, [
      { label: t('cust.colName'), value: (r: any) => r.name },
      { label: 'Phone', value: (r: any) => r.phone },
      { label: 'Email', value: (r: any) => r.email },
      { label: t('cust.colGroup'), value: (r: any) => r.segment },
      { label: t('cust.colVisits'), value: (r: any) => r.visits },
      { label: t('cust.colTotalSpent'), value: (r: any) => r.total_spent },
      { label: t('cust.colLastVisit') + ' (' + t('cust.daysAgo') + ')', value: (r: any) => r.last_visit_days_ago },
      { label: t('cust.colPoints'), value: (r: any) => r.points },
    ]);
    const segPart = selectedSeg ? `-${selectedSeg}` : '-all';
    downloadCsv(`customers${segPart}-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    showCopyToast(`${t('cust.toastExported')} ${rows.length} ${t('cust.toastExportedSuffix')}`);
  };

  const copySmsTemplate = async (segment: string) => {
    const tpl = segmentInfo(segment).smsTemplate;
    if (!tpl) return;
    const ok = await copyToClipboard(tpl);
    if (ok) showCopyToast(t('cust.toastSmsCopied'));
  };

  const copyPhoneList = async () => {
    const phones = filtered.map((c: any) => c.phone).filter(Boolean).join(', ');
    if (!phones) return;
    const ok = await copyToClipboard(phones);
    if (ok) showCopyToast(`${t('cust.toastPhonesCopied')} ${phones.split(',').length} ${t('cust.toastPhonesCopiedSuffix')}`);
  };

  return (
    <div className="p-6 space-y-5 max-w-screen-xl">
      <PageIntro
        title={t('cust.title')}
        whatItTells={t('cust.subtitle')}
        howToUse={[t('cust.howTo1'), t('cust.howTo2'), t('cust.howTo3')]}
        tip={t('cust.tip')}
      />

      {/* Error state */}
      {error && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-medium">{t('cust.cantConnect')}</div>
            <div className="text-muted-foreground mt-1">
              {t('cust.runCmd')}{' '}
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
          title={`${atRiskList.length} ${t('cust.slippingAway')}`}
          description={
            <>
              {t('cust.slippingDesc1')} <strong>{t('cust.atRiskLongGone')}</strong> {t('cust.slippingDesc2')}{' '}
              {t('cust.slippingDesc3')}
            </>
          }
          metric={{ label: t('cust.customersLabel'), value: String(atRiskList.length) }}
          actions={
            <>
              <BannerAction
                onClick={() => {
                  setSelectedSeg('At Risk');
                  document.getElementById('customer-table')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <Sparkles className="w-3.5 h-3.5" /> {t('cust.viewAtRiskList')}
              </BannerAction>
              <BannerAction variant="outline" onClick={() => copySmsTemplate('At Risk')}>
                <MessageSquare className="w-3.5 h-3.5" /> {t('cust.copySmsMessage')}
              </BannerAction>
            </>
          }
        />
      )}

      {/* CLV stats */}
      {clv && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label={t('cust.totalCustomers')} value={(clv.total_customers || 0).toString()} />
          <Stat label={t('cust.avgSpend')} value={formatCurrency(clv.avg_clv || 0)} />
          <Stat label={t('cust.vip')} value={(summary.champions || 0).toString()} tone="success" />
          <Stat label={t('cust.atRisk')} value={(summary.at_risk || 0).toString()} tone="warning" />
        </div>
      )}

      {/* Segments — list of cards, friendly */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {t('cust.pickGroup')}
          </div>
          {selectedSeg && (
            <button
              onClick={() => setSelectedSeg(null)}
              className="text-xs text-primary hover:underline"
            >
              {t('cust.clearFilter')}
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
            <div className="text-xs text-muted-foreground">{t('cust.all')}</div>
            <div className="text-xl font-semibold tabular-nums mt-1">{summary.total || customers.length}</div>
            <div className="text-[10px] text-muted-foreground mt-1">{t('cust.allGroups')}</div>
          </button>
          {segments.map((s: any) => {
            const info = segmentInfo(s.segment);
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
                <div className="text-xs text-muted-foreground">{info.label}</div>
                <div className="text-xl font-semibold tabular-nums mt-1">{s.count}</div>
                <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{info.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Playbook + actions for selected segment */}
      {selectedSeg && SEGMENT_KEY[selectedSeg] && (
        <div className="bg-card border border-primary/40 rounded-lg p-4 space-y-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
              {t('cust.whatToDo')}
            </div>
            <div className="text-sm">{segmentInfo(selectedSeg).playbook}</div>
          </div>

          {segmentInfo(selectedSeg).smsTemplate && (
            <div className="bg-muted/50 rounded-md p-3 border border-border">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <MessageSquare className="w-3 h-3" /> {t('cust.sampleSms')}
                </div>
                <button
                  onClick={() => copySmsTemplate(selectedSeg)}
                  className="text-[11px] text-primary hover:underline flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" /> {t('cust.copy')}
                </button>
              </div>
              <div className="text-sm text-foreground/90 font-mono leading-relaxed">
                {segmentInfo(selectedSeg).smsTemplate}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1.5">
                {t('cust.replaceHint')}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Customer table */}
      <div id="customer-table" className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-medium">
            {t('cust.customerList')}
            {selectedSeg && (
              <span className="text-muted-foreground ml-1.5">
                · {segmentInfo(selectedSeg).label}
              </span>
            )}
            <span className="ml-2 text-xs text-muted-foreground">({filtered.length} {t('cust.people')})</span>
          </h3>
          <div className="flex gap-2">
            <button
              onClick={copyPhoneList}
              disabled={filtered.length === 0}
              className="text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border hover:bg-card-hover disabled:opacity-50"
            >
              <Copy className="w-3.5 h-3.5" /> {t('cust.copyAllPhones')}
            </button>
            <button
              onClick={exportFiltered}
              disabled={filtered.length === 0}
              className="text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary-600 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" /> {t('cust.exportCsv')}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-sm">
            <thead className="bg-card-hover/40 text-xs text-muted-foreground sticky top-0">
              <tr>
                <th className="px-4 py-2.5 text-left">{t('cust.colName')}</th>
                <th className="px-4 py-2.5 text-left">{t('cust.colGroup')}</th>
                <th className="px-4 py-2.5 text-right">{t('cust.colVisits')}</th>
                <th className="px-4 py-2.5 text-right">{t('cust.colTotalSpent')}</th>
                <th className="px-4 py-2.5 text-right">{t('cust.colLastVisit')}</th>
                <th className="px-4 py-2.5 text-right">{t('cust.colPoints')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((c: any) => {
                const info = segmentInfo(c.segment);
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
                    <td className="px-4 py-2.5 text-xs">{info.label}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{c.frequency}×</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                      {formatCurrency(c.monetary)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                      {c.recency_days != null ? `${c.recency_days} ${t('cust.daysAgo')}` : t('cust.never')}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{c.points}</td>
                  </tr>
                );
              })}
              {filtered.length > 200 && (
                <tr>
                  <td colSpan={6} className="px-4 py-2.5 text-xs text-muted-foreground text-center">
                    {t('cust.showingOf')} {filtered.length} {t('cust.useExport')}
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
