'use client';
import { useQuery } from '@tanstack/react-query';
import { Package } from 'lucide-react';
import { DashboardShell, useStoreId } from '@/components/DashboardShell';
import { KpiCard, KpiSkeleton } from '@/components/dashboard/KpiCard';
import { RevenueChart, SalesHeatmap, TopProductsCard } from '@/components/dashboard/Charts';
import { InsightCard } from '@/components/dashboard/InsightCard';
import { api, formatCurrency, formatNumber, cn } from '@/lib/api';

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
  const isUp = growth >= 0;

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
  const { data: insights = [] } = useQuery({
    queryKey: ['insights', storeId],
    queryFn: () => api.get('/api/insights', { params: { store_id: storeId, limit: 5 } }).then((r) => r.data),
  });

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
          <p className="text-muted-foreground text-xs mt-0.5">ภาพรวมธุรกิจ 30 วันล่าสุด</p>
        </div>
        <a
          href="/assistant"
          className="px-3 py-1.5 text-xs border border-border bg-card hover:bg-card-hover rounded-md transition-colors"
        >
          ถาม AI →
        </a>
      </div>

      {/* Today Banner */}
      <TodayBanner storeId={storeId} />

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

      {/* Heatmap + Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SalesHeatmap data={heatmap} />
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">Insights ล่าสุด</h3>
            <a href="/insights" className="text-xs text-muted-foreground hover:text-foreground">
              ดูทั้งหมด →
            </a>
          </div>
          {insights.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              ยังไม่มี insight —{' '}
              <a href="/insights" className="text-primary hover:underline">สร้างใหม่</a>
            </div>
          ) : (
            <div className="space-y-2">
              {insights.map((ins: any, i: number) => (
                <InsightCard key={ins.id} insight={ins} delay={i * 0.05} />
              ))}
            </div>
          )}
        </div>
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
