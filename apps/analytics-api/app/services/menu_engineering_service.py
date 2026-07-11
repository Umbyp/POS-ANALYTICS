"""
Menu Engineering Matrix (Kasavana–Smith)
4-quadrant: profit (high/low) × popularity (high/low)
  ⭐ Stars        — profit สูง + ขายดี → highlight ในเมนู
  🐴 Plowhorses   — กำไรต่ำ + ขายดี → ปรับสูตร/ปรับราคาขึ้น
  🧩 Puzzles      — กำไรสูง + ขายน้อย → push, reposition
  🐕 Dogs         — กำไรต่ำ + ขายน้อย → พิจารณาตัด
"""
import pandas as pd
from sqlalchemy import text
from .. import database
from ..i18n import pick


def _df(q: str, params: dict) -> pd.DataFrame:
    with database.engine.connect() as conn:
        return pd.read_sql(text(q), conn, params=params)


def get_menu_engineering(store_id: str, days: int = 30, lang: str = "th") -> dict:
    q = """
        SELECT
            p.id,
            p.name,
            p.image,
            c.name AS category,
            c.icon AS category_icon,
            SUM(oi.quantity)::int AS qty_sold,
            SUM(oi."unitPrice" * oi.quantity)::float AS revenue,
            SUM((oi."unitPrice" - p."costPrice") * oi.quantity)::float AS profit,
            AVG(oi."unitPrice")::float AS avg_price,
            p."costPrice"::float AS cost
        FROM "Product" p
        JOIN "OrderItem" oi ON oi."productId" = p.id
        JOIN "Order" o ON o.id = oi."orderId"
        JOIN "Category" c ON c.id = p."categoryId"
        WHERE p."storeId" = :store_id
          AND p."isActive" = true
          AND p."isIngredient" = false
          AND o."createdAt" >= NOW() - (:days || ' days')::interval
          AND o.status NOT IN ('CANCELLED', 'REFUNDED', 'DRAFT')
        GROUP BY p.id, p.name, p.image, c.name, c.icon, p."costPrice"
        HAVING SUM(oi.quantity) > 0
    """
    df = _df(q, {"store_id": store_id, "days": days})
    if df.empty:
        return {"items": [], "summary": {}}

    df["margin"] = (df["profit"] / df["revenue"] * 100).fillna(0)
    df["profit_per_unit"] = df["profit"] / df["qty_sold"]

    # threshold = median
    pop_threshold = df["qty_sold"].median()
    profit_threshold = df["profit_per_unit"].median()

    def classify(row):
        high_pop = row["qty_sold"] >= pop_threshold
        high_profit = row["profit_per_unit"] >= profit_threshold
        if high_pop and high_profit:
            return ("Star", "⭐", pick(lang, "เก็บไว้/promote — กำไรดีและขายดี", "Keep it up / promote it — good profit and good sales"))
        if high_pop and not high_profit:
            return ("Plowhorse", "🐴", pick(lang, "ลองปรับราคาขึ้นเล็กน้อย หรือลด cost", "Try a small price increase, or cut costs"))
        if not high_pop and high_profit:
            return ("Puzzle", "🧩", pick(lang, "ถ้ามีจริง — push promote/reposition", "If it's real potential — push it or reposition it"))
        return ("Dog", "🐕", pick(lang, "พิจารณาตัดออก หรือ rebrand", "Consider cutting it, or rebranding it"))

    df[["quadrant", "icon", "recommendation"]] = df.apply(
        lambda r: pd.Series(classify(r)), axis=1
    )

    items = []
    for _, r in df.iterrows():
        items.append({
            "id": r["id"],
            "name": r["name"],
            "image": r.get("image"),
            "category": r["category"],
            "category_icon": r["category_icon"],
            "qty_sold": int(r["qty_sold"]),
            "revenue": float(r["revenue"]),
            "profit": float(r["profit"]),
            "margin": float(r["margin"]),
            "profit_per_unit": float(r["profit_per_unit"]),
            "quadrant": r["quadrant"],
            "icon": r["icon"],
            "recommendation": r["recommendation"],
        })

    counts = df["quadrant"].value_counts().to_dict()
    return {
        "items": items,
        "summary": {
            "total": len(df),
            "stars": int(counts.get("Star", 0)),
            "plowhorses": int(counts.get("Plowhorse", 0)),
            "puzzles": int(counts.get("Puzzle", 0)),
            "dogs": int(counts.get("Dog", 0)),
            "pop_threshold": float(pop_threshold),
            "profit_threshold": float(profit_threshold),
            "period_days": days,
        },
    }
