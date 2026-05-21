'use client';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useStoreId } from '@/components/DashboardShell';
import { PageIntro } from '@/components/PageIntro';

export default function BasketPage() {
  const storeId = useStoreId();
  const { data, isLoading } = useQuery({
    queryKey: ['basket', storeId],
    queryFn: () =>
      api.get('/api/basket/rules', {
        params: { store_id: storeId, days: 90, min_support: 3, min_confidence: 0.3 },
      }).then((r) => r.data),
    enabled: !!storeId,
  });

  if (isLoading) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> กำลังวิเคราะห์...
      </div>
    );
  }

  const rules = data?.rules || [];
  const bundles = data?.bundle_suggestions || [];
  const stats = data?.stats || {};

  return (
    <div className="p-6 space-y-5">
      <PageIntro
        title="สินค้าที่ขายคู่กัน"
        whatItTells="ระบบดูจากบิลที่ผ่านมา 90 วันว่าสินค้าใดมักถูกซื้อพร้อมกัน — ใช้สร้างเซต/Combo ที่ขายได้จริง"
        howToUse={[
          'สร้าง Combo จากสินค้าคู่ขายดี — เพิ่มยอดบิลเฉลี่ย',
          'แนะนำ "ใส่อันนี้ด้วยไหม" ตอนลูกค้าสั่ง',
          'จัดวางสินค้าที่ขายคู่กันให้อยู่ใกล้กัน',
        ]}
        tip={`วิเคราะห์จาก ${stats.orders || 0} บิล — พบความเชื่อมโยง ${stats.rules_found || 0} รูปแบบ`}
      />

      {/* Bundle Suggestions */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-sm font-medium mb-1">เซต Combo ที่ระบบแนะนำให้สร้าง</h2>
        <p className="text-xs text-muted-foreground mb-4">
          คู่สินค้าที่ลูกค้าซื้อด้วยกันบ่อยที่สุด — เอาไปสร้างใน POS ได้เลย
        </p>

        {bundles.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3">
            ยังไม่พบคู่สินค้าที่ขายคู่กันบ่อยพอ — เก็บข้อมูลเพิ่ม 2-4 สัปดาห์
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {bundles.map((b: any, i: number) => (
              <div key={i} className="bg-card-hover border border-border rounded-md p-4">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {b.items.map((name: string, j: number) => (
                    <span key={j} className="inline-flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-md bg-card text-sm font-medium">
                        {name}
                      </span>
                      {j < b.items.length - 1 && (
                        <span className="text-muted-foreground">+</span>
                      )}
                    </span>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground mb-2">
                  ลูกค้าซื้อด้วยกัน <b className="text-foreground tabular-nums">{b.co_occurrence}</b> ครั้ง
                  · เมื่อซื้อตัวแรก มีโอกาสซื้อตัวที่สอง <b className="text-foreground tabular-nums">{b.confidence}%</b>
                </div>
                <div className="text-[11px] text-success">
                  💡 ระดับความสัมพันธ์: {b.lift >= 2 ? 'สูงมาก' : b.lift >= 1.5 ? 'สูง' : 'พอใช้'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* All Rules — simplified */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-medium">ความสัมพันธ์ทั้งหมด</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            "ลูกค้าที่ซื้อ A มักจะซื้อ B ด้วย กี่%" — เรียงจากความสัมพันธ์มากไปน้อย
          </p>
        </div>
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-sm">
            <thead className="bg-card-hover/40 text-xs text-muted-foreground sticky top-0">
              <tr>
                <th className="px-4 py-2.5 text-left">ถ้าซื้อ</th>
                <th className="px-4 py-2.5"></th>
                <th className="px-4 py-2.5 text-left">มักซื้อด้วย</th>
                <th className="px-4 py-2.5 text-right">ขายคู่ (ครั้ง)</th>
                <th className="px-4 py-2.5 text-right">โอกาส</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r: any, i: number) => (
                <tr key={i} className="border-t border-border hover:bg-card-hover/40">
                  <td className="px-4 py-2.5 font-medium">{r.antecedent_name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    <ArrowRight className="w-4 h-4" />
                  </td>
                  <td className="px-4 py-2.5">{r.consequent_name}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.support}</td>
                  <td
                    className={`px-4 py-2.5 text-right tabular-nums font-medium ${
                      r.confidence >= 60 ? 'text-success' :
                      r.confidence >= 40 ? 'text-foreground' :
                      'text-muted-foreground'
                    }`}
                  >
                    {r.confidence}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
