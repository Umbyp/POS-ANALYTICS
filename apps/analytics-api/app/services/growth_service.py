"""
Growth & Promotion services:
  - promotion_recommendation: AI ดู context แล้วเสนอโปรที่เหมาะสม
  - whatif_simulator: "ถ้าลด X% → ยอดเปลี่ยนเท่าไหร่?"
  - elasticity: คำนวณ price elasticity per product
  - cohort: retention rate per cohort
  - per_product_forecast: Prophet แยกตามสินค้า
"""
import pandas as pd
import datetime
from sqlalchemy import text
from .. import database
from . import data_service, basket_service, menu_engineering_service, segmentation_service
from ..i18n import pick


def _df(q: str, params: dict) -> pd.DataFrame:
    with database.engine.connect() as conn:
        return pd.read_sql(text(q), conn, params=params)


# ==================== Promotion Recommendation ====================

def recommend_promotions(store_id: str, lang: str = "th") -> list[dict]:
    """AI ดู data หลายมุม แล้วเสนอโปรที่ควรทำ พร้อมเหตุผล + คาดการณ์ผล"""
    suggestions = []
    now = datetime.datetime.now()

    # 1. Bundle จาก basket analysis
    try:
        bm = basket_service.get_basket_rules(store_id, days=60, min_support=5, min_confidence=0.5, lang=lang)
        for b in bm["bundle_suggestions"][:3]:
            suggestions.append({
                "type": "BUNDLE",
                "title": f"Combo: {' + '.join(b['items'])}",
                "reason": pick(lang, f"ขายร่วมกันบ่อย ({b['co_occurrence']} ครั้ง, lift {b['lift']}x)", f"Frequently bought together ({b['co_occurrence']} times, lift {b['lift']}x)"),
                "estimated_impact": pick(lang, "เพิ่มยอดบิลเฉลี่ย ~10-15%", "Boosts average ticket ~10-15%"),
                "config": {
                    "name": pick(lang, f"เซต {' + '.join(b['items'])[:30]}", f"Set {' + '.join(b['items'])[:30]}"),
                    "type": "FIXED_PRICE",
                    "scope": "PRODUCT",
                    "productIds": b["item_ids"],
                    "value": 0,  # ให้ user ปรับ
                },
                "data": b,
            })
    except Exception as e:
        print(f"[recommend] bundle failed: {e}")

    # 2. Happy Hour สำหรับช่วงเวลาที่ขายไม่ดี
    try:
        q = """
            SELECT
                EXTRACT(HOUR FROM "createdAt" AT TIME ZONE 'Asia/Bangkok')::int as hour,
                EXTRACT(DOW FROM "createdAt" AT TIME ZONE 'Asia/Bangkok')::int as dow,
                COUNT(*)::int as orders,
                SUM(total)::float as revenue
            FROM "Order"
            WHERE "storeId" = :store_id
              AND "createdAt" >= NOW() - INTERVAL '60 days'
              AND status NOT IN ('CANCELLED','REFUNDED','DRAFT')
              AND EXTRACT(HOUR FROM "createdAt" AT TIME ZONE 'Asia/Bangkok') BETWEEN 8 AND 22
            GROUP BY hour, dow
        """
        hd = _df(q, {"store_id": store_id})
        if not hd.empty:
            avg = hd["orders"].mean()
            slow = hd[hd["orders"] < avg * 0.5]
            if not slow.empty:
                # หาช่วงเวลาที่ slow ต่อเนื่อง
                slow_hour = slow.groupby("hour")["orders"].mean().idxmin()
                suggestions.append({
                    "type": "HAPPY_HOUR",
                    "title": pick(lang, f"Happy Hour ลด 20% เวลา {int(slow_hour):02d}:00-{int(slow_hour)+2:02d}:00", f"Happy Hour — 20% off {int(slow_hour):02d}:00-{int(slow_hour)+2:02d}:00"),
                    "reason": pick(
                        lang,
                        f"ช่วงนี้ขายต่ำกว่าค่าเฉลี่ย {(1 - slow[slow['hour']==slow_hour]['orders'].mean()/avg)*100:.0f}%",
                        f"This slot sells {(1 - slow[slow['hour']==slow_hour]['orders'].mean()/avg)*100:.0f}% below average",
                    ),
                    "estimated_impact": pick(lang, "ดึงยอดช่วงเงียบ +30-50%", "Lifts the quiet slot by +30-50%"),
                    "config": {
                        "name": f"Happy Hour {int(slow_hour):02d}:00-{int(slow_hour)+2:02d}:00",
                        "type": "PERCENT_OFF",
                        "scope": "ALL_ORDER",
                        "value": 20,
                        "hourStart": int(slow_hour),
                        "hourEnd": int(slow_hour) + 2,
                    },
                })
    except Exception as e:
        print(f"[recommend] happy hour failed: {e}")

    # 3. Win-back สำหรับ At Risk
    try:
        rfm = segmentation_service.get_rfm_segments(store_id, lang=lang)
        at_risk = next((s for s in rfm["segments"] if s["segment"] == "At Risk"), None)
        if at_risk and at_risk["count"] >= 5:
            suggestions.append({
                "type": "WINBACK",
                "title": pick(lang, f"Win-back Coupon — ส่งให้ลูกค้า At Risk {at_risk['count']} คน", f"Win-back coupon — send to {at_risk['count']} At-Risk customers"),
                "reason": pick(lang, "ลูกค้ากำลังจะหายไป (ไม่มา 90-180 วัน)", "These customers are about to churn (haven't visited in 90-180 days)"),
                "estimated_impact": pick(lang, f"กลับมา ~10-15% = {int(at_risk['count'] * 0.12)} คน", f"~10-15% expected to return = {int(at_risk['count'] * 0.12)} customers"),
                "config": {
                    "name": "Win-back Member",
                    "type": "PERCENT_OFF",
                    "scope": "ALL_ORDER",
                    "value": 30,
                    "memberOnly": True,
                    "code": "COMEBACK",
                    "usageLimit": at_risk["count"],
                },
            })
    except Exception as e:
        print(f"[recommend] winback failed: {e}")

    # 4. Plowhorse — เมนูที่ขายดีแต่กำไรน้อย → ปรับราคา/ลดต้นทุน
    try:
        me = menu_engineering_service.get_menu_engineering(store_id, days=30, lang=lang)
        plowhorses = [i for i in me["items"] if i["quadrant"] == "Plowhorse"]
        if plowhorses:
            top = plowhorses[0]
            suggestions.append({
                "type": "PRICE_UP",
                "title": pick(lang, f"ขึ้นราคา {top['name']} 5-10฿", f"Raise the price of {top['name']} by 5-10฿"),
                "reason": pick(
                    lang,
                    f"ขายดี ({top['qty_sold']} ชิ้น/30วัน) แต่กำไรต่อชิ้นต่ำ ({top['profit_per_unit']:.0f}฿)",
                    f"Sells well ({top['qty_sold']} units/30d) but per-unit profit is low ({top['profit_per_unit']:.0f}฿)",
                ),
                "estimated_impact": pick(lang, f"+{top['qty_sold'] * 7:.0f}฿/เดือน ถ้าขายเท่าเดิม", f"+{top['qty_sold'] * 7:.0f}฿/month if volume stays the same"),
                "config": {
                    "productId": top["id"],
                    "currentPrice": top.get("avg_price"),
                    "suggestedIncrease": 7,
                },
            })
    except Exception as e:
        print(f"[recommend] plowhorse failed: {e}")

    # 5. Push Puzzles — กำไรดีแต่ขายน้อย
    try:
        me = menu_engineering_service.get_menu_engineering(store_id, days=30, lang=lang)
        puzzles = [i for i in me["items"] if i["quadrant"] == "Puzzle"]
        if puzzles:
            top = puzzles[0]
            suggestions.append({
                "type": "PROMOTE",
                "title": pick(lang, f"Push '{top['name']}' — กำไรดี แต่คนยังไม่รู้จัก", f"Push '{top['name']}' — great margin, but nobody knows it yet"),
                "reason": pick(
                    lang,
                    f"กำไร/ชิ้น {top['profit_per_unit']:.0f}฿ (สูง) แต่ขายแค่ {top['qty_sold']} ชิ้น/30วัน",
                    f"Profit/unit {top['profit_per_unit']:.0f}฿ (high) but only {top['qty_sold']} units sold/30d",
                ),
                "estimated_impact": pick(lang, f"ถ้าขายเพิ่ม 2x = +{top['profit']:.0f}฿/เดือน", f"Selling 2x more = +{top['profit']:.0f}฿/month"),
                "config": {
                    "name": pick(lang, f"แนะนำเดือนนี้ — {top['name']}", f"Featured this month — {top['name']}"),
                    "type": "PERCENT_OFF",
                    "scope": "PRODUCT",
                    "productIds": [top["id"]],
                    "value": 10,
                },
            })
    except Exception as e:
        print(f"[recommend] puzzle failed: {e}")

    return suggestions


