"""
Market Basket Analysis — หา product affinity
ใช้ algorithm แบบ co-occurrence + lift (simple form ของ Apriori)

Output:
  - "ลูกค้า 80% ที่ซื้อ A ก็ซื้อ B ด้วย" (confidence)
  - "ซื้อ A+B ด้วยกัน บ่อยกว่าค่า random X เท่า" (lift)

ใช้ผลลัพธ์เพื่อ:
  - สร้าง Combo / Bundle อัตโนมัติ
  - Cross-sell แนะนำตอนเพิ่มสินค้าใส่ตะกร้า
"""
import pandas as pd
from collections import defaultdict, Counter
from itertools import combinations
from sqlalchemy import text
from .. import database
from ..i18n import pick


def _df(q: str, params: dict) -> pd.DataFrame:
    with database.engine.connect() as conn:
        return pd.read_sql(text(q), conn, params=params)


def get_basket_rules(
    store_id: str,
    days: int = 90,
    min_support: int = 3,
    min_confidence: float = 0.3,
    top_n: int = 20,
    lang: str = "th",
) -> dict:
    """
    คืน association rules: {antecedent} → {consequent}
    - support: จำนวนบิลที่มี A+B
    - confidence: P(B|A) = support(A∪B) / support(A)
    - lift: confidence(A→B) / P(B) — ถ้า > 1 = correlated มากกว่า random
    """
    # ดึง orders + items
    q = """
        SELECT
            o.id AS order_id,
            oi."productId",
            p.name AS product_name
        FROM "Order" o
        JOIN "OrderItem" oi ON oi."orderId" = o.id
        JOIN "Product" p ON p.id = oi."productId"
        WHERE o."storeId" = :store_id
          AND o."createdAt" >= NOW() - (:days || ' days')::interval
          AND o.status NOT IN ('CANCELLED', 'REFUNDED', 'DRAFT')
          AND p."isIngredient" = false
    """
    df = _df(q, {"store_id": store_id, "days": days})
    if df.empty:
        return {"rules": [], "bundle_suggestions": [], "stats": {"orders": 0}}

    # Group items per order
    baskets = df.groupby("order_id")["productId"].apply(set).tolist()
    total_orders = len(baskets)

    # Product name lookup
    name_map = dict(zip(df["productId"], df["product_name"]))

    # Item support
    item_support = Counter()
    for basket in baskets:
        for item in basket:
            item_support[item] += 1

    # Pair support (co-occurrence)
    pair_support = Counter()
    for basket in baskets:
        if len(basket) < 2:
            continue
        for pair in combinations(sorted(basket), 2):
            pair_support[pair] += 1

    # Build rules
    rules = []
    for (a, b), sup_ab in pair_support.items():
        if sup_ab < min_support:
            continue
        sup_a = item_support[a]
        sup_b = item_support[b]
        # both directions
        for ant, con, sup_ant in [(a, b, sup_a), (b, a, sup_b)]:
            conf = sup_ab / sup_ant if sup_ant > 0 else 0
            if conf < min_confidence:
                continue
            lift = (conf / (item_support[con] / total_orders)) if item_support[con] > 0 else 0
            rules.append({
                "antecedent_id": ant,
                "antecedent_name": name_map.get(ant, "?"),
                "consequent_id": con,
                "consequent_name": name_map.get(con, "?"),
                "support": int(sup_ab),
                "support_pct": round(sup_ab / total_orders * 100, 1),
                "confidence": round(conf * 100, 1),
                "lift": round(lift, 2),
            })

    # Sort by lift × support (correlated AND meaningful volume)
    rules.sort(key=lambda r: (r["lift"], r["support"]), reverse=True)
    top_rules = rules[:top_n]

    # Bundle suggestions: pairs with high confidence + high lift = good combo candidates
    bundle_suggestions = []
    seen_pairs = set()
    for r in rules:
        pair_key = tuple(sorted([r["antecedent_id"], r["consequent_id"]]))
        if pair_key in seen_pairs:
            continue
        if r["confidence"] >= 50 and r["lift"] >= 1.5 and r["support"] >= 5:
            seen_pairs.add(pair_key)
            bundle_suggestions.append({
                "items": [r["antecedent_name"], r["consequent_name"]],
                "item_ids": list(pair_key),
                "co_occurrence": r["support"],
                "confidence": r["confidence"],
                "lift": r["lift"],
                "suggestion": pick(
                    lang,
                    f"สร้างเซต '{r['antecedent_name']} + {r['consequent_name']}' — "
                    f"ขายร่วมกัน {r['support']} ครั้ง ({r['support_pct']}% ของบิล)",
                    f"Bundle '{r['antecedent_name']} + {r['consequent_name']}' — "
                    f"bought together {r['support']} times ({r['support_pct']}% of orders)",
                ),
            })
        if len(bundle_suggestions) >= 10:
            break

    return {
        "rules": top_rules,
        "bundle_suggestions": bundle_suggestions,
        "stats": {
            "orders": total_orders,
            "unique_pairs": len(pair_support),
            "rules_found": len(rules),
        },
    }


def get_cross_sell_for_product(store_id: str, product_id: str, days: int = 90) -> list[dict]:
    """ดูว่าสินค้าตัวนี้มักขายคู่กับอะไร — ใช้แนะนำตอนเพิ่มลงตะกร้าใน POS"""
    q = """
        WITH product_orders AS (
            SELECT DISTINCT o.id
            FROM "Order" o
            JOIN "OrderItem" oi ON oi."orderId" = o.id
            WHERE o."storeId" = :store_id
              AND oi."productId" = :product_id
              AND o."createdAt" >= NOW() - (:days || ' days')::interval
              AND o.status NOT IN ('CANCELLED', 'REFUNDED', 'DRAFT')
        )
        SELECT
            oi."productId",
            p.name,
            p."sellingPrice"::float as price,
            p.image,
            COUNT(*)::int as co_count
        FROM "OrderItem" oi
        JOIN "Product" p ON p.id = oi."productId"
        WHERE oi."orderId" IN (SELECT id FROM product_orders)
          AND oi."productId" != :product_id
          AND p."isIngredient" = false
          AND p."isActive" = true
        GROUP BY oi."productId", p.name, p."sellingPrice", p.image
        ORDER BY co_count DESC
        LIMIT 5
    """
    df = _df(q, {"store_id": store_id, "product_id": product_id, "days": days})
    return df.to_dict("records") if not df.empty else []
