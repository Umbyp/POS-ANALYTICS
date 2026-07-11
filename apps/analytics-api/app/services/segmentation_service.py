"""
RFM Customer Segmentation
- Recency: how recently they bought (days)
- Frequency: how often they buy (count)
- Monetary: how much they spend (total)

Segments:
  Champion    — บ่อย+เยอะ+เพิ่งซื้อ
  Loyal       — บ่อย+เพิ่งซื้อ
  Big Spender — เยอะ+เพิ่งซื้อ
  New         — เพิ่งซื้อครั้งแรก
  At Risk     — เคยซื้อแต่หายไป
  Hibernating — หายไปนาน
  Lost        — หายไปนานมาก
"""
import pandas as pd
from datetime import datetime
from sqlalchemy import text
from .. import database
from ..i18n import pick


def _df(q: str, params: dict) -> pd.DataFrame:
    with database.engine.connect() as conn:
        return pd.read_sql(text(q), conn, params=params)


def get_rfm_segments(store_id: str, lang: str = "th") -> dict:
    """คำนวณ RFM + แบ่ง segment ทุก customer"""
    q = """
        SELECT
            c.id,
            c.name,
            c.phone,
            c.email,
            c.points,
            c."createdAt" AS joined_at,
            COUNT(o.id)::int AS frequency,
            COALESCE(SUM(o.total), 0)::float AS monetary,
            MAX(o."createdAt") AS last_order_at,
            EXTRACT(DAY FROM NOW() - MAX(o."createdAt"))::int AS recency_days
        FROM "Customer" c
        LEFT JOIN "Order" o ON o."customerId" = c.id
            AND o.status NOT IN ('CANCELLED', 'REFUNDED', 'DRAFT')
        WHERE c."storeId" = :store_id AND c."isActive" = true
        GROUP BY c.id, c.name, c.phone, c.email, c.points, c."createdAt"
    """
    df = _df(q, {"store_id": store_id})
    if df.empty:
        return {
            "customers": [],
            "segments": [],
            "summary": {"total": 0, "champions": 0, "at_risk": 0, "lost": 0, "total_revenue": 0},
        }

    # Handle never-purchased customers
    df["frequency"] = df["frequency"].fillna(0).astype(int)
    df["monetary"] = df["monetary"].fillna(0.0)
    df["recency_days"] = df["recency_days"].fillna(9999).astype(int)

    def assign_segment(row):
        r, f, m = row["recency_days"], row["frequency"], row["monetary"]
        if f == 0:
            return "Never Bought"
        if r <= 30 and f >= 5 and m >= 2000:
            return "Champion"
        if r <= 60 and f >= 3:
            return "Loyal"
        if r <= 30 and m >= 1000:
            return "Big Spender"
        if r <= 14 and f == 1:
            return "New"
        if r <= 90 and f >= 2:
            return "Promising"
        if 90 < r <= 180:
            return "At Risk"
        if 180 < r <= 365:
            return "Hibernating"
        return "Lost"

    df["segment"] = df.apply(assign_segment, axis=1)

    # Group summary
    seg_counts = df["segment"].value_counts().to_dict()
    seg_revenue = df.groupby("segment")["monetary"].sum().to_dict()

    # Per-segment recommendations
    SEGMENT_META = {
        "Champion": {
            "color": "#10b981",
            "icon": "🏆",
            "action": pick(lang, "รักษาด้วย VIP rewards / สิทธิพิเศษ — อย่าให้หายไป", "Retain with VIP rewards / perks — don't let them slip away"),
            "priority": 1,
        },
        "Loyal": {
            "color": "#3b82f6",
            "icon": "💎",
            "action": pick(lang, "สร้างความผูกพัน — birthday reward, สะสมแต้มเพิ่ม", "Build the relationship — birthday rewards, extra points"),
            "priority": 2,
        },
        "Big Spender": {
            "color": "#a855f7",
            "icon": "💰",
            "action": pick(lang, "เสนอเมนู premium / ใหม่ก่อนใคร", "Offer premium items / early access to new ones"),
            "priority": 2,
        },
        "New": {
            "color": "#06b6d4",
            "icon": "🌱",
            "action": pick(lang, "Onboarding coupon ครั้งที่ 2 ลด 30฿", "Send a 30฿ coupon for their 2nd visit"),
            "priority": 3,
        },
        "Promising": {
            "color": "#22c55e",
            "icon": "🌿",
            "action": pick(lang, "กระตุ้นให้กลายเป็น Loyal — โปรกลับมาภายใน 30 วัน", "Nudge them toward Loyal — a return-within-30-days promo"),
            "priority": 3,
        },
        "At Risk": {
            "color": "#f59e0b",
            "icon": "⚠️",
            "action": pick(lang, "ส่ง LINE/SMS coupon ทันที — กำลังจะหาย", "Send a LINE/SMS coupon now — they're about to churn"),
            "priority": 1,
        },
        "Hibernating": {
            "color": "#f97316",
            "icon": "😴",
            "action": pick(lang, "Win-back campaign — coupon ลด 50%", "Win-back campaign — 50% off coupon"),
            "priority": 2,
        },
        "Lost": {
            "color": "#ef4444",
            "icon": "💔",
            "action": pick(lang, "ทำใจ หรือลอง re-engagement ครั้งเดียว", "Let it go, or try one last re-engagement attempt"),
            "priority": 4,
        },
        "Never Bought": {
            "color": "#6b7280",
            "icon": "❓",
            "action": pick(lang, "ตรวจว่ามีลูกค้าจริงไหม / ทำไมไม่ซื้อ", "Check whether they're a real customer / why they haven't bought"),
            "priority": 4,
        },
    }

    segments_summary = []
    for seg, count in seg_counts.items():
        meta = SEGMENT_META.get(seg, {})
        segments_summary.append({
            "segment": seg,
            "count": int(count),
            "revenue": float(seg_revenue.get(seg, 0)),
            "color": meta.get("color"),
            "icon": meta.get("icon"),
            "action": meta.get("action"),
            "priority": meta.get("priority", 5),
        })
    segments_summary.sort(key=lambda x: x["priority"])

    # Top customers per segment
    customers = []
    for _, row in df.sort_values("monetary", ascending=False).head(200).iterrows():
        customers.append({
            "id": row["id"],
            "name": row["name"],
            "phone": row.get("phone"),
            "segment": row["segment"],
            "recency_days": int(row["recency_days"]) if row["recency_days"] < 9999 else None,
            "frequency": int(row["frequency"]),
            "monetary": float(row["monetary"]),
            "points": int(row.get("points", 0)),
            "last_order_at": str(row["last_order_at"]) if pd.notna(row["last_order_at"]) else None,
        })

    return {
        "summary": {
            "total": len(df),
            "champions": int(seg_counts.get("Champion", 0)),
            "at_risk": int(seg_counts.get("At Risk", 0)),
            "lost": int(seg_counts.get("Lost", 0)),
            "total_revenue": float(df["monetary"].sum()),
        },
        "segments": segments_summary,
        "customers": customers,
    }


