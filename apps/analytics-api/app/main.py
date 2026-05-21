from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import init_analytics_tables
from .routers import analytics, chat, growth
from .routers.forecast import forecast_router, insights_router, rec_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: สร้างตาราง analytics + pgvector
    try:
        init_analytics_tables()
    except Exception as e:
        print(f"[WARN] Could not init analytics tables: {e}")
    yield
    # Shutdown


app = FastAPI(
    title="POS Analytics API",
    description="AI-powered business analytics connected to POS",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analytics.router)
app.include_router(forecast_router)
app.include_router(insights_router)
app.include_router(rec_router)
app.include_router(chat.router)
app.include_router(growth.router)


@app.get("/health")
def health():
    return {"ok": True, "service": "analytics-api"}


@app.get("/")
def root():
    return {
        "service": "POS Analytics API",
        "docs": "/docs",
        "endpoints": [
            "/api/analytics/*",
            "/api/forecast/*",
            "/api/insights/*",
            "/api/recommendations/*",
            "/api/chat/*",
        ],
    }
