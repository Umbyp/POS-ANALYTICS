from fastapi import APIRouter, Query
from ..services import forecast_service, insight_service, recommendation_service

# ============ FORECAST ============
forecast_router = APIRouter(prefix="/api/forecast", tags=["forecast"])


@forecast_router.get("/revenue")
def revenue(store_id: str, days_ahead: int = Query(30, ge=1, le=90)):
    return forecast_service.forecast_revenue(store_id, days_ahead)


@forecast_router.get("/traffic")
def traffic(store_id: str, days_ahead: int = Query(14, ge=1, le=60)):
    return forecast_service.forecast_traffic(store_id, days_ahead)


@forecast_router.get("/demand")
def demand(store_id: str, product_id: str, days_ahead: int = Query(14, ge=1, le=60)):
    return forecast_service.forecast_demand(store_id, product_id, days_ahead)


@forecast_router.get("/peak-hours")
def peak_hours(store_id: str):
    return forecast_service.predict_peak_hours(store_id)


# ============ INSIGHTS ============
insights_router = APIRouter(prefix="/api/insights", tags=["insights"])


@insights_router.get("")
def list_insights(store_id: str, limit: int = 20):
    return insight_service.get_recent_insights(store_id, limit)


@insights_router.post("/generate")
def generate(store_id: str, lang: str = "th"):
    """รัน insight engine — ลบเก่า แล้ว generate ใหม่ทั้งหมด"""
    from sqlalchemy import text
    from ..database import engine
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM ai_insights WHERE store_id = :s"), {"s": store_id})
    return {"generated": insight_service.generate_all_insights(store_id, save=True, lang=lang)}


# ============ RECOMMENDATIONS ============
rec_router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])


@rec_router.get("")
def all_recommendations(store_id: str, lang: str = "th"):
    return recommendation_service.get_all_recommendations(store_id, lang=lang)
