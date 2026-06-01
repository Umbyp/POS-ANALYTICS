'use client';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, AlertCircle, TrendingUp, Crown, Tag, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { api, formatCurrency } from '@/lib/api';
import { useStoreId } from '@/components/DashboardShell';
import { PageIntro } from '@/components/PageIntro';
import { InsightBanner, BannerAction } from '@/components/InsightBanner';
import { rowsToCsv, downloadCsv } from '@/lib/export';

// ใช้ภาษาที่เจ้าของร้านเข้าใจทันที — ไม่ใช้ Stars/Dogs/Puzzles
const QUADRANT_META: Record<
  string,
  {
    label: string;
    color: string;
    bg: string;
    border: string;
    oneLine: string;
    action: string;
    actionVerb: string;
    icon: any;
  }
> = {
  Star: {
    label: 'เมนูดาว',
    color: 'text-success',
    bg: 'bg-success/10',
    border: 'border-success/40',
    oneLine: 'กำไรดี + ขายดี',
    action: 'เก็บไว้และโปรโมตเป็นเมนูแนะนำ — ติดป้าย "เมนูยอดนิยม" / โพสต์รูปสวยๆ บน social',
    actionVerb: 'รักษา',
    icon: Crown,
  },
  Puzzle: {
    label: 'มีศักยภาพ',
    color: 'text-primary',
    bg: 'bg-primary/10',
    border: 'border-primary/40',
    oneLine: 'กำไรดี แต่ขายน้อย',
    action: 'push ให้คนรู้จัก — วางหน้าเมนู, ใส่ในเซ็ต Combo, ลด 10% ช่วงแรก',
    actionVerb: 'โปรโมต',
    icon: TrendingUp,
  },
  Plowhorse: {
    label: 'ขายดีแต่ไม่กำไร',
    color: 'text-warning',
    bg: 'bg-warning/10',
    border: 'border-warning/40',
    oneLine: 'ขายดี + กำไรต่อชิ้นต่ำ',
    action: 'ขึ้นราคา 5-10 บาท หรือลดต้นทุนวัตถุดิบ — ลูกค้าซื้ออยู่แล้ว ปรับนิดเพิ่มกำไรเยอะ',
    actionVerb: 'ปรับราคา',
    icon: Tag,
  },
  Dog: {
    label: 'ตัดได้',
    color: 'text-danger',
    bg: 'bg-danger/10',
    border: 'border-danger/40',
    oneLine: 'ขายน้อย + กำไรต่ำ',
    action: 'พิจารณาตัดออก / rebrand — ลดความซับซ้อนของครัว + วัตถุดิบไม่หมดอายุค้าง',
    actionVerb: 'พิจารณาตัด',
    icon: Trash2,
  },
};

