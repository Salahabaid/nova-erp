from fastapi import APIRouter

from app.core.deps import UserDep
from app.schemas.common import PartyIn
from app.services.crud import create_row, delete_row, get_row, history, list_rows, party_balance, update_row

customers = APIRouter(prefix="/customers", tags=["customers"])
suppliers = APIRouter(prefix="/suppliers", tags=["suppliers"])


def _party_routes(router: APIRouter, table: str, perm: str, party_field: str, invoice_type: str):
    @router.get("")
    def list_items(
        user: UserDep,
        page: int = 1,
        page_size: int = 20,
        search: str | None = None,
        status: str | None = None,
    ):
        user.require(f"{perm}.read")
        return list_rows(
            table,
            page=page,
            page_size=page_size,
            search=search,
            search_columns=["name", "company_name", "email", "phone", "city"],
            filters={"status": status},
        )

    @router.get("/{item_id}")
    def detail(item_id: str, user: UserDep):
        user.require(f"{perm}.read")
        row = get_row(table, item_id)
        row["balance"] = party_balance(item_id, party_field, invoice_type)
        if table == "customers":
            row["orders"] = history("sales_orders", {party_field: item_id}, "id, number, status, total, created_at")
            row["invoices"] = history("invoices", {party_field: item_id}, "id, number, status, total, paid_amount, created_at")
            row["payments"] = history("payments", {party_field: item_id}, "id, amount, method, payment_date, reference")
        else:
            row["orders"] = history("purchase_orders", {party_field: item_id}, "id, number, status, total, created_at")
            row["invoices"] = history("invoices", {party_field: item_id}, "id, number, status, total, paid_amount, created_at")
            row["payments"] = history("payments", {party_field: item_id}, "id, amount, method, payment_date, reference")
        return row

    @router.post("")
    def create(body: PartyIn, user: UserDep):
        user.require(f"{perm}.write")
        return create_row(table, body.model_dump(), user.id)

    @router.patch("/{item_id}")
    def update(item_id: str, body: PartyIn, user: UserDep):
        user.require(f"{perm}.write")
        return update_row(table, item_id, body.model_dump(), user.id)

    @router.delete("/{item_id}")
    def delete(item_id: str, user: UserDep):
        user.require(f"{perm}.delete")
        delete_row(table, item_id, user.id)
        return {"message": "Supprimé avec succès."}


_party_routes(customers, "customers", "customers", "customer_id", "sales")
_party_routes(suppliers, "suppliers", "suppliers", "supplier_id", "purchase")
