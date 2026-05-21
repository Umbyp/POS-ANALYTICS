"""
Recommendation Engine — แนะนำการตัดสินใจทางธุรกิจ
"""
import pandas as pd

from . import data_service, forecast_service


def recommend_restock(store_id: str) -> list[dict]:
    """แนะนำสินค้าที่ควรสั่งเพิ่ม + จำนวนที่แนะนำ"""
    df = data_service.get_inventory_status(store_id)
    if df.empty:
        return []

    recs = []
    # สินค้าที่จะหมดใน 14 วัน
    at_risk = df[(df["days_until_out"].notna()) & (df["days_until_out"] <= 14)]
    for _, row in at_risk.iterrows():
        # แนะนำสั่งให้พอ 30 วัน
        suggested = max(0, round(row["avg_daily_sales"] * 30 - row["stock"]))
        recs.append({
            "product_id": row["id"],
            "product_name": row["name"],
            "current_stock": int(row["stock"]),
            "days_until_out": float(row["days_until_out"]),
            "suggested_order_qty": int(suggested),
            "reason": f"ขายเฉลี่ย {row['avg_daily_sales']:.1f}/วัน จะหมดใน {row['days_until_out']:.0f} วัน",
            "priority": "HIGH" if row["days_until_out"] <= 5 else "MEDIUM",
        })
    return sorted(recs, key=lambda x: x["days_until_out"])


def recommend_discontinue(store_id: str) -> list[dict]:
    """แนะนำสินค้าที่ควรเลิกขาย (ขายช้า + ทุนจม)"""
    top = data_service.get_top_products(store_id, days=60, limit=1000)
    inv = data_service.get_inventory_status(store_id)
    if inv.empty:
        return []

    sold_ids = set(top["id"].tolist()) if not top.empty else set()
    recs = []
    for _, row in inv.iterrows():
        # สินค้าที่ไม่เคยขายเลยใน 60 วัน + ยังมีสต็อก
        if row["id"] not in sold_ids and row["stock"] > 0:
            recs.append({
                "product_id": row["id"],
                "product_name": row["name"],
                "current_stock": int(row["stock"]),
                "reason": "ไม่มียอดขายใน 60 วันที่ผ่านมา — พิจารณาลดราคาระบายหรือเลิกขาย",
            })
    return recs[:10]


def recommend_promotions(store_id: str) -> list[dict]:
    """ไอเดียโปรโมชัน"""
    top = data_service.get_top_products(store_id, days=30, limit=20)
    if top.empty:
        return []

    recs = []

    # สินค้ากำไรสูง → โปรโมตเพิ่ม
    top_sorted = top.copy()
    top_sorted["margin"] = top_sorted["profit"] / top_sorted["revenue"].replace(0, 1)
    high_margin = top_sorted.nlargest(3, "margin")
    for _, row in high_margin.iterrows():
        recs.append({
            "type": "PROMOTE",
            "product_name": row["name"],
            "suggestion": f"โปรโมต '{row['name']}' — กำไรต่อหน่วยสูง ({row['margin']*100:.0f}%) เพิ่มยอดขายจะกำไรดี",
        })

    # Bundle: สินค้าขายดี 2 ตัวแรก
    if len(top) >= 2:
        recs.append({
            "type": "BUNDLE",
            "product_name": f"{top.iloc[0]['name']} + {top.iloc[1]['name']}",
            "suggestion": f"จัดเซ็ต '{top.iloc[0]['name']}' คู่ '{top.iloc[1]['name']}' ในราคาพิเศษ เพิ่มยอดต่อบิล",
        })

    return recs


def recommend_high_profit(store_id: str) -> list[dict]:
    """สินค้าทำกำไรสูงสุด"""
    top = data_service.get_top_products(store_id, days=30, limit=10)
    if top.empty:
        return []
    return [
        {
            "product_name": row["name"],
            "profit": float(row["profit"]),
            "revenue": float(row["revenue"]),
            "qty_sold": int(row["qty_sold"]),
        }
        for _, row in top.sort_values("profit", ascending=False).head(5).iterrows()
    ]


def get_all_recommendations(store_id: str) -> dict:
    return {
        "restock": recommend_restock(store_id),
        "discontinue": recommend_discontinue(store_id),
        "promotions": recommend_promotions(store_id),
        "high_profit": recommend_high_profit(store_id),
    }
