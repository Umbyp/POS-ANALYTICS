'use client';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { api, formatCurrency } from '@/lib/api';
import { useStoreId } from '@/components/DashboardShell';
import { PageIntro } from '@/components/PageIntro';

export default function GoalCoachPage() {
  const storeId = useStoreId();
  const { data, isLoading } = useQuery({
    queryKey: ['goal-coach', storeId],
    queryFn: () => api.get('/api/goal-coach', { params: { store_id: storeId } }).then((r) => r.data),
    enabled: !!storeId,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> กำลังตรวจเป้า...
      </div>
    );
  }

  if (!data?.has_target) {
    return (
      <div className="p-6 max-w-2xl space-y-5">
        <PageIntro
          title="ติดตามเป้าหมาย"
          whatItTells="ตั้งเป้ารายเดือนใน POS แล้วระบบจะคำนวณว่าทำได้ทันไหม และต้องเร่งอย่างไร"
        />
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <h2 className="font-medium mb-2">ยังไม่ได้ตั้งเป้ารายเดือน</h2>
          <p className="text-sm text-muted-foreground">
            ไปที่ <b>POS → Settings → ข้อมูลร้าน</b> เพื่อตั้งค่า "เป้ารายเดือน"
          </p>
        </div>
      </div>
    );
  }

  const progressPct = Math.min(data.progress_pct, 100);
  const onTrack = data.on_track;

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <PageIntro
        title="ติดตามเป้าหมาย"
        whatItTells={`เดือนนี้ผ่านมา ${data.days_passed}/${data.days_in_month} วัน · เหลืออีก ${data.days_left} วัน — มาดูว่าทำได้ทันเป้าไหม`}
        howToUse={[
          'ดูว่าตอนนี้ทำได้กี่ % ของเป้า',
          'รู้ว่าต้องขายเฉลี่ยวันละเท่าไหร่ในวันที่เหลือ',
          'AI แนะนำว่าควรเพิ่มยอด/บิล หรือเพิ่มจำนวนออเดอร์',
        ]}
      />

      {/* Hero progress */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
              ทำได้แล้ว
            </div>
            <div className="text-metric-lg tabular-nums">{formatCurrency(data.actual)}</div>
            <div className="text-sm text-muted-foreground mt-1">
              จากเป้า {formatCurrency(data.target)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
              ความคืบหน้า
            </div>
            <div className={`text-metric-lg tabular-nums ${onTrack ? 'text-success' : 'text-warning'}`}>
              {data.progress_pct.toFixed(0)}%
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-card-hover rounded-full overflow-hidden mb-4">
          <div
            className={`h-full transition-all duration-500 ${onTrack ? 'bg-success' : 'bg-warning'}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
              เฉลี่ยวันละ
            </div>
            <div className="text-lg font-semibold tabular-nums">
              {formatCurrency(data.daily_run_rate)}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
              ต้องขายเพิ่ม/วัน
            </div>
            <div className={`text-lg font-semibold tabular-nums ${onTrack ? 'text-success' : 'text-warning'}`}>
              {formatCurrency(data.needed_daily)}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
              คาดสิ้นเดือน
            </div>
            <div className="text-lg font-semibold tabular-nums">
              {formatCurrency(data.projected_total)}
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="text-sm font-medium mb-3">
          {onTrack ? 'รักษาระดับนี้ต่อ' : 'ต้องทำเพิ่มเพื่อทำเป้าให้ทัน'}
        </h3>
        <div className="space-y-2.5">
          {data.recommendations.map((r: any, i: number) => (
            <div key={i} className="p-3 rounded-md bg-card-hover/40 border border-border">
              <div className="font-medium text-sm mb-1">{r.action}</div>
              <div className="text-xs text-muted-foreground">วิธี: {r.method}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
