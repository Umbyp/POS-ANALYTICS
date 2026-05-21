'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, RefreshCw, Package, TrendingUp, TrendingDown,
  AlertTriangle, AlertCircle, Info, CheckCircle2, BarChart3,
  Target, Zap, ShoppingBag, DollarSign, Clock, Filter,
} from 'lucide-react';
import { DashboardShell, useStoreId } from '@/components/DashboardShell';
import { api, formatCurrency, cn } from '@/lib/api';

// ─── Type / Severity meta ────────────────────────────────
const TYPE_META: Record<string, { icon: any; label: string; color: string; bg: string }> = {
  TREND:          { icon: TrendingUp,    label: 'เทรนด์',       color: 'text-indigo-400',  bg: 'bg-indigo-500/10' },
  ANOMALY:        { icon: AlertCircle,   label: 'ผิดปกติ',      color: 'text-rose-400',    bg: 'bg-rose-500/10'   },
  INVENTORY:      { icon: Package,       label: 'สต็อก',        color: 'text-amber-400',   bg: 'bg-amber-500/10'  },
  PROFIT:         { icon: DollarSign,    label: 'กำไร',         color: 'text-emerald-400', bg: 'bg-emerald-500/10'},
  FORECAST:       { icon: Sparkles,      label: 'พยากรณ์',      color: 'text-violet-400',  bg: 'bg-violet-500/10' },
  RECOMMENDATION: { icon: Target,        label: 'แนะนำ',        color: 'text-cyan-400',    bg: 'bg-cyan-500/10'   },
};

const SEV_META: Record<string, { icon: any; label: string; color: string; border: string; badge: string }> = {
  CRITICAL: { icon: AlertTriangle, label: 'วิกฤต',    color: 'text-rose-400',    border: 'border-l-rose-500',    badge: 'bg-rose-500/20 text-rose-300' },
  WARNING:  { icon: AlertCircle,   label: 'เตือน',    color: 'text-amber-400',   border: 'border-l-amber-500',   badge: 'bg-amber-500/20 text-amber-300' },
  INFO:     { icon: Info,          label: 'ข้อมูล',   color: 'text-indigo-400',  border: 'border-l-indigo-500',  badge: 'bg-indigo-500/20 text-indigo-300' },
};

const ALL_FILTERS = ['ทั้งหมด', 'CRITICAL', 'WARNING', 'INFO'] as const;
const ALL_TYPES   = ['ทั้งประเภท', 'TREND', 'ANOMALY', 'INVENTORY', 'PROFIT', 'FORECAST', 'RECOMMENDATION'] as const;

type SevFilter  = typeof ALL_FILTERS[number];
type TypeFilter = typeof ALL_TYPES[number];

