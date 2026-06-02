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
  { label: "Today's sales", icon: DollarSign, q: "How are today's sales? Compare with yesterday too." },
  { label: 'What to reorder', icon: Package, q: 'Which products do I urgently need to reorder today?' },
  { label: 'Staff tasks', icon: Users, q: 'What should the staff focus on today?' },
  { label: 'Analyze store', icon: BarChart3, q: 'Analyze my business and suggest what to improve.' },
  { label: 'Forecast', icon: TrendingUp, q: "Forecast next month's revenue." },
  { label: 'Peak hours', icon: Clock, q: 'Which hours have the most customers?' },
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
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Today&apos;s status</span>
        <button
          onClick={() => refetch()}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Refresh"
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
            label="Revenue today"
            value={formatCurrency(kpi?.revenue || 0)}
            sub={kpi?.vs_yesterday_pct != null ? `${kpi.vs_yesterday_pct > 0 ? '+' : ''}${kpi.vs_yesterday_pct.toFixed(1)}% vs yesterday` : ''}
            positive={kpi?.vs_yesterday_pct >= 0}
            color="text-primary"
          />
          <StatPill
            icon={<ShoppingBag className="w-4 h-4" />}
            label="Orders"
            value={`${kpi?.order_count || 0} orders`}
            sub="today"
            color="text-primary"
          />
          <StatPill
            icon={<TrendingUp className="w-4 h-4" />}
            label="30 days (revenue)"
            value={formatCurrency(kpi30?.revenue || 0)}
            sub={`${kpi30?.revenue_growth?.toFixed(1) || 0}% growth`}
            positive={kpi30?.revenue_growth >= 0}
            color="text-success"
          />
          <StatPill
            icon={<Package className="w-4 h-4" />}
            label="Low stock"
            value={`${lowStockCount} items`}
            sub={lowStockCount > 0 ? 'reorder needed' : 'OK'}
            positive={lowStockCount === 0}
            color={lowStockCount > 0 ? 'text-warning' : 'text-success'}
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
    <div className="bg-card border border-border rounded-xl px-3 py-2.5 flex flex-col gap-0.5">
      <div className={`flex items-center gap-1.5 ${color || 'text-primary'}`}>
        {icon}
        <span className="text-xs text-muted-foreground truncate">{label}</span>
      </div>
      <div className="text-sm font-bold tabular-nums truncate">{value}</div>
      {sub && (
        <div className={`text-xs flex items-center gap-0.5 ${positive === false ? 'text-danger' : positive ? 'text-success' : 'text-muted-foreground'}`}>
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
          content: '⚠️ Something went wrong connecting to the AI. Please try again.',
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
      <div className="bg-card border-b border-border px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-sm">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight">POS AI Assistant</h1>
            <p className="text-xs text-muted-foreground">Real-time data from POS</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-card transition-colors"
          >
            Clear chat
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
                <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-md">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-lg font-bold mb-1">Ask anything!</h2>
                <p className="text-muted-foreground text-sm">AI pulls live POS data and analyzes it for you in real time</p>
              </div>

              {/* Quick actions */}
              <div className="mb-6">
                <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">Popular questions</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {QUICK_ACTIONS.map((a) => {
                    const Icon = a.icon;
                    return (
                      <button
                        key={a.label}
                        onClick={() => send(a.q)}
                        className="bg-card hover:bg-card-hover rounded-xl p-3.5 text-left border border-border hover:border-primary/40 transition-all group"
                      >
                        <Icon className="w-4 h-4 text-primary mb-2 group-hover:scale-110 transition-transform" />
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
                  <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">More questions</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((q: string) => (
                      <button
                        key={q}
                        onClick={() => send(q)}
                        className="bg-card hover:bg-card-hover rounded-full px-4 py-1.5 text-sm border border-border hover:border-primary/40 transition-all"
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
                      m.role === 'user' ? 'bg-foreground' : 'bg-primary'
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
                          ? 'bg-foreground text-background rounded-tr-sm'
                          : 'bg-card border border-border rounded-tl-sm'
                      }`}
                    >
                      {m.content ? (
                        m.role === 'user' ? (
                          <span>{m.content}</span>
                        ) : (
                          <div className="prose prose-sm prose-p:leading-relaxed prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-headings:text-sm prose-pre:bg-muted prose-pre:border prose-pre:border-border max-w-none">
                            <ReactMarkdown>{m.content}</ReactMarkdown>
                          </div>
                        )
                      ) : (
                        <div className="flex space-x-1.5 h-5 items-center">
                          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      )}
                    </div>
                    {m.timestamp && m.content && (
                      <span className={`text-[10px] text-muted-foreground px-1 ${m.role === 'user' ? 'text-right' : ''}`}>
                        {m.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
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
      <div className="border-t border-border bg-card px-4 md:px-8 py-4 shrink-0">
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
                    className="flex items-center gap-1.5 bg-card border border-border hover:border-primary/40 rounded-full px-3 py-1.5 text-xs whitespace-nowrap transition-all disabled:opacity-50 shrink-0"
                  >
                    <Icon className="w-3 h-3 text-primary" />
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
              placeholder="e.g. How are sales today? What should staff do?"
              disabled={streaming}
              className="flex-1 bg-input border border-border rounded-2xl pl-5 pr-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all shadow-sm disabled:opacity-50 placeholder:text-muted-foreground/60 resize-none"
            />
            <button
              onClick={() => send(input)}
              disabled={streaming || !input.trim()}
              className="w-11 h-11 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:bg-primary-600 transition-all shrink-0"
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
