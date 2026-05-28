'use client';
import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Loader2, AlertCircle, FlaskConical, Percent, TagIcon } from 'lucide-react';
import { api, formatCurrency } from '@/lib/api';
import { useStoreId } from '@/components/DashboardShell';
import { PageIntro } from '@/components/PageIntro';

export default function WhatIfPage() {
  const storeId = useStoreId();
  const [mode, setMode] = useState<'discount' | 'price'>('discount');

  // Discount what-if
  const [discountPct, setDiscountPct] = useState(10);
  const { data: discountResult, error: discountError } = useQuery({
    queryKey: ['whatif-discount', storeId, discountPct],
    queryFn: () =>
      api.get('/api/whatif/discount', {
        params: { store_id: storeId, discount_pct: discountPct, days: 30 },
      }).then((r) => r.data),
    enabled: !!storeId && mode === 'discount',
  });

  // Product list for the price what-if dropdown — much friendlier than asking
  // the user to copy a product id from a different page.
  const { data: topProducts = [] } = useQuery({
    queryKey: ['whatif-products', storeId],
    queryFn: () =>
      api
        .get('/api/analytics/top-products', { params: { store_id: storeId, days: 90, limit: 60 } })
        .then((r) => r.data),
    enabled: !!storeId && mode === 'price',
  });

  // Price what-if
  const [productId, setProductId] = useState('');
  const [newPrice, setNewPrice] = useState(0);

  // Auto-fill new price = current price when product changes
  const selectedProduct = useMemo(
    () => topProducts.find((p: any) => p.id === productId),
    [topProducts, productId]
  );
  useEffect(() => {
    if (selectedProduct && !newPrice) {
      setNewPrice(Number(selectedProduct.price) || 0);
    }
  }, [selectedProduct, newPrice]);

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
        whatItTells="ก่อนลดราคา/ขึ้นราคา ลองให้ระบบคำนวณก่อนว่าจะได้ผลยังไง — ดูตัวเลข ก่อนตัดสินใจ"
        howToUse={[
          'เลื่อน slider ดูทันที — ยอดขาย/กำไร จะเปลี่ยนเท่าไร',
          'ขึ้นราคาเมนู → ลูกค้าจะซื้อน้อยลงแค่ไหน คุ้มกันหรือเปล่า',
          'ระบบประเมินจากค่า elasticity = -1.2 ของธุรกิจอาหาร/เครื่องดื่ม',
        ]}
        tip="ใช้ก่อนเปลี่ยนราคาจริงๆ — ลดความเสี่ยงและทำตัดสินใจง่ายขึ้น"
      />

      {/* Mode tabs */}
      <div className="flex border border-border rounded-md p-0.5 max-w-md text-sm">
        <button
          onClick={() => setMode('discount')}
          className={`flex-1 py-2 rounded-sm transition-colors flex items-center justify-center gap-1.5 ${
            mode === 'discount'
              ? 'bg-foreground text-background font-medium'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Percent className="w-3.5 h-3.5" />
          ส่วนลดทั่วบิล
        </button>
        <button
          onClick={() => setMode('price')}
          className={`flex-1 py-2 rounded-sm transition-colors flex items-center justify-center gap-1.5 ${
            mode === 'price'
              ? 'bg-foreground text-background font-medium'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <TagIcon className="w-3.5 h-3.5" />
          เปลี่ยนราคาเมนู
        </button>
      </div>

      {/* Error banner for analytics down */}
      {((mode === 'discount' && discountError) || priceResult.error) && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground">
            เชื่อมต่อ analytics service ไม่ได้ — ตรวจสอบว่ารัน{' '}
            <code className="bg-card px-1 rounded">analytics-api</code> ที่ port 8000
          </div>
        </div>
      )}

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
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <div>
              <label className="text-sm mb-1.5 block font-medium">
                เลือกเมนู
                <span className="text-xs text-muted-foreground font-normal ml-1">
                  (จาก 60 เมนูขายดีที่สุด 90 วัน)
                </span>
              </label>
              <select
                value={productId}
                onChange={(e) => {
                  setProductId(e.target.value);
                  setNewPrice(0); // reset so useEffect refills with current price
                }}
                className="w-full bg-card border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              >
                <option value="">— กรุณาเลือกเมนู —</option>
                {topProducts.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · ราคาปัจจุบัน {formatCurrency(p.price)} · ขาย {p.qty_sold || 0}×
                  </option>
                ))}
              </select>
              {topProducts.length === 0 && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  ยังไม่มีข้อมูลขาย — ต้องมีออเดอร์อย่างน้อย 1 รายการ
                </p>
              )}
            </div>

            {selectedProduct && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/40 rounded-md p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                    ราคาเดิม
                  </div>
                  <div className="text-xl font-semibold tabular-nums">
                    {formatCurrency(selectedProduct.price)}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5 block">
                    ราคาใหม่ที่ต้องการลอง
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={newPrice || ''}
                    onChange={(e) => setNewPrice(Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-card border border-border rounded-md px-3 py-2 text-xl font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
              </div>
            )}

            {/* Quick suggest buttons */}
            {selectedProduct && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[-10, -5, 5, 10, 20].map((delta) => {
                  const p = Number(selectedProduct.price) + delta;
                  if (p <= 0) return null;
                  return (
                    <button
                      key={delta}
                      onClick={() => setNewPrice(p)}
                      className="text-xs px-2.5 py-1 rounded-md border border-border hover:border-primary hover:bg-primary/5 tabular-nums"
                    >
                      {delta > 0 ? '+' : ''}
                      {delta} → {formatCurrency(p)}
                    </button>
                  );
                })}
              </div>
            )}

            <button
              onClick={() => priceResult.mutate()}
              disabled={!productId || !newPrice || priceResult.isPending}
              className="w-full h-11 bg-primary text-primary-foreground rounded-md text-sm font-semibold disabled:opacity-50 hover:bg-primary-600 inline-flex items-center justify-center gap-2"
            >
              {priceResult.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FlaskConical className="w-4 h-4" />
              )}
              ลองคำนวณ
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