// ─── Insight Card ────────────────────────────────────────
function InsightCardFull({ insight, delay = 0 }: { insight: any; delay?: number }) {
  const type = TYPE_META[insight.type] ?? TYPE_META.TREND;
  const sev  = SEV_META[insight.severity] ?? SEV_META.INFO;
  const TypeIcon = type.icon;
  const SevIcon  = sev.icon;

  const metricDisplay = () => {
    if (insight.metric == null) return null;
    const v = Number(insight.metric);
    if (insight.type === 'INVENTORY') return `${v.toFixed(0)} วัน`;
    if (Math.abs(v) < 100 && String(insight.metric).includes('.'))
      return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
    return v.toFixed(0);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={cn(
        'glass rounded-xl p-4 border-l-[3px] hover:bg-white/[0.06] transition-colors',
        sev.border
      )}
    >
      <div className="flex items-start gap-3">
        {/* Type icon */}
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5', type.bg)}>
          <TypeIcon className={cn('w-4 h-4', type.color)} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="text-sm font-semibold leading-snug">{insight.title}</h3>
            <div className="flex items-center gap-1.5 shrink-0">
              {metricDisplay() && (
                <span className={cn('text-xs font-bold tabular-nums', sev.color)}>
                  {metricDisplay()}
                </span>
              )}
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', sev.badge)}>
                {sev.label}
              </span>
            </div>
          </div>

          {/* Description */}
          <p className="text-xs text-muted-foreground leading-relaxed">
            {insight.description}
          </p>

          {/* Footer */}
          <div className="flex items-center gap-3 mt-2">
            <span className={cn('text-[10px] px-2 py-0.5 rounded-full', type.bg, type.color)}>
              {type.label}
            </span>
            {insight.created_at && (
              <span className="text-[10px] text-muted-foreground/60">
                {new Date(insight.created_at).toLocaleString('th-TH', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Summary bar ─────────────────────────────────────────
function SummaryBar({ insights }: { insights: any[] }) {
  const critical = insights.filter(i => i.severity === 'CRITICAL').length;
  const warning  = insights.filter(i => i.severity === 'WARNING').length;
  const info     = insights.filter(i => i.severity === 'INFO').length;

  const stats = [
    { label: 'วิกฤต',   count: critical, icon: AlertTriangle, color: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/30' },
    { label: 'เตือน',   count: warning,  icon: AlertCircle,   color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30' },
    { label: 'ข้อมูล',  count: info,     icon: Info,          color: 'text-indigo-400',  bg: 'bg-indigo-500/10',  border: 'border-indigo-500/30' },
    { label: 'ทั้งหมด', count: insights.length, icon: BarChart3, color: 'text-muted-foreground', bg: 'bg-white/5', border: 'border-white/10' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map(s => {
        const Icon = s.icon;
        return (
          <div key={s.label} className={cn('rounded-xl p-3.5 border', s.bg, s.border)}>
            <div className={cn('flex items-center gap-1.5 mb-1', s.color)}>
              <Icon className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">{s.label}</span>
            </div>
            <div className="text-2xl font-bold tabular-nums">{s.count}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Restock table ───────────────────────────────────────
function RestockTable({ items }: { items: any[] }) {
  if (!items?.length) return (
    <div className="text-sm text-muted-foreground flex items-center gap-2 py-4">
      <CheckCircle2 className="w-4 h-4 text-emerald-400" /> สต็อกเพียงพอทุกรายการ
    </div>
  );

  return (
    <div className="space-y-2">
      {items.map((r: any) => {
        const urgency = r.days_until_out <= 2 ? 'rose' : r.days_until_out <= 5 ? 'amber' : 'indigo';
        return (
          <div key={r.product_id} className="flex items-center justify-between text-sm p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-2 h-2 rounded-full shrink-0 ${urgency === 'rose' ? 'bg-rose-400' : urgency === 'amber' ? 'bg-amber-400' : 'bg-indigo-400'}`} />
              <div className="min-w-0">
                <div className="font-medium truncate">{r.product_name}</div>
                <div className="text-xs text-muted-foreground">{r.reason}</div>
              </div>
            </div>
            <div className="text-right shrink-0 ml-3">
              <div className="font-bold text-emerald-400">+{r.suggested_order_qty}</div>
              <div className="text-[10px] text-muted-foreground">ชิ้น</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────
function InsightsContent() {
  const storeId = useStoreId();
  const qc = useQueryClient();
  const [sevFilter,  setSevFilter]  = useState<SevFilter>('ทั้งหมด');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ทั้งประเภท');

  const { data: insights = [], isLoading } = useQuery({
    queryKey: ['insights-full', storeId],
    queryFn: () => api.get('/api/insights', { params: { store_id: storeId, limit: 60 } }).then((r) => r.data),
  });

  const { data: recs } = useQuery({
    queryKey: ['recommendations', storeId],
    queryFn: () => api.get('/api/recommendations', { params: { store_id: storeId } }).then((r) => r.data),
  });

  const generate = useMutation({
    mutationFn: () => api.post('/api/insights/generate', null, { params: { store_id: storeId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['insights-full'] });
      qc.invalidateQueries({ queryKey: ['recommendations'] });
    },
  });

  const filtered = insights.filter((ins: any) => {
    const sevOk  = sevFilter  === 'ทั้งหมด'   || ins.severity === sevFilter;
    const typeOk = typeFilter === 'ทั้งประเภท' || ins.type === typeFilter;
    return sevOk && typeOk;
  });

  const hasCritical = insights.some((i: any) => i.severity === 'CRITICAL');

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" /> AI Insights
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">วิเคราะห์ธุรกิจอัตโนมัติ — เทรนด์ สต็อก กำไร โอกาส ความเสี่ยง</p>
        </div>
        <button
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium disabled:opacity-50 transition-colors shadow-lg shadow-indigo-500/20"
        >
          <RefreshCw className={cn('w-4 h-4', generate.isPending && 'animate-spin')} />
          {generate.isPending ? 'กำลังวิเคราะห์...' : 'วิเคราะห์ใหม่'}
        </button>
      </div>

      {/* Critical alert banner */}
      {hasCritical && !isLoading && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-center gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <div>
            <div className="text-sm font-semibold text-rose-300">ต้องการความสนใจทันที</div>
            <div className="text-xs text-rose-400/80 mt-0.5">
              มี {insights.filter((i: any) => i.severity === 'CRITICAL').length} รายการวิกฤตที่ต้องดำเนินการ — ดูรายละเอียดด้านล่าง
            </div>
          </div>
        </motion.div>
      )}

      {/* Summary */}
      {!isLoading && insights.length > 0 && <SummaryBar insights={insights} />}

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        {/* Severity filter */}
        <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.08] rounded-xl p-1">
          {ALL_FILTERS.map(f => {
            const count = f === 'ทั้งหมด' ? insights.length : insights.filter((i: any) => i.severity === f).length;
            return (
              <button
                key={f}
                onClick={() => setSevFilter(f)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  sevFilter === f
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.05]'
                )}
              >
                {f === 'CRITICAL' ? 'วิกฤต' : f === 'WARNING' ? 'เตือน' : f === 'INFO' ? 'ข้อมูล' : f}
                {' '}<span className="opacity-60">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {ALL_TYPES.map(t => {
            const meta = t === 'ทั้งประเภท' ? null : TYPE_META[t];
            const count = t === 'ทั้งประเภท' ? insights.length : insights.filter((i: any) => i.type === t).length;
            if (count === 0 && t !== 'ทั้งประเภท') return null;
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap border',
                  typeFilter === t
                    ? (meta ? cn(meta.bg, meta.color, 'border-transparent') : 'bg-white/10 text-white border-transparent')
                    : 'border-white/[0.08] text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'
                )}
              >
                {meta ? meta.label : t} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Insight grid */}
      <div>
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="shimmer h-24 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center text-muted-foreground">
            <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
            {insights.length === 0
              ? 'ยังไม่มี insight — กด "วิเคราะห์ใหม่" เพื่อให้ AI สร้าง'
              : 'ไม่มี insight ในหมวดที่เลือก'}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {filtered.map((ins: any, i: number) => (
                <InsightCardFull key={ins.id ?? i} insight={ins} delay={i * 0.02} />
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>

      {/* Recommendations section */}
      {recs && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 pt-2">
            <div className="h-px flex-1 bg-border/60" />
            <span className="text-xs text-muted-foreground font-medium px-3">คำแนะนำเชิงปฏิบัติ</span>
            <div className="h-px flex-1 bg-border/60" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Restock */}
            <div className="glass rounded-2xl p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-sm">
                <Package className="w-4 h-4 text-amber-400" /> ควรสั่งสินค้าเพิ่ม
                {recs.restock?.length > 0 && (
                  <span className="ml-auto text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">
                    {recs.restock.length} รายการ
                  </span>
                )}
              </h3>
              <RestockTable items={recs.restock} />
            </div>

            {/* High profit */}
            <div className="glass rounded-2xl p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-sm">
                <DollarSign className="w-4 h-4 text-emerald-400" /> สินค้ากำไรสูงสุด
              </h3>
              <div className="space-y-2">
                {recs.high_profit?.map((p: any, i: number) => {
                  const maxProfit = Math.max(...(recs.high_profit?.map((x: any) => x.profit) ?? [1]));
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground truncate mr-2">{p.product_name}</span>
                        <span className="text-emerald-400 font-bold shrink-0">{formatCurrency(p.profit)}</span>
                      </div>
                      <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full"
                          style={{ width: `${(p.profit / maxProfit) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Promotions */}
            <div className="glass rounded-2xl p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-sm">
                <Zap className="w-4 h-4 text-violet-400" /> ไอเดียโปรโมชัน
              </h3>
              <div className="space-y-3">
                {recs.promotions?.map((p: any, i: number) => (
                  <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full font-medium',
                        p.type === 'BUNDLE' ? 'bg-violet-500/20 text-violet-300' : 'bg-cyan-500/20 text-cyan-300'
                      )}>
                        {p.type === 'BUNDLE' ? 'Bundle' : 'Promote'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{p.suggestion}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Discontinue warning */}
          {recs.discontinue?.length > 0 && (
            <div className="glass rounded-2xl p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-sm">
                <TrendingDown className="w-4 h-4 text-rose-400" /> สินค้าแนะนำให้ระบาย / เลิกขาย
                <span className="ml-auto text-xs bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full">
                  {recs.discontinue.length} รายการ
                </span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {recs.discontinue.slice(0, 6).map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <div>
                      <div className="font-medium">{p.product_name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{p.reason}</div>
                    </div>
                    <span className="text-xs bg-rose-500/20 text-rose-300 px-2 py-1 rounded-lg shrink-0 ml-2">
                      {p.current_stock} ชิ้น
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <DashboardShell>
      <InsightsContent />
    </DashboardShell>
  );
}
