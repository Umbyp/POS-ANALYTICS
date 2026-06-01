'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';
import { Package, TrendingUp, Clock, Calendar, Sparkles, Target, Loader2, RefreshCw } from 'lucide-react';
import { DashboardShell, useStoreId } from '@/components/DashboardShell';
import { KpiCard, KpiSkeleton } from '@/components/dashboard/KpiCard';
import { RevenueChart, SalesHeatmap, TopProductsCard } from '@/components/dashboard/Charts';
import { InsightCard } from '@/components/dashboard/InsightCard';
import { api, formatCurrency, formatNumber, formatDate, cn } from '@/lib/api';

function TodayBanner({ storeId }: { storeId: string }) {
  const { data: kpiToday, isLoading } = useQuery({
    queryKey: ['today', storeId],
    queryFn: () => api.get('/api/analytics/today', { params: { store_id: storeId } }).then((r) => r.data),
    refetchInterval: 60_000,
    staleTime: 0,
  });
  const { data: inv = [] } = useQuery({
    queryKey: ['inv', storeId],
    queryFn: () => api.get('/api/analytics/inventory-status', { params: { store_id: storeId } }).then((r) => r.data),
  });

  const now = new Date();
  const thaiDay = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'][now.getDay()];
  const dateStr = `วัน${thaiDay} ${now.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  const lowStockCount = inv.filter((i: any) => i.days_until_out != null && i.days_until_out <= 7).length;
  const criticalCount = inv.filter((i: any) => i.days_until_out != null && i.days_until_out <= 3).length;

  const growth = kpiToday?.vs_yesterday_pct ?? 0;

  return (
    <div className="rounded-lg overflow-hidden border border-border bg-card">
      <div className="p-5 flex flex-wrap items-center gap-4 justify-between">
        {/* Date + title */}
        <div>
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Real-time
          </div>
          <h2 className="text-base font-medium">{dateStr}</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">อัปเดตทุก 1 นาที</p>
        </div>

        {/* Stats row */}
        {isLoading ? (
          <div className="flex gap-3">
            {[...Array(3)].map((_, i) => <div key={i} className="w-28 h-14 shimmer rounded-xl" />)}
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            <TodayStatChip
              label="รายได้วันนี้"
              value={formatCurrency(kpiToday?.revenue || 0)}
              change={growth}
            />
            <TodayStatChip
              label="ออเดอร์วันนี้"
              value={`${kpiToday?.order_count || 0} รายการ`}
              change={kpiToday?.yesterday_orders
                ? Math.round(((kpiToday.order_count - kpiToday.yesterday_orders) / kpiToday.yesterday_orders) * 100)
                : undefined}
            />
            <TodayStatChip
              label="เฉลี่ยต่อบิล"
              value={formatCurrency(kpiToday?.avg_ticket || 0)}
            />
            {criticalCount > 0 && (
              <TodayStatChip
                label="สต็อกวิกฤต"
                value={`${criticalCount} รายการ`}
                alert
              />
            )}
          </div>
        )}
      </div>

      {/* Low stock bar */}
      {lowStockCount > 0 && (
        <div className="bg-warning/10 border-t border-warning/30 px-5 py-2.5 flex items-center gap-2">
          <Package className="w-3.5 h-3.5 text-warning shrink-0" />
          <span className="text-xs text-warning">
            มีสินค้า <strong>{lowStockCount} รายการ</strong> ที่จะหมดภายใน 7 วัน —{' '}
            <a href="/assistant" className="underline">ถาม AI ว่าต้องสั่งอะไร</a>
          </span>
        </div>
      )}
    </div>
  );
}

function TodayStatChip({ label, value, change, alert }: { label: string; value: string; change?: number; alert?: boolean }) {
  const isUp = (change ?? 0) >= 0;
  return (
    <div className={cn(
      'rounded-md px-4 py-2.5 border min-w-[7rem]',
      alert ? 'bg-danger/10 border-danger/40' : 'bg-card-hover border-border'
    )}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</div>
      <div className={cn('text-base font-semibold tabular-nums', alert && 'text-danger')}>{value}</div>
      {change !== undefined && (
        <div className={cn('text-[10px] mt-0.5 tabular-nums', isUp ? 'text-success' : 'text-danger')}>
          {isUp ? '+' : ''}{change.toFixed(1)}%
          <span className="text-muted-foreground ml-1">vs เมื่อวาน</span>
        </div>
      )}
    </div>
  );
}

/** Compact monthly-goal tracker — folded in from the old /goal page. */
function GoalStrip({ storeId }: { storeId: string }) {
  const { data } = useQuery({
    queryKey: ['goal-coach', storeId],
    queryFn: () => api.get('/api/goal-coach', { params: { store_id: storeId } }).then((r) => r.data),
    enabled: !!storeId,
    refetchInterval: 60_000,
  });

  // Hide entirely if no monthly target is set — keeps the page clean.
  if (!data?.has_target) return null;

  const progressPct = Math.min(data.progress_pct, 100);
  const onTrack = data.on_track;

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-center gap-2 mb-3">
        <Target className={cn('w-4 h-4', onTrack ? 'text-success' : 'text-warning')} />
        <h3 className="text-sm font-medium">เป้าเดือนนี้</h3>
        <span className="text-[11px] text-muted-foreground">
          ผ่านมา {data.days_passed}/{data.days_in_month} วัน · เหลือ {data.days_left} วัน
        </span>
        <span className={cn('ml-auto text-lg font-semibold tabular-nums', onTrack ? 'text-success' : 'text-warning')}>
          {data.progress_pct.toFixed(0)}%
        </span>
      </div>

      <div className="h-2 bg-card-hover rounded-full overflow-hidden mb-3">
        <div
          className={cn('h-full transition-all duration-500', onTrack ? 'bg-success' : 'bg-warning')}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <GoalStat label="ทำได้แล้ว" value={formatCurrency(data.actual)} />
        <GoalStat label="เป้า" value={formatCurrency(data.target)} muted />
        <GoalStat
          label="ต้องขายเพิ่ม/วัน"
          value={formatCurrency(data.needed_daily)}
          accent={onTrack ? 'text-success' : 'text-warning'}
        />
        <GoalStat label="คาดสิ้นเดือน" value={formatCurrency(data.projected_total)} />
      </div>
    </div>
  );
}

function GoalStat({ label, value, accent, muted }: { label: string; value: string; accent?: string; muted?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</div>
      <div className={cn('font-semibold tabular-nums', accent || (muted ? 'text-muted-foreground' : 'text-foreground'))}>
        {value}
      </div>
    </div>
  );
}

/** Revenue forecast — folded in from the old /forecast page. */
function ForecastSection({ storeId }: { storeId: string }) {
  const { data: revenue, isLoading: revLoading } = useQuery({
    queryKey: ['fc-revenue', storeId],
    queryFn: () => api.get('/api/forecast/revenue', { params: { store_id: storeId, days_ahead: 30 } }).then((r) => r.data),
    enabled: !!storeId,
  });
  const { data: peak, isLoading: peakLoading } = useQuery({
    queryKey: ['fc-peak', storeId],
    queryFn: () => api.get('/api/forecast/peak-hours', { params: { store_id: storeId } }).then((r) => r.data),
    enabled: !!storeId,
  });

  const series = revenue?.series || [];
  const firstForecast = series.find((s: any) => s.is_forecast)?.date;
  const actualPoints = series.filter((s: any) => !s.is_forecast).length;
  const forecastPoints = series.filter((s: any) => s.is_forecast).length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <FcCard
          label="รายได้คาดการณ์ 30 วันข้างหน้า"
          icon={<TrendingUp className="w-4 h-4" />}
          loading={revLoading}
          value={revenue ? formatCurrency(revenue.total_predicted || 0) : null}
          accent="text-primary"
          sub={revenue?.total_predicted ? `≈ ${formatCurrency((revenue.total_predicted || 0) / 30)}/วัน` : undefined}
        />
        <FcCard
          label="ข้อมูลย้อนหลังที่ใช้"
          icon={<Calendar className="w-4 h-4" />}
          loading={revLoading}
          value={actualPoints > 0 ? `${actualPoints} วัน` : null}
          sub={actualPoints < 14 ? 'น้อยไป — ผลอาจไม่แม่น' : actualPoints < 30 ? 'ดีพอใช้' : 'ข้อมูลพอแล้ว'}
        />
        <FcCard
          label="ช่วงเวลาขายดีที่สุด"
          icon={<Clock className="w-4 h-4" />}
          loading={peakLoading}
          value={peak?.peak_hours?.length ? peak.peak_hours.map((p: any) => `${p.hour}:00`).join(', ') : null}
          accent="text-success"
          sub={peak?.peak_hours?.length ? `รวม ${peak.peak_hours.reduce((s: number, p: any) => s + p.orders, 0)} ออเดอร์` : undefined}
        />
      </div>

      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="font-medium flex items-center gap-2 text-sm">
              <Sparkles className="w-4 h-4 text-primary" /> พยากรณ์รายได้ 30 วันข้างหน้า
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              เส้นทึบ = ยอดจริง · เส้นประส้ม = คาดการณ์
            </p>
          </div>
          {series.length > 0 && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <FcLegend color="#FF6B35" label="คาดการณ์" />
              <FcLegend color="#FED7AA" label="ช่วงเชื่อมั่น" />
            </div>
          )}
        </div>

        {revLoading ? (
          <div className="shimmer h-[320px] rounded-xl" />
        ) : series.length === 0 ? (
          <div className="h-[320px] flex flex-col items-center justify-center text-center px-6">
            <Sparkles className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <div className="font-medium mb-1">ยังไม่มีข้อมูลพอจะพยากรณ์</div>
            <div className="text-xs text-muted-foreground max-w-sm">
              ต้องมีออเดอร์อย่างน้อย 7-14 วันที่ผ่านมา ตอนนี้มี {actualPoints} วัน
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={series} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="band" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF6B35" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#FF6B35" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="#6B7280"
                fontSize={11}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis
                stroke="#6B7280"
                fontSize={11}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: '#FFFFFF',
                  border: '1px solid #E5E7EB',
                  borderRadius: 8,
                  fontSize: 12,
                  boxShadow: '0 4px 12px -2px rgba(0,0,0,0.08)',
                }}
                labelFormatter={formatDate}
                formatter={(v: any, name: any) => [formatCurrency(v), name]}
              />
              {firstForecast && (
                <ReferenceLine
                  x={firstForecast}
                  stroke="#F59E0B"
                  strokeDasharray="4 4"
                  label={{ value: 'วันนี้', fill: '#F59E0B', fontSize: 10, position: 'top' }}
                />
              )}
              <Area dataKey="upper" stroke="none" fill="url(#band)" name="ขอบบน" />
              <Area dataKey="lower" stroke="none" fill="#FFFFFF" name="ขอบล่าง" />
              <Line dataKey="actual" stroke="#0F172A" strokeWidth={2} dot={false} name="ยอดจริง" connectNulls />
              <Line dataKey="predicted" stroke="#FF6B35" strokeWidth={2} dot={false} name="คาดการณ์" strokeDasharray="4 4" />
            </ComposedChart>
          </ResponsiveContainer>
        )}

        {series.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border text-xs text-muted-foreground">
            ข้อมูลย้อนหลัง {actualPoints} วัน · พยากรณ์ {forecastPoints} วันข้างหน้า
          </div>
        )}
      </div>
    </div>
  );
}

function FcCard({ label, icon, loading, value, sub, accent }: {
  label: string; icon: React.ReactNode; loading: boolean; value: string | null; sub?: string; accent?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon} <span>{label}</span>
      </div>
      {loading ? (
        <div className="shimmer h-7 rounded mt-2 w-2/3" />
      ) : value ? (
        <>
          <div className={cn('text-xl font-semibold mt-1.5 tabular-nums truncate', accent || 'text-foreground')}>
            {value}
          </div>
          {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
        </>
      ) : (
        <div className="text-sm text-muted-foreground mt-2 italic">—</div>
      )}
    </div>
  );
}

function FcLegend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block w-3 h-2 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

/** Auto insights — folded in from the old /insights page (with inline generate). */
function InsightsPanel({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const { data: insights = [], isLoading } = useQuery({
    queryKey: ['insights', storeId],
    queryFn: () => api.get('/api/insights', { params: { store_id: storeId, limit: 5 } }).then((r) => r.data),
    enabled: !!storeId,
  });

  const generate = useMutation({
    mutationFn: () => api.post('/api/insights/generate', null, { params: { store_id: storeId } }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insights', storeId] }),
  });

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" /> สรุปอัตโนมัติ
        </h3>
        <button
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 border border-border rounded-md hover:bg-card-hover transition-colors disabled:opacity-50"
        >
          {generate.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          วิเคราะห์ใหม่
        </button>
      </div>
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="shimmer h-16 rounded-lg" />)}
        </div>
      ) : insights.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          ยังไม่มีสรุป — กด <b>วิเคราะห์ใหม่</b> เพื่อให้ AI สรุปจุดเด่น/จุดที่ต้องระวัง
        </div>
      ) : (
        <div className="space-y-2">
          {insights.map((ins: any, i: number) => (
            <InsightCard key={ins.id} insight={ins} delay={i * 0.05} />
          ))}
        </div>
      )}
    </div>
  );
}

function DashboardContent() {
  const storeId = useStoreId();

  const { data: kpi, isLoading: kpiLoading } = useQuery({
    queryKey: ['kpi', storeId],
    queryFn: () => api.get('/api/analytics/kpi', { params: { store_id: storeId, days: 30 } }).then((r) => r.data),
  });
  const { data: daily = [] } = useQuery({
    queryKey: ['daily', storeId],
    queryFn: () => api.get('/api/analytics/daily-sales', { params: { store_id: storeId, days: 60 } }).then((r) => r.data),
  });
  const { data: heatmap = [] } = useQuery({
    queryKey: ['heatmap', storeId],
    queryFn: () => api.get('/api/analytics/heatmap', { params: { store_id: storeId } }).then((r) => r.data),
  });
  const { data: topProducts = [] } = useQuery({
    queryKey: ['top', storeId],
    queryFn: () => api.get('/api/analytics/top-products', { params: { store_id: storeId } }).then((r) => r.data),
  });

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">ภาพรวม</h1>
          <p className="text-muted-foreground text-xs mt-0.5">สรุปธุรกิจวันนี้ + 30 วันล่าสุด + พยากรณ์ล่วงหน้า</p>
        </div>
        <a
          href="/assistant"
          className="px-3 py-1.5 text-xs border border-border bg-card hover:bg-card-hover rounded-md transition-colors"
        >
          ถาม AI →
        </a>
      </div>

      {/* Today */}
      <TodayBanner storeId={storeId} />

      {/* Monthly goal (hidden if no target) */}
      <GoalStrip storeId={storeId} />

      {/* KPI 30-day */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3">
          30 วันที่ผ่านมา
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpiLoading ? (
            <><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /></>
          ) : (
            <>
              <KpiCard
                label="รายได้รวม"
                value={formatCurrency(kpi?.revenue || 0)}
                change={kpi?.revenue_growth}
                sparkline={daily.slice(-14).map((d: any) => Number(d.revenue) || 0)}
              />
              <KpiCard
                label="กำไรขั้นต้น"
                value={formatCurrency(kpi?.gross_profit || 0)}
                sparkline={daily.slice(-14).map((d: any) => Number(d.revenue) * 0.4 || 0)}
              />
              <KpiCard
                label="จำนวนออเดอร์"
                value={formatNumber(kpi?.order_count || 0)}
                sparkline={daily.slice(-14).map((d: any) => Number(d.order_count) || Number(d.orders) || 0)}
              />
              <KpiCard
                label="ค่าเฉลี่ยต่อบิล"
                value={formatCurrency(kpi?.avg_ticket || 0)}
              />
            </>
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RevenueChart data={daily} />
        </div>
        <TopProductsCard data={topProducts} />
      </div>

      {/* Forecast */}
      <ForecastSection storeId={storeId} />

      {/* Heatmap + Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SalesHeatmap data={heatmap} />
        <InsightsPanel storeId={storeId} />
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <DashboardShell>
      <DashboardContent />
    </DashboardShell>
  );
}
