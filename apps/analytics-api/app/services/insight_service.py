"""
Insight Engine v2 — วิเคราะห์ข้อมูลอัตโนมัติ 12+ detectors
ครอบคลุม: Trend, Anomaly, Inventory, Profit, AOV, Day-of-Week,
           Dead Stock, Demand Spike, Product Opportunity, Consecutive Decline,
           Peak Hour, Forecast
"""
import json
import pandas as pd
import numpy as np
from datetime import datetime
from sqlalchemy import text

from . import data_service, forecast_service
from .. import database


def _save_insight(store_id: str, insight: dict):
    q = text("""
        INSERT INTO ai_insights (store_id, type, severity, title, description, metric, metadata)
        VALUES (:store_id, :type, :severity, :title, :description, :metric, :metadata)
    """)
    with database.engine.begin() as conn:
        conn.execute(q, {
            "store_id": store_id,
            "type": insight["type"],
            "severity": insight.get("severity", "INFO"),
            "title": insight["title"],
            "description": insight["description"],
            "metric": insight.get("metric"),
            "metadata": json.dumps(insight.get("metadata")) if insight.get("metadata") else None,
        })


# ─────────────────────────────────────────────────────────
# 1. TREND — ยอดขาย 2 สัปดาห์
# ─────────────────────────────────────────────────────────
def detect_trend_insights(store_id: str) -> list[dict]:
    insights = []
    df = data_service.get_daily_sales(store_id, days=28)
    if len(df) < 14:
        return insights

    df["date"] = pd.to_datetime(df["date"])
    mid = df["date"].max() - pd.Timedelta(days=14)
    recent = df[df["date"] > mid]["revenue"].sum()
    older  = df[df["date"] <= mid]["revenue"].sum()

    if older > 0:
        change = (recent - older) / older * 100
        if change <= -15:
            insights.append({
                "type": "TREND", "severity": "WARNING",
                "title": f"ยอดขายลดลง {abs(change):.0f}% ใน 2 สัปดาห์",
                "description": (
                    f"ยอดขาย 2 สัปดาห์ล่าสุด {recent:,.0f} บาท ลดลง {abs(change):.0f}% "
                    f"จากช่วงก่อนหน้า ({older:,.0f} บาท) "
                    "ควรตรวจสอบสาเหตุและวางแผนกระตุ้นยอดขาย"
                ),
                "metric": round(change, 1),
                "metadata": {"recent": round(recent, 0), "older": round(older, 0)},
            })
        elif change >= 15:
            insights.append({
                "type": "TREND", "severity": "INFO",
                "title": f"ยอดขายเติบโต {change:.0f}% ในรอบ 2 สัปดาห์",
                "description": (
                    f"ยอดขาย 2 สัปดาห์ล่าสุด {recent:,.0f} บาท เพิ่มขึ้น {change:.0f}% "
                    "เทรนด์เป็นบวก — วิเคราะห์ว่าอะไรทำให้ดีขึ้นเพื่อทำซ้ำ"
                ),
                "metric": round(change, 1),
            })
    return insights


