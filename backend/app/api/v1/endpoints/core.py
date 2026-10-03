from fastapi import APIRouter, Query

from app.core.deps import UserDep
from app.repositories.db import Table, company, get_admin_client, unwrap
from app.schemas.common import CompanyUpdate, OnboardingIn
from app.services import dashboard as dashboard_service
from app.services import search as search_service

router = APIRouter(tags=["core"])


@router.get("/dashboard")
def dashboard(user: UserDep):
    user.require("dashboard.read")
    return dashboard_service.build()


@router.get("/search")
def search(user: UserDep, q: str = Query(min_length=1)):
    return search_service.global_search(q)


@router.get("/notifications")
def notifications(user: UserDep, unread_only: bool = False):
    user.require("notifications.read")
    q = Table("notifications").q().select("*").eq("user_id", user.id).order("created_at", desc=True).limit(40)
    if unread_only:
        q = q.eq("is_read", False)
    items = unwrap(q.execute())
    unread = len([n for n in items if not n.get("is_read")])
    return {"items": items, "unread": unread}


@router.post("/notifications/{notification_id}/read")
def read_notification(notification_id: str, user: UserDep):
    Table("notifications").q().update({"is_read": True}).eq("id", notification_id).eq("user_id", user.id).execute()
    return {"message": "Notification lue."}


@router.post("/notifications/read-all")
def read_all(user: UserDep):
    Table("notifications").q().update({"is_read": True}).eq("user_id", user.id).execute()
    return {"message": "Toutes les notifications ont été marquées comme lues."}


@router.post("/notifications/refresh")
def refresh_notifications(user: UserDep):
    """Génère les alertes métier (factures en retard, tâches proches)."""
    from datetime import date, timedelta

    db = get_admin_client()
    settings = unwrap(db.table("company_settings").select("*").limit(1).execute())
    prefs = settings[0] if settings else {}
    created = 0
    today = date.today().isoformat()
    soon = (date.today() + timedelta(days=2)).isoformat()

    existing = unwrap(
        db.table("notifications")
        .select("related_id, type")
        .eq("user_id", user.id)
        .eq("is_read", False)
        .execute()
    )
    seen = {(n.get("type"), n.get("related_id")) for n in existing}

    if prefs.get("notify_overdue_invoices", True):
        overdue = unwrap(
            db.table("invoices")
            .select("id, number, due_date")
            .eq("invoice_type", "sales")
            .in_("status", ["sent", "partially_paid", "overdue"])
            .lt("due_date", today)
            .execute()
        )
        for inv in overdue:
            if ("overdue_invoice", inv["id"]) in seen:
                continue
            db.table("notifications").insert(
                {
                    "user_id": user.id,
                    "type": "overdue_invoice",
                    "title": "Facture en retard",
                    "message": f"La facture {inv.get('number')} est échue.",
                    "related_type": "invoices",
                    "related_id": inv["id"],
                }
            ).execute()
            created += 1

    if prefs.get("notify_tasks", True):
        due = unwrap(
            db.table("tasks")
            .select("id, title, due_date")
            .in_("status", ["todo", "in_progress"])
            .lte("due_date", soon)
            .execute()
        )
        for task in due:
            if ("task_due", task["id"]) in seen:
                continue
            db.table("notifications").insert(
                {
                    "user_id": user.id,
                    "type": "task_due",
                    "title": "Tâche proche de l'échéance",
                    "message": task.get("title"),
                    "related_type": "tasks",
                    "related_id": task["id"],
                }
            ).execute()
            created += 1

    return {"created": created}


@router.get("/settings/company")
def get_company(user: UserDep):
    user.require("settings.read", "dashboard.read")
    return company()


@router.patch("/settings/company")
def update_company(body: CompanyUpdate, user: UserDep):
    user.require("settings.write")
    row = company()
    data = body.model_dump(exclude_none=True)
    return Table("company_settings").update(row["id"], data)


@router.post("/onboarding")
def onboarding(body: OnboardingIn, user: UserDep):
    row = company()
    data = body.model_dump(exclude_none=True)
    data["onboarding_completed"] = True
    return Table("company_settings").update(row["id"], data)


@router.post("/settings/demo/purge")
def purge_demo(user: UserDep):
    user.require("system.configure", "settings.write")
    db = get_admin_client()
    for table in [
        "delivery_items",
        "deliveries",
        "payments",
        "expenses",
        "invoice_items",
        "invoices",
        "sales_order_items",
        "sales_orders",
        "quote_items",
        "quotes",
        "purchase_order_items",
        "purchase_orders",
        "stock_movements",
        "tasks",
        "documents",
        "products",
        "customers",
        "suppliers",
        "employees",
    ]:
        try:
            db.table(table).delete().eq("is_demo", True).execute()
        except Exception:
            continue
    return {"message": "Données de démonstration supprimées."}


@router.get("/settings/audit")
def audit_logs(user: UserDep, page: int = 1, page_size: int = 30):
    user.require("users.manage", "system.configure")
    items, total = Table("audit_logs").list(
        select="*, profiles(first_name, last_name, email)",
        page=page,
        page_size=page_size,
    )
    return {"items": items, "total": total, "page": page, "page_size": page_size}
