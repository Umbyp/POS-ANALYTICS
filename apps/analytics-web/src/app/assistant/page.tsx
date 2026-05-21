'use client';
import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import {
  Send, Bot, User, Sparkles, Loader2, TrendingUp, TrendingDown,
  Package, Clock, ShoppingBag, DollarSign, Users, BarChart3, RefreshCw,
} from 'lucide-react';
import { DashboardShell, useStoreId } from '@/components/DashboardShell';
import { api, API_BASE, formatCurrency } from '@/lib/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

const QUICK_ACTIONS = [
  { label: 'ยอดวันนี้', icon: DollarSign, q: 'วันนี้ยอดขายเป็นอย่างไร เทียบเมื่อวานด้วย' },
  { label: 'สั่งสินค้า', icon: Package, q: 'สินค้าไหนต้องสั่งด่วนวันนี้?' },
  { label: 'Task พนักงาน', icon: Users, q: 'พนักงานวันนี้ต้องทำอะไรบ้าง?' },
  { label: 'วิเคราะห์ร้าน', icon: BarChart3, q: 'วิเคราะห์ธุรกิจและแนะนำว่าควรปรับอะไร?' },
  { label: 'พยากรณ์', icon: TrendingUp, q: 'พยากรณ์รายได้เดือนหน้า' },
  { label: 'ช่วงขายดี', icon: Clock, q: 'ช่วงเวลาไหนลูกค้าเยอะที่สุด?' },
];

function TodayStatsPanel({ storeId }: { storeId: string }) {
  const { data: kpi, isLoading, refetch } = useQuery({
    queryKey: ['today', storeId],
    queryFn: () => api.get('/api/analytics/today', { params: { store_id: storeId } }).then((r) => r.data),
    refetchInterval: 60_000,
    staleTime: 0,
  });
  const { data: kpi30 } = useQuery({
    queryKey: ['kpi', storeId],
    queryFn: () => api.get('/api/analytics/kpi', { params: { store_id: storeId, days: 30 } }).then((r) => r.data),
  });
  const { data: inv = [] } = useQuery({
    queryKey: ['inv', storeId],
    queryFn: () => api.get('/api/analytics/inventory-status', { params: { store_id: storeId } }).then((r) => r.data),
  });

  const lowStockCount = inv.filter((i: any) => i.days_until_out != null && i.days_until_out <= 7).length;

  return (
    <div className="border-b border-border/60 bg-background/60 backdrop-blur-xl px-6 py-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">สถานะวันนี้</span>
        <button
          onClick={() => refetch()}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="รีเฟรช"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl shimmer" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatPill
            icon={<DollarSign className="w-4 h-4" />}
            label="รายได้วันนี้"
            value={formatCurrency(kpi?.revenue || 0)}
            sub={kpi?.vs_yesterday_pct != null ? `${kpi.vs_yesterday_pct > 0 ? '+' : ''}${kpi.vs_yesterday_pct.toFixed(1)}% vs เมื่อวาน` : ''}
            positive={kpi?.vs_yesterday_pct >= 0}
            color="text-indigo-400"
          />
          <StatPill
            icon={<ShoppingBag className="w-4 h-4" />}
            label="ออเดอร์"
            value={`${kpi?.order_count || 0} รายการ`}
            sub="วันนี้"
            color="text-violet-400"
          />
          <StatPill
            icon={<TrendingUp className="w-4 h-4" />}
            label="30 วัน (รายได้)"
            value={formatCurrency(kpi30?.revenue || 0)}
            sub={`เติบโต ${kpi30?.revenue_growth?.toFixed(1) || 0}%`}
            positive={kpi30?.revenue_growth >= 0}
            color="text-emerald-400"
          />
          <StatPill
            icon={<Package className="w-4 h-4" />}
            label="สต็อกใกล้หมด"
            value={`${lowStockCount} รายการ`}
            sub={lowStockCount > 0 ? 'ต้องสั่งเพิ่ม' : 'ปกติ'}
            positive={lowStockCount === 0}
            color={lowStockCount > 0 ? 'text-amber-400' : 'text-emerald-400'}
          />
        </div>
      )}
    </div>
  );
}

function StatPill({ icon, label, value, sub, positive, color }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; positive?: boolean; color?: string;
}) {
  return (
    <div className="glass rounded-xl px-3 py-2.5 flex flex-col gap-0.5">
      <div className={`flex items-center gap-1.5 ${color || 'text-primary'}`}>
        {icon}
        <span className="text-xs text-muted-foreground truncate">{label}</span>
      </div>
      <div className="text-sm font-bold tabular-nums truncate">{value}</div>
      {sub && (
        <div className={`text-xs flex items-center gap-0.5 ${positive === false ? 'text-red-400' : positive ? 'text-emerald-400' : 'text-muted-foreground'}`}>
          {positive === false ? <TrendingDown className="w-3 h-3" /> : positive ? <TrendingUp className="w-3 h-3" /> : null}
          {sub}
        </div>
      )}
    </div>
  );
}

