'use client';
import { useQuery } from '@tanstack/react-query';
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';
import { Clock, TrendingUp, Sparkles, AlertCircle, Calendar } from 'lucide-react';
import { DashboardShell, useStoreId } from '@/components/DashboardShell';
import { api, formatCurrency, formatDate } from '@/lib/api';
import { PageIntro } from '@/components/PageIntro';

function ForecastContent() {
  const storeId = useStoreId();

  const { data: revenue, isLoading: revLoading, error: revError } = useQuery({
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

  const isAnalyticsDown = revError && /Network|ECONNREFUSED|Failed to fetch/i.test(String(revError));

  return (
    <div className="p-6 space-y-5 max-w-screen-xl">
      <PageIntro
        title="พยากรณ์ยอดขาย"
        whatItTells="ใช้ข้อมูลย้อนหลังคำนวณว่าใน 30 วันข้างหน้า ยอดน่าจะเป็นเท่าไร — ใช้สำหรับวางแผนวัตถุดิบ, จ้างคน, ตั้งเป้า"
        howToUse={[
          'ดูเส้นทึบ = ยอดจริงที่ผ่านมา · พื้นที่ส้ม = ช่วงคาดการณ์',
          'ยิ่งข้อมูลในระบบเยอะ ยิ่งพยากรณ์แม่นยำ (แนะนำมี ≥ 30 วัน)',
          'ใช้ตัวเลข "รายได้คาดการณ์ 30 วัน" วางแผนทำเป้าและสั่งวัตถุดิบ',
        ]}
        tip="โมเดล Prophet ของ Facebook — รองรับฤดูกาล/วันหยุดอัตโนมัติ"
      />

      {/* Error state */}
      {isAnalyticsDown && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-medium text-foreground">เชื่อมต่อ Analytics service ไม่ได้</div>
            <div className="text-muted-foreground mt-1">
              ต้องเปิดบริการ <code className="bg-card border border-border px-1.5 py-0.5 rounded text-xs">analytics-api</code> ที่ port 8000 ก่อน
              <br />
              ทำได้โดยรัน: <code className="bg-card border border-border px-1.5 py-0.5 rounded text-xs">cd apps/analytics-api &amp;&amp; uvicorn app.main:app --port 8000</code>
            </div>
          </div>
        </div>
      )}

      {/* Summary cards — always rendered (with skeleton when loading) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SummaryCard
          label="รายได้คาดการณ์ 30 วันข้างหน้า"
          icon={<TrendingUp className="w-4 h-4" />}
          loading={revLoading}
          value={revenue ? formatCurrency(revenue.total_predicted || 0) : null}
          accent="text-primary"
          sub={revenue?.total_predicted ? `≈ ${formatCurrency((revenue.total_predicted || 0) / 30)}/วัน` : undefined}
        />
        <SummaryCard
          label="ข้อมูลย้อนหลังที่ใช้"
          icon={<Calendar className="w-4 h-4" />}
          loading={revLoading}
          value={actualPoints > 0 ? `${actualPoints} วัน` : null}
          accent="text-foreground"
          sub={
            actualPoints < 14
              ? '⚠️ น้อยเกินไป — ผลอาจไม่แม่น'
              : actualPoints < 30
              ? 'ดีพอใช้ — ยิ่งเก็บนานยิ่งแม่น'
              : '✓ ข้อมูลพอแล้ว'
          }
        />
        <SummaryCard
          label="ช่วงเวลาขายดีที่สุด"
          icon={<Clock className="w-4 h-4" />}
          loading={peakLoading}
          value={
            peak?.peak_hours?.length
              ? peak.peak_hours.map((p: any) => `${p.hour}:00`).join(', ')
              : null
          }
          accent="text-success"
          sub={
            peak?.peak_hours?.length
              ? `รวม ${peak.peak_hours.reduce((s: number, p: any) => s + p.orders, 0)} ออเดอร์`
              : undefined
          }
        />
      </div>

      {/* Forecast chart */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> พยากรณ์รายได้
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              เส้นทึบ = ยอดจริง · พื้นที่ส้ม = ช่วงคาดการณ์ (95% confidence)
            </p>
          </div>
          {series.length > 0 && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <Legend color="#FF6B35" label="คาดการณ์" />
              <Legend color="#FED7AA" label="ช่วงเชื่อมั่น" />
            </div>
          )}
        </div>

        {revLoading ? (
          <div className="shimmer h-[360px] rounded-xl" />
        ) : series.length === 0 ? (
          <EmptyChart
            title={isAnalyticsDown ? 'รอข้อมูล' : 'ยังไม่มีข้อมูลพอจะพยากรณ์'}
            description={
              isAnalyticsDown
                ? 'รอเชื่อมต่อกับบริการพยากรณ์...'
                : `ต้องมีออเดอร์อย่างน้อย 7-14 วันที่ผ่านมา ตอนนี้มี ${actualPoints} วัน`
            }
          />
        ) : (
          <ResponsiveContainer width="100%" height={360}>
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

        {/* Forecast meta footer */}
        {series.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>
              ข้อมูลย้อนหลัง {actualPoints} วัน · พยากรณ์ {forecastPoints} วันข้างหน้า
            </span>
            <span>อัปเดตเมื่อ refresh หน้า</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  icon,
  loading,
  value,
  sub,
  accent,
}: {
  label: string;
  icon: React.ReactNode;
  loading: boolean;
  value: string | null;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon} <span>{label}</span>
      </div>
      {loading ? (
        <div className="shimmer h-7 rounded mt-2 w-2/3" />
      ) : value ? (
        <>
          <div className={`text-xl font-semibold mt-1.5 tabular-nums truncate ${accent || 'text-foreground'}`}>
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

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block w-3 h-2 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

function EmptyChart({ title, description }: { title: string; description: string }) {
  return (
    <div className="h-[360px] flex flex-col items-center justify-center text-center px-6">
      <Sparkles className="w-10 h-10 text-muted-foreground/40 mb-3" />
      <div className="font-medium mb-1">{title}</div>
      <div className="text-xs text-muted-foreground max-w-sm">{description}</div>
    </div>
  );
}

export default function Page() {
  return (
    <DashboardShell>
      <ForecastContent />
    </DashboardShell>
  );
}
