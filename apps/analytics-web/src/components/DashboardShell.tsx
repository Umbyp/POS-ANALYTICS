'use client';
import { useEffect, useState, createContext, useContext } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Sparkles,
  Bot,
  ChevronDown,
  Store,
  Users,
  Grid2x2,
  ClipboardList,
  Tag,
} from 'lucide-react';
import { api, cn, getActiveStoreId, setActiveStoreId } from '@/lib/api';

// 6 หน้าหลัก — ทุกหน้าเชื่อมฐานข้อมูลจริงและจำเป็นต่อการวิเคราะห์
// (พยากรณ์ยอดขาย / เป้าหมาย / สรุปอัตโนมัติ ถูกรวมไว้ในหน้า "ภาพรวม" แล้ว)
const NAV = [
  // วันนี้เป็นยังไง
  { href: '/', label: 'ภาพรวม', icon: LayoutDashboard, group: 'now' },
  { href: '/playbook', label: 'ต้องทำวันนี้', icon: ClipboardList, group: 'now' },

  // วิเคราะห์เชิงลึก
  { href: '/customers', label: 'กลุ่มลูกค้า', icon: Users, group: 'analyze' },
  { href: '/menu', label: 'เมนูไหนทำเงิน', icon: Grid2x2, group: 'analyze' },
  { href: '/promotions', label: 'แนะนำโปรโมชัน', icon: Tag, group: 'analyze' },

  // ผู้ช่วย
  { href: '/assistant', label: 'ถาม AI', icon: Bot, group: 'helper' },
];

const GROUP_LABELS: Record<string, string> = {
  now: 'วันนี้เป็นยังไง',
  analyze: 'วิเคราะห์เชิงลึก',
  helper: 'ผู้ช่วย',
};

const StoreContext = createContext<string>('');
export const useStoreId = () => useContext(StoreContext);

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [storeId, setStoreId] = useState<string | null>(null);

  const { data: stores = [] } = useQuery({
    queryKey: ['stores'],
    queryFn: () => api.get('/api/analytics/stores').then((r) => r.data),
  });

  useEffect(() => {
    const saved = getActiveStoreId();
    if (saved) setStoreId(saved);
    else if (stores.length) {
      setStoreId(stores[0].id);
      setActiveStoreId(stores[0].id);
    }
  }, [stores]);

  const activeStore = stores.find((s: any) => s.id === storeId);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar — light theme + orange accent */}
      <aside className="w-60 shrink-0 flex flex-col border-r border-border bg-card">
        {/* Logo — กดเพื่อกลับหน้าภาพรวม */}
        <Link
          href="/"
          className="px-5 py-5 flex items-center gap-2.5 border-b border-border hover:bg-muted/50 transition-colors"
        >
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shadow-sm">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-base tracking-tight">Analytics</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Business Intelligence
            </div>
          </div>
        </Link>

        {/* Store selector — only a dropdown when there's more than one branch.
            For a single store we just show the name (read-only viewing, no setup). */}
        <div className="px-3 py-3 border-b border-border">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block px-1">
            ร้านที่ดู
          </label>
          {stores.length > 1 ? (
            <div className="relative">
              <Store className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <select
                value={storeId || ''}
                onChange={(e) => {
                  setStoreId(e.target.value);
                  setActiveStoreId(e.target.value);
                  window.location.reload();
                }}
                className="w-full bg-card border border-border rounded-lg pl-8 pr-7 py-2 text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              >
                {stores.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
              <Store className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="truncate font-medium">
                {activeStore?.name || stores[0]?.name || 'กำลังเชื่อมข้อมูล…'}
              </span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-2 overflow-y-auto scrollbar-thin">
          {(['now', 'analyze', 'helper'] as const).map((group, gi) => (
            <div key={group} className={gi === 0 ? '' : 'mt-5'}>
              {/* Group header with divider */}
              <div className="flex items-center gap-2 px-3 mb-1.5">
                <p className="text-[11px] tracking-wide text-foreground/70 font-semibold whitespace-nowrap">
                  {GROUP_LABELS[group]}
                </p>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-0.5">
                {NAV.filter((i) => i.group === group).map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                        active
                          ? 'bg-primary text-white font-medium shadow-sm'
                          : 'text-foreground/80 hover:text-foreground hover:bg-muted'
                      )}
                    >
                      <Icon className={cn('w-4 h-4 shrink-0', active ? '' : 'text-muted-foreground')} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer with health status */}
        <ServiceStatusFooter activeStore={activeStore} storeId={storeId} />
      </aside>

      <main className="flex-1 overflow-y-auto scrollbar-thin min-w-0">
        {storeId ? (
          <StoreContext.Provider value={storeId}>{children}</StoreContext.Provider>
        ) : (
          <div className="flex items-center justify-center h-screen text-muted-foreground text-sm">
            กำลังโหลดข้อมูลสาขา...
          </div>
        )}
      </main>
    </div>
  );
}

/** Footer that pings the API every 30s and shows a live health indicator. */
function ServiceStatusFooter({ activeStore, storeId }: { activeStore: any; storeId: string | null }) {
  const { data: health, error } = useQuery({
    queryKey: ['health', storeId],
    queryFn: () =>
      api
        .get('/api/analytics/kpi', { params: { store_id: storeId, days: 30 } })
        .then((r) => ({ ok: true, orders: r.data?.order_count || 0, revenue: r.data?.revenue || 0 })),
    enabled: !!storeId,
    refetchInterval: 30_000,
    retry: 0,
  });

  const isUp = !!health?.ok;
  const isDown = !!error;

  return (
    <div className="px-3 py-3 border-t border-border space-y-2">
      <div className="flex items-center gap-2 text-xs">
        <div
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            isUp ? 'bg-success animate-pulse' : isDown ? 'bg-danger' : 'bg-warning animate-pulse'
          )}
        />
        <span className="truncate flex-1">
          {isUp ? 'Connected' : isDown ? 'Service offline' : 'Connecting…'}
        </span>
      </div>
      {isDown && (
        <div className="rounded-md bg-danger/10 border border-danger/30 p-2 text-[10px] leading-relaxed text-danger">
          analytics-api ไม่ตอบ — รัน:
          <code className="block mt-1 bg-card px-1.5 py-1 rounded font-mono text-foreground/90 break-all">
            cd apps/analytics-api &amp;&amp; uvicorn app.main:app --port 8000
          </code>
        </div>
      )}
      {isUp && health.orders > 0 && (
        <div className="text-[10px] text-muted-foreground tabular-nums">
          {health.orders.toLocaleString()} orders · 30 วัน
        </div>
      )}
      {isUp && health.orders === 0 && (
        <div className="rounded-md bg-warning/10 border border-warning/30 p-2 text-[10px] leading-relaxed">
          ยังไม่มีข้อมูลออเดอร์ — รัน{' '}
          <code className="bg-card px-1 rounded">npm run db:seed:mock</code> ใน apps/api
        </div>
      )}
      <div className="text-[10px] text-muted-foreground truncate">
        ร้าน: {activeStore?.name || '…'}
      </div>
    </div>
  );
}
