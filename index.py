"""Entrée FastAPI officielle pour Vercel (fichier racine, pas /api)."""
from __future__ import annotations

import sys
import traceback
from pathlib import Path

_BACKEND = Path(__file__).resolve().parent / "backend"
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

try:
    from app.main import app
except Exception:  # noqa: BLE001
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse

    app = FastAPI(title="Nova ERP boot error")
    _err = traceback.format_exc()

    @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
    async def boot_failed(path: str = "") -> JSONResponse:
        return JSONResponse(
            {"detail": {"message": "Échec au démarrage de l'API.", "error": _err}},
            status_code=500,
        )