# ─────────────────────────────────────────────────────────
# 2. ANOMALY — z-score รายวัน
# ─────────────────────────────────────────────────────────
def detect_anomaly_insights(store_id: str) -> list[dict]:
    insights = []
    df = data_service.get_daily_sales(store_id, days=30)
    if len(df) < 10:
        return insights

    mean = df["revenue"].mean()
    std  = df["revenue"].std()
    if std == 0:
        return insights

    last = df.iloc[-1]
    z = (last["revenue"] - mean) / std
    date_str = str(last["date"])[:10]

    if z <= -2:
        insights.append({
            "type": "ANOMALY", "severity": "CRITICAL",
            "title": "ยอดขายวันล่าสุดต่ำผิดปกติ",
            "description": (
                f"วันที่ {date_str} มียอดขาย {last['revenue']:,.0f} บาท "
                f"ต่ำกว่าค่าเฉลี่ย {mean:,.0f} บาท อย่างมีนัยสำคัญ (z={z:.1f}) "
                "ตรวจสอบว่าร้านปิดครึ่งวัน ระบบล่ม หรือมีเหตุพิเศษ"
            ),
            "metric": round(float(z), 2),
        })
    elif z >= 2:
        insights.append({
            "type": "ANOMALY", "severity": "INFO",
            "title": "ยอดขายวันล่าสุดสูงผิดปกติ — โอกาสเรียนรู้",
            "description": (
                f"วันที่ {date_str} มียอดขาย {last['revenue']:,.0f} บาท "
                f"สูงกว่าค่าเฉลี่ย {mean:,.0f} บาท มาก (z={z:.1f}) "
                "วิเคราะห์ว่าอะไรทำให้ดี — event พิเศษ? โปรโมชัน? เพื่อทำซ้ำ"
            ),
            "metric": round(float(z), 2),
        })
    return insights


# ─────────────────────────────────────────────────────────
# 3. INVENTORY — ใกล้หมด + วิกฤต
# ─────────────────────────────────────────────────────────
def detect_inventory_insights(store_id: str) -> list[dict]:
    insights = []
    df = data_service.get_inventory_status(store_id)
    if df.empty:
        return insights

    urgent = df[(df["days_until_out"].notna()) & (df["days_until_out"] <= 7)]
    for _, row in urgent.iterrows():
        days = row["days_until_out"]
        sev = "CRITICAL" if days <= 2 else "WARNING"
        action = "สั่งซื้อทันที" if days <= 2 else "วางแผนสั่งซื้อสัปดาห์นี้"
        insights.append({
            "type": "INVENTORY", "severity": sev,
            "title": f"{row['name']} ใกล้หมด ({days:.0f} วัน)",
            "description": (
                f"เหลือ {int(row['stock'])} ชิ้น ขายเฉลี่ย {row['avg_daily_sales']:.1f} ชิ้น/วัน "
                f"จะหมดใน ~{days:.0f} วัน — {action}"
            ),
            "metric": float(days),
            "metadata": {"stock": int(row["stock"]), "avg_daily": round(float(row["avg_daily_sales"]), 1)},
        })
    return insights


# ─────────────────────────────────────────────────────────
# 4. DEAD STOCK — สินค้าค้างสต็อก ไม่มียอดขาย
# ─────────────────────────────────────────────────────────
def detect_dead_stock(store_id: str) -> list[dict]:
    insights = []
    try:
        inv = data_service.get_inventory_status(store_id)
        top = data_service.get_top_products(store_id, days=30, limit=500)
        sold_ids = set(top["id"].tolist()) if not top.empty else set()

        dead = inv[(~inv["id"].isin(sold_ids)) & (inv["stock"] > 5)]
        if not dead.empty:
            names = ", ".join(dead["name"].tolist()[:3])
            extra = f" และอีก {len(dead)-3} รายการ" if len(dead) > 3 else ""
            insights.append({
                "type": "INVENTORY", "severity": "WARNING",
                "title": f"พบสินค้าค้างสต็อก {len(dead)} รายการ",
                "description": (
                    f"สินค้า {names}{extra} มีสต็อกแต่ไม่มียอดขายใน 30 วัน "
                    "พิจารณาลดราคาระบาย จัด Bundle หรือเลิกสินค้า เพื่อลดทุนจม"
                ),
                "metric": float(len(dead)),
                "metadata": {"products": dead[["name", "stock"]].to_dict(orient="records")[:5]},
            })
    except Exception:
        pass
    return insights


