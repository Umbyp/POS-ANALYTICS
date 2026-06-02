'use client';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { formatCurrency, formatDate } from '@/lib/api';

export function RevenueChart({ data }: { data: any[] }) {
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h3 className="text-sm font-medium mb-4">Revenue trend</h3>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
          <defs>
            <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF6B35" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#FF6B35" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            stroke="#6B7280"
            fontSize={10}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            stroke="#6B7280"
            fontSize={10}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
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
            formatter={(v: any) => [formatCurrency(v), 'Revenue']}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#FF6B35"
            strokeWidth={2}
            fill="url(#rev)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Heatmap
const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function SalesHeatmap({ data }: { data: any[] }) {
  const max = Math.max(...data.map((d) => d.orders), 1);

  const getCell = (dow: number, hour: number) => {
    const cell = data.find((d) => d.dow === dow && d.hour === hour);
    return cell?.orders || 0;
  };

  const hours = Array.from({ length: 18 }, (_, i) => i + 6);

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h3 className="text-sm font-medium mb-4">Peak hours</h3>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full">
          <thead>
            <tr>
              <th className="w-8"></th>
              {hours.map((h) => (
                <th key={h} className="text-[9px] text-muted-foreground font-normal pb-1">
                  {h % 3 === 0 ? h : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3, 4, 5, 6].map((dow) => (
              <tr key={dow}>
                <td className="text-[10px] text-muted-foreground pr-2 font-medium">
                  {DOW[dow]}
                </td>
                {hours.map((h) => {
                  const val = getCell(dow, h);
                  const intensity = val / max;
                  return (
                    <td key={h} className="p-0.5">
                      <div
                        className="aspect-square rounded-sm"
                        style={{
                          background:
                            intensity === 0
                              ? '#F3F4F6'
                              : `rgba(255, 107, 53, ${0.15 + intensity * 0.75})`,
                        }}
                        title={`${DOW[dow]} ${h}:00 — ${val} orders`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TopProductsCard({ data }: { data: any[] }) {
  const maxRev = Math.max(...data.map((d) => d.revenue), 1);
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h3 className="text-sm font-medium mb-4">Top products</h3>
      <div className="space-y-3">
        {data.slice(0, 8).map((p, i) => (
          <div key={p.id}>
            <div className="flex justify-between text-sm mb-1">
              <span className="flex items-center gap-2 min-w-0">
                <span className="text-muted-foreground tabular-nums w-4 text-right shrink-0">
                  {i + 1}
                </span>
                <span className="truncate">{p.name}</span>
              </span>
              <span className="tabular-nums font-medium shrink-0">
                {formatCurrency(p.revenue)}
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${(p.revenue / maxRev) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
