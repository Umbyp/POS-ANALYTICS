import json
from fastapi import APIRouter, Query
from ..services import data_service


def _safe_records(df):
    """DataFrame → list[dict] โดย NaN/Inf/None ถูก serialize เป็น null"""
    return json.loads(df.to_json(orient="records", default_handler=str))


router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/stores")
def list_stores():
    return _safe_records(data_service.get_stores())


@router.get("/kpi")
def kpi(store_id: str, days: int = Query(30, ge=1, le=365)):
    return data_service.get_kpi_summary(store_id, days)


@router.get("/daily-sales")
def daily_sales(store_id: str, days: int = Query(90, ge=7, le=365)):
    df = data_service.get_daily_sales(store_id, days)
    df["date"] = df["date"].astype(str)
    return _safe_records(df)


@router.get("/heatmap")
def heatmap(store_id: str, days: int = Query(30, ge=7, le=90)):
    return _safe_records(data_service.get_hourly_heatmap(store_id, days))


@router.get("/top-products")
def top_products(store_id: str, days: int = Query(30, ge=1, le=365), limit: int = 10):
    return _safe_records(data_service.get_top_products(store_id, days, limit))


@router.get("/inventory-status")
def inventory_status(store_id: str):
    return _safe_records(data_service.get_inventory_status(store_id))


@router.get("/today")
def today_summary(store_id: str):
    today = data_service.get_today_sales(store_id)
    top = _safe_records(data_service.get_today_top_products(store_id, limit=5))
    hourly = _safe_records(data_service.get_today_hourly(store_id))

    peak_hour = None
    if hourly:
        peak = max(hourly, key=lambda r: r.get("orders") or 0)
        peak_hour = peak

    return {**today, "top_products": top, "hourly": hourly, "peak_hour_today": peak_hour}
