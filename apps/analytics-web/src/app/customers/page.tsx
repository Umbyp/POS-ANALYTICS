'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { api, formatCurrency } from '@/lib/api';
import { useStoreId } from '@/components/DashboardShell';
import { PageIntro } from '@/components/PageIntro';

// แปลชื่อ segment เป็นภาษาไทยที่เจ้าของร้านเข้าใจ
const SEGMENT_TRANSLATIONS: Record<string, { label: string; desc: string }> = {
  Champion: {
    label: 'ลูกค้าระดับ VIP',
    desc: 'มาบ่อย ใช้จ่ายเยอะ ซื้อล่าสุดเร็วๆ นี้',
  },
  Loyal: {
    label: 'ลูกค้าประจำ',
    desc: 'มาเป็นประจำ ผูกพันกับร้าน',
  },
  'Big Spender': {
    label: 'ลูกค้าใช้จ่ายเยอะ',
    desc: 'ครั้งละมาก แต่อาจมาไม่บ่อย',
  },
  New: {
    label: 'ลูกค้าใหม่',
    desc: 'เพิ่งซื้อครั้งแรก ต้องดึงให้มาซ้ำ',
  },
  Promising: {
    label: 'ลูกค้ามีแววดี',
    desc: 'มาแล้ว 2-3 ครั้ง กำลังจะเป็นประจำ',
  },
  'At Risk': {
    label: 'กำลังจะหาย',
    desc: 'ไม่มา 3-6 เดือนแล้ว ต้องดึงกลับด่วน',
  },
  Hibernating: {
    label: 'หายไปนาน',
    desc: 'ไม่มา 6-12 เดือน — ลองส่ง coupon ดึงกลับ',
  },
  Lost: {
    label: 'น่าจะเลิกใช้แล้ว',
    desc: 'ไม่มาเกิน 1 ปี — เลือกจะเก็บไว้หรือทำใจ',
  },
  'Never Bought': {
    label: 'ยังไม่เคยซื้อ',
    desc: 'มีในระบบ แต่ไม่มีออเดอร์',
  },
};

