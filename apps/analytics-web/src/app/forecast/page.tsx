'use client';
import { useQuery } from '@tanstack/react-query';
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';
import { Clock, TrendingUp } from 'lucide-react';
import { DashboardShell, useStoreId } from '@/components/DashboardShell';
import { api, formatCurrency, formatDate } from '@/lib/api';

function ForecastContent() {
  const storeId = useStoreId();

  const { data: revenue } = useQuery({
    queryKey: ['fc-revenue', storeId],
    queryFn: () => api.get('/api/forecast/revenue', { params: { store_id: storeId, days_ahead: 30 } }).then((r) => r.data),
  });

  const { data: peak } = useQuery({
    queryKey: ['fc-peak', storeId],
    queryFn: () => api.get('/api/forecast/peak-hours', { params: { store_id: storeId } }).then((r) => r.data),
  });

  // หาจุดที่เริ่ม forecast
  const series = revenue?.series || [];
  const firstForecast = series.find((s: any) => s.is_forecast)?.date;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Forecast</h1>
        <p className="text-muted-foreground text-sm">พยากรณ์ด้วย Prophet — ข้อมูลจริง + คาดการณ์</p>
      </div>

      {/* Summary */}
      {revenue && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <TrendingUp className="w-4 h-4" /> รายได้คาดการณ์ 30 วันข้างหน้า
            </div>
            <div className="text-3xl font-bold mt-2 text-primary">
              {formatCurrency(revenue.total_predicted)}
            </div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Clock className="w-4 h-4" /> ช่วงเวลาขายดีที่สุด
            </div>
            <div className="flex gap-3 mt-2">
              {peak?.peak_hours?.map((p: any) => (
                <div key={p.hour} className="text-center">
                  <div className="text-2xl font-bold text-accent">{p.hour}:00</div>
                  <div className="text-xs text-muted-foreground">{p.orders} ออเดอร์</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Forecast chart */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="font-semibold mb-4">พยากรณ์รายได้ (เส้นทึบ = จริง, พื้นที่ = ช่วงคาดการณ์)</h3>
        <ResponsiveContainer width="100%" height={360}>
          <ComposedChart data={series}>
            <defs>
              <linearGradient id="band" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF6B35" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#FF6B35" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
            <XAxis dataKey="date" tickFormatter={formatDate} stroke="#6B7280" fontSize={11} axisLine={false} tickLine={false} />
            <YAxis stroke="#6B7280" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px -2px rgba(0,0,0,0.08)' }}
              labelFormatter={formatDate}
              formatter={(v: any, name: any) => [formatCurrency(v), name]}
            />
            {firstForecast && (
              <ReferenceLine x={firstForecast} stroke="#F59E0B" strokeDasharray="4 4" label={{ value: 'วันนี้', fill: '#F59E0B', fontSize: 10 }} />
            )}
            <Area dataKey="upper" stroke="none" fill="url(#band)" name="ขอบบน" />
            <Area dataKey="lower" stroke="none" fill="#FFFFFF" name="ขอบล่าง" />
            <Line dataKey="predicted" stroke="#FF6B35" strokeWidth={2} dot={false} name="คาดการณ์" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
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
