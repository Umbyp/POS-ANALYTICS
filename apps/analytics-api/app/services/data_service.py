"""
Data Service — อ่านข้อมูลจากตาราง POS (ที่ Prisma สร้าง) แบบ read-only
หมายเหตุ: Prisma ตั้งชื่อ table แบบ PascalCase ("Order", "Product")
          และ column แบบ camelCase ("createdAt", "storeId")
          ต้องใส่ double-quote ใน SQL เสมอ
"""
import pandas as pd
from sqlalchemy import text
from .. import database


def _df(query: str, params: dict) -> pd.DataFrame:
    """รัน SQL แล้วคืน DataFrame — ใช้ connection ใหม่ทุกครั้งเพื่อเห็นข้อมูลล่าสุด"""
    with database.engine.connect().execution_options(isolation_level="READ COMMITTED") as conn:
        return pd.read_sql(text(query), conn, params=params)


# ============ KPI / SUMMARY ============
def get_kpi_summary(store_id: str, days: int = 30) -> dict:
    """สรุป KPI หลัก: รายได้, ออเดอร์, กำไร, ค่าเฉลี่ยต่อบิล"""
    q = """
        SELECT
            COALESCE(SUM(o.total), 0)        AS revenue,
            COUNT(*)                          AS order_count,
            COALESCE(SUM(o.tax), 0)          AS tax,
            COALESCE(SUM(o.discount), 0)     AS discount,
            COALESCE(AVG(o.total), 0)        AS avg_ticket
        FROM "Order" o
        WHERE o."storeId" = :store_id
          AND o."createdAt" >= NOW() - (:days || ' days')::interval
          AND o.status NOT IN ('CANCELLED', 'REFUNDED')
    """
    row = _df(q, {"store_id": store_id, "days": days}).iloc[0]

    # กำไร = ยอดขาย - ต้นทุน (จาก OrderItem join Product)
    q_profit = """
        SELECT COALESCE(SUM(
            (oi."unitPrice" - p."costPrice") * oi.quantity
        ), 0) AS gross_profit
        FROM "OrderItem" oi
        JOIN "Order" o ON o.id = oi."orderId"
        JOIN "Product" p ON p.id = oi."productId"
        WHERE o."storeId" = :store_id
          AND o."createdAt" >= NOW() - (:days || ' days')::interval
          AND o.status NOT IN ('CANCELLED', 'REFUNDED')
    """
    profit = _df(q_profit, {"store_id": store_id, "days": days}).iloc[0]["gross_profit"]

    # เทียบช่วงก่อนหน้า (growth %)
    q_prev = """
        SELECT COALESCE(SUM(o.total), 0) AS revenue
        FROM "Order" o
        WHERE o."storeId" = :store_id
          AND o."createdAt" >= NOW() - (:days2 || ' days')::interval
          AND o."createdAt" <  NOW() - (:days || ' days')::interval
          AND o.status NOT IN ('CANCELLED', 'REFUNDED')
    """
    prev_rev = _df(q_prev, {"store_id": store_id, "days": days, "days2": days * 2}).iloc[0]["revenue"]
    growth = ((float(row["revenue"]) - float(prev_rev)) / float(prev_rev) * 100) if prev_rev else 0.0

    return {
        "revenue": float(row["revenue"]),
        "order_count": int(row["order_count"]),
        "gross_profit": float(profit),
        "avg_ticket": float(row["avg_ticket"]),
        "tax": float(row["tax"]),
        "discount": float(row["discount"]),
        "revenue_growth": round(growth, 1),
        "period_days": days,
    }


# ============ TIME SERIES (สำหรับ chart + Prophet) ============
def get_daily_sales(store_id: str, days: int = 90) -> pd.DataFrame:
    """ยอดขายรายวัน — คืน DataFrame [date, revenue, orders]"""
    q = """
        SELECT
            DATE(o."createdAt")        AS date,
            SUM(o.total)::float        AS revenue,
            COUNT(*)::int              AS orders
        FROM "Order" o
        WHERE o."storeId" = :store_id
          AND o."createdAt" >= NOW() - (:days || ' days')::interval
          AND o.status NOT IN ('CANCELLED', 'REFUNDED')
        GROUP BY DATE(o."createdAt")
        ORDER BY date ASC
    """
    return _df(q, {"store_id": store_id, "days": days})


