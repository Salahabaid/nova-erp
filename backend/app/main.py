from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.errors import unhandled_error_handler

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="API REST sécurisée de Nova ERP — FastAPI + Supabase.",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=r"https://.*\.(vercel\.app|onrender\.com)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_prefix)
app.add_exception_handler(Exception, unhandled_error_handler)


@app.get("/health")
def health():
    return {"status": "ok", "service": settings.app_name, "env": settings.app_env}


_frontend_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if _frontend_dist.is_dir():
    if hasattr(app, "frontend"):
        app.frontend("/", directory=str(_frontend_dist))
    else:
        from fastapi.staticfiles import StaticFiles

        app.mount("/", StaticFiles(directory=str(_frontend_dist), html=True), name="ui")