export default function MenuEngineeringPage() {
  const storeId = useStoreId();
  const { data, isLoading, error } = useQuery({
    queryKey: ['menu-eng', storeId],
    queryFn: () =>
      api.get('/api/menu-engineering', { params: { store_id: storeId, days: 30 } }).then((r) => r.data),
    enabled: !!storeId,
  });

  const items = data?.items || [];
  const summary = data?.summary || {};
  const grouped: Record<string, any[]> = useMemo(() => {
    const g: Record<string, any[]> = { Star: [], Plowhorse: [], Puzzle: [], Dog: [] };
    for (const item of items) g[item.quadrant]?.push(item);
    // Sort each group by profit desc
    for (const k of Object.keys(g)) {
      g[k].sort((a, b) => (b.profit || 0) - (a.profit || 0));
    }
    return g;
  }, [items]);

  // Generate the most actionable banner based on data
  const banner = useMemo(() => {
    if (items.length === 0) return null;
    const plowhorses = grouped.Plowhorse || [];
    const dogs = grouped.Dog || [];
    const puzzles = grouped.Puzzle || [];

    // Highest opportunity = plowhorse (sell-well-but-low-margin)
    if (plowhorses.length >= 2) {
      const topPlow = plowhorses[0];
      const potentialUplift = plowhorses
        .slice(0, 3)
        .reduce((s, p) => s + (p.qty_sold || 0) * 5, 0); // 5 baht price bump x sold qty
      return {
        tone: 'warning' as const,
        title: `มี ${plowhorses.length} เมนูขายดีแต่กำไรต่ำ`,
        description: (
          <>
            ถ้าขึ้นราคา 5 บาทกับ 3 เมนูแรก (เริ่มจาก <strong>{topPlow.name}</strong>) อาจเพิ่มกำไรได้
            ประมาณ <strong>{formatCurrency(potentialUplift)}/เดือน</strong> โดยไม่กระทบยอดขายมาก
          </>
        ),
        metric: { label: 'รายได้เพิ่ม/เดือน', value: `+${formatCurrency(potentialUplift)}` },
      };
    }

    if (dogs.length >= 3) {
      return {
        tone: 'critical' as const,
        title: `มี ${dogs.length} เมนูไม่ทำเงิน`,
        description:
          'ขายไม่ออก + กำไรต่ำ — พิจารณาตัดออก หรือ rebrand เพื่อลดความซับซ้อนในครัว',
      };
    }

    if (puzzles.length >= 2) {
      return {
        tone: 'info' as const,
        title: `มี ${puzzles.length} เมนูที่กำไรดีแต่คนยังไม่รู้จัก`,
        description:
          'ลองวางหน้าเมนู, โพสต์ social, ใส่ใน Combo — กำไรต่อจานสูง รอแค่คนเห็น',
      };
    }

    return {
      tone: 'good' as const,
      title: 'เมนูในร้านมี balance ดีอยู่แล้ว',
      description: 'มีทั้งเมนูดาวและเมนูมีศักยภาพ — รักษาคุณภาพและสำรวจเทรนด์ใหม่ๆ',
    };
  }, [items, grouped]);

  const exportAll = () => {
    const rows = items.map((i: any) => ({
      name: i.name,
      quadrant: QUADRANT_META[i.quadrant]?.label || i.quadrant,
      action: QUADRANT_META[i.quadrant]?.actionVerb || '',
      qty_sold: i.qty_sold,
      revenue: i.revenue,
      profit: i.profit,
      profit_margin_pct: i.profit_margin ? (i.profit_margin * 100).toFixed(1) : '',
    }));
    const csv = rowsToCsv(rows, [
      { label: 'ชื่อเมนู', value: (r: any) => r.name },
      { label: 'กลุ่ม', value: (r: any) => r.quadrant },
      { label: 'ควรทำ', value: (r: any) => r.action },
      { label: 'ขาย (ชิ้น)', value: (r: any) => r.qty_sold },
      { label: 'รายได้', value: (r: any) => r.revenue },
      { label: 'กำไร', value: (r: any) => r.profit },
      { label: 'อัตรากำไร (%)', value: (r: any) => r.profit_margin_pct },
    ]);
    downloadCsv(`menu-engineering-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  if (error) {
    return (
      <div className="p-6 space-y-5 max-w-screen-xl">
        <PageIntro
          title="เมนูไหนทำเงิน"
          whatItTells="ดูเมนูแต่ละตัวว่าขายดี + ทำกำไรหรือไม่"
          howToUse={[]}
        />
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-medium">เชื่อมต่อ Analytics service ไม่ได้</div>
            <div className="text-muted-foreground mt-1">รัน analytics-api ที่ port 8000 ก่อน</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-screen-xl">
      <PageIntro
        title="เมนูไหนทำเงิน"
        whatItTells="แบ่งเมนูทุกตัวเป็น 4 กลุ่ม จาก 2 มิติ: ขายดีหรือไม่ + กำไรเยอะหรือไม่ — รู้ทันทีว่าควรทำอะไรกับเมนูไหน"
        howToUse={[
          'ดูข้อแนะนำในกล่องด้านบน — บอกว่าควรเริ่มจากไหน',
          'เปิดกลุ่ม "ขายดีแต่ไม่กำไร" — ขึ้นราคา 5-10 บาทมัก work',
          'กลุ่ม "มีศักยภาพ" → จัดโปรหรือวางหน้าเมนูให้เห็น',
          'Export CSV เอาไปประชุมหรือ share กับทีมครัวได้',
        ]}
        tip={`วิเคราะห์จากยอดขาย 30 วันล่าสุด · เมนูที่ขายเกิน ${
          summary.pop_threshold?.toFixed(0) || '?'
        } ชิ้น = "ขายดี"`}
      />

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-3">
          <div className="shimmer h-24 rounded-lg" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="shimmer h-24 rounded-lg" />
            ))}
          </div>
        </div>
      )}

      {/* Insight banner */}
      {banner && !isLoading && (
        <InsightBanner
          tone={banner.tone}
          title={banner.title}
          description={banner.description}
          metric={banner.metric}
          actions={
            <>
              <Link href="/promotions">
                <BannerAction>
                  <Tag className="w-3.5 h-3.5" /> สร้างโปรโมชัน
                </BannerAction>
              </Link>
              <BannerAction variant="outline" onClick={exportAll}>
                <Download className="w-3.5 h-3.5" /> Export ทั้งหมด
              </BannerAction>
            </>
          }
        />
      )}

      {/* Quadrant summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['Star', 'Puzzle', 'Plowhorse', 'Dog'] as const).map((q) => {
          const meta = QUADRANT_META[q];
          const count = grouped[q].length;
          const Icon = meta.icon;
          return (
            <div key={q} className={`rounded-lg border p-4 ${meta.bg} ${meta.border}`}>
              <div className={`flex items-center gap-1.5 text-xs uppercase tracking-wider font-semibold ${meta.color}`}>
                <Icon className="w-3.5 h-3.5" />
                {meta.label}
              </div>
              <div className="text-2xl font-semibold tabular-nums mt-1.5">{count}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{meta.oneLine}</div>
            </div>
          );
        })}
      </div>

      {/* Detail per quadrant */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(['Star', 'Puzzle', 'Plowhorse', 'Dog'] as const).map((q) => {
          const meta = QUADRANT_META[q];
          const list = grouped[q] || [];
          const Icon = meta.icon;
          return (
            <div key={q} className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-md flex items-center justify-center ${meta.bg} ${meta.border} border`}
                  >
                    <Icon className={`w-4 h-4 ${meta.color}`} />
                  </div>
                  <div>
                    <h3 className={`text-sm font-semibold ${meta.color}`}>{meta.label}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{meta.oneLine}</p>
                  </div>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {list.length} เมนู
                </span>
              </div>

              <div className="bg-muted/40 rounded-md p-2.5 mb-3 text-xs leading-relaxed">
                <span className="font-medium text-foreground">{meta.actionVerb}: </span>
                <span className="text-muted-foreground">{meta.action}</span>
              </div>

              {list.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">
                  ไม่มีเมนูในกลุ่มนี้
                </p>
              ) : (
                <div className="space-y-1 max-h-80 overflow-y-auto scrollbar-thin">
                  {list.map((item: any) => {
                    const margin = item.profit_margin
                      ? (item.profit_margin * 100).toFixed(0)
                      : null;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 px-2 py-2 rounded hover:bg-card-hover/40"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{item.name}</div>
                          <div className="text-[10px] text-muted-foreground tabular-nums">
                            ขาย {item.qty_sold}× · {formatCurrency(item.revenue || 0)}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-semibold tabular-nums">
                            {formatCurrency(item.profit || 0)}
                          </div>
                          {margin && (
                            <div className="text-[10px] text-muted-foreground tabular-nums">
                              {margin}% margin
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer export */}
      {items.length > 0 && (
        <div className="text-center pt-2">
          <button
            onClick={exportAll}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV ทั้งหมด ({items.length} เมนู)
          </button>
        </div>
      )}
    </div>
  );
}
