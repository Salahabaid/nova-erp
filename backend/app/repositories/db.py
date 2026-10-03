from __future__ import annotations

import re
from datetime import date, datetime
from decimal import Decimal
from functools import lru_cache
from typing import Any
from uuid import UUID

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from supabase import Client, create_client

from app.core.config import get_settings
from app.core.errors import BadRequest, NotFound

_IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")

# (table, embed) -> FK on the current table (many-to-one)
_MANY_TO_ONE = {
    ("profiles", "roles"): "role_id",
    ("invoices", "customers"): "customer_id",
    ("invoices", "suppliers"): "supplier_id",
    ("quotes", "customers"): "customer_id",
    ("sales_orders", "customers"): "customer_id",
    ("purchase_orders", "suppliers"): "supplier_id",
    ("products", "categories"): "category_id",
    ("products", "suppliers"): "supplier_id",
    ("payments", "customers"): "customer_id",
    ("payments", "suppliers"): "supplier_id",
    ("payments", "invoices"): "invoice_id",
    ("invoice_items", "invoices"): "invoice_id",
    ("role_permissions", "permissions"): "permission_id",
    ("documents", "profiles"): "uploaded_by",
    ("audit_logs", "profiles"): "user_id",
    ("tasks", "profiles"): "assignee_id",
    ("tasks", "employees"): "employee_id",
    ("stock_movements", "products"): "product_id",
    ("stock_movements", "warehouses"): "warehouse_id",
}

# (table, embed) -> FK on the child table (one-to-many)
_ONE_TO_MANY = {
    ("roles", "role_permissions"): "role_id",
    ("quotes", "quote_items"): "quote_id",
    ("sales_orders", "sales_order_items"): "sales_order_id",
    ("purchase_orders", "purchase_order_items"): "purchase_order_id",
    ("invoices", "invoice_items"): "invoice_id",
    ("deliveries", "delivery_items"): "delivery_id",
}


def _ident(name: str) -> str:
    if not _IDENT.match(name):
        raise BadRequest("Identifiant SQL invalide.")
    return name


def _jsonable(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, memoryview):
        return bytes(value)
    if isinstance(value, dict):
        return {k: _jsonable(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_jsonable(v) for v in value]
    return value


def _adapt(value: Any) -> Any:
    if isinstance(value, (dict, list)):
        return Jsonb(value)
    return value


def _row(data: dict) -> dict:
    return {k: _jsonable(v) for k, v in data.items()}


def connect_pg():
    settings = get_settings()
    if not settings.database_url:
        raise BadRequest("DATABASE_URL manquant.")
    return psycopg.connect(settings.database_url, prepare_threshold=None, row_factory=dict_row)


def execute_sql(sql: str, params: list | tuple | None = None) -> list[dict]:
    with connect_pg() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params or [])
            if cur.description is None:
                return []
            return [_row(r) for r in cur.fetchall()]


def confirm_auth_user(user_id: str) -> None:
    execute_sql(
        """
        update auth.users
        set email_confirmed_at = coalesce(email_confirmed_at, now())
        where id = %s::uuid
        """,
        [user_id],
    )


def parse_select(spec: str) -> tuple[list[str], list[tuple[str, str]]]:
    spec = (spec or "*").strip()
    cols: list[str] = []
    embeds: list[tuple[str, str]] = []
    i = 0
    n = len(spec)
    token = ""
    while i < n:
        ch = spec[i]
        if ch == "," and token.count("(") == token.count(")"):
            piece = token.strip()
            if piece:
                _add_select_piece(piece, cols, embeds)
            token = ""
            i += 1
            continue
        token += ch
        i += 1
    piece = token.strip()
    if piece:
        _add_select_piece(piece, cols, embeds)
    return cols or ["*"], embeds


def _add_select_piece(piece: str, cols: list[str], embeds: list[tuple[str, str]]) -> None:
    if "(" in piece and piece.endswith(")"):
        name, rest = piece.split("(", 1)
        embeds.append((name.strip(), rest[:-1].strip() or "*"))
    else:
        cols.append(piece)


def _guess_fk(embed: str) -> str:
    if embed.endswith("ies"):
        return embed[:-3] + "y_id"
    if embed.endswith("s"):
        return embed[:-1] + "_id"
    return embed + "_id"


