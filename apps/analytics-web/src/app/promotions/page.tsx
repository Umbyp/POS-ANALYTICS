'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Loader2,
  AlertCircle,
  Tag,
  Copy,
  ChevronDown,
  Sparkles,
  ShoppingBasket,
  Clock,
  UserPlus,
  TrendingUp,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useStoreId } from '@/components/DashboardShell';
import { PageIntro } from '@/components/PageIntro';
import { copyToClipboard } from '@/lib/export';

const TYPE_META: Record<
  string,
  { label: string; icon: any; color: string; bg: string }
> = {
  BUNDLE: {
    label: 'จัดเซต / Combo',
    icon: ShoppingBasket,
    color: 'text-primary',
    bg: 'bg-primary/10 border-primary/30',
  },
  HAPPY_HOUR: {
    label: 'ลดราคาช่วงเวลา',
    icon: Clock,
    color: 'text-warning',
    bg: 'bg-warning/10 border-warning/30',
  },
  WINBACK: {
    label: 'ดึงลูกค้าเก่ากลับ',
    icon: UserPlus,
    color: 'text-danger',
    bg: 'bg-danger/10 border-danger/30',
  },
  PRICE_UP: {
    label: 'ขึ้นราคา',
    icon: TrendingUp,
    color: 'text-success',
    bg: 'bg-success/10 border-success/30',
  },
  PROMOTE: {
    label: 'โปรโมตเมนู',
    icon: Sparkles,
    color: 'text-primary',
    bg: 'bg-primary/10 border-primary/30',
  },
};

export default function PromotionsPage() {
  const storeId = useStoreId();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [copyMsg, setCopyMsg] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['promo-recommend', storeId],
    queryFn: () =>
      api.get('/api/promotions/recommend', { params: { store_id: storeId } }).then((r) => r.data),
    enabled: !!storeId,
  });

  const suggestions = data?.suggestions || [];

  const showToast = (text: string) => {
    setCopyMsg(text);
    setTimeout(() => setCopyMsg(''), 2500);
  };

  const copyConfig = async (config: any) => {
    const json = JSON.stringify(config, null, 2);
    const ok = await copyToClipboard(json);
    if (ok) showToast('คัดลอกค่าโปรโมชันแล้ว');
  };

  if (error) {
    return (
      <div className="p-6 space-y-5 max-w-4xl">
        <PageIntro
          title="แนะนำโปรโมชัน"
          whatItTells="AI ดูข้อมูลร้านคุณ แล้วเสนอโปรโมชันที่น่าจะได้ผล"
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
    <div className="p-6 space-y-5 max-w-4xl">
      <PageIntro
        title="แนะนำโปรโมชัน"
        whatItTells="AI ดูข้อมูลร้านคุณแล้วเสนอโปรโมชันที่คิดว่าจะได้ผล — พร้อมเหตุผลและคาดการณ์ผลลัพธ์"
        howToUse={[
          'อ่านโปรที่แนะนำ → คลิก "ดูวิธีตั้งค่า" → ก๊อปค่า JSON',
          'ไปที่ POS Settings → Promotions → สร้างโปรใหม่ตามค่าที่ก๊อป',
          'ลองเปิดทีละ 1-2 โปร ดูยอดเทียบสัปดาห์ก่อน-หลัง',
        ]}
        tip="ระบบใช้ข้อมูลขายจริงของร้าน — ยิ่งเก็บข้อมูลนาน คำแนะนำยิ่งแม่นยำ"
      />

      {isLoading && (
        <div className="space-y-3">
          <div className="shimmer h-32 rounded-lg" />
          <div className="shimmer h-32 rounded-lg" />
          <div className="shimmer h-32 rounded-lg" />
        </div>
      )}

      {!isLoading && suggestions.length === 0 && (
        <div className="bg-card border border-border rounded-lg p-10 text-center">
          <Sparkles className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <div className="font-medium mb-1">ยังไม่พบโปรที่แนะนำ</div>
          <div className="text-sm text-muted-foreground max-w-md mx-auto">
            ระบบต้องการข้อมูลขายอย่างน้อย 2-4 สัปดาห์ ลองเก็บข้อมูลเพิ่ม
            หรือกลับมาดูใหม่หลังจากร้านเปิดมาสักพัก
          </div>
        </div>
      )}

      {/* Suggestion cards */}
      <div className="space-y-3">
        {suggestions.map((s: any, i: number) => {
          const meta = TYPE_META[s.type] || {
            label: s.type,
            icon: Tag,
            color: 'text-foreground',
            bg: 'bg-muted',
          };
          const Icon = meta.icon;
          const isOpen = expanded === i;

          return (
            <div key={i} className="bg-card border border-border rounded-lg overflow-hidden">
              {/* Header */}
              <div className="p-5">
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${meta.bg}`}
                  >
                    <Icon className={`w-5 h-5 ${meta.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[10px] uppercase tracking-wider font-semibold ${meta.color}`}>
                      {meta.label}
                    </div>
                    <h3 className="text-base font-semibold mt-0.5">{s.title}</h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                      ทำไมถึงแนะนำ
                    </div>
                    <div className="text-sm leading-relaxed">{s.reason}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                      คาดว่าจะได้ผล
                    </div>
                    <div className="text-sm text-success font-medium">{s.estimated_impact}</div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                  {s.config && (
                    <>
                      <button
                        onClick={() => copyConfig(s.config)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary-600 text-xs font-medium"
                      >
                        <Copy className="w-3.5 h-3.5" /> ก๊อปค่าโปรโมชัน
                      </button>
                      <button
                        onClick={() => setExpanded(isOpen ? null : i)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border hover:bg-card-hover text-xs font-medium"
                      >
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                        ดูวิธีตั้งค่า
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Expanded config + walkthrough */}
              {isOpen && s.config && (
                <div className="border-t border-border bg-muted/30 p-5 space-y-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                      ขั้นตอนใช้งาน
                    </div>
                    <ol className="text-sm space-y-1.5 list-decimal list-inside leading-relaxed">
                      <li>เปิด POS → Settings → Promotions</li>
                      <li>กด "เพิ่มโปรโมชันใหม่"</li>
                      <li>กรอกค่าตามด้านล่าง (ก๊อปแต่ละช่องจาก JSON ได้)</li>
                      <li>Save แล้วทดสอบที่หน้า POS</li>
                    </ol>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        ค่าที่ต้องใส่
                      </div>
                      <button
                        onClick={() => copyConfig(s.config)}
                        className="text-[11px] text-primary hover:underline flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" /> ก๊อป
                      </button>
                    </div>
                    <pre className="text-[11px] bg-card border border-border rounded-md p-3 overflow-x-auto font-mono">
                      {JSON.stringify(s.config, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Toast */}
      {copyMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background px-4 py-2 rounded-lg shadow-lg text-sm">
          {copyMsg}
        </div>
      )}
    </div>
  );
}