# ==================== What-If Simulator ====================

def whatif_price_change(store_id: str, product_id: str, new_price: float, lang: str = "th") -> dict:
    """
    เทียบ scenario เปลี่ยนราคา product
    ใช้ price elasticity (simple): ถ้ามี historical price changes
    หรือใช้ default elasticity = -1.2 (ปกติของอาหาร/เครื่องดื่ม)
    """
    # ดึง current product + sales
    q = """
        SELECT
            p.id, p.name, p."sellingPrice"::float as current_price, p."costPrice"::float as cost,
            AVG(oi.quantity::float) as avg_qty_per_order,
            SUM(oi.quantity)::int as total_qty_60d,
            COUNT(DISTINCT o.id)::int as orders_60d
        FROM "Product" p
        LEFT JOIN "OrderItem" oi ON oi."productId" = p.id
        LEFT JOIN "Order" o ON o.id = oi."orderId"
            AND o."createdAt" >= NOW() - INTERVAL '60 days'
            AND o.status NOT IN ('CANCELLED','REFUNDED','DRAFT')
        WHERE p.id = :pid AND p."storeId" = :sid
        GROUP BY p.id, p.name, p."sellingPrice", p."costPrice"
    """
    df = _df(q, {"pid": product_id, "sid": store_id})
    if df.empty:
        return {"error": "Product not found"}

    row = df.iloc[0]
    current = float(row["current_price"])
    cost = float(row["cost"])
    qty = int(row["total_qty_60d"] or 0)

    # Calculate elasticity from same-product price history (if available)
    # For now use default -1.2 (food/drink typical)
    elasticity = -1.2

    pct_change = (new_price - current) / current if current > 0 else 0
    qty_change_pct = elasticity * pct_change
    new_qty = qty * (1 + qty_change_pct)

    current_revenue = qty * current
    current_profit = qty * (current - cost)
    new_revenue = new_qty * new_price
    new_profit = new_qty * (new_price - cost)

    return {
        "product": {
            "id": row["id"],
            "name": row["name"],
            "current_price": current,
            "cost": cost,
        },
        "scenario": {
            "new_price": new_price,
            "price_change_pct": pct_change * 100,
            "elasticity_used": elasticity,
        },
        "projections_60days": {
            "current_qty": qty,
            "projected_qty": round(new_qty),
            "qty_change_pct": qty_change_pct * 100,
            "current_revenue": current_revenue,
            "projected_revenue": new_revenue,
            "revenue_delta": new_revenue - current_revenue,
            "current_profit": current_profit,
            "projected_profit": new_profit,
            "profit_delta": new_profit - current_profit,
        },
        "recommendation": _whatif_verdict(new_profit - current_profit, new_revenue - current_revenue, lang=lang),
    }