# ─────────────────────────────────────────────────────────
# 5. PROFIT HEALTH — margin, สินค้ายอดดีแต่กำไรน้อย
# ─────────────────────────────────────────────────────────
def detect_profit_health(store_id: str) -> list[dict]:
    insights = []
    try:
        top = data_service.get_top_products(store_id, days=30, limit=20)
        if top.empty or "profit" not in top.columns:
            return insights

        top = top.copy()
        top["margin_pct"] = top.apply(
            lambda r: (r["profit"] / r["revenue"] * 100) if r["revenue"] > 0 else 0, axis=1
        )

        # สินค้าขายดีแต่ margin ต่ำมาก (< 10%)
        low_margin = top[(top["revenue"] > top["revenue"].quantile(0.5)) & (top["margin_pct"] < 10)]
        if not low_margin.empty:
            worst = low_margin.iloc[0]
            insights.append({
                "type": "PROFIT", "severity": "WARNING",
                "title": f"'{worst['name']}' ขายดีแต่กำไรต่ำมาก ({worst['margin_pct']:.0f}%)",
                "description": (
                    f"สินค้า '{worst['name']}' มียอดขาย {worst['revenue']:,.0f} บาท "
                    f"แต่กำไรเพียง {worst['profit']:,.0f} บาท (margin {worst['margin_pct']:.0f}%) "
                    "ควรทบทวนราคาขาย หรือลดต้นทุน"
                ),
                "metric": round(float(worst["margin_pct"]), 1),
                "metadata": {"product": worst["name"], "revenue": round(float(worst["revenue"]), 0)},
            })

        # Overall margin drop
        total_rev = top["revenue"].sum()
        total_profit = top["profit"].sum()
        if total_rev > 0:
            overall_margin = total_profit / total_rev * 100
            if overall_margin < 20:
                insights.append({
                    "type": "PROFIT", "severity": "WARNING",
                    "title": f"Gross Margin รวมต่ำกว่าเป้า ({overall_margin:.0f}%)",
                    "description": (
                        f"Gross margin รวม 30 วัน อยู่ที่ {overall_margin:.0f}% "
                        "ซึ่งต่ำกว่าเกณฑ์ปกติ (20%+) "
                        "ตรวจสอบต้นทุนสินค้า หรือพิจารณาปรับราคาขาย"
                    ),
                    "metric": round(overall_margin, 1),
                })
    except Exception:
        pass
    return insights


# ─────────────────────────────────────────────────────────
# 6. AOV TREND — แนวโน้มค่าเฉลี่ยต่อบิล
# ─────────────────────────────────────────────────────────
def detect_aov_trend(store_id: str) -> list[dict]:
    insights = []
    try:
        df = data_service.get_daily_sales(store_id, days=28)
        if len(df) < 14:
            return insights
        df["date"] = pd.to_datetime(df["date"])
        df = df[df["orders"] > 0].copy()
        df["aov"] = df["revenue"] / df["orders"]

        mid = df["date"].max() - pd.Timedelta(days=14)
        recent_aov = df[df["date"] > mid]["aov"].mean()
        older_aov  = df[df["date"] <= mid]["aov"].mean()

        if older_aov > 0:
            change = (recent_aov - older_aov) / older_aov * 100
            if change <= -10:
                insights.append({
                    "type": "TREND", "severity": "WARNING",
                    "title": f"ค่าเฉลี่ยต่อบิล (AOV) ลดลง {abs(change):.0f}%",
                    "description": (
                        f"AOV 2 สัปดาห์ล่าสุดอยู่ที่ {recent_aov:,.0f} บาท/บิล "
                        f"ลดลงจาก {older_aov:,.0f} บาท ({abs(change):.0f}%) "
                        "ลูกค้าซื้อน้อยลงต่อครั้ง — ลอง Upsell หรือ Bundle สินค้า"
                    ),
                    "metric": round(change, 1),
                })
            elif change >= 10:
                insights.append({
                    "type": "TREND", "severity": "INFO",
                    "title": f"ค่าเฉลี่ยต่อบิล (AOV) เพิ่มขึ้น {change:.0f}%",
                    "description": (
                        f"AOV ล่าสุด {recent_aov:,.0f} บาท/บิล เพิ่มขึ้น {change:.0f}% "
                        "ลูกค้าซื้อมากขึ้นต่อครั้ง — ดูว่า strategy ไหนได้ผลแล้วทำต่อ"
                    ),
                    "metric": round(change, 1),
                })
    except Exception:
        pass
    return insights


