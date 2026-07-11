"""
AI Service — Business Assistant (Intent-based v3)

ปรัชญา: ส่งเฉพาะข้อมูลที่จำเป็นต่อคำถาม เพื่อประหยัด token + ลด latency
- Intent detection → เลือก context blocks
- Each block lazy-fetched + capped → no full-context dump
- Fallback minimum context สำหรับคำถามทั่วไป
- Primary: Gemini · Fallback: OpenRouter
"""
import json
import datetime
import httpx
import google.generativeai as genai

from ..config import settings
from . import data_service, forecast_service, recommendation_service
from ..i18n import pick

if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)


SYSTEM_PROMPT_TH = """คุณคือ "POS AI" ผู้ช่วยธุรกิจร้านค้า/ร้านอาหาร

หลักการ:
- ตอบไทย กระชับ เหมือนผู้จัดการมืออาชีพ
- อ้างตัวเลขจาก context เท่านั้น ห้ามแต่ง
- ใช้ emoji เพื่ออ่านง่าย (✅ ⚠️ 🔴 📦 💰 ⏰ 📊)
- จบด้วย action ที่ทำได้ทันที
- ถ้าข้อมูลไม่พอ บอกตรงๆ + แนะนำสิ่งที่ผู้ใช้ควรถามต่อ
"""

SYSTEM_PROMPT_EN = """You are "POS AI", a business assistant for a retail/restaurant store.

Principles:
- Answer in English, concise, like a professional manager.
- Only cite numbers from the given context — never make numbers up.
- Use emoji for readability (✅ ⚠️ 🔴 📦 💰 ⏰ 📊)
- End with an action the owner can take right now.
- If the data isn't enough, say so plainly and suggest what to ask next.
"""


def _system_prompt(lang: str) -> str:
    return pick(lang, SYSTEM_PROMPT_TH, SYSTEM_PROMPT_EN)


# ============================================================
# Intent detection — keyword-based + scoring
# ============================================================

INTENT_KEYWORDS = {
    "today": ["วันนี้", "ตอนนี้", "เดี๋ยวนี้", "ล่าสุด", "today", "now"],
    "yesterday_compare": ["เมื่อวาน", "เทียบ", "ดีขึ้น", "แย่ลง", "vs"],
    "period": ["เดือนนี้", "สัปดาห์", "30 วัน", "ที่ผ่านมา", "ภาพรวม", "สรุป", "summary"],
    "inventory": ["สต็อก", "หมด", "เติม", "สั่ง", "คลัง", "stock", "restock", "inventory"],
    "employee": ["พนักงาน", "schedule", "งาน", "ทำอะไร", "หน้าที่", "task", "staff"],
    "forecast": ["พยากรณ์", "คาดการณ์", "ทำนาย", "เดือนหน้า", "สัปดาห์หน้า", "อนาคต", "forecast", "predict"],
    "product": ["สินค้า", "ขายดี", "เมนู", "product", "top", "best"],
    "profit": ["กำไร", "ทำกำไร", "margin", "profit"],
    "peak": ["ช่วงเวลา", "ชั่วโมง", "peak", "rush", "ลูกค้าเยอะ"],
    "promotion": ["โปรโมชัน", "ลด", "แคมเปญ", "ดึงดูด", "promo"],
    "analysis": ["วิเคราะห์", "แนะนำ", "ควรทำ", "ปัญหา", "improve", "analyze"],
}


def detect_intents(message: str) -> set[str]:
    msg = message.lower()
    hits = {name for name, kws in INTENT_KEYWORDS.items() if any(k in msg for k in kws)}
    # ถ้าไม่ match อะไรเลย → ถือว่าถามสรุปทั่วไป
    if not hits:
        hits = {"today", "period"}
    return hits


# ============================================================
# Context blocks — each is independent + estimated token cost
# ============================================================

