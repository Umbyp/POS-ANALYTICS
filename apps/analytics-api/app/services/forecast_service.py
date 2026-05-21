"""
Forecast Service — ใช้ Prophet พยากรณ์ยอดขาย/ความต้องการ/traffic
"""
import warnings
import pandas as pd

warnings.filterwarnings("ignore")

from . import data_service


def _run_prophet(df: pd.DataFrame, periods: int, value_col: str) -> list[dict]:
    """
    df ต้องมีคอลัมน์ [date, <value_col>]
    คืน list ของ {date, predicted, lower, upper, is_forecast}
    """
    from prophet import Prophet

    if len(df) < 7:
        # ข้อมูลน้อยเกินไป → fallback เป็นค่าเฉลี่ย
        avg = df[value_col].mean() if len(df) else 0
        last_date = pd.Timestamp.now().normalize()
        return [
            {
                "date": str((last_date + pd.Timedelta(days=i + 1)).date()),
                "predicted": round(float(avg), 2),
                "lower": round(float(avg) * 0.8, 2),
                "upper": round(float(avg) * 1.2, 2),
                "is_forecast": True,
            }
            for i in range(periods)
        ]

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
    result = []
    cutoff = prophet_df["ds"].max()
    for _, row in forecast.iterrows():
        is_fc = row["ds"] > cutoff
        result.append({
            "date": str(row["ds"].date()),
            "predicted": round(max(0, float(row["yhat"])), 2),
            "lower": round(max(0, float(row["yhat_lower"])), 2),
            "upper": round(max(0, float(row["yhat_upper"])), 2),
            "is_forecast": is_fc,
        })
    return result


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
