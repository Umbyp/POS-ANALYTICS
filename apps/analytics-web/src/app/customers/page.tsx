'use client';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Download, Copy, MessageSquare, Sparkles, AlertCircle } from 'lucide-react';
import { api, formatCurrency } from '@/lib/api';
import { useStoreId } from '@/components/DashboardShell';
import { PageIntro } from '@/components/PageIntro';
import { InsightBanner, BannerAction } from '@/components/InsightBanner';
import { rowsToCsv, downloadCsv, copyToClipboard } from '@/lib/export';

// Friendly Thai labels for each RFM segment, plus a concrete play book
const SEGMENT_TRANSLATIONS: Record<
  string,
  { label: string; desc: string; playbook: string; smsTemplate?: string }
> = {
  Champion: {
    label: 'ลูกค้าระดับ VIP',
    desc: 'มาบ่อย ใช้จ่ายเยอะ ซื้อล่าสุดเร็วๆ นี้',
    playbook: 'ขอบคุณเป็นพิเศษ + early access โปรใหม่ + ของแถมพิเศษ — รักษาให้อยู่กับร้านนานๆ',
    smsTemplate: 'ขอบคุณ {ชื่อ} ที่อุดหนุน {ร้าน} เสมอ 🙏 ส่วนลดพิเศษ 15% สำหรับวันเกิด/พิเศษ — โชว์ SMS นี้ได้เลย',
  },
  Loyal: {
    label: 'ลูกค้าประจำ',
    desc: 'มาเป็นประจำ ผูกพันกับร้าน',
    playbook: 'ส่งโปรพิเศษ + ขอ review/แนะนำเพื่อน + เชิญร่วม loyalty program',
    smsTemplate: '🎉 ขอบคุณที่เป็นลูกค้าประจำ! รับฟรี [เมนู] เมื่อซื้อครบ ฿200 ถึงสิ้นเดือนนี้',
  },
  'Big Spender': {
    label: 'ลูกค้าใช้จ่ายเยอะ',
    desc: 'ครั้งละมาก แต่อาจมาไม่บ่อย',
    playbook: 'เสนอเมนูพรีเมียม + ของแถมเมื่อซื้อเยอะ — กระตุ้นให้มาบ่อยขึ้น',
    smsTemplate: 'จัดเลี้ยง/ปาร์ตี้? เรามีเซ็ตพิเศษให้คุณ {ชื่อ} — ลด 10% สำหรับยอดเกิน ฿1,000',
  },
  New: {
    label: 'ลูกค้าใหม่',
    desc: 'เพิ่งซื้อครั้งแรก ต้องดึงให้มาซ้ำ',
    playbook: 'ส่ง coupon ครั้งที่ 2 ภายใน 7 วัน — เพิ่มอัตราการกลับมาเป็น 30-40%',
    smsTemplate: 'ยินดีต้อนรับ {ชื่อ}! 🎁 ส่วนลด 50 บาท สำหรับครั้งถัดไป — ใช้ได้ภายใน 14 วัน',
  },
  Promising: {
    label: 'ลูกค้ามีแววดี',
    desc: 'มาแล้ว 2-3 ครั้ง กำลังจะเป็นประจำ',
    playbook: 'ชวนสมัครสมาชิก + ส่ง personalized recommendation',
    smsTemplate: 'สมัครสมาชิก {ร้าน} วันนี้ รับฟรี [เมนู] + สะสมแต้ม 1 บาท = 1 แต้ม',
  },
  'At Risk': {
    label: 'กำลังจะหาย',
    desc: 'ไม่มา 3-6 เดือนแล้ว ต้องดึงกลับด่วน',
    playbook: 'ส่ง coupon แรงๆ (20-30% off) ทันที — รอช้าจะกลับยาก',
    smsTemplate: 'คิดถึง {ชื่อ}! เราเก็บโปรพิเศษไว้รอ — ลด 20% รอบหน้า โชว์ SMS นี้ที่ร้าน',
  },
  Hibernating: {
    label: 'หายไปนาน',
    desc: 'ไม่มา 6-12 เดือน — ลองส่ง coupon ดึงกลับ',
    playbook: 'win-back campaign 30-40% off + ของแถม — สุดท้ายแล้ว ถ้าไม่กลับให้ตัดออก list',
    smsTemplate: '{ชื่อ} กลับมาเถอะ 💕 ลด 30% เฉพาะคุณ ใช้ได้ครั้งเดียวภายใน 30 วัน',
  },
  Lost: {
    label: 'น่าจะเลิกใช้แล้ว',
    desc: 'ไม่มาเกิน 1 ปี — เลือกจะเก็บไว้หรือทำใจ',
    playbook: 'ถ้างบจำกัด ตัดออกจาก list ไปก่อน — เก็บเฉพาะที่ใช้จ่ายเคยสูง',
  },
  'Never Bought': {
    label: 'ยังไม่เคยซื้อ',
    desc: 'มีในระบบ แต่ไม่มีออเดอร์',
    playbook: 'ส่งโปรชวนมาลอง + อธิบายเหตุที่ลูกค้าคนอื่นชอบ',
  },
};