def _block_datetime() -> str:
    now = datetime.datetime.now()
    thai_days = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"]
    return f"เวลาปัจจุบัน: วัน{thai_days[now.weekday()]} {now.day}/{now.month}/{now.year + 543} {now.strftime('%H:%M')} น."


def _block_today_sales(store_id: str) -> str:
    try:
        td = data_service.get_today_sales(store_id)
        sign = "📈" if td["vs_yesterday_pct"] >= 0 else "📉"
        out = (
            f"[ยอดวันนี้] รายได้ {td['revenue']:,.0f} บาท ({sign}{td['vs_yesterday_pct']:+.1f}% vs เมื่อวาน) "
            f"| {td['order_count']} ออเดอร์ (เมื่อวาน {td['yesterday_orders']}) "
            f"| เฉลี่ย/บิล {td['avg_ticket']:,.0f}"
        )
        if td.get("last_order_at"):
            out += f" | ล่าสุด {td['last_order_at'][11:16]}"
        return out
    except Exception:
        return ""


def _block_today_top(store_id: str, limit: int = 3) -> str:
    try:
        df = data_service.get_today_top_products(store_id, limit=limit)
        if df.empty:
            return ""
        items = " | ".join(f"{r['name']} {int(r['qty_sold'])}ชิ้น" for _, r in df.iterrows())
        return f"[ขายดีวันนี้] {items}"
    except Exception:
        return ""


def _block_peak_hours(store_id: str, today_only: bool = True) -> str:
    try:
        if today_only:
            df = data_service.get_today_hourly(store_id)
            if df.empty:
                return ""
            peak = df.loc[df["orders"].idxmax()]
            return f"[Peak วันนี้] {int(peak['hour']):02d}:00 น. ({int(peak['orders'])} ออเดอร์)"
        else:
            df = data_service.get_hourly_heatmap(store_id, days=30)
            if df.empty:
                return ""
            top3 = df.nlargest(3, "orders")
            slots = ", ".join(f"{int(r['hour']):02d}:00 ({int(r['orders'])})" for _, r in top3.iterrows())
            return f"[Peak hours 30วัน] {slots}"
    except Exception:
        return ""


def _block_period_kpi(store_id: str, days: int = 30) -> str:
    try:
        k = data_service.get_kpi_summary(store_id, days=days)
        return (
            f"[KPI {days}วัน] รายได้ {k['revenue']:,.0f} ({k['revenue_growth']:+.1f}%) "
            f"| กำไร {k['gross_profit']:,.0f} | {k['order_count']:,} ออเดอร์ "
            f"| เฉลี่ย {k['avg_ticket']:,.0f}/บิล"
        )
    except Exception:
        return ""


def _block_top_products(store_id: str, days: int = 30, limit: int = 5, include_profit: bool = False) -> str:
    try:
        df = data_service.get_top_products(store_id, days=days, limit=limit)
        if df.empty:
            return ""
        lines = [f"[Top {limit} สินค้า {days}วัน]"]
        for i, (_, p) in enumerate(df.iterrows(), 1):
            if include_profit:
                lines.append(f"  {i}. {p['name']}: {int(p['qty_sold'])}ชิ้น | รายได้ {p['revenue']:,.0f} | กำไร {p['profit']:,.0f}")
            else:
                lines.append(f"  {i}. {p['name']}: {int(p['qty_sold'])}ชิ้น ({p['revenue']:,.0f} บาท)")
        return "\n".join(lines)
    except Exception:
        return ""


