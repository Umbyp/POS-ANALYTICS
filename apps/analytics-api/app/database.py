from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from .config import settings

# SQLAlchemy engine — ใช้ connection เดียวกับ POS database
engine = create_engine(
    settings.DATABASE_URL,
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

    with engine.begin() as conn:
        # แยกรันทีละ statement
        for stmt in sql.split(";"):
            stmt = stmt.strip()
            if stmt:
                conn.execute(text(stmt))
    print("[OK] Analytics tables ready")