def get_hourly_heatmap(store_id: str, days: int = 30) -> pd.DataFrame:
    """ยอดขายแยกตาม วันในสัปดาห์ x ชั่วโมง — สำหรับ heatmap + peak hour"""
    q = """
        SELECT
            EXTRACT(DOW  FROM o."createdAt")::int AS dow,
            EXTRACT(HOUR FROM o."createdAt")::int AS hour,
            COUNT(*)::int                          AS orders,
            SUM(o.total)::float                    AS revenue
        FROM "Order" o
        WHERE o."storeId" = :store_id
          AND o."createdAt" >= NOW() - (:days || ' days')::interval
          AND o.status NOT IN ('CANCELLED', 'REFUNDED')
        GROUP BY dow, hour
        ORDER BY dow, hour
    """
    return _df(q, {"store_id": store_id, "days": days})


# ============ PRODUCTS ============
def get_top_products(store_id: str, days: int = 30, limit: int = 10) -> pd.DataFrame:
    q = """
        SELECT
            p.id,
            p.name,
            SUM(oi.quantity)::int                          AS qty_sold,
            SUM(oi."unitPrice" * oi.quantity)::float       AS revenue,
            SUM((oi."unitPrice" - p."costPrice") * oi.quantity)::float AS profit
        FROM "OrderItem" oi
        JOIN "Order" o   ON o.id = oi."orderId"
        JOIN "Product" p ON p.id = oi."productId"
        WHERE o."storeId" = :store_id
          AND o."createdAt" >= NOW() - (:days || ' days')::interval
          AND o.status NOT IN ('CANCELLED', 'REFUNDED')
        GROUP BY p.id, p.name
        ORDER BY revenue DESC
        LIMIT :limit
    """
    return _df(q, {"store_id": store_id, "days": days, "limit": limit})


def get_product_daily_sales(store_id: str, product_id: str, days: int = 90) -> pd.DataFrame:
    """ยอดขายรายวันของสินค้าตัวเดียว — สำหรับ demand forecast"""
    q = """
        SELECT
            DATE(o."createdAt")    AS date,
            SUM(oi.quantity)::int  AS qty
        FROM "OrderItem" oi
        JOIN "Order" o ON o.id = oi."orderId"
        WHERE o."storeId" = :store_id
          AND oi."productId" = :product_id
          AND o."createdAt" >= NOW() - (:days || ' days')::interval
          AND o.status NOT IN ('CANCELLED', 'REFUNDED')
        GROUP BY DATE(o."createdAt")
        ORDER BY date ASC
    """
    return _df(q, {"store_id": store_id, "product_id": product_id, "days": days})


# ============ INVENTORY ============
def get_inventory_status(store_id: str) -> pd.DataFrame:
    """สถานะคลัง + อัตราการขายต่อวัน (เพื่อคำนวณว่าจะหมดกี่วัน)"""
    q = """
        SELECT
            p.id,
            p.name,
            inv.quantity            AS stock,
            inv."lowStockAt"        AS low_threshold,
            COALESCE(sales.avg_daily, 0) AS avg_daily_sales
        FROM "Product" p
        JOIN "Inventory" inv ON inv."productId" = p.id
        LEFT JOIN (
            SELECT
                oi."productId",
                SUM(oi.quantity)::float / 30.0 AS avg_daily
            FROM "OrderItem" oi
            JOIN "Order" o ON o.id = oi."orderId"
            WHERE o."createdAt" >= NOW() - INTERVAL '30 days'
              AND o.status NOT IN ('CANCELLED', 'REFUNDED')
            GROUP BY oi."productId"
        ) sales ON sales."productId" = p.id
        WHERE p."storeId" = :store_id
          AND p."isActive" = true
          AND p."trackStock" = true
    """
    df = _df(q, {"store_id": store_id})
    # คำนวณวันที่จะหมด
    df["days_until_out"] = df.apply(
        lambda r: round(r["stock"] / r["avg_daily_sales"], 1) if r["avg_daily_sales"] > 0 else None,
        axis=1,
    )
    return df


