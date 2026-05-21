'use client';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { api, formatCurrency } from '@/lib/api';
import { useStoreId } from '@/components/DashboardShell';
import { PageIntro } from '@/components/PageIntro';

export default function WhatIfPage() {
  const storeId = useStoreId();
  const [mode, setMode] = useState<'discount' | 'price'>('discount');

  // Discount what-if
  const [discountPct, setDiscountPct] = useState(10);
  const { data: discountResult } = useQuery({
    queryKey: ['whatif-discount', storeId, discountPct],
    queryFn: () =>
      api.get('/api/whatif/discount', {
        params: { store_id: storeId, discount_pct: discountPct, days: 30 },
      }).then((r) => r.data),
    enabled: !!storeId && mode === 'discount',
  });

  // Price what-if
  const [productId, setProductId] = useState('');
  const [newPrice, setNewPrice] = useState(0);
  const priceResult = useMutation({
    mutationFn: () =>
      api.get('/api/whatif/price', {
        params: { store_id: storeId, product_id: productId, new_price: newPrice },
      }).then((r) => r.data),
  });

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <PageIntro
        title="ลองคำนวณก่อนตัดสินใจ"
        whatItTells="ก่อนตัดสินใจลดราคาหรือเปลี่ยนราคา ลองให้ระบบคำนวณก่อนว่าจะได้ผลยังไง"
        howToUse={[
          'ลดราคา X% — จะได้ออเดอร์เพิ่ม แต่ลดยอด/บิล คุ้มไหม?',
          'ขึ้นราคาเมนูนี้ — คนจะซื้อน้อยลงแค่ไหน',
          'ดูตัวเลขเปรียบเทียบ "ปัจจุบัน vs ถ้าทำตามนี้"',
        ]}
        tip="ระบบประเมินจากความเป็นจริงของธุรกิจอาหาร/เครื่องดื่ม (elasticity = -1.2)"
      />

      {/* Mode tabs */}
      <div className="flex border border-border rounded-md p-0.5 max-w-md text-sm">
        <button
          onClick={() => setMode('discount')}
          className={`flex-1 py-1.5 rounded-sm transition-colors ${
            mode === 'discount'
              ? 'bg-foreground text-background font-medium'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          ถ้าให้ส่วนลดทั่วบิล
        </button>
        <button
          onClick={() => setMode('price')}
          className={`flex-1 py-1.5 rounded-sm transition-colors ${
            mode === 'price'
              ? 'bg-foreground text-background font-medium'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          ถ้าเปลี่ยนราคาเมนู
        </button>
      </div>

      {mode === 'discount' ? (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-lg p-5">
            <label className="text-sm mb-1 block">
              ส่วนลดทั่วบิล: <span className="font-semibold text-foreground tabular-nums">{discountPct}%</span>
            </label>
            <p className="text-xs text-muted-foreground mb-3">
              เลื่อนเพื่อดูว่าให้ส่วนลดเท่าไหร่ ยอดขายจะเปลี่ยนยังไง
            </p>
            <input
              type="range"
              min="0"
              max="50"
              step="5"
              value={discountPct}
              onChange={(e) => setDiscountPct(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
            </div>
          </div>

          {discountResult && !discountResult.error && (
            <ResultCard
              currentLabel="ปัจจุบัน (30 วัน)"
              projectedLabel={`ถ้าให้ส่วนลด ${discountPct}%`}
              current={discountResult.current}
              projected={discountResult.projected}
              recommendation={discountResult.recommendation}
            />
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-lg p-5 space-y-3">
            <div>
              <label className="text-sm mb-1.5 block">รหัสสินค้า (Product ID)</label>
              <input
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                placeholder="cmp..."
                className="w-full bg-card-hover border border-border rounded-md px-3 py-2 text-sm font-mono"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                ดูจากหน้า /products ของ POS — copy ID ของเมนูที่ต้องการลอง
              </p>
            </div>
            <div>
              <label className="text-sm mb-1.5 block">ราคาใหม่ (บาท)</label>
              <input
                type="number"
                value={newPrice || ''}
                onChange={(e) => setNewPrice(Number(e.target.value))}
                placeholder="0"
                className="w-full bg-card-hover border border-border rounded-md px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={() => priceResult.mutate()}
              disabled={!productId || !newPrice || priceResult.isPending}
              className="w-full bg-foreground text-background py-2 rounded-md text-sm font-medium disabled:opacity-50"
            >
              {priceResult.isPending ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'ลองคำนวณ'}
            </button>
          </div>

          {priceResult.data && !priceResult.data.error && (
            <ResultCard
              currentLabel={`ราคาปัจจุบัน ${formatCurrency(priceResult.data.product.current_price)}`}
              projectedLabel={`ถ้าเปลี่ยนเป็น ${formatCurrency(priceResult.data.scenario.new_price)}`}
              current={{
                orders: priceResult.data.projections_60days.current_qty,
                revenue: priceResult.data.projections_60days.current_revenue,
                avg_ticket: priceResult.data.product.current_price,
              }}
              projected={{
                orders: priceResult.data.projections_60days.projected_qty,
                revenue: priceResult.data.projections_60days.projected_revenue,
                avg_ticket: priceResult.data.scenario.new_price,
                revenue_delta: priceResult.data.projections_60days.revenue_delta,
                revenue_delta_pct:
                  (priceResult.data.projections_60days.revenue_delta /
                    priceResult.data.projections_60days.current_revenue) *
                  100,
              }}
              recommendation={priceResult.data.recommendation}
              extraInfo={
                <div className="text-xs">
                  <span className="text-muted-foreground">กำไรเปลี่ยน: </span>
                  <span
                    className={
                      priceResult.data.projections_60days.profit_delta >= 0
                        ? 'text-success font-medium'
                        : 'text-danger font-medium'
                    }
                  >
                    {priceResult.data.projections_60days.profit_delta >= 0 ? '+' : ''}
                    {formatCurrency(priceResult.data.projections_60days.profit_delta)}
                  </span>
                </div>
              }
            />
          )}
        </div>
      )}
    </div>
  );
}

function ResultCard({
  currentLabel,
  projectedLabel,
  current,
  projected,
  recommendation,
  extraInfo,
}: {
  currentLabel: string;
  projectedLabel: string;
  current: any;
  projected: any;
  recommendation: string;
  extraInfo?: React.ReactNode;
}) {
  const up = projected.revenue_delta >= 0;
  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
            {currentLabel}
          </div>
          <div className="text-metric-md tabular-nums">{formatCurrency(current.revenue)}</div>
          <div className="text-xs text-muted-foreground mt-1.5">
            {current.orders} ออเดอร์ · เฉลี่ย/บิล {formatCurrency(current.avg_ticket)}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
            {projectedLabel}
          </div>
          <div
            className={`text-metric-md tabular-nums ${up ? 'text-success' : 'text-danger'}`}
          >
            {formatCurrency(projected.revenue)}
          </div>
          <div className="text-xs text-muted-foreground mt-1.5">
            {projected.orders} ออเดอร์ · เฉลี่ย/บิล {formatCurrency(projected.avg_ticket)}
          </div>
        </div>
      </div>

      <div
        className={`p-3 rounded-md border ${
          up ? 'border-success/40 bg-success/5' : 'border-danger/40 bg-danger/5'
        }`}
      >
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
          ผลที่จะได้
        </div>
        <div className="text-sm mb-1">
          รายได้เปลี่ยน{' '}
          <span className={`font-semibold tabular-nums ${up ? 'text-success' : 'text-danger'}`}>
            {up ? '+' : ''}
            {formatCurrency(projected.revenue_delta || 0)}
            <span className="text-xs ml-1.5">
              ({projected.revenue_delta_pct >= 0 ? '+' : ''}
              {projected.revenue_delta_pct?.toFixed(1)}%)
            </span>
          </span>
        </div>
        <div className="text-sm">{recommendation}</div>
        {extraInfo && <div className="mt-2">{extraInfo}</div>}
      </div>
    </div>
  );
}