# ─────────────────────────────────────────────────────────
# 7. DAY-OF-WEEK PATTERN — วันขายดี/แย่
# ─────────────────────────────────────────────────────────
def detect_dayofweek_insights(store_id: str) -> list[dict]:
    insights = []
    try:
        heatmap = data_service.get_hourly_heatmap(store_id, days=30)
        if heatmap.empty:
            return insights

        DOW_TH = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"]
        by_dow = heatmap.groupby("dow")["revenue"].sum().reset_index()
        if len(by_dow) < 3:
            return insights

        best = by_dow.loc[by_dow["revenue"].idxmax()]
        worst = by_dow.loc[by_dow["revenue"].idxmin()]
        avg = by_dow["revenue"].mean()

        best_name  = DOW_TH[int(best["dow"])]
        worst_name = DOW_TH[int(worst["dow"])]
        best_pct   = (best["revenue"] - avg) / avg * 100
        worst_pct  = (worst["revenue"] - avg) / avg * 100

        insights.append({
            "type": "TREND", "severity": "INFO",
            "title": f"วัน{best_name} คือวันขายดีที่สุด (+{best_pct:.0f}% vs เฉลี่ย)",
            "description": (
                f"วัน{best_name} มียอดขายสูงสุด {best['revenue']:,.0f} บาท "
                f"สูงกว่าเฉลี่ย {best_pct:.0f}% "
                f"ส่วนวัน{worst_name} ขายน้อยสุด ({worst_pct:.0f}% vs เฉลี่ย) "
                "ควรจัดโปรโมชันหรือกิจกรรมในวันที่ยอดต่ำ"
            ),
            "metric": round(float(best_pct), 1),
            "metadata": {"best_day": best_name, "worst_day": worst_name},
        })
    except Exception:
        pass
    return insights


# ─────────────────────────────────────────────────────────
# 8. CONSECUTIVE DECLINE — ยอดลงติดต่อกัน N วัน
# ─────────────────────────────────────────────────────────
def detect_consecutive_decline(store_id: str) -> list[dict]:
    insights = []
    try:
        df = data_service.get_daily_sales(store_id, days=14)
        if len(df) < 4:
            return insights
        df = df.sort_values("date").tail(7)
        streak = 0
        for i in range(len(df) - 1, 0, -1):
            if df.iloc[i]["revenue"] < df.iloc[i - 1]["revenue"]:
                streak += 1
            else:
                break

        if streak >= 3:
            start_rev = df.iloc[-streak - 1]["revenue"] if streak < len(df) else df.iloc[0]["revenue"]
            end_rev   = df.iloc[-1]["revenue"]
            drop      = (end_rev - start_rev) / start_rev * 100 if start_rev > 0 else 0
            insights.append({
                "type": "ANOMALY", "severity": "CRITICAL" if streak >= 5 else "WARNING",
                "title": f"ยอดขายลดลงติดต่อกัน {streak} วัน",
                "description": (
                    f"ยอดขายลดลงต่อเนื่อง {streak} วันติด "
                    f"จาก {start_rev:,.0f} เหลือ {end_rev:,.0f} บาท ({drop:.0f}%) "
                    "ต้องหาสาเหตุและแก้ไขเร่งด่วน: สต็อก? คู่แข่ง? บริการ?"
                ),
                "metric": float(streak),
            })
    except Exception:
        pass
    return insights


