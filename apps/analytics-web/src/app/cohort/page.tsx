'use client';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useStoreId } from '@/components/DashboardShell';
import { PageIntro } from '@/components/PageIntro';
import { InsightBanner, BannerAction } from '@/components/InsightBanner';

export default function CohortPage() {
  const storeId = useStoreId();
  const { data, isLoading, error } = useQuery({
    queryKey: ['cohort', storeId],
    queryFn: () =>
      api.get('/api/cohort/retention', { params: { store_id: storeId, weeks: 12 } }).then((r) => r.data),
    enabled: !!storeId,
  });

  const cohorts = data?.cohorts || [];
  const maxOffset = Math.max(
    ...cohorts.flatMap((c: any) => c.retention.map((r: any) => r.week_offset)),
    0
  );

  // Compute aggregate retention metrics
  const summary = useMemo(() => {
    if (cohorts.length === 0) return null;
    // Average W1 retention (returning after 1 week)
    const w1Values = cohorts
      .map((c: any) => c.retention.find((r: any) => r.week_offset === 1)?.retention_pct)
      .filter((v: any) => v != null) as number[];
    const w4Values = cohorts
      .map((c: any) => c.retention.find((r: any) => r.week_offset === 4)?.retention_pct)
      .filter((v: any) => v != null) as number[];
    const avgW1 = w1Values.length ? w1Values.reduce((s, v) => s + v, 0) / w1Values.length : 0;
    const avgW4 = w4Values.length ? w4Values.reduce((s, v) => s + v, 0) / w4Values.length : 0;
    const totalNewCustomers = cohorts.reduce((s: number, c: any) => s + (c.size || 0), 0);

    // Trend: is the latest W1 better than the average?
    const latestW1 = w1Values[w1Values.length - 1] ?? 0;
    const earlierAvg =
      w1Values.length > 1
        ? w1Values.slice(0, -1).reduce((s, v) => s + v, 0) / (w1Values.length - 1)
        : 0;
    const trend = latestW1 - earlierAvg;

    return { avgW1, avgW4, totalNewCustomers, latestW1, trend };
  }, [cohorts]);

  // Decide which banner to show based on retention quality
  const banner = useMemo(() => {
    if (!summary) return null;
    const { avgW1 } = summary;
    if (avgW1 < 20) {
      return {
        tone: 'critical' as const,
        title: `ลูกค้าใหม่ไม่ค่อยกลับมา — W1 retention ${avgW1.toFixed(0)}%`,
        description:
          'มีลูกค้าใหม่กลับมาในสัปดาห์ที่ 2 น้อยมาก (มาตรฐานร้านอาหารควรเกิน 30%) — แนะนำส่งคูปอง "ครั้งที่ 2 ลด 50 บาท" ภายใน 7 วันแรก',
      };
    }
    if (avgW1 < 35) {
      return {
        tone: 'warning' as const,
        title: `Retention พอใช้ — W1 ${avgW1.toFixed(0)}%`,
        description:
          'ลูกค้ากลับมาเกือบครึ่ง แต่ยังเพิ่มได้อีก ลองตั้งโปรครั้งที่ 2 + เก็บเบอร์โทรลูกค้าใหม่เพื่อส่ง follow-up',
      };
    }
    return {
      tone: 'good' as const,
      title: `Retention ดีมาก — W1 ${avgW1.toFixed(0)}%`,
      description: 'ลูกค้าใหม่ส่วนใหญ่กลับมาในสัปดาห์ถัดไป — รักษามาตรฐานนี้และโฟกัสที่หา new customers เพิ่ม',
    };
  }, [summary]);

  if (error) {
    return (
      <div className="p-6 space-y-5 max-w-screen-xl">
        <PageIntro
          title="การกลับมาซื้อซ้ำ"
          whatItTells="ลูกค้าใหม่กลับมาภายในสัปดาห์ถัดไปกี่ %"
          howToUse={[]}
        />
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-medium">เชื่อมต่อ Analytics service ไม่ได้</div>
            <div className="text-muted-foreground mt-1">
              รัน{' '}
              <code className="bg-card border border-border px-1.5 py-0.5 rounded text-xs">
                cd apps/analytics-api &amp;&amp; uvicorn app.main:app --port 8000
              </code>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-screen-xl">
      <PageIntro
        title="การกลับมาซื้อซ้ำ"
        whatItTells="ลูกค้าใหม่ที่มาในแต่ละสัปดาห์ — กี่ % ที่กลับมาในสัปดาห์ถัดๆ ไป (ทำการตลาดให้กลายเป็นลูกค้าประจำ)"
        howToUse={[
          'ดู "+1 สัปดาห์" — ถ้าน้อยกว่า 30% แปลว่าลูกค้าใหม่ไม่ติด → ทำโปรครั้งที่ 2 ให้ดึงดูดมากกว่านี้',
          'แต่ละแถวคือลูกค้าที่มาครั้งแรกในสัปดาห์นั้น — เทียบดูว่าเดือนล่าสุดดีกว่าเดือนก่อนๆ ไหม',
          'ยิ่ง "+8 สัปดาห์" เข้ม = ลูกค้าผูกพันกับร้าน → กลายเป็นประจำ',
        ]}
        tip="หลักเกณฑ์ทั่วไป: ร้านอาหารควรมี W1 retention 30%+ · W4 retention 15%+"
      />

      {isLoading && (
        <div className="space-y-3">
          <div className="shimmer h-24 rounded-lg" />
          <div className="shimmer h-96 rounded-lg" />
        </div>
      )}

      {/* Summary stats */}
      {summary && !isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat
            label="ลูกค้าใหม่รวม"
            value={summary.totalNewCustomers.toString()}
            sub={`ใน ${cohorts.length} สัปดาห์`}
          />
          <Stat
            label="กลับมาภายใน 1 สัปดาห์"
            value={`${summary.avgW1.toFixed(0)}%`}
            tone={summary.avgW1 >= 30 ? 'good' : summary.avgW1 >= 20 ? 'warning' : 'critical'}
            sub={summary.avgW1 >= 30 ? 'ดี' : 'ต่ำกว่ามาตรฐาน'}
          />
          <Stat
            label="กลับมาภายใน 1 เดือน"
            value={`${summary.avgW4.toFixed(0)}%`}
            tone={summary.avgW4 >= 15 ? 'good' : summary.avgW4 >= 10 ? 'warning' : 'critical'}
            sub={summary.avgW4 >= 15 ? 'ดี' : 'ต้องเพิ่ม'}
          />
          <Stat
            label="เทรนด์ล่าสุด"
            value={`${summary.trend >= 0 ? '+' : ''}${summary.trend.toFixed(1)}%`}
            tone={summary.trend >= 0 ? 'good' : 'warning'}
            sub={summary.trend >= 0 ? 'ดีขึ้น' : 'ลดลง'}
            icon={summary.trend >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          />
        </div>
      )}

      {/* Insight + action */}
      {banner && (
        <InsightBanner
          tone={banner.tone}
          title={banner.title}
          description={banner.description}
          actions={
            <>
              <Link href="/customers">
                <BannerAction>
                  ดูกลุ่ม "ลูกค้าใหม่"
                </BannerAction>
              </Link>
              <Link href="/promotions">
                <BannerAction variant="outline">สร้างโปรครั้งที่ 2</BannerAction>
              </Link>
            </>
          }
        />
      )}

      {/* Retention table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium">ตาราง Retention 12 สัปดาห์</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            แถว = "กลุ่มลูกค้าใหม่ที่มาครั้งแรกในสัปดาห์ไหน" · คอลัมน์ = "อีกกี่สัปดาห์ต่อมา"
          </p>
        </div>

        {cohorts.length === 0 && !isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            ยังไม่มีข้อมูลพอ — ต้องมีลูกค้าใหม่อย่างน้อย 4-8 สัปดาห์ที่ผ่านมา
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-card-hover/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 text-left sticky left-0 bg-card-hover/40 z-10">
                    มาครั้งแรก
                  </th>
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
                    <td className="px-3 py-2.5 font-medium sticky left-0 bg-card text-xs">
                      {c.cohort_week}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{c.size}</td>
                    {Array.from({ length: maxOffset + 1 }, (_, offset) => {
                      const r = c.retention.find((x: any) => x.week_offset === offset);
                      if (!r)
                        return (
                          <td key={offset} className="px-3 py-2.5 text-center text-muted-foreground/30">
                            —
                          </td>
                        );
                      const pct = r.retention_pct;
                      const intensity = Math.min(1, pct / 100);
                      const isLight = intensity < 0.5;
                      return (
                        <td
                          key={offset}
                          className="px-3 py-2.5 text-center text-xs tabular-nums font-medium"
                          style={{
                            backgroundColor: `rgba(255, 107, 53, ${0.08 + intensity * 0.7})`,
                            color: isLight ? '#0F172A' : '#FFFFFF',
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
        )}

        {/* Legend */}
        {cohorts.length > 0 && (
          <div className="px-4 py-2.5 border-t border-border flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>สีเข้ม</span>
            <div className="flex gap-0.5">
              {[0.1, 0.25, 0.45, 0.65, 0.85].map((v) => (
                <div
                  key={v}
                  className="w-5 h-3 rounded-sm"
                  style={{ background: `rgba(255, 107, 53, ${0.08 + v * 0.7})` }}
                />
              ))}
            </div>
            <span>ลูกค้ากลับมาเยอะ → เป้าคือทำให้แถวล่างเข้มขึ้นเรื่อยๆ</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = 'default',
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'good' | 'warning' | 'critical';
  icon?: React.ReactNode;
}) {
  const toneClass =
    tone === 'good'
      ? 'border-success/60 text-success'
      : tone === 'warning'
      ? 'border-warning/60 text-warning'
      : tone === 'critical'
      ? 'border-danger/60 text-danger'
      : 'border-border text-foreground';
  return (
    <div className={`bg-card border rounded-lg p-4 ${toneClass.split(' ')[0]}`}>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold mt-1.5 tabular-nums flex items-center gap-1.5 ${toneClass.split(' ')[1] || ''}`}>
        {value}
        {icon}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
