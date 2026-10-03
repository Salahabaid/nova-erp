from datetime import date

from app.core.errors import BadRequest
from app.repositories.db import Table, audit, get_admin_client, next_document_number, one, unwrap
from app.utils.money import apply_document_discount, compute_lines, invoice_status, money


ITEM_TABLE = {
    "quotes": ("quote_items", "quote_id", "quote_prefix", "quote_next_number"),
    "sales_orders": ("sales_order_items", "sales_order_id", "sales_order_prefix", "sales_order_next_number"),
    "purchase_orders": ("purchase_order_items", "purchase_order_id", "purchase_prefix", "purchase_next_number"),
    "invoices": ("invoice_items", "invoice_id", "invoice_prefix", "invoice_next_number"),
}


def _party_field(table: str, payload: dict) -> None:
    if table in {"quotes", "sales_orders"} and not payload.get("customer_id"):
        raise BadRequest("Un client est requis.")
    if table == "purchase_orders" and not payload.get("supplier_id"):
        raise BadRequest("Un fournisseur est requis.")
    if table == "invoices":
        itype = payload.get("invoice_type") or "sales"
        if itype == "sales" and not payload.get("customer_id"):
            raise BadRequest("Un client est requis.")
        if itype == "purchase" and not payload.get("supplier_id"):
            raise BadRequest("Un fournisseur est requis.")


def create_document(table: str, payload: dict, user_id: str | None, extra: dict | None = None) -> dict:
    items_table, fk, prefix_f, next_f = ITEM_TABLE[table]
    _party_field(table, payload)
    items_in = [i if isinstance(i, dict) else i.model_dump() for i in payload.get("items") or []]
    if not items_in:
        raise BadRequest("Ajoutez au moins une ligne.")
    lines, totals = compute_lines(items_in)
    totals = apply_document_discount(totals, payload.get("discount") or 0)
    number = next_document_number(prefix_f, next_f)
    header = {
        "number": number,
        "status": "draft",
        "issue_date": str(payload.get("issue_date") or date.today()),
        "discount": totals["discount"],
        "subtotal": totals["subtotal"],
        "tax_amount": totals["tax_amount"],
        "total": totals["total"],
        "notes": payload.get("notes"),
        "created_by": user_id,
    }
    if table in {"quotes", "sales_orders"} or (table == "invoices" and (payload.get("invoice_type") or "sales") == "sales"):
        header["customer_id"] = payload.get("customer_id")
    if table == "quotes":
        header["valid_until"] = str(payload["valid_until"]) if payload.get("valid_until") else None
    if table == "sales_orders":
        header["delivery_date"] = str(payload["delivery_date"]) if payload.get("delivery_date") else None
        header["quote_id"] = payload.get("quote_id")
    if table == "purchase_orders":
        header["supplier_id"] = payload.get("supplier_id")
        header["expected_date"] = str(payload["expected_date"]) if payload.get("expected_date") else None
    if table == "invoices":
        header["invoice_type"] = payload.get("invoice_type") or "sales"
        header["supplier_id"] = payload.get("supplier_id")
        header["sales_order_id"] = payload.get("sales_order_id")
        header["purchase_order_id"] = payload.get("purchase_order_id")
        header["due_date"] = str(payload["due_date"]) if payload.get("due_date") else None
        header["paid_amount"] = 0
    if extra:
        header.update(extra)
    header = {k: v for k, v in header.items() if v is not None}
    doc = Table(table).insert(header)
    for line in lines:
        line[fk] = doc["id"]
        line.pop("id", None)
        Table(items_table).insert(line)
    audit(user_id, "create", table, doc["id"], header)
    return get_document(table, doc["id"])


def get_document(table: str, id: str) -> dict:
    items_table, fk, *_ = ITEM_TABLE[table]
    embeds = {
        "quotes": "*, customers(*), quote_items(*)",
        "sales_orders": "*, customers(*), sales_order_items(*)",
        "purchase_orders": "*, suppliers(*), purchase_order_items(*)",
        "invoices": "*, customers(*), suppliers(*), invoice_items(*)",
    }
    return one(Table(table).q().select(embeds[table]).eq("id", id).limit(1).execute())


def update_document(table: str, id: str, payload: dict, user_id: str | None) -> dict:
    db = get_admin_client()
    current = Table(table).get(id)
    if current.get("status") not in ("draft",):
        if "status" in payload and len(payload) <= 2:
            return set_status(table, id, payload["status"], user_id)
        raise BadRequest("Seul un document en brouillon peut être modifié.")
    items_table, fk, *_ = ITEM_TABLE[table]
    data = {k: v for k, v in payload.items() if k != "items" and v is not None}
    if payload.get("items"):
        items_in = [i if isinstance(i, dict) else i.model_dump() for i in payload["items"]]
        lines, totals = compute_lines(items_in)
        totals = apply_document_discount(totals, payload.get("discount") or current.get("discount") or 0)
        data.update(totals)
        db.table(items_table).delete().eq(fk, id).execute()
        for line in lines:
            line[fk] = id
            line.pop("id", None)
            Table(items_table).insert(line)
    for key in ("issue_date", "valid_until", "expected_date", "due_date", "delivery_date"):
        if key in data and data[key] is not None:
            data[key] = str(data[key])
    Table(table).update(id, data)
    audit(user_id, "update", table, id, data)
    return get_document(table, id)


