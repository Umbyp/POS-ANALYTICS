'use client';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useStoreId } from '@/components/DashboardShell';
import { PageIntro } from '@/components/PageIntro';

export default function CohortPage() {
  const storeId = useStoreId();
  const { data, isLoading } = useQuery({
    queryKey: ['cohort', storeId],
    queryFn: () => api.get('/api/cohort/retention', { params: { store_id: storeId, weeks: 12 } }).then((r) => r.data),
    enabled: !!storeId,
  });

  if (isLoading) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> วิเคราะห์การกลับมาซื้อซ้ำ...
      </div>
    );
  }

  const cohorts = data?.cohorts || [];
  const maxOffset = Math.max(...cohorts.flatMap((c: any) => c.retention.map((r: any) => r.week_offset)), 0);

  return (
    <div className="p-6 space-y-5">
      <PageIntro
        title="การกลับมาซื้อซ้ำ"
        whatItTells="ลูกค้าที่มาครั้งแรกในแต่ละสัปดาห์ มีกี่ % ที่กลับมาซื้อในสัปดาห์ถัดไป"
        howToUse={[
          'ตัวเลขในช่อง W1 = ลูกค้ากลุ่มนั้น กลับมาในสัปดาห์ที่ 2 กี่ %',
          'ถ้า W1 ต่ำกว่า 30% = ลูกค้าใหม่ไม่ติด ต้องหา offer ดึงให้กลับมาครั้งที่ 2',
          'ดูเทรนด์ตามคอลัมน์ — กลุ่มใหม่ดีกว่ากลุ่มเก่าหรือเปล่า',
        ]}
        tip="สีเข้ม = ลูกค้ากลับมาเยอะ · สีจาง = น้อย — เน้นทำให้สีเข้มขึ้นเรื่อยๆ"
      />

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium">ตาราง Retention 12 สัปดาห์</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            แถวคือ "กลุ่มลูกค้าใหม่ที่มาครั้งแรกในสัปดาห์ไหน" · คอลัมน์คือ "อีกกี่สัปดาห์ต่อมา"
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-card-hover/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 text-left sticky left-0 bg-card-hover/40">มาครั้งแรก</th>
                <th className="px-3 py-2.5 text-right">ขนาด</th>
                {Array.from({ length: maxOffset + 1 }, (_, i) => (
                  <th key={i} className="px-3 py-2.5 text-center min-w-[60px]">
                    {i === 0 ? 'มาแล้ว' : `+${i} สัปดาห์`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohorts.map((c: any) => (
                <tr key={c.cohort_week} className="border-t border-border">
                  <td className="px-3 py-2.5 font-medium sticky left-0 bg-card">
                    {c.cohort_week}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{c.size}</td>
                  {Array.from({ length: maxOffset + 1 }, (_, offset) => {
                    const r = c.retention.find((x: any) => x.week_offset === offset);
                    if (!r) return <td key={offset} />;
                    const pct = r.retention_pct;
                    const intensity = Math.min(1, pct / 100);
                    return (
                      <td
                        key={offset}
                        className="px-3 py-2.5 text-center text-xs tabular-nums"
                        style={{
                          backgroundColor: `rgba(255, 107, 53, ${0.05 + intensity * 0.4})`,
                          color: intensity > 0.5 ? '#fff' : undefined,
                        }}
                        title={`${r.customers} จาก ${c.size} คน = ${pct}%`}
                      >
                        {pct.toFixed(0)}%
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
