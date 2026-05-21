'use client';
import { useEffect, useState, createContext, useContext } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  TrendingUp,
  Sparkles,
  Bot,
  ChevronDown,
  Store,
  Users,
  ShoppingBasket,
  Grid2x2,
  ClipboardList,
  Tag,
  FlaskConical,
  Target,
  LineChart,
} from 'lucide-react';
import { api, cn, getActiveStoreId, setActiveStoreId } from '@/lib/api';

const NAV = [
  // "วันนี้เป็นยังไง?"
  { href: '/', label: 'ภาพรวม', icon: LayoutDashboard, group: 'now' },
  { href: '/playbook', label: 'ต้องทำวันนี้', icon: ClipboardList, group: 'now' },

  // "ลูกค้าฉันเป็นยังไง?"
  { href: '/customers', label: 'กลุ่มลูกค้า', icon: Users, group: 'customer' },
  { href: '/cohort', label: 'การกลับมาซื้อซ้ำ', icon: LineChart, group: 'customer' },

  // "ขายอะไรดี / เมนูไหนทำเงิน?"
  { href: '/menu', label: 'เมนูไหนทำเงิน', icon: Grid2x2, group: 'sales' },
  { href: '/basket', label: 'สินค้าที่ขายคู่กัน', icon: ShoppingBasket, group: 'sales' },

  // "ทำยังไงให้ขายดีขึ้น?"
  { href: '/promotions', label: 'แนะนำโปรโมชัน', icon: Tag, group: 'grow' },
  { href: '/whatif', label: 'ลองคำนวณก่อนตัดสินใจ', icon: FlaskConical, group: 'grow' },
  { href: '/forecast', label: 'พยากรณ์ยอดขาย', icon: TrendingUp, group: 'grow' },
  { href: '/goal', label: 'ติดตามเป้าหมาย', icon: Target, group: 'grow' },

  // ผู้ช่วย
  { href: '/insights', label: 'สรุปอัตโนมัติ', icon: Sparkles, group: 'helper' },
  { href: '/assistant', label: 'ถาม AI', icon: Bot, group: 'helper' },
];

const GROUP_LABELS: Record<string, string> = {
  now: 'วันนี้เป็นยังไง',
  customer: 'รู้จักลูกค้า',
  sales: 'รู้จักเมนู',
  grow: 'ทำยังไงให้ขายดีขึ้น',
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
        {/* Logo */}
        <div className="px-5 py-5 flex items-center gap-2.5 border-b border-border">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shadow-sm">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-base tracking-tight">Analytics</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Business Intelligence
            </div>
          </div>
        </div>

        {/* Store selector */}
        <div className="px-3 py-3 border-b border-border">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block px-1">
            ร้านที่ดู
          </label>
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
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-2 overflow-y-auto scrollbar-thin">
          {(['now', 'customer', 'sales', 'grow', 'helper'] as const).map((group, gi) => (
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

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span className="truncate">{activeStore?.name || 'กำลังโหลด...'}</span>
          </div>
        </div>
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
