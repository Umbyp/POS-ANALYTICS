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


def generate_playbook(store_id: str) -> dict:
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
                    "title": f"Win-back: {c['name']}",
                    "description": (
                        f"ไม่มา {c['days_silent']} วัน (ปกติทุก {c['expected_gap']} วัน) · "
                        f"LTV {c['lifetime_value']:,.0f}฿"
                    ),
                    "action": f"ส่ง LINE/SMS coupon ลด 30%",
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
                "title": f"สั่งด่วน: {p['name']}",
                "description": f"เหลือ {int(p['stock'])} ชิ้น · หมดใน {p['days_until_out']:.1f} วัน",
                "action": "ติดต่อ supplier วันนี้",
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
                "title": "ยอดวันนี้ต่ำกว่าเมื่อวาน",
                "description": f"ยอด {td['revenue']:,.0f}฿ (ต่ำกว่าเมื่อวาน {abs(td['vs_yesterday_pct']):.0f}%)",
                "action": "ลองโพสต์ LINE/Facebook โปรแฟลช ลด 15-20% ช่วงท้ายวัน",
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
                "title": f"สร้างเซต: {' + '.join(b['items'])}",
                "description": (
                    f"ขายร่วมกันแล้ว {b['co_occurrence']} ครั้ง · "
                    f"confidence {b['confidence']}% · lift {b['lift']}x"
                ),
                "action": "ตั้งเป็น Combo ใน POS — ลด 10-15% จาก sum",
                "data": b,
            })
    except Exception as e:
        print(f"[playbook] basket failed: {e}")

    # ===== 5. Menu Engineering: Dogs =====
    try:
        me = menu_engineering_service.get_menu_engineering(store_id, days=30)
        dogs = [i for i in me["items"] if i["quadrant"] == "Dog"]
        if len(dogs) >= 3:
            actions.append({
                "priority": "medium",
                "category": "menu",
                "icon": "🐕",
                "title": f"พิจารณาตัด {len(dogs)} เมนู (Dogs)",
                "description": (
                    f"กำไรต่ำ+ขายน้อย: " +
                    ", ".join([d["name"] for d in dogs[:3]]) +
                    ("..." if len(dogs) > 3 else "")
                ),
                "action": "ตัดออก/rebrand/ลดราคา เพื่อเคลียร์สต็อก",
                "data": {"items": dogs[:5]},
            })
        stars = [i for i in me["items"] if i["quadrant"] == "Star"]
        if stars:
            actions.append({
                "priority": "low",
                "category": "menu",
                "icon": "⭐",
                "title": f"Highlight Stars: {stars[0]['name']}",
                "description": f"เมนูทำกำไรดี+ขายดี — ขึ้นมาให้เห็นในเมนูหลัก",
                "action": "ใส่ป้าย 'Recommended' / ดันใน social",
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
            "title": "เปิดร้านวันใหม่",
            "description": "ทำความสะอาด · ตรวจสต็อก · เปิดเครื่อง POS",
            "action": "Checklist เปิดร้าน",
        })
    elif 10 <= now.hour < 14:
        actions.append({
            "priority": "low",
            "category": "ops",
            "icon": "☀️",
            "title": "ช่วงเที่ยง — เตรียมรับลูกค้า",
            "description": "อยู่หน้าร้าน · พนักงานครบ?",
            "action": "Watch peak hour",
        })
    elif 17 <= now.hour < 21:
        actions.append({
            "priority": "low",
            "category": "ops",
            "icon": "🌆",
            "title": "ช่วงเย็น — peak time",
            "description": "เตรียมพร้อม + ของพอ",
            "action": "Stand-by",
        })
    elif now.hour >= 21 or now.hour < 5:
        actions.append({
            "priority": "medium",
            "category": "ops",
            "icon": "🌙",
            "title": "ปิดยอดประจำวัน",
            "description": "นับเงิน · ปิดกะ · ตรวจสต็อก",
            "action": "ปิดร้าน",
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
