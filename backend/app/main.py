from pathlib import Path

from fastapi import FastAPI, Request
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


@app.middleware("http")
async def restore_vercel_path(request: Request, call_next):
    current = request.scope.get("path") or ""
    if current.rstrip("/") == "/api":
        raw = request.headers.get("x-invoke-path") or request.headers.get("x-forwarded-uri") or ""
        path = raw.split("?")[0]
        if path and path.rstrip("/") not in {"", "/api"}:
            request.scope["path"] = path
            request.scope["raw_path"] = path.encode("utf-8")
    return await call_next(request)


@app.get("/health")
@app.get("/api")
@app.get("/api/")
def health():
    return {"status": "ok", "service": settings.app_name, "env": settings.app_env}


_frontend_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if _frontend_dist.is_dir():
    if hasattr(app, "frontend"):
        app.frontend("/", directory=str(_frontend_dist))
    else:
        from fastapi.staticfiles import StaticFiles

        app.mount("/", StaticFiles(directory=str(_frontend_dist), html=True), name="ui")