def _whatif_verdict(profit_delta: float, revenue_delta: float, lang: str = "th") -> str:
    if profit_delta > 0 and revenue_delta > 0:
        return pick(lang, "✅ ดี — กำไรและยอดขายเพิ่มทั้งคู่", "✅ Good — both profit and revenue increase")
    if profit_delta > 0 and revenue_delta < 0:
        return pick(lang, "🤔 ตัดสินใจ — กำไรเพิ่มแต่ยอดขายลด (มี trade-off)", "🤔 Judgment call — profit rises but revenue falls (there's a trade-off)")
    if profit_delta < 0 and revenue_delta > 0:
        return pick(lang, "⚠️ ระวัง — ยอดขายเพิ่มแต่กำไรลด (ขายเยอะแต่ไม่ได้กำไร)", "⚠️ Caution — revenue rises but profit falls (more sales, less profit)")
    return pick(lang, "❌ ไม่แนะนำ — ลดทั้งกำไรและยอดขาย", "❌ Not recommended — both profit and revenue drop")


def whatif_discount(store_id: str, discount_pct: float, days: int = 30, lang: str = "th") -> dict:
    """ถ้าให้ส่วนลด X% ทั่วบิล คาดผลเป็นอย่างไร"""
    # ดึง avg ticket + order count 30 วัน
    q = """
        SELECT
            COUNT(*)::int as orders,
            SUM(total)::float as revenue,
            AVG(total)::float as avg_ticket
        FROM "Order"
        WHERE "storeId" = :sid
          AND "createdAt" >= NOW() - (:days || ' days')::interval
          AND status NOT IN ('CANCELLED','REFUNDED','DRAFT')
    """
    df = _df(q, {"sid": store_id, "days": days})
    if df.empty or df.iloc[0]["orders"] == 0:
        return {"error": "No data"}

    row = df.iloc[0]
    orders = int(row["orders"])
    revenue = float(row["revenue"])
    avg = float(row["avg_ticket"])

    # Assume elasticity for orders: discount drives ~0.3x as much volume
    # i.e. 10% discount → 12% more orders
    volume_lift = (discount_pct / 100) * 1.5
    new_orders = orders * (1 + volume_lift)
    new_avg = avg * (1 - discount_pct / 100)
    new_revenue = new_orders * new_avg

    return {
        "scenario": {
            "discount_pct": discount_pct,
            "period_days": days,
        },
        "current": {"orders": orders, "revenue": revenue, "avg_ticket": avg},
        "projected": {
            "orders": round(new_orders),
            "revenue": new_revenue,
            "avg_ticket": new_avg,
            "revenue_delta": new_revenue - revenue,
            "revenue_delta_pct": (new_revenue - revenue) / revenue * 100,
        },
        "recommendation": _whatif_verdict(new_revenue - revenue, new_revenue - revenue, lang=lang),
    }


