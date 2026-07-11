"""
Daily Action Playbook — รวบรวมสิ่งที่ owner ต้องทำวันนี้
รวม alerts จากหลาย service:
  - At-Risk customers → win-back
  - Low stock ingredients → restock
  - Poor performance days → promote
  - Bundle opportunities → create combo
  - Dead stock → discount campaign
"""
import datetime
from . import (
    segmentation_service,
    basket_service,
    menu_engineering_service,
    data_service,
    forecast_service,
    recommendation_service,
)
from ..i18n import pick


def generate_playbook(store_id: str, lang: str = "th") -> dict:
    """สร้าง action plan สำหรับวันนี้"""
    now = datetime.datetime.now()
    actions: list[dict] = []

    # ===== 1. Customer (At-Risk) =====
    try:
        churn = segmentation_service.get_churn_candidates(store_id)
        if churn:
            top_at_risk = churn[:3]
            for c in top_at_risk:
                actions.append({
                    "priority": "high",
                    "category": "customer",
                    "icon": "📞",
                    "title": pick(lang, f"ดึงลูกค้ากลับ: {c['name']}", f"Win back: {c['name']}"),
                    "description": pick(
                        lang,
                        f"ไม่มา {c['days_silent']} วัน (ปกติทุก {c['expected_gap']} วัน) · "
                        f"LTV {c['lifetime_value']:,.0f}฿",
                        f"Away for {c['days_silent']} days (usually visits every {c['expected_gap']} days) · "
                        f"LTV {c['lifetime_value']:,.0f}฿",
                    ),
                    "action": pick(lang, "ส่ง LINE/SMS coupon ลด 30%", "Send a 30%-off coupon via LINE/SMS"),
                    "data": c,
                })
    except Exception as e:
        print(f"[playbook] churn failed: {e}")

    # ===== 2. Inventory (Low stock) =====
    try:
        inv = data_service.get_inventory_status(store_id)
        critical = inv[(inv["days_until_out"].notna()) & (inv["days_until_out"] <= 3)]
        for _, p in critical.head(5).iterrows():
            actions.append({
                "priority": "high",
                "category": "inventory",
                "icon": "📦",
                "title": pick(lang, f"สั่งด่วน: {p['name']}", f"Order now: {p['name']}"),
                "description": pick(
                    lang,
                    f"เหลือ {int(p['stock'])} ชิ้น · หมดใน {p['days_until_out']:.1f} วัน",
                    f"{int(p['stock'])} units left · runs out in {p['days_until_out']:.1f} days",
                ),
                "action": pick(lang, "ติดต่อ supplier วันนี้", "Contact your supplier today"),
                "data": {"name": p["name"], "stock": int(p["stock"])},
            })
    except Exception as e:
        print(f"[playbook] inventory failed: {e}")

    # ===== 3. Today vs Average =====
    try:
        td = data_service.get_today_sales(store_id)
        if td["vs_yesterday_pct"] < -20 and now.hour >= 12:
            actions.append({
                "priority": "high",
                "category": "performance",
                "icon": "⚠️",
                "title": pick(lang, "ยอดวันนี้ต่ำกว่าเมื่อวาน", "Today's sales are behind yesterday"),
                "description": pick(
                    lang,
                    f"ยอด {td['revenue']:,.0f}฿ (ต่ำกว่าเมื่อวาน {abs(td['vs_yesterday_pct']):.0f}%)",
                    f"Revenue {td['revenue']:,.0f}฿ ({abs(td['vs_yesterday_pct']):.0f}% below yesterday)",
                ),
                "action": pick(
                    lang,
                    "ลองโพสต์ LINE/Facebook โปรแฟลช ลด 15-20% ช่วงท้ายวัน",
                    "Try a LINE/Facebook flash promo — 15-20% off for the rest of the day",
                ),
                "data": td,
            })
    except Exception as e:
        print(f"[playbook] today perf failed: {e}")

    # ===== 4. Bundle opportunity =====
    try:
        bm = basket_service.get_basket_rules(store_id, days=60, min_support=5, min_confidence=0.5)
        for b in bm["bundle_suggestions"][:2]:
            actions.append({
                "priority": "medium",
                "category": "promotion",
                "icon": "🎁",
                "title": pick(lang, f"สร้างเซต: {' + '.join(b['items'])}", f"Create a bundle: {' + '.join(b['items'])}"),
                "description": pick(
                    lang,
                    f"ขายร่วมกันแล้ว {b['co_occurrence']} ครั้ง · "
                    f"confidence {b['confidence']}% · lift {b['lift']}x",
                    f"Bought together {b['co_occurrence']} times · "
                    f"confidence {b['confidence']}% · lift {b['lift']}x",
                ),
                "action": pick(lang, "ตั้งเป็น Combo ใน POS — ลด 10-15% จาก sum", "Set it up as a combo in POS — 10-15% off the sum"),
                "data": b,
            })
    except Exception as e:
        print(f"[playbook] basket failed: {e}")

    # ===== 5. Menu Engineering: Dogs =====
    try:
        me = menu_engineering_service.get_menu_engineering(store_id, days=30)
        dogs = [i for i in me["items"] if i["quadrant"] == "Dog"]
        if len(dogs) >= 3:
            more = "..." if len(dogs) > 3 else ""
            actions.append({
                "priority": "medium",
                "category": "menu",
                "icon": "🐕",
                "title": pick(lang, f"พิจารณาตัด {len(dogs)} เมนู (Dogs)", f"Consider cutting {len(dogs)} menu items (Dogs)"),
                "description": pick(
                    lang,
                    "กำไรต่ำ+ขายน้อย: " + ", ".join([d["name"] for d in dogs[:3]]) + more,
                    "Low profit + low sales: " + ", ".join([d["name"] for d in dogs[:3]]) + more,
                ),
                "action": pick(lang, "ตัดออก/rebrand/ลดราคา เพื่อเคลียร์สต็อก", "Cut it, rebrand it, or discount it to clear stock"),
                "data": {"items": dogs[:5]},
            })
        stars = [i for i in me["items"] if i["quadrant"] == "Star"]
        if stars:
            actions.append({
                "priority": "low",
                "category": "menu",
                "icon": "⭐",
                "title": pick(lang, f"Highlight Stars: {stars[0]['name']}", f"Highlight your star: {stars[0]['name']}"),
                "description": pick(
                    lang,
                    "เมนูทำกำไรดี+ขายดี — ขึ้นมาให้เห็นในเมนูหลัก",
                    "High profit + high sales — feature it prominently on the main menu",
                ),
                "action": pick(lang, "ใส่ป้าย 'Recommended' / ดันใน social", "Add a 'Recommended' tag / push it on social media"),
                "data": stars[0],
            })
    except Exception as e:
        print(f"[playbook] menu eng failed: {e}")

    # ===== 6. Time-of-day actions =====
    if 5 <= now.hour < 10:
        actions.insert(0, {
            "priority": "high",
            "category": "ops",
            "icon": "🌅",
            "title": pick(lang, "เปิดร้านวันใหม่", "Opening for the day"),
            "description": pick(lang, "ทำความสะอาด · ตรวจสต็อก · เปิดเครื่อง POS", "Clean up · check stock · power on the POS"),
            "action": pick(lang, "Checklist เปิดร้าน", "Run the opening checklist"),
        })
    elif 10 <= now.hour < 14:
        actions.append({
            "priority": "low",
            "category": "ops",
            "icon": "☀️",
            "title": pick(lang, "ช่วงเที่ยง — เตรียมรับลูกค้า", "Midday — get ready for customers"),
            "description": pick(lang, "อยู่หน้าร้าน · พนักงานครบ?", "Stay on the floor · is staffing full?"),
            "action": pick(lang, "Watch peak hour", "Watch the peak hour"),
        })
    elif 17 <= now.hour < 21:
        actions.append({
            "priority": "low",
            "category": "ops",
            "icon": "🌆",
            "title": pick(lang, "ช่วงเย็น — peak time", "Evening — peak time"),
            "description": pick(lang, "เตรียมพร้อม + ของพอ", "Stay ready + keep stock topped up"),
            "action": pick(lang, "Stand-by", "Stand by"),
        })
    elif now.hour >= 21 or now.hour < 5:
        actions.append({
            "priority": "medium",
            "category": "ops",
            "icon": "🌙",
            "title": pick(lang, "ปิดยอดประจำวัน", "Closing out the day"),
            "description": pick(lang, "นับเงิน · ปิดกะ · ตรวจสต็อก", "Count the till · end shift · check stock"),
            "action": pick(lang, "ปิดร้าน", "Close up"),
        })

    # Sort by priority
    priority_order = {"high": 0, "medium": 1, "low": 2}
    actions.sort(key=lambda a: priority_order.get(a["priority"], 3))

    high_count = sum(1 for a in actions if a["priority"] == "high")
    return {
        "actions": actions,
        "summary": {
            "total": len(actions),
            "high_priority": high_count,
            "generated_at": now.isoformat(),
        },
    }