def _block_inventory_alerts(store_id: str) -> str:
    """แสดงเฉพาะ critical + warning (ตัด normal stock ออกเพื่อประหยัด token)"""
    try:
        inv = data_service.get_inventory_status(store_id)
        critical = inv[(inv["days_until_out"].notna()) & (inv["days_until_out"] <= 3)]
        warning = inv[(inv["days_until_out"].notna()) & (inv["days_until_out"] > 3) & (inv["days_until_out"] <= 7)]
        ok_count = len(inv) - len(critical) - len(warning)

        out = [f"[สต็อก] รวม {len(inv)} | 🔴 วิกฤต {len(critical)} | ⚠️ ใกล้หมด {len(warning)} | ✅ ปกติ {ok_count}"]
        if not critical.empty:
            out.append("🔴 ต้องสั่งด่วน:")
            for _, p in critical.head(8).iterrows():
                out.append(f"  • {p['name']}: เหลือ {int(p['stock'])} (หมดใน {p['days_until_out']:.1f} วัน)")
        if not warning.empty and len(critical) < 5:
            out.append("⚠️ ควรสั่งสัปดาห์นี้:")
            for _, p in warning.head(5).iterrows():
                out.append(f"  • {p['name']}: เหลือ {int(p['stock'])} (หมดใน {p['days_until_out']:.1f} วัน)")
        return "\n".join(out)
    except Exception:
        return ""


def _block_restock_recommendations(store_id: str) -> str:
    try:
        recs = recommendation_service.recommend_restock(store_id)
        if not recs:
            return ""
        out = ["[แนะนำสั่งซื้อ]"]
        for r in recs[:5]:
            out.append(f"  📦 {r['product_name']}: สั่ง {r['suggested_order_qty']} ชิ้น ({r['reason']})")
        return "\n".join(out)
    except Exception:
        return ""


def _block_high_profit(store_id: str) -> str:
    try:
        items = recommendation_service.recommend_high_profit(store_id)
        if not items:
            return ""
        out = ["[สินค้ากำไรดี]"]
        for r in items[:3]:
            out.append(f"  💎 {r['product_name']}: กำไร {r.get('profit', 0):,.0f}")
        return "\n".join(out)
    except Exception:
        return ""


def _block_promotion_ideas(store_id: str) -> str:
    try:
        promos = recommendation_service.recommend_promotions(store_id)
        if not promos:
            return ""
        out = ["[ไอเดียโปรโมชัน]"]
        for r in promos[:3]:
            out.append(f"  🎯 {r['product_name']}: {r.get('suggestion', r.get('reason', ''))}")
        return "\n".join(out)
    except Exception:
        return ""


def _block_forecast(store_id: str) -> str:
    try:
        fc = forecast_service.forecast_revenue(store_id, days_ahead=30)
        return f"[พยากรณ์ 30 วัน] รายได้รวมคาดการณ์ {fc['total_predicted']:,.0f} บาท"
    except Exception:
        return ""


def _block_employee_tasks(store_id: str) -> str:
    """Task แนะนำสำหรับวันนี้ — สั้น ไม่ดึงสต็อกซ้ำ (assume inventory block จะ append แยก)"""
    now = datetime.datetime.now()
    tasks = []
    h = now.hour
    if h < 10:
        tasks.append("🧹 เปิดร้าน + ทำความสะอาด")
        tasks.append("📋 ตรวจนับสต็อกเปิดวัน")
    elif h < 14:
        tasks.append("👥 ดูแลลูกค้าช่วง lunch")
    elif h < 18:
        tasks.append("📊 เช็คยอดเทียบเป้า")
    else:
        tasks.append("💰 ปิดยอดประจำวัน")
        tasks.append("📦 ตรวจสต็อกปิดวัน")
    return "[Task พนักงานวันนี้]\n" + "\n".join(f"  • {t}" for t in tasks)


# ============================================================
# Context router — intent → blocks
# ============================================================