# ==================== Cohort Retention ====================

def get_cohort_retention(store_id: str, weeks: int = 12) -> dict:
    """
    ดู cohort retention — ลูกค้าที่มาสัปดาห์ X กลับมาในสัปดาห์ถัดไปกี่%
    """
    q = """
        WITH customer_weeks AS (
            SELECT
                o."customerId" as cid,
                DATE_TRUNC('week', MIN(o."createdAt")) as cohort_week
            FROM "Order" o
            WHERE o."storeId" = :sid
              AND o."customerId" IS NOT NULL
              AND o."createdAt" >= NOW() - (:weeks || ' weeks')::interval
              AND o.status NOT IN ('CANCELLED','REFUNDED','DRAFT')
            GROUP BY o."customerId"
        ),
        order_weeks AS (
            SELECT
                o."customerId" as cid,
                DATE_TRUNC('week', o."createdAt") as week
            FROM "Order" o
            WHERE o."storeId" = :sid
              AND o."customerId" IS NOT NULL
              AND o.status NOT IN ('CANCELLED','REFUNDED','DRAFT')
              AND o."createdAt" >= NOW() - (:weeks || ' weeks')::interval
            GROUP BY o."customerId", week
        )
        SELECT
            cw.cohort_week,
            ow.week,
            EXTRACT(WEEK FROM ow.week)::int - EXTRACT(WEEK FROM cw.cohort_week)::int as week_offset,
            COUNT(DISTINCT cw.cid)::int as customers
        FROM customer_weeks cw
        LEFT JOIN order_weeks ow ON ow.cid = cw.cid AND ow.week >= cw.cohort_week
        GROUP BY cw.cohort_week, ow.week
        ORDER BY cw.cohort_week, ow.week
    """
    df = _df(q, {"sid": store_id, "weeks": weeks})
    if df.empty:
        return {"cohorts": [], "summary": {}}

    cohort_sizes = df[df["week_offset"] == 0].set_index("cohort_week")["customers"].to_dict()

    cohorts = []
    for cohort_week, size in cohort_sizes.items():
        if size == 0:
            continue
        weeks_data = df[df["cohort_week"] == cohort_week]
        retention = []
        for offset in range(0, weeks):
            row = weeks_data[weeks_data["week_offset"] == offset]
            count = int(row["customers"].iloc[0]) if not row.empty else 0
            retention.append({
                "week_offset": offset,
                "customers": count,
                "retention_pct": round(count / size * 100, 1),
            })
        cohorts.append({
            "cohort_week": str(cohort_week)[:10],
            "size": size,
            "retention": retention,
        })

    return {
        "cohorts": cohorts[-8:],  # last 8 cohorts only
        "summary": {
            "total_cohorts": len(cohorts),
        },
    }


# ==================== Per-product Forecast ====================

def forecast_product_demand(store_id: str, product_id: str, days_ahead: int = 14) -> dict:
    """พยากรณ์ demand ของสินค้าตัวเดียวด้วย Prophet (ถ้ามี data ≥ 14 วัน)"""
    df = data_service.get_product_daily_sales(store_id, product_id, days=90)
    if df.empty or len(df) < 14:
        avg = float(df["qty"].mean()) if not df.empty else 0
        return {
            "method": "fallback_avg",
            "avg_daily": avg,
            "total_predicted": avg * days_ahead,
            "forecast": [
                {"date": (datetime.date.today() + datetime.timedelta(days=i+1)).isoformat(),
                 "predicted_qty": round(avg)}
                for i in range(days_ahead)
            ],
        }

    try:
        from prophet import Prophet
        prophet_df = df.rename(columns={"date": "ds", "qty": "y"})
        m = Prophet(daily_seasonality=False, weekly_seasonality=True, yearly_seasonality=False)
        m.fit(prophet_df)
        future = m.make_future_dataframe(periods=days_ahead)
        forecast = m.predict(future)
        future_only = forecast.tail(days_ahead)
        return {
            "method": "prophet",
            "forecast": [
                {
                    "date": str(r["ds"])[:10],
                    "predicted_qty": max(0, round(r["yhat"])),
                    "lower": max(0, round(r["yhat_lower"])),
                    "upper": max(0, round(r["yhat_upper"])),
                }
                for _, r in future_only.iterrows()
            ],
            "total_predicted": float(future_only["yhat"].clip(lower=0).sum()),
        }
    except Exception as e:
        avg = float(df["qty"].mean())
        return {
            "method": "fallback_avg",
            "error": str(e),
            "avg_daily": avg,
            "total_predicted": avg * days_ahead,
        }