function AssistantContent() {
  const storeId = useStoreId();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: suggestions = [] } = useQuery({
    queryKey: ['suggestions'],
    queryFn: () => api.get('/api/chat/suggestions').then((r) => r.data.questions),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || streaming) return;

    const userMsg: Message = { role: 'user', content: text, timestamp: new Date() };
    const history = [...messages];
    setMessages([...history, userMsg, { role: 'assistant', content: '', timestamp: new Date() }]);
    setInput('');
    setStreaming(true);

    try {
      const res = await fetch(`${API_BASE}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId,
          message: text,
          history: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.body) throw new Error('No stream');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: 'assistant', content: acc, timestamp: new Date() };
          return next;
        });
      }
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'assistant',
          content: '⚠️ เกิดข้อผิดพลาดในการเชื่อมต่อ AI กรุณาลองใหม่',
          timestamp: new Date(),
        };
        return next;
      });
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  };

  const clearChat = () => setMessages([]);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="glass border-b border-border/60 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight">POS AI Assistant</h1>
            <p className="text-xs text-muted-foreground">ข้อมูลจาก POS แบบ real-time</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-card transition-colors"
          >
            ล้างการสนทนา
          </button>
        )}
      </div>

      {/* Today stats */}
      <TodayStatsPanel storeId={storeId} />

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-4 md:px-8 py-6">
        <AnimatePresence mode="popLayout">
          {messages.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="max-w-2xl mx-auto"
            >
              {/* Empty state */}
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-indigo-500/20">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-lg font-bold mb-1">ถามได้เลย!</h2>
                <p className="text-muted-foreground text-sm">AI ดึงข้อมูลจาก POS วิเคราะห์ให้แบบ real-time</p>
              </div>

              {/* Quick actions */}
              <div className="mb-6">
                <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">คำถามยอดนิยม</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {QUICK_ACTIONS.map((a) => {
                    const Icon = a.icon;
                    return (
                      <button
                        key={a.label}
                        onClick={() => send(a.q)}
                        className="glass glass-hover rounded-xl p-3.5 text-left border border-border/40 hover:border-indigo-500/40 transition-all group"
                      >
                        <Icon className="w-4 h-4 text-indigo-400 mb-2 group-hover:scale-110 transition-transform" />
                        <div className="text-sm font-medium">{a.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{a.q}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* More suggestions */}
              {suggestions.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">คำถามอื่นๆ</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((q: string) => (
                      <button
                        key={q}
                        onClick={() => send(q)}
                        className="glass glass-hover rounded-full px-4 py-1.5 text-sm border border-border/40 hover:border-indigo-500/40 transition-all"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-5">
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                      m.role === 'user'
                        ? 'bg-indigo-600'
                        : 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-500/20'
                    }`}
                  >
                    {m.role === 'user'
                      ? <User className="w-4 h-4 text-white" />
                      : <Bot className="w-4 h-4 text-white" />
                    }
                  </div>

                  {/* Bubble */}
                  <div className="flex flex-col gap-1 max-w-[82%]">
                    <div
                      className={`rounded-2xl px-4 py-3 text-[14px] leading-relaxed shadow-sm ${
                        m.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-tr-sm'
                          : 'glass border border-border/50 rounded-tl-sm'
                      }`}
                    >
                      {m.content ? (
                        m.role === 'user' ? (
                          <span>{m.content}</span>
                        ) : (
                          <div className="prose prose-invert prose-sm prose-p:leading-relaxed prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-headings:text-sm prose-pre:bg-black/50 prose-pre:border prose-pre:border-border max-w-none">
                            <ReactMarkdown>{m.content}</ReactMarkdown>
                          </div>
                        )
                      ) : (
                        <div className="flex space-x-1.5 h-5 items-center">
                          <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      )}
                    </div>
                    {m.timestamp && m.content && (
                      <span className={`text-[10px] text-muted-foreground px-1 ${m.role === 'user' ? 'text-right' : ''}`}>
                        {m.timestamp.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Input area */}
      <div className="border-t border-border/60 bg-background/80 backdrop-blur-xl px-4 md:px-8 py-4 shrink-0">
        <div className="max-w-2xl mx-auto">
          {/* Quick action chips while chatting */}
          {messages.length > 0 && (
            <div className="flex gap-2 mb-3 overflow-x-auto scrollbar-none pb-1">
              {QUICK_ACTIONS.slice(0, 4).map((a) => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.label}
                    onClick={() => send(a.q)}
                    disabled={streaming}
                    className="flex items-center gap-1.5 glass rounded-full px-3 py-1.5 text-xs whitespace-nowrap border border-border/40 hover:border-indigo-500/40 transition-all disabled:opacity-50 shrink-0"
                  >
                    <Icon className="w-3 h-3 text-indigo-400" />
                    {a.label}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex gap-2 items-end">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send(input)}
              placeholder="เช่น ยอดขายวันนี้เท่าไหร่? พนักงานต้องทำอะไร?"
              disabled={streaming}
              className="flex-1 bg-secondary/60 border border-border/60 rounded-2xl pl-5 pr-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all shadow-sm disabled:opacity-50 placeholder:text-muted-foreground/60 resize-none"
            />
            <button
              onClick={() => send(input)}
              disabled={streaming || !input.trim()}
              className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center disabled:opacity-40 hover:shadow-lg hover:shadow-indigo-500/20 transition-all hover:scale-105 shrink-0"
            >
              {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <DashboardShell>
      <AssistantContent />
    </DashboardShell>
  );
}
