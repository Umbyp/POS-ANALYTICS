"""
Forecast Service — ใช้ Prophet พยากรณ์ยอดขาย/ความต้องการ/traffic
"""
import warnings
import pandas as pd

warnings.filterwarnings("ignore")

from . import data_service


def _naive_forecast(df: pd.DataFrame, periods: int, value_col: str) -> list[dict]:
    """
    Fallback พยากรณ์แบบ day-of-week average — ใช้เมื่อ Prophet ใช้ไม่ได้
    หรือข้อมูลน้อยเกินไป. ไม่ throw error เด็ดขาด.

    - historical rows: actual = ค่าจริง
    - future rows:     predicted = ค่าเฉลี่ยตามวันในสัปดาห์ (fallback เป็นค่าเฉลี่ยรวม)
                       lower/upper = ±18%
    """
    historical: list[dict] = []
    last_date = pd.Timestamp.now().normalize()
    dow_avg: dict[int, float] = {}
    overall_avg = 0.0

    if len(df):
        work = df.copy()
        work["date"] = pd.to_datetime(work["date"])
        work = work.sort_values("date")
        last_date = work["date"].max().normalize()
        overall_avg = float(work[value_col].mean())
        # ค่าเฉลี่ยรายวันในสัปดาห์ (0=จันทร์ ... 6=อาทิตย์)
        grouped = work.groupby(work["date"].dt.dayofweek)[value_col].mean()
        dow_avg = {int(k): float(v) for k, v in grouped.items()}

        for _, row in work.iterrows():
            historical.append({
                "date": str(row["date"].date()),
                "actual": round(float(row[value_col]), 2),
                "predicted": None,
                "lower": None,
                "upper": None,
                "is_forecast": False,
            })

    future = []
    for i in range(periods):
        d = last_date + pd.Timedelta(days=i + 1)
        base = dow_avg.get(int(d.dayofweek), overall_avg)
        future.append({
            "date": str(d.date()),
            "actual": None,
            "predicted": round(max(0.0, base), 2),
            "lower": round(max(0.0, base * 0.82), 2),
            "upper": round(max(0.0, base * 1.18), 2),
            "is_forecast": True,
        })

    return historical + future


def _run_prophet(df: pd.DataFrame, periods: int, value_col: str) -> list[dict]:
    """
    df ต้องมีคอลัมน์ [date, <value_col>]
    คืน list ของ {date, predicted, lower, upper, is_forecast}

    พยายามใช้ Prophet ก่อน — ถ้า import/fit ล้มเหลว หรือข้อมูลน้อยเกินไป
    จะ fallback ไปใช้ _naive_forecast (ไม่ throw error → API ไม่ 500)
    """
    if len(df) < 7:
        return _naive_forecast(df, periods, value_col)

    try:
        from prophet import Prophet

        # เตรียม data ตาม format Prophet: ds, y
        prophet_df = df.rename(columns={"date": "ds", value_col: "y"})[["ds", "y"]]
        prophet_df["ds"] = pd.to_datetime(prophet_df["ds"])

        model = Prophet(
            daily_seasonality=False,
            weekly_seasonality=True,
            yearly_seasonality=False,
            seasonality_mode="multiplicative",
            interval_width=0.85,
        )
        model.fit(prophet_df)

        future = model.make_future_dataframe(periods=periods)
        forecast = model.predict(future)

        # รวมข้อมูลจริง + พยากรณ์
        # - historical rows: actual = ค่าจริง, predicted = ค่าที่ Prophet fit ได้ (เปรียบเทียบ)
        # - future rows:    actual = None,   predicted = ค่าที่ Prophet พยากรณ์
        result = []
        cutoff = prophet_df["ds"].max()
        actual_lookup = dict(zip(prophet_df["ds"], prophet_df["y"]))
        for _, row in forecast.iterrows():
            is_fc = row["ds"] > cutoff
            ds = row["ds"]
            actual_val = actual_lookup.get(ds)
            result.append({
                "date": str(ds.date()),
                "actual": round(float(actual_val), 2) if actual_val is not None else None,
                "predicted": round(max(0, float(row["yhat"])), 2) if is_fc else None,
                "lower": round(max(0, float(row["yhat_lower"])), 2) if is_fc else None,
                "upper": round(max(0, float(row["yhat_upper"])), 2) if is_fc else None,
                "is_forecast": is_fc,
            })
        return result
    except Exception as e:
        # Prophet ไม่พร้อมใช้ (ติดตั้งไม่ได้ / fit ล้มเหลว) → ใช้ fallback
        warnings.warn(f"Prophet unavailable, using naive forecast: {e}")
        return _naive_forecast(df, periods, value_col)


def forecast_revenue(store_id: str, days_ahead: int = 30) -> dict:
    """พยากรณ์รายได้รวม"""
    df = data_service.get_daily_sales(store_id, days=120)
    series = _run_prophet(df, periods=days_ahead, value_col="revenue")

    forecast_only = [s for s in series if s["is_forecast"]]
    total_predicted = sum(s["predicted"] for s in forecast_only)

    return {
        "type": "REVENUE",
        "days_ahead": days_ahead,
        "total_predicted": round(total_predicted, 2),
        "series": series,
    }


def forecast_traffic(store_id: str, days_ahead: int = 14) -> dict:
    """พยากรณ์จำนวนลูกค้า (จำนวนออเดอร์)"""
    df = data_service.get_daily_sales(store_id, days=120)
    series = _run_prophet(df, periods=days_ahead, value_col="orders")
    forecast_only = [s for s in series if s["is_forecast"]]
    return {
        "type": "TRAFFIC",
        "days_ahead": days_ahead,
        "total_predicted": round(sum(s["predicted"] for s in forecast_only)),
        "series": series,
    }


def forecast_demand(store_id: str, product_id: str, days_ahead: int = 14) -> dict:
    """พยากรณ์ความต้องการสินค้ารายตัว (สำหรับวางแผนสต็อก)"""
    df = data_service.get_product_daily_sales(store_id, product_id, days=120)
    df = df.rename(columns={"qty": "value"})
    series = _run_prophet(df, periods=days_ahead, value_col="value")
    forecast_only = [s for s in series if s["is_forecast"]]
    return {
        "type": "DEMAND",
        "product_id": product_id,
        "days_ahead": days_ahead,
        "total_predicted_qty": round(sum(s["predicted"] for s in forecast_only)),
        "series": series,
    }


def predict_peak_hours(store_id: str) -> dict:
    """หาช่วงเวลาที่ลูกค้าเยอะที่สุด"""
    df = data_service.get_hourly_heatmap(store_id, days=30)
    if df.empty:
        return {"peak_hours": [], "heatmap": []}

    # รวมตามชั่วโมง
    by_hour = df.groupby("hour")["orders"].sum().sort_values(ascending=False)
    peak = [{"hour": int(h), "orders": int(o)} for h, o in by_hour.head(3).items()]

    return {
        "peak_hours": peak,
        "heatmap": df.to_dict(orient="records"),
    }
