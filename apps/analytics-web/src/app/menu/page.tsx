'use client';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { api, formatCurrency } from '@/lib/api';
import { useStoreId } from '@/components/DashboardShell';
import { PageIntro } from '@/components/PageIntro';

// ใช้ภาษาที่เจ้าของร้านเข้าใจทันที — ไม่ใช้ Stars/Dogs/Puzzles
const QUADRANT_META: Record<string, {
  label: string;
  color: string;
  bg: string;
  oneLine: string;
  action: string;
}> = {
  Star: {
    label: 'เมนูดาว',
    color: 'text-success',
    bg: 'bg-success/10 border-success/40',
    oneLine: 'กำไรดี + ขายดี',
    action: 'เก็บไว้ และโปรโมตให้เป็นเมนูแนะนำ',
  },
  Puzzle: {
    label: 'มีศักยภาพ',
    color: 'text-primary',
    bg: 'bg-primary/10 border-primary/40',
    oneLine: 'กำไรดี แต่ขายน้อย',
    action: 'ลอง push ให้คนรู้จัก — อยู่หน้าเมนู / โพสต์ social',
  },
  Plowhorse: {
    label: 'ขายดี แต่ไม่ค่อยกำไร',
    color: 'text-warning',
    bg: 'bg-warning/10 border-warning/40',
    oneLine: 'ขายดี + กำไรต่อชิ้นต่ำ',
    action: 'ลองขึ้นราคา 5-10 บาท หรือลดต้นทุนวัตถุดิบ',
  },
  Dog: {
    label: 'ตัดได้',
    color: 'text-danger',
    bg: 'bg-danger/10 border-danger/40',
    oneLine: 'ขายน้อย + กำไรต่ำ',
    action: 'พิจารณาตัดออกจากเมนู หรือ rebrand',
  },
};

export default function MenuEngineeringPage() {
  const storeId = useStoreId();
  const { data, isLoading } = useQuery({
    queryKey: ['menu-eng', storeId],
    queryFn: () => api.get('/api/menu-engineering', { params: { store_id: storeId, days: 30 } }).then((r) => r.data),
    enabled: !!storeId,
  });

  if (isLoading) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> กำลังวิเคราะห์เมนู...
      </div>
    );
  }

  const items = data?.items || [];
  const summary = data?.summary || {};
  const grouped: Record<string, any[]> = { Star: [], Plowhorse: [], Puzzle: [], Dog: [] };
  for (const item of items) grouped[item.quadrant]?.push(item);

  return (
    <div className="p-6 space-y-5">
      <PageIntro
        title="เมนูไหนทำเงิน"
        whatItTells="ดูเมนูแต่ละตัวว่า ขายดีหรือเปล่า และทำกำไรหรือไม่ — แบ่งเป็น 4 กลุ่ม"
        howToUse={[
          'เก็บ "เมนูดาว" ให้เห็นได้ชัด — เป็นจุดแข็งของร้าน',
          'push "เมนูมีศักยภาพ" — กำไรดีแต่คนยังไม่รู้จัก',
          'พิจารณาขึ้นราคาหรือลดต้นทุน "เมนูขายดีไม่กำไร"',
          'ตัดออก "เมนูไม่ทำเงิน" — เลิกขายก็ได้',
        ]}
        tip={`วิเคราะห์จากยอดขาย 30 วันล่าสุด · เมนูที่ขายเกิน ${summary.pop_threshold?.toFixed(0) || '?'} ชิ้น = "ขายดี"`}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {['Star', 'Puzzle', 'Plowhorse', 'Dog'].map((q) => {
          const meta = QUADRANT_META[q];
          const count = grouped[q].length;
          return (
            <div key={q} className={`rounded-lg border p-4 ${meta.bg}`}>
              <div className={`text-xs uppercase tracking-wider font-medium ${meta.color}`}>
                {meta.label}
              </div>
              <div className="text-2xl font-semibold tabular-nums mt-1.5">{count}</div>
              <div className="text-[10px] text-muted-foreground mt-1">{meta.oneLine}</div>
            </div>
          );
        })}
      </div>

      {/* Detail per quadrant */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {['Star', 'Puzzle', 'Plowhorse', 'Dog'].map((q) => {
          const meta = QUADRANT_META[q];
          const list = grouped[q] || [];
          return (
            <div key={q} className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className={`text-sm font-medium ${meta.color}`}>{meta.label}</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{meta.oneLine}</p>
                </div>
                <span className="text-sm tabular-nums text-muted-foreground">{list.length} เมนู</span>
              </div>

              <div className="bg-card-hover/40 rounded-md p-2.5 mb-3 text-xs">
                <span className="text-muted-foreground">แนะนำ: </span>
                <span>{meta.action}</span>
              </div>

              {list.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center">ไม่มีเมนูในกลุ่มนี้</p>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto scrollbar-thin">
                  {list.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 px-2 py-1.5 rounded hover:bg-card-hover/40">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm truncate">{item.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          ขายไป {item.qty_sold} ชิ้น
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-medium tabular-nums">
                          {formatCurrency(item.profit)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">กำไร</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
