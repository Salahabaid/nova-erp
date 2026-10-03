from fastapi import APIRouter
from fastapi.responses import Response

from app.core.deps import UserDep
from app.repositories.db import company
from app.schemas.common import DocumentIn, ExpenseIn, PaymentIn, ReceiveIn
from app.services import commerce
from app.services.crud import delete_row, list_rows, update_row
from app.services.inventory import deliver_sales, receive_purchase
from app.services.reports import invoice_pdf

quotes = APIRouter(prefix="/quotes", tags=["sales"])
orders = APIRouter(prefix="/sales-orders", tags=["sales"])
purchases = APIRouter(prefix="/purchases", tags=["purchases"])
invoices = APIRouter(prefix="/invoices", tags=["invoices"])
payments = APIRouter(prefix="/payments", tags=["payments"])
expenses = APIRouter(prefix="/expenses", tags=["expenses"])


def _list(table: str, user, page, page_size, search, status, extra_filters=None, select="*"):
    filters = {"status": status, **(extra_filters or {})}
    return list_rows(
        table,
        page=page,
        page_size=page_size,
        search=search,
        search_columns=["number"],
        filters=filters,
        select=select,
    )


@quotes.get("")
def list_quotes(user: UserDep, page: int = 1, page_size: int = 20, search: str | None = None, status: str | None = None):
    user.require("sales.read")
    return _list("quotes", user, page, page_size, search, status, select="*, customers(name)")


@quotes.get("/{item_id}")
def get_quote(item_id: str, user: UserDep):
    user.require("sales.read")
    return commerce.get_document("quotes", item_id)


@quotes.post("")
def create_quote(body: DocumentIn, user: UserDep):
    user.require("sales.write")
    return commerce.create_document("quotes", body.model_dump(), user.id)


@quotes.patch("/{item_id}")
def update_quote(item_id: str, body: dict, user: UserDep):
    user.require("sales.write")
    return commerce.update_document("quotes", item_id, body, user.id)


@quotes.post("/{item_id}/convert")
def convert_quote(item_id: str, user: UserDep):
    user.require("sales.write")
    return commerce.convert_quote_to_order(item_id, user.id)


@orders.get("")
def list_orders(user: UserDep, page: int = 1, page_size: int = 20, search: str | None = None, status: str | None = None):
    user.require("sales.read")
    return _list("sales_orders", user, page, page_size, search, status, select="*, customers(name)")


@orders.get("/{item_id}")
def get_order(item_id: str, user: UserDep):
    user.require("sales.read")
    return commerce.get_document("sales_orders", item_id)


@orders.post("")
def create_order(body: DocumentIn, user: UserDep):
    user.require("sales.write")
    return commerce.create_document("sales_orders", body.model_dump(), user.id)


@orders.patch("/{item_id}")
def update_order(item_id: str, body: dict, user: UserDep):
    user.require("sales.write")
    return commerce.update_document("sales_orders", item_id, body, user.id)


@orders.post("/{item_id}/deliver")
def deliver(item_id: str, body: ReceiveIn, user: UserDep):
    user.require("sales.write")
    return deliver_sales(item_id, body.items, user.id, body.notes)


@orders.post("/{item_id}/invoice")
def invoice_order(item_id: str, user: UserDep):
    user.require("invoices.write", "sales.write")
    return commerce.convert_order_to_invoice(item_id, user.id)


@purchases.get("")
def list_purchases(user: UserDep, page: int = 1, page_size: int = 20, search: str | None = None, status: str | None = None):
    user.require("purchases.read")
    return _list("purchase_orders", user, page, page_size, search, status, select="*, suppliers(name)")


@purchases.get("/{item_id}")
def get_purchase(item_id: str, user: UserDep):
    user.require("purchases.read")
    return commerce.get_document("purchase_orders", item_id)


@purchases.post("")
def create_purchase(body: DocumentIn, user: UserDep):
    user.require("purchases.write")
    return commerce.create_document("purchase_orders", body.model_dump(), user.id)


@purchases.patch("/{item_id}")
def update_purchase(item_id: str, body: dict, user: UserDep):
    user.require("purchases.write")
    return commerce.update_document("purchase_orders", item_id, body, user.id)


@purchases.post("/{item_id}/receive")
def receive(item_id: str, body: ReceiveIn, user: UserDep):
    user.require("purchases.write")
    return receive_purchase(item_id, body.items, user.id, body.notes)


@invoices.get("")
def list_invoices(
    user: UserDep,
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    status: str | None = None,
    invoice_type: str | None = None,
):
    user.require("invoices.read")
    return _list(
        "invoices",
        user,
        page,
        page_size,
        search,
        status,
        extra_filters={"invoice_type": invoice_type},
        select="*, customers(name), suppliers(name)",
    )


@invoices.get("/{item_id}")
def get_invoice(item_id: str, user: UserDep):
    user.require("invoices.read")
    return commerce.get_document("invoices", item_id)


@invoices.post("")
def create_invoice(body: DocumentIn, user: UserDep):
    user.require("invoices.write")
    return commerce.create_document("invoices", body.model_dump(), user.id)


@invoices.patch("/{item_id}")
def update_invoice(item_id: str, body: dict, user: UserDep):
    user.require("invoices.write")
    return commerce.update_document("invoices", item_id, body, user.id)


@invoices.post("/{item_id}/duplicate")
def duplicate(item_id: str, user: UserDep):
    user.require("invoices.write")
    return commerce.duplicate_invoice(item_id, user.id)


@invoices.get("/{item_id}/pdf")
def pdf(item_id: str, user: UserDep):
    user.require("invoices.read")
    invoice = commerce.get_document("invoices", item_id)
    data = invoice_pdf(invoice, company())
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{invoice.get("number")}.pdf"'},
    )


@payments.get("")
def list_payments(
    user: UserDep,
    page: int = 1,
    page_size: int = 20,
    payment_type: str | None = None,
    method: str | None = None,
):
    user.require("payments.read")
    return list_rows(
        "payments",
        page=page,
        page_size=page_size,
        search=None,
        search_columns=[],
        filters={"payment_type": payment_type, "method": method},
        select="*, customers(name), suppliers(name), invoices(number)",
    )


@payments.post("")
def create_payment(body: PaymentIn, user: UserDep):
    user.require("payments.write")
    return commerce.register_payment(body.model_dump(), user.id)


@expenses.get("")
def list_expenses(
    user: UserDep,
    page: int = 1,
    page_size: int = 20,
    category: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
):
    user.require("expenses.read")
    return list_rows(
        "expenses",
        page=page,
        page_size=page_size,
        search=None,
        search_columns=[],
        filters={"category": category},
        gte={"expense_date": date_from},
        lte={"expense_date": date_to},
    )


@expenses.post("")
def create_expense(body: ExpenseIn, user: UserDep):
    user.require("expenses.write")
    return commerce.create_expense(body.model_dump(), user.id)


@expenses.patch("/{item_id}")
def update_expense(item_id: str, body: ExpenseIn, user: UserDep):
    user.require("expenses.write")
    return update_row("expenses", item_id, body.model_dump(), user.id)


@expenses.delete("/{item_id}")
def delete_expense(item_id: str, user: UserDep):
    user.require("expenses.write")
    delete_row("expenses", item_id, user.id)
    return {"message": "Dépense supprimée."}
