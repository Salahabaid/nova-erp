from collections import defaultdict
from datetime import date, timedelta

from app.repositories.db import get_admin_client, unwrap


def _month_key(value: str | None) -> str:
    if not value:
        return ""
    return str(value)[:7]


def build() -> dict:
    db = get_admin_client()
    today = date.today()
    month_start = today.replace(day=1).isoformat()

    invoices = unwrap(
        db.table("invoices")
        .select("*")
        .neq("status", "cancelled")
        .execute()
    )
    sales_inv = [i for i in invoices if i.get("invoice_type") == "sales"]
    purch_inv = [i for i in invoices if i.get("invoice_type") == "purchase"]

    expenses = unwrap(db.table("expenses").select("*").execute())
    products = unwrap(db.table("products").select("id, name, sku, stock_quantity, min_stock, purchase_price, sale_price").execute())
    customers = unwrap(db.table("customers").select("id, name, created_at").execute())
    payments = unwrap(db.table("payments").select("*").order("created_at", desc=True).limit(8).execute())
    recent_sales = unwrap(
        db.table("sales_orders").select("id, number, total, status, created_at, customers(name)").order("created_at", desc=True).limit(6).execute()
    )
    recent_invoices = unwrap(
        db.table("invoices").select("id, number, total, status, invoice_type, created_at").order("created_at", desc=True).limit(6).execute()
    )
    recent_customers = sorted(customers, key=lambda c: c.get("created_at") or "", reverse=True)[:6]
    orders = unwrap(db.table("purchase_orders").select("id, number, total, status, created_at, suppliers(name)").order("created_at", desc=True).limit(6).execute())

    revenue = sum(float(i.get("paid_amount") or 0) for i in sales_inv)
    month_sales = sum(float(i.get("total") or 0) for i in sales_inv if (i.get("issue_date") or "") >= month_start)
    month_purchases = sum(float(i.get("total") or 0) for i in purch_inv if (i.get("issue_date") or "") >= month_start)
    month_expenses = sum(float(e.get("amount") or 0) for e in expenses if (e.get("expense_date") or "") >= month_start)
    receivables = sum(float(i.get("total") or 0) - float(i.get("paid_amount") or 0) for i in sales_inv if i.get("status") not in ("paid", "draft"))
    payables = sum(float(i.get("total") or 0) - float(i.get("paid_amount") or 0) for i in purch_inv if i.get("status") not in ("paid", "draft"))
    stock_value = sum(float(p.get("stock_quantity") or 0) * float(p.get("purchase_price") or 0) for p in products)
    profit = month_sales - month_purchases - month_expenses

    months = []
    cursor = (today.replace(day=1) - timedelta(days=180)).replace(day=1)
    while cursor <= today.replace(day=1):
        months.append(cursor.strftime("%Y-%m"))
        if cursor.month == 12:
            cursor = cursor.replace(year=cursor.year + 1, month=1)
        else:
            cursor = cursor.replace(month=cursor.month + 1)

    sales_by_month = defaultdict(float)
    purch_by_month = defaultdict(float)
    for i in sales_inv:
        sales_by_month[_month_key(i.get("issue_date"))] += float(i.get("total") or 0)
    for i in purch_inv:
        purch_by_month[_month_key(i.get("issue_date"))] += float(i.get("total") or 0)
    exp_by_cat = defaultdict(float)
    for e in expenses:
        exp_by_cat[e.get("category") or "other"] += float(e.get("amount") or 0)

    # top products from invoice items
    items = unwrap(db.table("invoice_items").select("product_id, description, quantity, line_total, invoices(invoice_type, status)").execute())
    top = defaultdict(lambda: {"name": "", "qty": 0.0, "amount": 0.0})
    for it in items:
        inv = it.get("invoices") or {}
        if inv.get("invoice_type") != "sales" or inv.get("status") == "cancelled":
            continue
        key = it.get("product_id") or it.get("description")
        top[key]["name"] = it.get("description") or "Produit"
        top[key]["qty"] += float(it.get("quantity") or 0)
        top[key]["amount"] += float(it.get("line_total") or 0)
    top_products = sorted(top.values(), key=lambda x: x["amount"], reverse=True)[:6]

    stock_series = [{"name": p["name"], "stock": float(p.get("stock_quantity") or 0)} for p in products[:12]]
    low_stock = [p for p in products if float(p.get("stock_quantity") or 0) <= float(p.get("min_stock") or 0)]

    revenue_series = [{"month": m, "revenue": round(sales_by_month[m], 2), "purchases": round(purch_by_month[m], 2), "profit": round(sales_by_month[m] - purch_by_month[m], 2)} for m in months]

    return {
        "kpis": {
            "revenue": round(revenue, 2),
            "month_sales": round(month_sales, 2),
            "month_purchases": round(month_purchases, 2),
            "profit": round(profit, 2),
            "expenses": round(month_expenses, 2),
            "receivables": round(receivables, 2),
            "payables": round(payables, 2),
            "customers": len(customers),
            "products": len(products),
            "stock_value": round(stock_value, 2),
        },
        "charts": {
            "revenue": revenue_series,
            "expenses_by_category": [{"name": k, "value": round(v, 2)} for k, v in exp_by_cat.items()],
            "top_products": top_products,
            "stock": stock_series,
        },
        "activity": {
            "sales": recent_sales,
            "orders": orders,
            "invoices": recent_invoices,
            "payments": payments,
            "customers": recent_customers,
            "stock_alerts": low_stock[:8],
        },
    }