# ─────────────────────────────────────────────────────────
# 9. PRODUCT OPPORTUNITY — margin ดีแต่ขายน้อย
# ─────────────────────────────────────────────────────────
def detect_product_opportunities(store_id: str) -> list[dict]:
    insights = []
    try:
        top = data_service.get_top_products(store_id, days=30, limit=50)
        if top.empty or len(top) < 5:
            return insights

        top = top.copy()
        top["margin_pct"] = top.apply(
            lambda r: (r["profit"] / r["revenue"] * 100) if r["revenue"] > 0 else 0, axis=1
        )
        rev_median = top["revenue"].median()

        # margin สูง (>40%) แต่ยอดขายต่ำกว่า median
        opps = top[(top["margin_pct"] > 40) & (top["revenue"] < rev_median)]
        if not opps.empty:
            best = opps.sort_values("margin_pct", ascending=False).iloc[0]
            insights.append({
                "type": "RECOMMENDATION", "severity": "INFO",
                "title": f"โอกาสทอง: '{best['name']}' margin {best['margin_pct']:.0f}% แต่ขายน้อย",
                "description": (
                    f"'{best['name']}' มี gross margin {best['margin_pct']:.0f}% "
                    f"แต่ยอดขายเพียง {best['revenue']:,.0f} บาท (ต่ำกว่าสินค้าอื่น) "
                    "ลอง Feature ในเมนู จัดโปรโมชัน หรือ แนะนำแก่ลูกค้าให้มากขึ้น"
                ),
                "metric": round(float(best["margin_pct"]), 1),
                "metadata": {"product": best["name"], "margin": round(float(best["margin_pct"]), 1)},
            })
    except Exception:
        pass
    return insights


# ─────────────────────────────────────────────────────────
# 10. DEMAND SPIKE — สินค้าขายเร็วกว่าปกติ 2x
# ─────────────────────────────────────────────────────────
def detect_demand_spikes(store_id: str) -> list[dict]:
    insights = []
    try:
        recent = data_service.get_top_products(store_id, days=7,  limit=20)
        older  = data_service.get_top_products(store_id, days=30, limit=20)
        if recent.empty or older.empty:
            return insights

        merged = recent.merge(older, on=["id", "name"], suffixes=("_7d", "_30d"))
        merged["daily_recent"] = merged["qty_sold_7d"] / 7
        merged["daily_older"]  = merged["qty_sold_30d"] / 30

        spikes = merged[
            (merged["daily_older"] > 0) &
            (merged["daily_recent"] / merged["daily_older"] >= 2.0) &
            (merged["qty_sold_7d"] >= 5)
        ]
        for _, row in spikes.head(2).iterrows():
            ratio = row["daily_recent"] / row["daily_older"]
            insights.append({
                "type": "INVENTORY", "severity": "WARNING",
                "title": f"'{row['name']}' ขายเร็วขึ้น {ratio:.0f}x — เช็คสต็อก",
                "description": (
                    f"7 วันล่าสุดขาย {row['qty_sold_7d']} ชิ้น "
                    f"(เฉลี่ย {row['daily_recent']:.1f}/วัน) "
                    f"เร็วกว่าปกติ {ratio:.1f} เท่า "
                    "ตรวจสอบว่าสต็อกเพียงพอรองรับ demand ที่เพิ่มขึ้น"
                ),
                "metric": round(float(ratio), 1),
            })
    except Exception:
        pass
    return insights


# ─────────────────────────────────────────────────────────
# 11. PEAK HOUR
# ─────────────────────────────────────────────────────────
def detect_peak_hour_insights(store_id: str) -> list[dict]:
    insights = []
    try:
        peak = forecast_service.predict_peak_hours(store_id)
        if peak.get("peak_hours"):
            top3 = peak["peak_hours"][:3]
            hours_str = ", ".join(f"{h['hour']:02d}:00" for h in top3)
            top = top3[0]
            insights.append({
                "type": "TREND", "severity": "INFO",
                "title": f"Peak hours: {hours_str} น.",
                "description": (
                    f"ช่วง {top['hour']:02d}:00-{top['hour']+1:02d}:00 น. "
                    f"มีออเดอร์สูงสุด ({top['orders']} ออเดอร์/ช่วง) "
                    "เตรียมพนักงานและ stock ให้พร้อมในช่วงนี้เป็นพิเศษ"
                ),
                "metric": float(top["hour"]),
            })
    except Exception:
        pass
    return insights


