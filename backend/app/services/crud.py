from typing import Any

from app.repositories.db import Table, audit


def list_rows(
    table: str,
    *,
    page: int,
    page_size: int,
    search: str | None,
    search_columns: list[str],
    filters: dict | None = None,
    select: str = "*",
    order: str = "created_at",
    gte: dict | None = None,
    lte: dict | None = None,
):
    items, total = Table(table).list(
        select=select,
        filters=filters,
        search=search,
        search_columns=search_columns,
        page=page,
        page_size=page_size,
        order=order,
        gte=gte,
        lte=lte,
    )
    return {"items": items, "total": total, "page": page, "page_size": page_size}


def get_row(table: str, id: str, select: str = "*") -> dict:
    return Table(table).get(id) if select == "*" else __import__(
        "app.repositories.db", fromlist=["one"]
    ).one(Table(table).q().select(select).eq("id", id).limit(1).execute())


def create_row(table: str, payload: dict, user_id: str | None = None) -> dict:
    data = {k: v for k, v in payload.items() if v is not None}
    if user_id and "created_by" not in data:
        # only if column exists — safe for most business tables
        if table in {
            "customers",
            "suppliers",
            "products",
            "quotes",
            "sales_orders",
            "purchase_orders",
            "invoices",
            "payments",
            "expenses",
            "tasks",
            "stock_movements",
        }:
            data["created_by"] = user_id
    row = Table(table).insert(data)
    audit(user_id, "create", table, row.get("id"), data)
    return row


def update_row(table: str, id: str, payload: dict, user_id: str | None = None) -> dict:
    data = {k: v for k, v in payload.items() if v is not None}
    row = Table(table).update(id, data)
    audit(user_id, "update", table, id, data)
    return row


def delete_row(table: str, id: str, user_id: str | None = None) -> None:
    Table(table).delete(id)
    audit(user_id, "delete", table, id)


def party_balance(party_id: str, party_field: str, invoice_type: str) -> dict:
    from app.repositories.db import get_admin_client, unwrap

    db = get_admin_client()
    invoices = unwrap(
        db.table("invoices")
        .select("id, total, paid_amount, status")
        .eq(party_field, party_id)
        .eq("invoice_type", invoice_type)
        .neq("status", "cancelled")
        .execute()
    )
    invoiced = sum(float(i.get("total") or 0) for i in invoices)
    paid = sum(float(i.get("paid_amount") or 0) for i in invoices)
    return {
        "invoiced": invoiced,
        "paid": paid,
        "balance": round(invoiced - paid, 2),
        "open_invoices": len([i for i in invoices if i.get("status") not in ("paid", "draft")]),
    }


def history(table: str, filters: dict[str, Any], select: str = "*") -> list[dict]:
    from app.repositories.db import unwrap

    q = Table(table).q().select(select)
    for k, v in filters.items():
        q = q.eq(k, v)
    return unwrap(q.order("created_at", desc=True).limit(50).execute())
