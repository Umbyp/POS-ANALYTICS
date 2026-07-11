"""
Phase 8 routers — RFM, Basket, Menu Eng, Playbook, Growth
"""
from fastapi import APIRouter, Query, HTTPException
from ..services import (
    segmentation_service,
    basket_service,
    menu_engineering_service,
    playbook_service,
    growth_service,
)

router = APIRouter(prefix="/api", tags=["growth"])


# ============ RFM Segmentation ============

@router.get("/segments/rfm")
def rfm_segments(store_id: str, lang: str = "th"):
    return segmentation_service.get_rfm_segments(store_id, lang=lang)


@router.get("/segments/churn")
def churn_candidates(store_id: str):
    return {"candidates": segmentation_service.get_churn_candidates(store_id)}


@router.get("/segments/clv")
def clv(store_id: str):
    return segmentation_service.get_clv(store_id)


# ============ Market Basket ============

@router.get("/basket/rules")
def basket_rules(
    store_id: str,
    days: int = Query(90, ge=1, le=365),
    min_support: int = Query(3, ge=1),
    min_confidence: float = Query(0.3, ge=0, le=1),
    lang: str = "th",
):
    return basket_service.get_basket_rules(
        store_id=store_id,
        days=days,
        min_support=min_support,
        min_confidence=min_confidence,
        lang=lang,
    )


@router.get("/basket/cross-sell/{product_id}")
def cross_sell(store_id: str, product_id: str, days: int = 90):
    return {
        "product_id": product_id,
        "suggestions": basket_service.get_cross_sell_for_product(store_id, product_id, days),
    }


# ============ Menu Engineering ============

@router.get("/menu-engineering")
def menu_engineering(store_id: str, days: int = 30, lang: str = "th"):
    return menu_engineering_service.get_menu_engineering(store_id, days, lang=lang)


# ============ Daily Playbook ============

@router.get("/playbook")
def playbook(store_id: str, lang: str = "th"):
    return playbook_service.generate_playbook(store_id, lang=lang)


# ============ Promotion Recommendation ============

@router.get("/promotions/recommend")
def promotion_recommend(store_id: str, lang: str = "th"):
    return {"suggestions": growth_service.recommend_promotions(store_id, lang=lang)}


# ============ What-If ============

@router.get("/whatif/price")
def whatif_price(store_id: str, product_id: str, new_price: float, lang: str = "th"):
    return growth_service.whatif_price_change(store_id, product_id, new_price, lang=lang)


@router.get("/whatif/discount")
def whatif_discount(store_id: str, discount_pct: float, days: int = 30, lang: str = "th"):
    return growth_service.whatif_discount(store_id, discount_pct, days, lang=lang)


# ============ Cohort Retention ============

@router.get("/cohort/retention")
def cohort_retention(store_id: str, weeks: int = 12):
    return growth_service.get_cohort_retention(store_id, weeks)


# ============ Per-product Forecast ============

@router.get("/forecast/product/{product_id}")
def product_forecast(store_id: str, product_id: str, days_ahead: int = 14):
    return growth_service.forecast_product_demand(store_id, product_id, days_ahead)


# ============ Goal Coaching ============

@router.get("/goal-coach")
def goal_coach(store_id: str, lang: str = "th"):
    return growth_service.goal_coach(store_id, lang=lang)
