'use client';
import { Languages } from 'lucide-react';
import { useLang } from '@/lib/i18n';

export function LanguageToggle() {
  const { lang, toggle } = useLang();

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors active:scale-95"
      title={lang === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'}
      aria-label="Toggle language"
    >
      <Languages className="w-3.5 h-3.5" />
      <span className="text-xs font-semibold tabular-nums">{lang === 'th' ? 'ไทย' : 'EN'}</span>
    </button>
  );
}