# ─────────────────────────────────────────────────────────
# 12. FORECAST — พยากรณ์สัปดาห์หน้า
# ─────────────────────────────────────────────────────────
def detect_forecast_insights(store_id: str) -> list[dict]:
    insights = []
    try:
        fc = forecast_service.forecast_revenue(store_id, days_ahead=7)
        recent = data_service.get_daily_sales(store_id, days=7)
        if not recent.empty and fc.get("series"):
            last_week     = recent["revenue"].sum()
            forecast_week = fc["total_predicted"]
            if last_week > 0:
                change = (forecast_week - last_week) / last_week * 100
                if abs(change) >= 10:
                    direction = "เพิ่มขึ้น" if change > 0 else "ลดลง"
                    sev = "INFO" if change > 0 else "WARNING"
                    insights.append({
                        "type": "FORECAST", "severity": sev,
                        "title": f"พยากรณ์: รายได้สัปดาห์หน้า{direction} {abs(change):.0f}%",
                        "description": (
                            f"AI คาดว่า 7 วันข้างหน้าจะมีรายได้ ~{forecast_week:,.0f} บาท "
                            f"({direction} {abs(change):.0f}% จากสัปดาห์นี้ {last_week:,.0f} บาท) "
                            + ("เตรียมสต็อกและพนักงานเพิ่ม" if change > 0 else "ควรวางแผนโปรโมชันรับมือ")
                        ),
                        "metric": round(change, 1),
                    })
    except Exception as e:
        print(f"forecast insight error: {e}")
    return insights


# ─────────────────────────────────────────────────────────
# GENERATE ALL
# ─────────────────────────────────────────────────────────
def generate_all_insights(store_id: str, save: bool = True) -> list[dict]:
    """รันทุก detector แล้ว return + save"""
    detectors = [
        detect_trend_insights,
        detect_anomaly_insights,
        detect_inventory_insights,
        detect_dead_stock,
        detect_profit_health,
        detect_aov_trend,
        detect_dayofweek_insights,
        detect_consecutive_decline,
        detect_product_opportunities,
        detect_demand_spikes,
        detect_peak_hour_insights,
        detect_forecast_insights,
    ]

    all_insights = []
    for detector in detectors:
        try:
            all_insights += detector(store_id)
        except Exception as e:
            print(f"[WARN] detector {detector.__name__} failed: {e}")

    # เรียงตาม severity: CRITICAL > WARNING > INFO
    sev_order = {"CRITICAL": 0, "WARNING": 1, "INFO": 2}
    all_insights.sort(key=lambda x: sev_order.get(x.get("severity", "INFO"), 2))

    if save:
        for ins in all_insights:
            _save_insight(store_id, ins)

    return all_insights


def get_recent_insights(store_id: str, limit: int = 50) -> list[dict]:
    """ดึง insight ล่าสุดจาก DB"""
    q = text("""
        SELECT id, type, severity, title, description, metric, is_read, created_at
        FROM ai_insights
        WHERE store_id = :store_id
        ORDER BY
            CASE severity WHEN 'CRITICAL' THEN 0 WHEN 'WARNING' THEN 1 ELSE 2 END,
            created_at DESC
        LIMIT :limit
    """)
    with database.engine.connect() as conn:
        rows = conn.execute(q, {"store_id": store_id, "limit": limit}).mappings().all()
    return [dict(r) for r in rows]