# ==================== Goal Coaching ====================

def goal_coach(store_id: str, lang: str = "th") -> dict:
    """ดูเป้ารายเดือน vs actual → แนะนำว่าต้องทำอะไรเพื่อถึงเป้า"""
    now = datetime.datetime.now()
    day = now.day
    days_in_month = (datetime.date(now.year + (now.month // 12), (now.month % 12) + 1, 1) - datetime.timedelta(days=1)).day
    days_left = days_in_month - day

    # Get store target
    q_store = "SELECT \"monthlyTarget\"::float as target FROM \"Store\" WHERE id = :sid"
    sdf = _df(q_store, {"sid": store_id})
    if sdf.empty or sdf.iloc[0]["target"] == 0:
        return {"has_target": False, "message": pick(lang, "ยังไม่ได้ตั้งเป้ารายเดือน", "No monthly target set yet")}

    target = float(sdf.iloc[0]["target"])

    # Get MTD revenue
    q_mtd = """
        SELECT
            COALESCE(SUM(total), 0)::float as revenue,
            COUNT(*)::int as orders,
            AVG(total)::float as avg_ticket
        FROM "Order"
        WHERE "storeId" = :sid
          AND "createdAt" >= DATE_TRUNC('month', NOW())
          AND status NOT IN ('CANCELLED','REFUNDED','DRAFT')
    """
    mdf = _df(q_mtd, {"sid": store_id})
    row = mdf.iloc[0]
    actual = float(row["revenue"])
    orders = int(row["orders"])
    avg = float(row["avg_ticket"]) if row["avg_ticket"] else 0

    progress_pct = actual / target * 100
    needed = target - actual
    daily_run_rate = actual / day if day > 0 else 0
    needed_daily = needed / days_left if days_left > 0 else 0
    projected = daily_run_rate * days_in_month

    on_track = projected >= target * 0.95
    recommendations = []

    if needed_daily > daily_run_rate * 1.5:
        # Need significant push
        recommendations.append({
            "action": pick(lang, f"เพิ่ม avg/บิล จาก {avg:.0f} → {avg*1.15:.0f}฿", f"Raise avg/order from {avg:.0f} → {avg*1.15:.0f}฿"),
            "method": pick(lang, "Upsell + Combo + Cross-sell ใน POS", "Upsell + combo + cross-sell in the POS"),
        })
        recommendations.append({
            "action": pick(lang, f"เพิ่มออเดอร์/วัน จาก {orders/day:.0f} → {orders/day*1.2:.0f}", f"Raise orders/day from {orders/day:.0f} → {orders/day*1.2:.0f}"),
            "method": pick(lang, "โปร Happy Hour + LINE notify ลูกค้า", "Happy Hour promo + LINE notify to customers"),
        })
    elif needed_daily > daily_run_rate:
        recommendations.append({
            "action": pick(lang, "รักษาระดับและกระตุ้นเพิ่มเล็กน้อย", "Stay the course with a small extra push"),
            "method": pick(lang, "Bundle suggestions + Loyalty rewards", "Bundle suggestions + loyalty rewards"),
        })
    else:
        recommendations.append({
            "action": pick(lang, "✅ on track — รักษาระดับนี้ต่อ", "✅ On track — keep this pace up"),
            "method": pick(lang, "เน้น customer retention", "Focus on customer retention"),
        })

    return {
        "has_target": True,
        "target": target,
        "actual": actual,
        "progress_pct": progress_pct,
        "days_passed": day,
        "days_left": days_left,
        "days_in_month": days_in_month,
        "needed": needed,
        "daily_run_rate": daily_run_rate,
        "needed_daily": needed_daily,
        "projected_total": projected,
        "on_track": on_track,
        "recommendations": recommendations,
    }