# แต่ละ intent → list of (block_name, builder_fn, args)
# Order matters: most relevant first (ตัดท้ายได้ถ้า context ยาวเกิน)
INTENT_BLOCKS: dict[str, list[tuple[str, callable, dict]]] = {
    "today": [
        ("today_sales", _block_today_sales, {}),
        ("today_top", _block_today_top, {"limit": 3}),
    ],
    "yesterday_compare": [
        ("today_sales", _block_today_sales, {}),
    ],
    "period": [
        ("period_kpi", _block_period_kpi, {"days": 30}),
        ("top_products", _block_top_products, {"days": 30, "limit": 5}),
    ],
    "inventory": [
        ("inventory_alerts", _block_inventory_alerts, {}),
        ("restock", _block_restock_recommendations, {}),
    ],
    "employee": [
        ("employee_tasks", _block_employee_tasks, {}),
        ("inventory_alerts", _block_inventory_alerts, {}),
        ("today_sales", _block_today_sales, {}),
    ],
    "forecast": [
        ("forecast", _block_forecast, {}),
        ("period_kpi", _block_period_kpi, {"days": 30}),
    ],
    "product": [
        ("top_products", _block_top_products, {"days": 30, "limit": 5}),
    ],
    "profit": [
        ("top_products", _block_top_products, {"days": 30, "limit": 5, "include_profit": True}),
        ("high_profit", _block_high_profit, {}),
    ],
    "peak": [
        ("peak_today", _block_peak_hours, {"today_only": True}),
        ("peak_period", _block_peak_hours, {"today_only": False}),
    ],
    "promotion": [
        ("top_products", _block_top_products, {"days": 30, "limit": 5, "include_profit": True}),
        ("promotion_ideas", _block_promotion_ideas, {}),
        ("high_profit", _block_high_profit, {}),
    ],
    "analysis": [
        ("period_kpi", _block_period_kpi, {"days": 30}),
        ("today_sales", _block_today_sales, {}),
        ("top_products", _block_top_products, {"days": 30, "limit": 5, "include_profit": True}),
        ("inventory_alerts", _block_inventory_alerts, {}),
        ("promotion_ideas", _block_promotion_ideas, {}),
    ],
}


# Soft cap (approx chars; 1 token ~ 2-3 chars Thai/English mix)
MAX_CONTEXT_CHARS = 4000


def build_context(store_id: str, intents: set[str]) -> tuple[str, list[str]]:
    """
    คืน (context_string, used_block_names)
    - dedupe block ที่ซ้ำกันข้าม intent
    - cap ความยาวรวมเพื่อกัน token overflow
    """
    seen: set[str] = set()
    parts: list[str] = [_block_datetime()]
    used: list[str] = ["datetime"]
    total = len(parts[0])

    # เรียง intent ตาม priority (specific มาก่อน generic)
    priority = ["today", "yesterday_compare", "inventory", "employee", "forecast",
                "peak", "profit", "promotion", "product", "period", "analysis"]
    ordered = [i for i in priority if i in intents] + [i for i in intents if i not in priority]

    for intent in ordered:
        for name, fn, kwargs in INTENT_BLOCKS.get(intent, []):
            if name in seen:
                continue
            try:
                block = fn(store_id, **kwargs)
            except Exception as e:
                print(f"[WARN] block {name} failed: {e}")
                continue
            if not block:
                continue
            if total + len(block) > MAX_CONTEXT_CHARS:
                # ใส่ได้แค่ไหนใส่ — ถ้าเต็มก็หยุด
                break
            parts.append(block)
            seen.add(name)
            used.append(name)
            total += len(block) + 2

    return "\n\n".join(parts), used


# ============================================================
# Prompt assembly
# ============================================================

def build_full_prompt(store_id: str, message: str, history: list[dict], lang: str = "th") -> tuple[str, dict]:
    intents = detect_intents(message)
    ctx, used_blocks = build_context(store_id, intents)

    # ตัด history เหลือ 4 ล่าสุดเพื่อประหยัด token
    convo_lines = []
    for h in history[-4:]:
        role = pick(lang, "ผู้ใช้" if h["role"] == "user" else "ผู้ช่วย", "User" if h["role"] == "user" else "Assistant")
        # ตัดข้อความเก่าให้สั้น (200 ตัวอักษร)
        content = h["content"][:200] + ("..." if len(h["content"]) > 200 else "")
        convo_lines.append(f"{role}: {content}")
    convo = "\n".join(convo_lines) if convo_lines else pick(lang, "(ไม่มี)", "(none)")

    section_data = pick(lang, "ข้อมูลธุรกิจ", "Business data")
    section_convo = pick(lang, "บทสนทนาก่อนหน้า", "Previous conversation")
    section_q = pick(lang, "คำถาม", "Question")
    section_a = pick(lang, "ตอบ", "Answer")

    prompt = f"""{_system_prompt(lang)}

=== {section_data} ===
{ctx}

=== {section_convo} ===
{convo}

=== {section_q} ===
{message}

{section_a}:"""

    meta = {
        "intents": sorted(intents),
        "blocks_used": used_blocks,
        "prompt_chars": len(prompt),
        "approx_tokens": len(prompt) // 3,  # rough estimate
    }
    return prompt, meta


