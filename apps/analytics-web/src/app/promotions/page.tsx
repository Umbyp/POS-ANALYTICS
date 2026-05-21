'use client';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useStoreId } from '@/components/DashboardShell';
import { PageIntro } from '@/components/PageIntro';

const TYPE_LABEL: Record<string, string> = {
  BUNDLE: 'จัดเซต / Combo',
  HAPPY_HOUR: 'ลดราคาช่วงเวลา',
  WINBACK: 'ดึงลูกค้าเก่ากลับ',
  PRICE_UP: 'ขึ้นราคา',
  PROMOTE: 'โปรโมตเมนู',
};

export default function PromotionsPage() {
  const storeId = useStoreId();
  const { data, isLoading } = useQuery({
    queryKey: ['promo-recommend', storeId],
    queryFn: () =>
      api.get('/api/promotions/recommend', { params: { store_id: storeId } }).then((r) => r.data),
    enabled: !!storeId,
  });

  if (isLoading) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> AI กำลังคิดให้...
      </div>
    );
  }

  const suggestions = data?.suggestions || [];

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <PageIntro
        title="แนะนำโปรโมชัน"
        whatItTells="AI ดูข้อมูลร้านคุณแล้วเสนอโปรโมชันที่คิดว่าจะได้ผล — พร้อมเหตุผลและคาดการณ์ผลลัพธ์"
        howToUse={[
          'เลือกโปรที่ดูน่าสนใจ → ไป POS Settings → Promotions → ตั้งตาม config',
          'แต่ละโปรมีเหตุผลรองรับ — ไม่ใช่เดาสุ่ม',
          'ลองเปิดทีละ 1-2 โปร แล้วดูยอดเทียบสัปดาห์',
        ]}
        tip="เก็บข้อมูลขายเพิ่มเรื่อยๆ — AI จะแนะนำได้แม่นยำขึ้น"
      />

      {suggestions.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-10 text-center text-muted-foreground">
          ยังไม่พบ opportunity ที่ชัดเจน — เก็บข้อมูลเพิ่ม 2-4 สัปดาห์
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.map((s: any, i: number) => (
            <div key={i} className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    {TYPE_LABEL[s.type] || s.type}
                  </div>
                  <h3 className="text-base font-medium">{s.title}</h3>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    ทำไมถึงแนะนำ
                  </div>
                  <div className="text-sm">{s.reason}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    คาดว่าจะได้ผล
                  </div>
                  <div className="text-sm text-success">{s.estimated_impact}</div>
                </div>
              </div>

              {/* Config preview */}
              {s.config && (
                <details className="border-t border-border pt-3">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                    ดูค่าที่ต้องตั้งใน POS ▼
                  </summary>
                  <div className="mt-2 p-3 rounded-md bg-card-hover/40 border border-border">
                    <pre className="text-[11px] overflow-x-auto font-mono">
                      {JSON.stringify(s.config, null, 2)}
                    </pre>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      copy ค่าด้านบนไปสร้างโปรใน POS Settings → Promotions
                    </p>
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
