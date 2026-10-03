"""Entrée FastAPI pour Vercel."""
from __future__ import annotations

import sys
import traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
for path in (str(BACKEND), str(ROOT)):
    if path not in sys.path:
        sys.path.insert(0, path)

try:
    from app.main import app
except Exception:  # noqa: BLE001
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse

    app = FastAPI(title="Nova ERP (boot error)")
    _boot_error = traceback.format_exc()

    @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
    async def boot_failed(path: str = "") -> JSONResponse:
        return JSONResponse(
            {"detail": {"message": "API Vercel: échec au démarrage.", "error": _boot_error}},
            status_code=500,
        )
