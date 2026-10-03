from app.repositories.db import get_admin_client, unwrap


def global_search(q: str) -> dict:
    term = (q or "").strip()
    if len(term) < 2:
        return {"customers": [], "suppliers": [], "products": [], "orders": [], "invoices": [], "payments": []}
    db = get_admin_client()
    like = f"%{term}%"

    def find(table: str, columns: list[str], select: str, limit: int = 5):
        query = db.table(table).select(select)
        query = query.or_(",".join(f"{c}.ilike.{like}" for c in columns))
        return unwrap(query.limit(limit).execute())

    return {
        "customers": find("customers", ["name", "company_name", "email"], "id, name, email, company_name"),
        "suppliers": find("suppliers", ["name", "company_name", "email"], "id, name, email, company_name"),
        "products": find("products", ["name", "sku"], "id, name, sku, sale_price"),
        "orders": find("sales_orders", ["number"], "id, number, total, status"),
        "invoices": find("invoices", ["number"], "id, number, total, status"),
        "payments": find("payments", ["reference", "notes"], "id, amount, method, reference, payment_date"),
    }