def _hydrate(table: str, rows: list[dict], embeds: list[tuple[str, str]]) -> list[dict]:
    if not rows or not embeds:
        return rows
    ids = [r.get("id") for r in rows if r.get("id")]
    for name, inner in embeds:
        inner_cols, inner_embeds = parse_select(inner)
        otm = _ONE_TO_MANY.get((table, name))
        if otm:
            related = []
            if ids:
                placeholders = ",".join(["%s"] * len(ids))
                select_sql = "*" if inner_cols == ["*"] else ", ".join(_ident(c) for c in inner_cols if c != "*")
                if select_sql != "*" and otm not in inner_cols and "id" not in inner_cols:
                    select_sql = f"{select_sql}, {_ident(otm)}"
                related = execute_sql(
                    f"select {select_sql} from public.{_ident(name)} where {_ident(otm)} in ({placeholders})",
                    ids,
                )
                related = _hydrate(name, related, inner_embeds)
            grouped: dict[str, list] = {}
            for item in related:
                grouped.setdefault(str(item.get(otm)), []).append(item)
            for row in rows:
                row[name] = grouped.get(str(row.get("id")), [])
            continue

        fk = _MANY_TO_ONE.get((table, name), _guess_fk(name))
        fk_ids = [r.get(fk) for r in rows if r.get(fk)]
        related_map: dict[str, dict] = {}
        if fk_ids:
            placeholders = ",".join(["%s"] * len(fk_ids))
            select_sql = "*" if inner_cols == ["*"] else ", ".join(_ident(c) for c in inner_cols if c != "*")
            if select_sql != "*" and "id" not in inner_cols:
                select_sql = f"id, {select_sql}"
            fetched = execute_sql(
                f"select {select_sql} from public.{_ident(name)} where id in ({placeholders})",
                fk_ids,
            )
            fetched = _hydrate(name, fetched, inner_embeds)
            related_map = {str(item["id"]): item for item in fetched}
        for row in rows:
            key = row.get(fk)
            row[name] = related_map.get(str(key)) if key else None
    return rows


class QueryResult:
    def __init__(self, data: Any, count: int | None = None):
        self.data = data
        self.count = count


class PgQuery:
    def __init__(self, table: str):
        self.table = _ident(table)
        self._select = "*"
        self._count = False
        self._ops: list[tuple[str, str, Any]] = []
        self._or: str | None = None
        self._order: str | None = None
        self._desc = True
        self._limit: int | None = None
        self._offset: int | None = None
        self._insert: Any = None
        self._update: Any = None
        self._delete = False

    def select(self, cols: str = "*", count: str | None = None):
        self._select = cols
        self._count = count == "exact"
        return self

    def eq(self, key: str, value: Any):
        self._ops.append((_ident(key), "=", value))
        return self

    def neq(self, key: str, value: Any):
        self._ops.append((_ident(key), "<>", value))
        return self

    def gte(self, key: str, value: Any):
        self._ops.append((_ident(key), ">=", value))
        return self

    def lte(self, key: str, value: Any):
        self._ops.append((_ident(key), "<=", value))
        return self

    def in_(self, key: str, values: list[Any]):
        self._ops.append((_ident(key), "in", list(values)))
        return self

    def or_(self, pattern: str):
        self._or = pattern
        return self

    def order(self, col: str, desc: bool = False):
        self._order = _ident(col)
        self._desc = desc
        return self

    def limit(self, n: int):
        self._limit = int(n)
        return self

    def range(self, start: int, end: int):
        self._offset = int(start)
        self._limit = int(end) - int(start) + 1
        return self

    def insert(self, payload: dict | list[dict]):
        self._insert = payload
        return self

    def update(self, payload: dict):
        self._update = payload
        return self

    def delete(self):
        self._delete = True
        return self

    def _where(self) -> tuple[str, list[Any]]:
        clauses: list[str] = []
        params: list[Any] = []
        for key, op, value in self._ops:
            if op == "in":
                if not value:
                    clauses.append("false")
                    continue
                placeholders = ",".join(["%s"] * len(value))
                clauses.append(f"{key} in ({placeholders})")
                params.extend(value)
            else:
                clauses.append(f"{key} {op} %s")
                params.append(value)
        if self._or:
            or_parts: list[str] = []
            for part in re.split(r",(?=[A-Za-z_]+\.)", self._or):
                m = re.match(r"([A-Za-z_][A-Za-z0-9_]*)\.(\w+)\.(.*)$", part.strip())
                if not m:
                    continue
                col, operator, raw = m.group(1), m.group(2).lower(), m.group(3)
                _ident(col)
                if operator == "ilike":
                    or_parts.append(f"{col} ilike %s")
                    params.append(raw)
                elif operator == "eq":
                    or_parts.append(f"{col} = %s")
                    params.append(raw)
                elif operator == "neq":
                    or_parts.append(f"{col} <> %s")
                    params.append(raw)
            if or_parts:
                clauses.append("(" + " or ".join(or_parts) + ")")
        if not clauses:
            return "", params
        return " where " + " and ".join(clauses), params

    def execute(self) -> QueryResult:
        if self._insert is not None:
            return QueryResult(self._run_insert(self._insert))
        if self._update is not None:
            return QueryResult(self._run_update(self._update))
        if self._delete:
            where, params = self._where()
            execute_sql(f"delete from public.{self.table}{where}", params)
            return QueryResult([])

        cols, embeds = parse_select(self._select)
        select_sql = "*" if cols == ["*"] else ", ".join(_ident(c) if c != "*" else "*" for c in cols)
        where, params = self._where()
        count = None
        if self._count:
            counted = execute_sql(f"select count(*) as n from public.{self.table}{where}", params)
            count = int(counted[0]["n"]) if counted else 0
        sql = f"select {select_sql} from public.{self.table}{where}"
        if self._order:
            sql += f" order by {self._order} {'desc' if self._desc else 'asc'}"
        if self._limit is not None:
            sql += " limit %s"
            params = [*params, self._limit]
        if self._offset:
            sql += " offset %s"
            params = [*params, self._offset]
        rows = execute_sql(sql, params)
        rows = _hydrate(self.table, rows, embeds)
        return QueryResult(rows, count)

    def _run_insert(self, payload: dict | list[dict]) -> list[dict]:
        rows_in = payload if isinstance(payload, list) else [payload]
        out: list[dict] = []
        for item in rows_in:
            data = {k: v for k, v in item.items() if v is not None}
            if not data:
                continue
            cols = [_ident(k) for k in data]
            values = [_adapt(v) for v in data.values()]
            placeholders = ",".join(["%s"] * len(values))
            inserted = execute_sql(
                f"insert into public.{self.table} ({', '.join(cols)}) values ({placeholders}) returning *",
                values,
            )
            out.extend(inserted)
        return out

    def _run_update(self, payload: dict) -> list[dict]:
        data = {k: v for k, v in payload.items() if v is not None}
        where, params = self._where()
        if not data:
            return execute_sql(f"select * from public.{self.table}{where}", params)
        assigns = ", ".join(f"{_ident(k)} = %s" for k in data)
        values = [_adapt(v) for v in data.values()]
        return execute_sql(
            f"update public.{self.table} set {assigns}{where} returning *",
            [*values, *params],
        )