# ============ TODAY (real-time) ============
def get_today_sales(store_id: str) -> dict:
    """ยอดขายวันนี้ เทียบกับเมื่อวาน"""
    q_today = """
        SELECT
            COALESCE(SUM(o.total), 0)   AS revenue,
            COUNT(*)                     AS order_count,
            COALESCE(AVG(o.total), 0)   AS avg_ticket,
            MAX(o."createdAt")           AS last_order_at
        FROM "Order" o
        WHERE o."storeId" = :store_id
          AND DATE(o."createdAt" AT TIME ZONE 'Asia/Bangkok') = CURRENT_DATE
          AND o.status NOT IN ('CANCELLED', 'REFUNDED')
    """
    q_yesterday = """
        SELECT
            COALESCE(SUM(o.total), 0)   AS revenue,
            COUNT(*)                     AS order_count
        FROM "Order" o
        WHERE o."storeId" = :store_id
          AND DATE(o."createdAt" AT TIME ZONE 'Asia/Bangkok') = CURRENT_DATE - INTERVAL '1 day'
          AND o.status NOT IN ('CANCELLED', 'REFUNDED')
    """
    today = _df(q_today, {"store_id": store_id}).iloc[0]
    yesterday = _df(q_yesterday, {"store_id": store_id}).iloc[0]

    today_rev = float(today["revenue"])
    yest_rev = float(yesterday["revenue"])
    vs_yesterday = round(((today_rev - yest_rev) / yest_rev * 100) if yest_rev > 0 else 0.0, 1)

    return {
        "revenue": today_rev,
        "order_count": int(today["order_count"]),
        "avg_ticket": float(today["avg_ticket"]),
        "last_order_at": str(today["last_order_at"]) if today["last_order_at"] else None,
        "yesterday_revenue": yest_rev,
        "yesterday_orders": int(yesterday["order_count"]),
        "vs_yesterday_pct": vs_yesterday,
    }


def get_today_top_products(store_id: str, limit: int = 5) -> pd.DataFrame:
    """สินค้าขายดีวันนี้"""
    q = """
        SELECT
            p.name,
            SUM(oi.quantity)::int                         AS qty_sold,
            SUM(oi."unitPrice" * oi.quantity)::float      AS revenue
        FROM "OrderItem" oi
        JOIN "Order" o   ON o.id = oi."orderId"
        JOIN "Product" p ON p.id = oi."productId"
        WHERE o."storeId" = :store_id
          AND DATE(o."createdAt" AT TIME ZONE 'Asia/Bangkok') = CURRENT_DATE
          AND o.status NOT IN ('CANCELLED', 'REFUNDED')
        GROUP BY p.id, p.name
        ORDER BY revenue DESC
        LIMIT :limit
    """
    return _df(q, {"store_id": store_id, "limit": limit})


def get_today_hourly(store_id: str) -> pd.DataFrame:
    """ยอดขายรายชั่วโมงวันนี้"""
    q = """
        SELECT
            EXTRACT(HOUR FROM o."createdAt" AT TIME ZONE 'Asia/Bangkok')::int AS hour,
            COUNT(*)                                                             AS orders,
            COALESCE(SUM(o.total), 0)::float                                   AS revenue
        FROM "Order" o
        WHERE o."storeId" = :store_id
          AND DATE(o."createdAt" AT TIME ZONE 'Asia/Bangkok') = CURRENT_DATE
          AND o.status NOT IN ('CANCELLED', 'REFUNDED')
        GROUP BY hour
        ORDER BY hour
    """
    return _df(q, {"store_id": store_id})


# ============ STORE / MULTI-BRANCH ============
def get_stores() -> pd.DataFrame:
    q = 'SELECT id, name FROM "Store" ORDER BY name'
    return _df(q, {})
