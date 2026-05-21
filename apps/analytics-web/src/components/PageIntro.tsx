'use client';

interface Props {
  title: string;
  /** อธิบายว่าหน้านี้บอกอะไร (1-2 ประโยค) */
  whatItTells: string;
  /** อธิบายว่าใช้ทำอะไรได้ (action) — bullet points */
  howToUse?: string[];
  /** เคล็ดลับ/หมายเหตุเสริม */
  tip?: string;
}

/**
 * Header ของหน้า analytics — บอก user แบบเร็วว่า:
 *   - หน้านี้บอกอะไร
 *   - ใช้ทำอะไรได้
 *   - ใช้ตัดสินใจอะไร
 */
export function PageIntro({ title, whatItTells, howToUse, tip }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
          {whatItTells}
        </p>
      </div>

      {howToUse && howToUse.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4 max-w-2xl">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
            ใช้ตัดสินใจอะไรได้
          </div>
          <ul className="space-y-1.5 text-sm">
            {howToUse.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-muted-foreground mt-2 shrink-0" />
                <span className="text-foreground/90">{item}</span>
              </li>
            ))}
          </ul>
          {tip && (
            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
              💡 {tip}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
