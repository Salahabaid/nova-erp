"""Applique supabase/migrations/0001_init.sql. Préférez l'éditeur SQL Supabase si le pooler refuse le mot de passe."""
from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import urlparse, unquote

import psycopg
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
SQL = ROOT.parent / "supabase" / "migrations" / "0001_init.sql"


def main() -> None:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL manquant. Ou collez 0001_init.sql dans l'éditeur SQL Supabase.")
    parsed = urlparse(url)
    password = unquote(parsed.password or "")
    user = unquote(parsed.username or "postgres")
    sql = SQL.read_text(encoding="utf-8")
    with psycopg.connect(
        host=parsed.hostname,
        port=parsed.port or 5432,
        dbname=(parsed.path or "/postgres").lstrip("/"),
        user=user,
        password=password,
        sslmode="require",
        connect_timeout=20,
    ) as conn:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(sql)
    print("Migration appliquée.")


if __name__ == "__main__":
    main()
