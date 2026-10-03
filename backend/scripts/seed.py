"""Génère des données de démonstration clairement marquées is_demo=true."""
from __future__ import annotations

import os
import sys
from datetime import date, timedelta
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
sys.path.insert(0, str(ROOT))

from app.services.commerce import create_document, register_payment  # noqa: E402
from app.services.inventory import create_movement  # noqa: E402


def client():
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])


def first_user(db):
    rows = db.table("profiles").select("id").limit(1).execute().data
    if not rows:
        raise SystemExit("Créez d'abord un compte via /register avant de lancer le seed.")
    return rows[0]["id"]


def upsert_many(db, table: str, rows: list[dict]) -> list[dict]:
    created = []
    for row in rows:
        created.append(db.table(table).insert(row).execute().data[0])
    return created


def run() -> None:
    db = client()
    user_id = first_user(db)

    customers = upsert_many(
        db,
        "customers",
        [
            {"name": "Atlas Distribution", "company_name": "Atlas Distribution SARL", "email": "contact@atlas-demo.ma", "phone": "+212 522 000 111", "city": "Casablanca", "country": "MA", "tax_id": "001234567000012", "status": "active", "is_demo": True, "created_by": user_id},
            {"name": "Oasis Retail", "company_name": "Oasis Retail", "email": "achat@oasis-demo.ma", "phone": "+212 524 000 222", "city": "Marrakech", "country": "MA", "status": "active", "is_demo": True, "created_by": user_id},
            {"name": "Nord Logistique", "email": "ops@nord-demo.ma", "city": "Tanger", "country": "MA", "status": "active", "is_demo": True, "created_by": user_id},
        ],
    )
    suppliers = upsert_many(
        db,
        "suppliers",
        [
            {"name": "Maghreb Supplies", "email": "hello@maghreb-demo.ma", "city": "Casablanca", "country": "MA", "status": "active", "is_demo": True, "created_by": user_id},
            {"name": "Euro Components", "email": "sales@euro-demo.eu", "city": "Madrid", "country": "ES", "status": "active", "is_demo": True, "created_by": user_id},
        ],
    )
    categories = upsert_many(
        db,
        "categories",
        [
            {"name": "Informatique", "slug": "informatique"},
            {"name": "Mobilier", "slug": "mobilier"},
            {"name": "Consommables", "slug": "consommables"},
        ],
    )
    products = upsert_many(
        db,
        "products",
        [
            {"sku": "NB-140", "name": "Ordinateur portable 14\"", "category_id": categories[0]["id"], "purchase_price": 6200, "sale_price": 8490, "tax_rate": 20, "unit": "unité", "min_stock": 3, "supplier_id": suppliers[1]["id"], "status": "active", "is_demo": True, "created_by": user_id},
            {"sku": "MN-27", "name": "Écran 27\" 4K", "category_id": categories[0]["id"], "purchase_price": 2100, "sale_price": 3290, "tax_rate": 20, "unit": "unité", "min_stock": 5, "supplier_id": suppliers[1]["id"], "status": "active", "is_demo": True, "created_by": user_id},
            {"sku": "CHR-ERG", "name": "Chaise ergonomique", "category_id": categories[1]["id"], "purchase_price": 890, "sale_price": 1490, "tax_rate": 20, "unit": "unité", "min_stock": 4, "supplier_id": suppliers[0]["id"], "status": "active", "is_demo": True, "created_by": user_id},
            {"sku": "PAP-A4", "name": "Ramette papier A4", "category_id": categories[2]["id"], "purchase_price": 38, "sale_price": 59, "tax_rate": 20, "unit": "unité", "min_stock": 20, "supplier_id": suppliers[0]["id"], "status": "active", "is_demo": True, "created_by": user_id},
        ],
    )

    for product, q in zip(products, [12, 8, 6, 40]):
        create_movement(
            {"product_id": product["id"], "movement_type": "in", "quantity": q, "notes": "Stock initial démo", "reference_type": "seed"},
            user_id,
            is_demo=True,
        )

    quote = create_document(
        "quotes",
        {
            "customer_id": customers[0]["id"],
            "items": [
                {"product_id": products[0]["id"], "description": products[0]["name"], "quantity": 2, "unit_price": 8490, "tax_rate": 20},
                {"product_id": products[1]["id"], "description": products[1]["name"], "quantity": 2, "unit_price": 3290, "tax_rate": 20},
            ],
        },
        user_id,
    )
    db.table("quotes").update({"is_demo": True, "status": "accepted"}).eq("id", quote["id"]).execute()

    order = create_document(
        "sales_orders",
        {
            "customer_id": customers[1]["id"],
            "items": [
                {"product_id": products[2]["id"], "description": products[2]["name"], "quantity": 4, "unit_price": 1490, "tax_rate": 20},
            ],
        },
        user_id,
    )
    db.table("sales_orders").update({"is_demo": True, "status": "confirmed"}).eq("id", order["id"]).execute()

    invoice = create_document(
        "invoices",
        {
            "invoice_type": "sales",
            "customer_id": customers[0]["id"],
            "items": [
                {"product_id": products[0]["id"], "description": products[0]["name"], "quantity": 1, "unit_price": 8490, "tax_rate": 20},
                {"product_id": products[3]["id"], "description": products[3]["name"], "quantity": 10, "unit_price": 59, "tax_rate": 20},
            ],
        },
        user_id,
    )
    db.table("invoices").update({"is_demo": True, "status": "sent", "due_date": str(date.today() + timedelta(days=15))}).eq("id", invoice["id"]).execute()
    register_payment(
        {"payment_type": "customer", "amount": 4000, "method": "transfer", "invoice_id": invoice["id"], "customer_id": customers[0]["id"], "reference": "VIR-DEMO-001"},
        user_id,
    )
    db.table("payments").update({"is_demo": True}).eq("invoice_id", invoice["id"]).execute()

    po = create_document(
        "purchase_orders",
        {
            "supplier_id": suppliers[0]["id"],
            "items": [
                {"product_id": products[3]["id"], "description": products[3]["name"], "quantity": 50, "unit_price": 38, "tax_rate": 20},
            ],
        },
        user_id,
    )
    db.table("purchase_orders").update({"is_demo": True, "status": "confirmed"}).eq("id", po["id"]).execute()

    for cat, amount in [("rent", 8500), ("software", 1200), ("marketing", 2400), ("electricity", 980)]:
        db.table("expenses").insert(
            {
                "category": cat,
                "amount": amount,
                "expense_date": str(date.today().replace(day=1)),
                "description": f"Dépense démo — {cat}",
                "is_demo": True,
                "created_by": user_id,
            }
        ).execute()

    db.table("employees").insert(
        {
            "first_name": "Sara",
            "last_name": "Benali",
            "email": "sara.benali@demo.nova",
            "position": "Responsable commerciale",
            "department": "Ventes",
            "hire_date": str(date.today() - timedelta(days=400)),
            "status": "active",
            "is_demo": True,
        }
    ).execute()
    db.table("tasks").insert(
        [
            {"title": "Relancer Atlas Distribution", "priority": "high", "status": "todo", "due_date": str(date.today() + timedelta(days=2)), "assignee_id": user_id, "is_demo": True, "created_by": user_id},
            {"title": "Préparer inventaire Q4", "priority": "medium", "status": "in_progress", "due_date": str(date.today() + timedelta(days=10)), "assignee_id": user_id, "is_demo": True, "created_by": user_id},
            {"title": "Clôturer factures en retard", "priority": "urgent", "status": "todo", "due_date": str(date.today()), "assignee_id": user_id, "is_demo": True, "created_by": user_id},
        ]
    ).execute()

    print("Données de démonstration créées. Elles sont marquées is_demo=true et peuvent être purgées depuis Paramètres.")


if __name__ == "__main__":
    run()
