'use client';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useStoreId } from '@/components/DashboardShell';
import { PageIntro } from '@/components/PageIntro';

const PRIORITY_STYLE: Record<string, string> = {
  high: 'border-l-danger',
  medium: 'border-l-warning',
  low: 'border-l-border',
};

const PRIORITY_LABEL: Record<string, string> = {
  high: 'ด่วน',
  medium: 'ปานกลาง',
  low: 'ทั่วไป',
};

export default function PlaybookPage() {
  const storeId = useStoreId();
  const { data, isLoading } = useQuery({
    queryKey: ['playbook', storeId],
    queryFn: () => api.get('/api/playbook', { params: { store_id: storeId } }).then((r) => r.data),
    enabled: !!storeId,
    refetchInterval: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> กำลังสรุปสิ่งที่ต้องทำ...
      </div>
    );
  }

  const actions = data?.actions || [];
  const summary = data?.summary || {};

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <PageIntro
        title="ต้องทำวันนี้"
        whatItTells="AI รวบรวมทุกเรื่องที่ควรทำวันนี้ — สต็อก, ลูกค้า, โปรโมชัน, ครัว — ไว้ในหน้าเดียว"
        howToUse={[
          'ดูรายการด่วนก่อน (สีแดง) — ต้องทำตอนนี้เลย',
          'รายการปานกลาง (สีเหลือง) — ทำในวันนี้',
          'รายการทั่วไป — เก็บไว้ทำเมื่อมีเวลา',
        ]}
        tip={`อัปเดตทุก 5 นาที${summary.high_priority > 0 ? ` · ตอนนี้มี ${summary.high_priority} เรื่องด่วน` : ''}`}
      />

      {actions.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-10 text-center text-muted-foreground">
          ✅ ทุกอย่างเรียบร้อย — ไม่มีรายการด่วนตอนนี้
        </div>
      ) : (
        <div className="space-y-2.5">
          {actions.map((a: any, i: number) => (
            <div
              key={i}
              className={`bg-card border border-border rounded-lg p-4 border-l-4 ${PRIORITY_STYLE[a.priority] || ''}`}
            >
              <div className="flex items-start gap-3">
                <div className="text-xl shrink-0">{a.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-medium">{a.title}</h3>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {PRIORITY_LABEL[a.priority]}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{a.description}</p>
                  <div className="text-sm border-t border-border pt-2">
                    <span className="text-muted-foreground">วิธีทำ: </span>
                    <span>{a.action}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
