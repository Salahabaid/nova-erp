from collections import defaultdict
from io import BytesIO

from openpyxl import Workbook
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.repositories.db import get_admin_client, unwrap


def generate(kind: str, date_from: str | None, date_to: str | None, customer_id: str | None, product_id: str | None) -> dict:
    db = get_admin_client()
    rows: list[dict] = []
    title = kind

    if kind == "sales":
        q = db.table("invoices").select("*, customers(name)").eq("invoice_type", "sales").neq("status", "cancelled")
        if date_from:
            q = q.gte("issue_date", date_from)
        if date_to:
            q = q.lte("issue_date", date_to)
        if customer_id:
            q = q.eq("customer_id", customer_id)
        rows = unwrap(q.order("issue_date").execute())
        title = "Rapport des ventes"
    elif kind == "purchases":
        q = db.table("invoices").select("*, suppliers(name)").eq("invoice_type", "purchase").neq("status", "cancelled")
        if date_from:
            q = q.gte("issue_date", date_from)
        if date_to:
            q = q.lte("issue_date", date_to)
        rows = unwrap(q.order("issue_date").execute())
        title = "Rapport des achats"
    elif kind == "expenses":
        q = db.table("expenses").select("*")
        if date_from:
            q = q.gte("expense_date", date_from)
        if date_to:
            q = q.lte("expense_date", date_to)
        rows = unwrap(q.order("expense_date").execute())
        title = "Rapport des dépenses"
    elif kind == "payments":
        q = db.table("payments").select("*")
        if date_from:
            q = q.gte("payment_date", date_from)
        if date_to:
            q = q.lte("payment_date", date_to)
        rows = unwrap(q.order("payment_date").execute())
        title = "Rapport des paiements"
    elif kind == "unpaid":
        rows = unwrap(
            db.table("invoices")
            .select("*, customers(name)")
            .eq("invoice_type", "sales")
            .in_("status", ["sent", "partially_paid", "overdue"])
            .execute()
        )
        title = "Factures impayées"
    elif kind == "stock":
        rows = unwrap(db.table("products").select("sku, name, stock_quantity, min_stock, purchase_price, sale_price, categories(name)").execute())
        title = "Valorisation du stock"
    elif kind == "customers":
        rows = unwrap(db.table("customers").select("*").execute())
        title = "Clients"
    elif kind == "suppliers":
        rows = unwrap(db.table("suppliers").select("*").execute())
        title = "Fournisseurs"
    elif kind == "profit":
        sales = unwrap(db.table("invoices").select("total, issue_date").eq("invoice_type", "sales").neq("status", "cancelled").execute())
        purch = unwrap(db.table("invoices").select("total, issue_date").eq("invoice_type", "purchase").neq("status", "cancelled").execute())
        exp = unwrap(db.table("expenses").select("amount, expense_date").execute())
        by = defaultdict(lambda: {"sales": 0.0, "purchases": 0.0, "expenses": 0.0})
        for i in sales:
            if date_from and (i.get("issue_date") or "") < date_from:
                continue
            if date_to and (i.get("issue_date") or "") > date_to:
                continue
            by[(i.get("issue_date") or "")[:7]]["sales"] += float(i.get("total") or 0)
        for i in purch:
            if date_from and (i.get("issue_date") or "") < date_from:
                continue
            if date_to and (i.get("issue_date") or "") > date_to:
                continue
            by[(i.get("issue_date") or "")[:7]]["purchases"] += float(i.get("total") or 0)
        for e in exp:
            if date_from and (e.get("expense_date") or "") < date_from:
                continue
            if date_to and (e.get("expense_date") or "") > date_to:
                continue
            by[(e.get("expense_date") or "")[:7]]["expenses"] += float(e.get("amount") or 0)
        rows = [
            {
                "month": m,
                "sales": round(v["sales"], 2),
                "purchases": round(v["purchases"], 2),
                "expenses": round(v["expenses"], 2),
                "profit": round(v["sales"] - v["purchases"] - v["expenses"], 2),
            }
            for m, v in sorted(by.items())
        ]
        title = "Rapport de rentabilité"
    else:
        rows = []

    totals = {}
    if rows and kind in {"sales", "purchases", "unpaid"}:
        totals = {
            "total": round(sum(float(r.get("total") or 0) for r in rows), 2),
            "paid": round(sum(float(r.get("paid_amount") or 0) for r in rows), 2),
        }
    if kind == "expenses":
        totals = {"total": round(sum(float(r.get("amount") or 0) for r in rows), 2)}
    if kind == "stock":
        totals = {
            "valuation": round(sum(float(r.get("stock_quantity") or 0) * float(r.get("purchase_price") or 0) for r in rows), 2)
        }

    return {"title": title, "kind": kind, "rows": rows, "totals": totals}


