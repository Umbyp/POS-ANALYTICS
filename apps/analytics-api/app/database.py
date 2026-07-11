from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from .config import settings


def _psycopg2_safe_url(url: str) -> str:
    """Prisma's DATABASE_URL adds query params (schema, pgbouncer) that
    psycopg2 doesn't recognize as libpq options — strip them before use."""
    parts = urlsplit(url)
    query = [(k, v) for k, v in parse_qsl(parts.query) if k not in ("schema", "pgbouncer")]
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


# SQLAlchemy engine — ใช้ connection เดียวกับ POS database
engine = create_engine(
    _psycopg2_safe_url(settings.DATABASE_URL),
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_analytics_tables():
    """สร้างตาราง analytics + เปิด pgvector (รันครั้งเดียวตอน startup)"""
    import os

    sql_path = os.path.join(os.path.dirname(__file__), "sql", "init_analytics.sql")
    with open(sql_path, "r", encoding="utf-8") as f:
        sql = f.read()

    # รันทีละ statement ใน transaction แยกกัน — ถ้า pgvector ใช้ไม่ได้ (เช่น
    # Postgres ที่ไม่ใช่ Supabase) statement อื่นจะยังสร้างสำเร็จ ไม่ rollback ทั้งหมด
    for stmt in sql.split(";"):
        stmt = stmt.strip()
        if not stmt:
            continue
        try:
            with engine.begin() as conn:
                conn.execute(text(stmt))
        except Exception as e:
            print(f"[WARN] Skipped statement ({e.__class__.__name__}): {stmt[:60]}...")
    print("[OK] Analytics tables ready")