def get_churn_candidates(store_id: str) -> list[dict]:
    """ลูกค้าที่กำลังจะหาย — At Risk + Hibernating ที่เคยซื้อบ่อย"""
    q = """
        SELECT
            c.id,
            c.name,
            c.phone,
            c.points,
            COUNT(o.id)::int AS visit_count,
            MAX(o."createdAt") AS last_order_at,
            EXTRACT(DAY FROM NOW() - MAX(o."createdAt"))::int AS days_silent,
            AVG(EXTRACT(EPOCH FROM (o."createdAt" - LAG(o."createdAt") OVER (PARTITION BY c.id ORDER BY o."createdAt"))) / 86400.0) AS avg_gap_days,
            SUM(o.total)::float AS lifetime_value
        FROM "Customer" c
        JOIN "Order" o ON o."customerId" = c.id
            AND o.status NOT IN ('CANCELLED', 'REFUNDED', 'DRAFT')
        WHERE c."storeId" = :store_id AND c."isActive" = true
        GROUP BY c.id, c.name, c.phone, c.points
        HAVING COUNT(o.id) >= 2
    """
    df = _df(q, {"store_id": store_id})
    if df.empty:
        return []

    # คนที่เงียบนานเกิน 2x ของ gap ปกติของเขา → likely churn
    def churn_risk(row):
        gap = row.get("avg_gap_days") or 30
        days = row["days_silent"]
        if days > gap * 2 and days > 14:
            ratio = days / max(gap, 1)
            score = min(100, ratio * 30)
            return {
                "risk_score": int(score),
                "expected_gap": int(gap),
            }
        return None

    df["risk"] = df.apply(churn_risk, axis=1)
    at_risk = df[df["risk"].notna()].sort_values("lifetime_value", ascending=False)

    return [
        {
            "id": r["id"],
            "name": r["name"],
            "phone": r.get("phone"),
            "visit_count": int(r["visit_count"]),
            "days_silent": int(r["days_silent"]),
            "lifetime_value": float(r["lifetime_value"]),
            "points": int(r.get("points") or 0),
            "risk_score": r["risk"]["risk_score"],
            "expected_gap": r["risk"]["expected_gap"],
        }
        for _, r in at_risk.head(50).iterrows()
    ]


def get_clv(store_id: str) -> dict:
    """Customer Lifetime Value analysis"""
    q = """
        SELECT
            c.id,
            c.name,
            COUNT(o.id)::int AS orders,
            SUM(o.total)::float AS total_spent,
            EXTRACT(DAY FROM (MAX(o."createdAt") - MIN(o."createdAt")))::int AS active_days
        FROM "Customer" c
        JOIN "Order" o ON o."customerId" = c.id
            AND o.status NOT IN ('CANCELLED', 'REFUNDED', 'DRAFT')
        WHERE c."storeId" = :store_id
        GROUP BY c.id, c.name
    """
    df = _df(q, {"store_id": store_id})
    if df.empty:
        return {"avg_clv": 0, "median_clv": 0, "max_clv": 0, "total_customers": 0, "top_customers": []}

    avg_clv = float(df["total_spent"].mean())
    median_clv = float(df["total_spent"].median())
    max_clv = float(df["total_spent"].max())

    top = df.sort_values("total_spent", ascending=False).head(20)
    return {
        "avg_clv": avg_clv,
        "median_clv": median_clv,
        "max_clv": max_clv,
        "total_customers": int(len(df)),
        "top_customers": [
            {
                "id": r["id"],
                "name": r["name"],
                "orders": int(r["orders"]),
                "total_spent": float(r["total_spent"]),
                "active_days": int(r["active_days"]),
            }
            for _, r in top.iterrows()
        ],
    }
