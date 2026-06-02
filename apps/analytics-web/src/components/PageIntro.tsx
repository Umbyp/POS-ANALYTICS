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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        <p className="text-[15px] text-muted-foreground mt-1.5 max-w-2xl leading-relaxed">
          {whatItTells}
        </p>
      </div>

      {howToUse && howToUse.length > 0 && (
        <div className="relative bg-card border border-border rounded-xl p-5 pl-6 max-w-2xl shadow-card overflow-hidden">
          {/* accent แถบซ้าย */}
          <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
          <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">
            ใช้ตัดสินใจอะไรได้
          </div>
          <ul className="space-y-2.5 text-[15px]">
            {howToUse.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-[9px] shrink-0" />
                <span className="text-foreground leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
          {tip && (
            <p className="text-sm text-muted-foreground mt-4 pt-3 border-t border-border flex items-start gap-1.5">
              <span>💡</span>
              <span>{tip}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