export default function CustomersPage() {
  const storeId = useStoreId();
  const [selectedSeg, setSelectedSeg] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['rfm', storeId],
    queryFn: () => api.get('/api/segments/rfm', { params: { store_id: storeId } }).then((r) => r.data),
    enabled: !!storeId,
  });

  const { data: clv } = useQuery({
    queryKey: ['clv', storeId],
    queryFn: () => api.get('/api/segments/clv', { params: { store_id: storeId } }).then((r) => r.data),
    enabled: !!storeId,
  });

  if (isLoading) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> กำลังวิเคราะห์ลูกค้า...
      </div>
    );
  }

  const segments = data?.segments || [];
  const customers = data?.customers || [];
  const summary = data?.summary || {};

  const filtered = selectedSeg
    ? customers.filter((c: any) => c.segment === selectedSeg)
    : customers;

  return (
    <div className="p-6 space-y-5">
      <PageIntro
        title="กลุ่มลูกค้า"
        whatItTells="ระบบจะแบ่งลูกค้าออกเป็นกลุ่มอัตโนมัติ — ดูจาก 3 อย่าง คือ มาบ่อยแค่ไหน, ใช้จ่ายเท่าไหร่, ซื้อครั้งล่าสุดเมื่อไหร่"
        howToUse={[
          'รู้ว่าใครคือลูกค้าสำคัญที่ต้องรักษา (VIP) — อย่าให้หายไป',
          'หาลูกค้าที่กำลังจะเลิกมา (At Risk) — ส่ง coupon ทันที',
          'หาลูกค้าใหม่ที่ต้องเปลี่ยนเป็นประจำ — เสนอ offer ครั้งที่ 2',
        ]}
        tip="คลิกที่กลุ่มไหนก็ตามด้านล่าง เพื่อดูรายชื่อลูกค้าในกลุ่มนั้น"
      />

      {/* Stats */}
      {clv && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="ลูกค้าทั้งหมด" value={clv.total_customers.toString()} />
          <Stat label="ใช้จ่ายเฉลี่ย/คน" value={formatCurrency(clv.avg_clv)} />
          <Stat label="VIP" value={(summary.champions || 0).toString()} tone="success" />
          <Stat label="กำลังจะหาย" value={(summary.at_risk || 0).toString()} tone="warning" />
        </div>
      )}

      {/* Segments — list of cards, friendly */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3">
          เลือกกลุ่มที่ต้องการดู
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
          <button
            onClick={() => setSelectedSeg(null)}
            className={`text-left p-3 rounded-lg border transition-colors ${
              !selectedSeg
                ? 'border-primary bg-card-hover'
                : 'border-border bg-card hover:bg-card-hover/60'
            }`}
          >
            <div className="text-xs text-muted-foreground">ทั้งหมด</div>
            <div className="text-xl font-semibold tabular-nums mt-1">{summary.total}</div>
            <div className="text-[10px] text-muted-foreground mt-1">ลูกค้าทุกกลุ่ม</div>
          </button>
          {segments.map((s: any) => {
            const t = SEGMENT_TRANSLATIONS[s.segment] || { label: s.segment, desc: s.action };
            return (
              <button
                key={s.segment}
                onClick={() => setSelectedSeg(s.segment === selectedSeg ? null : s.segment)}
                className={`text-left p-3 rounded-lg border transition-colors ${
                  selectedSeg === s.segment
                    ? 'border-primary bg-card-hover'
                    : 'border-border bg-card hover:bg-card-hover/60'
                }`}
                style={{ borderLeft: `3px solid ${s.color}` }}
              >
                <div className="text-xs text-muted-foreground">{t.label}</div>
                <div className="text-xl font-semibold tabular-nums mt-1">{s.count}</div>
                <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{t.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recommendation for selected segment */}
      {selectedSeg && (
        <div className="bg-card border border-primary/40 rounded-lg p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
            แนะนำให้ทำ
          </div>
          <div className="text-sm">
            {segments.find((s: any) => s.segment === selectedSeg)?.action}
          </div>
        </div>
      )}

      {/* Customer table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-medium">
            ลูกค้าในกลุ่ม
            {selectedSeg && (
              <span className="text-muted-foreground ml-1">
                · {SEGMENT_TRANSLATIONS[selectedSeg]?.label || selectedSeg}
              </span>
            )}
          </h3>
          <span className="text-xs text-muted-foreground">{filtered.length} คน</span>
        </div>
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-sm">
            <thead className="bg-card-hover/40 text-xs text-muted-foreground sticky top-0">
              <tr>
                <th className="px-4 py-2.5 text-left">ชื่อ</th>
                <th className="px-4 py-2.5 text-left">กลุ่ม</th>
                <th className="px-4 py-2.5 text-right">มาทั้งหมด</th>
                <th className="px-4 py-2.5 text-right">ใช้จ่ายรวม</th>
                <th className="px-4 py-2.5 text-right">มาล่าสุด</th>
                <th className="px-4 py-2.5 text-right">คะแนน</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((c: any) => {
                const t = SEGMENT_TRANSLATIONS[c.segment] || { label: c.segment };
                return (
                  <tr key={c.id} className="border-t border-border hover:bg-card-hover/40">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{c.name}</div>
                      {c.phone && (
                        <div className="text-[10px] text-muted-foreground">{c.phone}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs">{t.label}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{c.frequency} ครั้ง</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                      {formatCurrency(c.monetary)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                      {c.recency_days != null ? `${c.recency_days} วันที่แล้ว` : 'ไม่เคย'}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{c.points}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'warning';
}) {
  return (
    <div
      className={`bg-card border rounded-lg p-4 ${
        tone === 'warning' ? 'border-warning/60' :
        tone === 'success' ? 'border-success/60' :
        'border-border'
      }`}
    >
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-metric-md mt-1.5 tabular-nums">{value}</div>
    </div>
  );
}