# ============================================================
# Streaming chat
# ============================================================

async def stream_chat(store_id: str, message: str, history: list[dict], lang: str = "th"):
    prompt, meta = build_full_prompt(store_id, message, history, lang=lang)
    print(f"[AI] intents={meta['intents']} blocks={meta['blocks_used']} ~{meta['approx_tokens']} tokens")

    # ---- Gemini ----
    if settings.GEMINI_API_KEY:
        try:
            model = genai.GenerativeModel(settings.GEMINI_MODEL)
            response = model.generate_content(prompt, stream=True)
            for chunk in response:
                if chunk.text:
                    yield chunk.text
            return
        except Exception as e:
            print(f"[WARN] Gemini failed: {e} - falling back to OpenRouter")

    # ---- OpenRouter fallback ----
    if settings.OPENROUTER_API_KEY:
        yielded = False
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                async with client.stream(
                    "POST",
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.OPENROUTER_API_KEY}"},
                    json={
                        "model": settings.OPENROUTER_MODEL,
                        "messages": [
                            {"role": "system", "content": _system_prompt(lang)},
                            {"role": "user", "content": prompt},
                        ],
                        "stream": True,
                    },
                ) as response:
                    if response.status_code != 200:
                        body = await response.aread()
                        raise RuntimeError(f"HTTP {response.status_code}: {body.decode(errors='replace')[:300]}")
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data = line[6:]
                            if data == "[DONE]":
                                break
                            try:
                                obj = json.loads(data)
                                delta = obj["choices"][0]["delta"].get("content", "")
                                if delta:
                                    yielded = True
                                    yield delta
                            except Exception:
                                continue
            if yielded:
                return
            print("[WARN] OpenRouter returned no content — falling through to unavailable message")
        except Exception as e:
            print(f"[WARN] OpenRouter failed: {e}")

    yield pick(
        lang,
        "ขออภัย ระบบ AI ไม่พร้อมใช้งาน (ยังไม่ได้ตั้งค่า GEMINI_API_KEY หรือ OPENROUTER_API_KEY)",
        "Sorry, the AI system isn't available (GEMINI_API_KEY / OPENROUTER_API_KEY isn't set)",
    )


def get_suggested_questions(lang: str = "th") -> list[str]:
    return pick(
        lang,
        [
            "วันนี้ยอดขายเป็นอย่างไร เทียบเมื่อวานด้วย",
            "สินค้าไหนต้องสั่งด่วนวันนี้?",
            "พนักงานวันนี้ต้องทำอะไรบ้าง?",
            "สินค้าไหนทำกำไรมากที่สุด 30 วันที่ผ่านมา?",
            "ช่วงเวลาไหนลูกค้าเยอะที่สุด?",
            "วิเคราะห์ธุรกิจและแนะนำว่าควรปรับอะไร?",
            "พยากรณ์รายได้เดือนหน้า",
            "ควรจัดโปรโมชันสินค้าอะไร?",
        ],
        [
            "How are today's sales? Compare with yesterday too.",
            "Which products urgently need reordering today?",
            "What should staff focus on today?",
            "Which products made the most profit in the last 30 days?",
            "Which hours have the most customers?",
            "Analyze the business and suggest what to improve.",
            "Forecast next month's revenue.",
            "What promotion should I run?",
        ],
    )