def to_csv(report: dict) -> bytes:
    rows = report["rows"]
    if not rows:
        return b""
    keys = list(rows[0].keys())
    lines = [";".join(keys)]
    for row in rows:
        lines.append(";".join(_cell(row.get(k)) for k in keys))
    return ("\ufeff" + "\n".join(lines)).encode("utf-8")


def to_xlsx(report: dict) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = report["kind"][:31]
    rows = report["rows"]
    if rows:
        keys = list(rows[0].keys())
        ws.append(keys)
        for row in rows:
            ws.append([_plain(row.get(k)) for k in keys])
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def to_pdf(report: dict) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, title=report["title"])
    styles = getSampleStyleSheet()
    story = [Paragraph(report["title"], styles["Title"]), Spacer(1, 12)]
    rows = report["rows"]
    if not rows:
        story.append(Paragraph("Aucune donnée.", styles["Normal"]))
    else:
        keys = list(rows[0].keys())[:7]
        data = [keys] + [[_cell(r.get(k))[:40] for k in keys] for r in rows[:40]]
        table = Table(data, repeatRows=1)
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0B1220")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E2E8F0")),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
                ]
            )
        )
        story.append(table)
    doc.build(story)
    return buf.getvalue()


def invoice_pdf(invoice: dict, company: dict) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, title=invoice.get("number"))
    styles = getSampleStyleSheet()
    party = invoice.get("customers") or invoice.get("suppliers") or {}
    story = [
        Paragraph(company.get("name") or "Nova ERP", styles["Title"]),
        Paragraph(f"Facture {invoice.get('number')}", styles["Heading2"]),
        Paragraph(f"Date : {invoice.get('issue_date')}", styles["Normal"]),
        Paragraph(f"Client / Fournisseur : {party.get('name') or '—'}", styles["Normal"]),
        Spacer(1, 16),
    ]
    items = invoice.get("invoice_items") or []
    data = [["Désignation", "Qté", "PU", "TVA", "Total HT"]]
    for it in items:
        data.append(
            [
                it.get("description") or "",
                str(it.get("quantity")),
                str(it.get("unit_price")),
                f"{it.get('tax_rate')}%",
                str(it.get("line_total")),
            ]
        )
    table = Table(data, repeatRows=1, colWidths=[240, 50, 70, 50, 80])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0B1220")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#CBD5E1")),
            ]
        )
    )
    story.append(table)
    story.append(Spacer(1, 16))
    story.append(Paragraph(f"Sous-total : {invoice.get('subtotal')}", styles["Normal"]))
    story.append(Paragraph(f"Remise : {invoice.get('discount')}", styles["Normal"]))
    story.append(Paragraph(f"TVA : {invoice.get('tax_amount')}", styles["Normal"]))
    story.append(Paragraph(f"<b>Total TTC : {invoice.get('total')}</b>", styles["Normal"]))
    story.append(Paragraph(f"Payé : {invoice.get('paid_amount')}", styles["Normal"]))
    doc.build(story)
    return buf.getvalue()


def _cell(value) -> str:
    if isinstance(value, dict):
        return value.get("name") or ""
    if value is None:
        return ""
    return str(value).replace(";", ",")


def _plain(value):
    if isinstance(value, dict):
        return value.get("name")
    return value