def set_status(table: str, id: str, status: str, user_id: str | None) -> dict:
    Table(table).update(id, {"status": status})
    audit(user_id, "status", table, id, {"status": status})
    return get_document(table, id)


def convert_quote_to_order(quote_id: str, user_id: str | None) -> dict:
    quote = get_document("quotes", quote_id)
    if quote["status"] in ("converted", "cancelled"):
        raise BadRequest("Ce devis ne peut pas être converti.")
    items = quote.get("quote_items") or []
    order = create_document(
        "sales_orders",
        {
            "customer_id": quote["customer_id"],
            "quote_id": quote_id,
            "discount": quote.get("discount") or 0,
            "notes": quote.get("notes"),
            "items": items,
        },
        user_id,
    )
    Table("quotes").update(quote_id, {"status": "converted", "converted_to_order_id": order["id"]})
    return get_document("sales_orders", order["id"])


def convert_order_to_invoice(order_id: str, user_id: str | None) -> dict:
    order = get_document("sales_orders", order_id)
    if order["status"] in ("cancelled", "invoiced"):
        raise BadRequest("Cette commande ne peut pas être facturée.")
    items = order.get("sales_order_items") or []
    invoice = create_document(
        "invoices",
        {
            "invoice_type": "sales",
            "customer_id": order["customer_id"],
            "sales_order_id": order_id,
            "discount": order.get("discount") or 0,
            "notes": order.get("notes"),
            "items": items,
        },
        user_id,
    )
    Table("sales_orders").update(order_id, {"status": "invoiced", "converted_to_invoice_id": invoice["id"]})
    return get_document("invoices", invoice["id"])


def duplicate_invoice(invoice_id: str, user_id: str | None) -> dict:
    inv = get_document("invoices", invoice_id)
    return create_document(
        "invoices",
        {
            "invoice_type": inv.get("invoice_type") or "sales",
            "customer_id": inv.get("customer_id"),
            "supplier_id": inv.get("supplier_id"),
            "discount": inv.get("discount") or 0,
            "notes": inv.get("notes"),
            "items": inv.get("invoice_items") or [],
        },
        user_id,
    )


def register_payment(payload: dict, user_id: str | None) -> dict:
    data = {k: v for k, v in payload.items() if v is not None}
    data["created_by"] = user_id
    if data.get("payment_date"):
        data["payment_date"] = str(data["payment_date"])
    payment = Table("payments").insert(data)
    if data.get("invoice_id"):
        _sync_invoice_payment(data["invoice_id"])
        _notify_payment(data["invoice_id"], user_id)
    if data.get("payment_type") == "expense" and not data.get("invoice_id"):
        pass
    audit(user_id, "create", "payments", payment["id"], data)
    return payment


def _sync_invoice_payment(invoice_id: str) -> None:
    db = get_admin_client()
    invoice = Table("invoices").get(invoice_id)
    pays = unwrap(db.table("payments").select("amount").eq("invoice_id", invoice_id).execute())
    paid = money(sum(float(p["amount"]) for p in pays))
    status = invoice_status(float(invoice["total"]), paid, invoice.get("due_date"), invoice.get("status") or "sent")
    Table("invoices").update(invoice_id, {"paid_amount": paid, "status": status})


def _notify_payment(invoice_id: str, user_id: str | None) -> None:
    db = get_admin_client()
    invoice = Table("invoices").get(invoice_id)
    targets = unwrap(db.table("profiles").select("id").eq("status", "active").execute())
    for p in targets[:15]:
        db.table("notifications").insert(
            {
                "user_id": p["id"],
                "type": "payment_received",
                "title": "Paiement enregistré",
                "message": f"Paiement sur la facture {invoice.get('number')}",
                "related_type": "invoices",
                "related_id": invoice_id,
            }
        ).execute()


def create_expense(payload: dict, user_id: str | None) -> dict:
    data = {k: v for k, v in payload.items() if v is not None}
    data["created_by"] = user_id
    if data.get("expense_date"):
        data["expense_date"] = str(data["expense_date"])
    expense = Table("expenses").insert(data)
    payment = Table("payments").insert(
        {
            "payment_type": "expense",
            "amount": data["amount"],
            "payment_date": data.get("expense_date") or str(date.today()),
            "method": "other",
            "notes": data.get("description"),
            "created_by": user_id,
        }
    )
    Table("expenses").update(expense["id"], {"payment_id": payment["id"]})
    expense["payment_id"] = payment["id"]
    audit(user_id, "create", "expenses", expense["id"], data)
    return expense