export default function CustomersPage() {
  const storeId = useStoreId();
  const [selectedSeg, setSelectedSeg] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['rfm', storeId],
    queryFn: () => api.get('/api/segments/rfm', { params: { store_id: storeId } }).then((r) => r.data),
    enabled: !!storeId,
  });

  const { data: clv } = useQuery({
    queryKey: ['clv', storeId],
    queryFn: () => api.get('/api/segments/clv', { params: { store_id: storeId } }).then((r) => r.data),
    enabled: !!storeId,
  });

  const segments = data?.segments || [];
  const customers = data?.customers || [];
  const summary = data?.summary || {};

  const filtered = useMemo(
    () => (selectedSeg ? customers.filter((c: any) => c.segment === selectedSeg) : customers),
    [customers, selectedSeg]
  );

  const atRiskList = useMemo(
    () => customers.filter((c: any) => c.segment === 'At Risk' || c.segment === 'Hibernating'),
    [customers]
  );

  const showCopyToast = (text: string) => {
    setCopyToast(text);
    setTimeout(() => setCopyToast(''), 2500);
  };

  const exportFiltered = () => {
    const rows = filtered.map((c: any) => ({
      name: c.name,
      phone: c.phone || '',
      email: c.email || '',
      segment: SEGMENT_TRANSLATIONS[c.segment]?.label || c.segment,
      visits: c.frequency,
      total_spent: c.monetary,
      last_visit_days_ago: c.recency_days ?? '',
      points: c.points,
    }));
    const csv = rowsToCsv(rows, [
      { label: 'ชื่อ', value: (r) => r.name },
      { label: 'เบอร์โทร', value: (r) => r.phone },
      { label: 'อีเมล', value: (r) => r.email },
      { label: 'กลุ่ม', value: (r) => r.segment },
      { label: 'มากี่ครั้ง', value: (r) => r.visits },
      { label: 'ใช้จ่ายรวม', value: (r) => r.total_spent },
      { label: 'มาล่าสุด (วันที่แล้ว)', value: (r) => r.last_visit_days_ago },
      { label: 'แต้มสะสม', value: (r) => r.points },
    ]);
    const segPart = selectedSeg ? `-${selectedSeg}` : '-all';
    downloadCsv(`customers${segPart}-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    showCopyToast(`Exported ${rows.length} customers`);
  };

  const copySmsTemplate = async (segment: string) => {
    const tpl = SEGMENT_TRANSLATIONS[segment]?.smsTemplate;
    if (!tpl) return;
    const ok = await copyToClipboard(tpl);
    if (ok) showCopyToast('คัดลอกข้อความ SMS แล้ว');
  };

  const copyPhoneList = async () => {
    const phones = filtered.map((c: any) => c.phone).filter(Boolean).join(', ');
    if (!phones) return;
    const ok = await copyToClipboard(phones);
    if (ok) showCopyToast(`คัดลอกเบอร์โทร ${phones.split(',').length} เบอร์`);
  };

  return (
    <div className="p-6 space-y-5 max-w-screen-xl">
      <PageIntro
        title="กลุ่มลูกค้า"
        whatItTells="ระบบแบ่งลูกค้าเป็นกลุ่มอัตโนมัติจาก 3 สัญญาณ: มาบ่อยแค่ไหน, ใช้จ่ายเท่าไหร่, ซื้อครั้งล่าสุดเมื่อไหร่ (RFM)"
        howToUse={[
          'ดู "ทำอะไรต่อ" ในกล่องสีเหลืองข้างล่าง — บอกว่าควรทำกับใครก่อน',
          'คลิกที่กลุ่ม → ดูรายชื่อ + ก๊อปข้อความ SMS / Export CSV เอาไปทำแคมเปญ',
          'เน้นกลุ่ม "กำลังจะหาย" + "หายไปนาน" — มี ROI สูงสุดเพราะลูกค้าเก่ารู้จักร้านแล้ว',
        ]}
        tip="แนะนำ: ทำ SMS campaign ทุก 2 สัปดาห์กับกลุ่ม At Risk"
      />

      {/* Error state */}
      {error && (
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
      )}

      {isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="shimmer h-24 rounded-lg" />
          ))}
        </div>
      )}

      {/* Top-priority action banner — ทำให้ user รู้ว่าควรทำอะไรก่อน */}
      {!isLoading && atRiskList.length > 0 && (
        <InsightBanner
          tone="warning"
          title={`มีลูกค้า ${atRiskList.length} คนกำลังจะหาย`}
          description={
            <>
              ลูกค้ากลุ่ม <strong>At Risk + Hibernating</strong> ที่ไม่กลับมาเกิน 3 เดือน —{' '}
              ส่ง SMS coupon ตอนนี้ มีโอกาสกลับมา 15-25% (ของลูกค้าใหม่ ~2%)
            </>
          }
          metric={{ label: 'ลูกค้า', value: String(atRiskList.length) }}
          actions={
            <>
              <BannerAction
                onClick={() => {
                  setSelectedSeg('At Risk');
                  document.getElementById('customer-table')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <Sparkles className="w-3.5 h-3.5" /> ดูรายชื่อ At Risk
              </BannerAction>
              <BannerAction variant="outline" onClick={() => copySmsTemplate('At Risk')}>
                <MessageSquare className="w-3.5 h-3.5" /> ก๊อปข้อความ SMS
              </BannerAction>
            </>
          }
        />
      )}

      {/* CLV stats */}
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
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            เลือกกลุ่มเพื่อดูรายชื่อ
          </div>
          {selectedSeg && (
            <button
              onClick={() => setSelectedSeg(null)}
              className="text-xs text-primary hover:underline"
            >
              ล้างตัวกรอง
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
          <button
            onClick={() => setSelectedSeg(null)}
            className={`text-left p-3 rounded-lg border transition-colors ${
              !selectedSeg
                ? 'border-primary bg-primary/5'
                : 'border-border bg-card hover:bg-card-hover/60'
            }`}
          >
            <div className="text-xs text-muted-foreground">ทั้งหมด</div>
            <div className="text-xl font-semibold tabular-nums mt-1">{summary.total || customers.length}</div>
            <div className="text-[10px] text-muted-foreground mt-1">ลูกค้าทุกกลุ่ม</div>
          </button>
          {segments.map((s: any) => {
            const t = SEGMENT_TRANSLATIONS[s.segment] || { label: s.segment, desc: s.action };
            return (
              <button
                key={s.segment}
                onClick={() => setSelectedSeg(s.segment === selectedSeg ? null : s.segment)}
                className={`text-left p-3 rounded-lg border transition-colors relative ${
                  selectedSeg === s.segment
                    ? 'border-primary bg-primary/5'
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

      {/* Playbook + actions for selected segment */}
      {selectedSeg && SEGMENT_TRANSLATIONS[selectedSeg] && (
        <div className="bg-card border border-primary/40 rounded-lg p-4 space-y-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
              ทำอะไรต่อกับกลุ่มนี้
            </div>
            <div className="text-sm">{SEGMENT_TRANSLATIONS[selectedSeg].playbook}</div>
          </div>

          {SEGMENT_TRANSLATIONS[selectedSeg].smsTemplate && (
            <div className="bg-muted/50 rounded-md p-3 border border-border">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <MessageSquare className="w-3 h-3" /> ตัวอย่างข้อความ SMS
                </div>
                <button
                  onClick={() => copySmsTemplate(selectedSeg)}
                  className="text-[11px] text-primary hover:underline flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" /> ก๊อป
                </button>
              </div>
              <div className="text-sm text-foreground/90 font-mono leading-relaxed">
                {SEGMENT_TRANSLATIONS[selectedSeg].smsTemplate}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1.5">
                {`แทน {ชื่อ} ด้วยชื่อลูกค้า · {ร้าน} ด้วยชื่อร้านของคุณ`}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Customer table */}
      <div id="customer-table" className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-medium">
            รายชื่อลูกค้า
            {selectedSeg && (
              <span className="text-muted-foreground ml-1.5">
                · {SEGMENT_TRANSLATIONS[selectedSeg]?.label || selectedSeg}
              </span>
            )}
            <span className="ml-2 text-xs text-muted-foreground">({filtered.length} คน)</span>
          </h3>
          <div className="flex gap-2">
            <button
              onClick={copyPhoneList}
              disabled={filtered.length === 0}
              className="text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border hover:bg-card-hover disabled:opacity-50"
            >
              <Copy className="w-3.5 h-3.5" /> ก๊อปเบอร์ทั้งหมด
            </button>
            <button
              onClick={exportFiltered}
              disabled={filtered.length === 0}
              className="text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary-600 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-sm">
            <thead className="bg-card-hover/40 text-xs text-muted-foreground sticky top-0">
              <tr>
                <th className="px-4 py-2.5 text-left">ชื่อ</th>
                <th className="px-4 py-2.5 text-left">กลุ่ม</th>
                <th className="px-4 py-2.5 text-right">มา</th>
                <th className="px-4 py-2.5 text-right">ใช้จ่ายรวม</th>
                <th className="px-4 py-2.5 text-right">มาล่าสุด</th>
                <th className="px-4 py-2.5 text-right">แต้ม</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((c: any) => {
                const t = SEGMENT_TRANSLATIONS[c.segment] || { label: c.segment };
                return (
                  <tr key={c.id} className="border-t border-border hover:bg-card-hover/40">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{c.name}</div>
                      {c.phone && (
                        <div className="text-[10px] text-muted-foreground tabular-nums">
                          {c.phone}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs">{t.label}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{c.frequency}×</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                      {formatCurrency(c.monetary)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                      {c.recency_days != null ? `${c.recency_days} วัน` : 'ไม่เคย'}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{c.points}</td>
                  </tr>
                );
              })}
              {filtered.length > 200 && (
                <tr>
                  <td colSpan={6} className="px-4 py-2.5 text-xs text-muted-foreground text-center">
                    แสดง 200 จาก {filtered.length} คน — ใช้ Export CSV เพื่อดูทั้งหมด
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating toast */}
      {copyToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background px-4 py-2 rounded-lg shadow-lg text-sm">
          {copyToast}
        </div>
      )}
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
        tone === 'warning'
          ? 'border-warning/60'
          : tone === 'success'
          ? 'border-success/60'
          : 'border-border'
      }`}
    >
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-metric-md mt-1.5 tabular-nums">{value}</div>
    </div>
  );
}