class HybridClient:
    def __init__(self, supabase: Client):
        self._sb = supabase
        self.auth = supabase.auth
        self.storage = supabase.storage

    def table(self, name: str) -> PgQuery:
        return PgQuery(name)


@lru_cache
def get_auth_client() -> Client:
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_anon_key)


@lru_cache
def get_admin_client() -> HybridClient:
    return HybridClient(get_auth_client())


def unwrap(result: Any) -> list[dict]:
    data = getattr(result, "data", result)
    if data is None:
        return []
    if isinstance(data, list):
        return data
    return [data]


def one(result: Any, message: str = "Ressource introuvable.") -> dict:
    rows = unwrap(result)
    if not rows:
        raise NotFound(message)
    return rows[0]


class Table:
    def __init__(self, name: str):
        self.name = name
        self.db = get_admin_client()

    def q(self):
        return self.db.table(self.name)

    def get(self, id: str) -> dict:
        return one(self.q().select("*").eq("id", id).limit(1).execute())

    def insert(self, payload: dict) -> dict:
        return one(self.q().insert(payload).execute(), "Création impossible.")

    def update(self, id: str, payload: dict) -> dict:
        return one(self.q().update(payload).eq("id", id).execute(), "Mise à jour impossible.")

    def delete(self, id: str) -> None:
        self.q().delete().eq("id", id).execute()

    def list(
        self,
        *,
        select: str = "*",
        filters: dict[str, Any] | None = None,
        search: str | None = None,
        search_columns: list[str] | None = None,
        order: str = "created_at",
        desc: bool = True,
        page: int = 1,
        page_size: int = 20,
        extra: Any | None = None,
        gte: dict[str, Any] | None = None,
        lte: dict[str, Any] | None = None,
    ) -> tuple[list[dict], int]:
        page = max(page, 1)
        page_size = min(max(page_size, 1), 100)
        start = (page - 1) * page_size
        end = start + page_size - 1

        query = self.q().select(select, count="exact")
        if filters:
            for key, value in filters.items():
                if value is None or value == "":
                    continue
                query = query.eq(key, value)
        if gte:
            for key, value in gte.items():
                if value:
                    query = query.gte(key, value)
        if lte:
            for key, value in lte.items():
                if value:
                    query = query.lte(key, value)
        if search and search_columns:
            pattern = ",".join(f"{col}.ilike.%{search}%" for col in search_columns)
            query = query.or_(pattern)
        if extra:
            query = extra(query)
        query = query.order(order, desc=desc).range(start, end)
        result = query.execute()
        total = result.count or 0
        return unwrap(result), total


def next_document_number(prefix_field: str, next_field: str) -> str:
    client = get_admin_client()
    row = one(client.table("company_settings").select("*").limit(1).execute(), "Paramètres entreprise introuvables.")
    prefix = row.get(prefix_field) or "DOC"
    current = int(row.get(next_field) or 1)
    number = f"{prefix}-{current:05d}"
    client.table("company_settings").update({next_field: current + 1}).eq("id", row["id"]).execute()
    return number


def company() -> dict:
    return one(get_admin_client().table("company_settings").select("*").limit(1).execute())


def audit(user_id: str | None, action: str, entity: str, entity_id: str | None, new_data: Any = None) -> None:
    try:
        get_admin_client().table("audit_logs").insert(
            {
                "user_id": user_id,
                "action": action,
                "entity": entity,
                "entity_id": entity_id,
                "new_data": new_data,
            }
        ).execute()
    except Exception:
        pass
