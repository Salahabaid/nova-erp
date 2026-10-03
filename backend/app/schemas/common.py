from datetime import date, datetime
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field

T = TypeVar("T")


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="ignore")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


class Message(BaseModel):
    message: str


class LineIn(BaseModel):
    product_id: str | None = None
    description: str
    quantity: float = Field(gt=0)
    unit_price: float = Field(ge=0)
    tax_rate: float = Field(default=20, ge=0, le=100)
    discount: float = Field(default=0, ge=0)


class LineOut(LineIn):
    id: str | None = None
    line_total: float = 0
    delivered_qty: float | None = None
    received_qty: float | None = None


class AuthLogin(BaseModel):
    email: EmailStr
    password: str


class AuthRefresh(BaseModel):
    refresh_token: str


class AuthRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    first_name: str
    last_name: str


class PasswordChange(BaseModel):
    password: str = Field(min_length=8)


class OnboardingIn(BaseModel):
    name: str
    country: str = "MA"
    currency: str = "MAD"
    default_tax_rate: float = 20
    email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None
    city: str | None = None
    tax_id: str | None = None
    language: str = "fr"


class CompanyUpdate(BaseModel):
    name: str | None = None
    logo_url: str | None = None
    address: str | None = None
    city: str | None = None
    country: str | None = None
    phone: str | None = None
    email: str | None = None
    tax_id: str | None = None
    currency: str | None = None
    default_tax_rate: float | None = None
    invoice_prefix: str | None = None
    quote_prefix: str | None = None
    sales_order_prefix: str | None = None
    purchase_prefix: str | None = None
    language: str | None = None
    notify_low_stock: bool | None = None
    notify_overdue_invoices: bool | None = None
    notify_tasks: bool | None = None


class PartyIn(BaseModel):
    name: str
    company_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None
    city: str | None = None
    country: str | None = None
    tax_id: str | None = None
    notes: str | None = None
    status: str = "active"


class ProductIn(BaseModel):
    sku: str
    name: str
    description: str | None = None
    category_id: str | None = None
    purchase_price: float = 0
    sale_price: float = 0
    tax_rate: float = 20
    unit: str = "unité"
    min_stock: float = 0
    supplier_id: str | None = None
    image_url: str | None = None
    status: str = "active"


class CategoryIn(BaseModel):
    name: str
    description: str | None = None


class StockMoveIn(BaseModel):
    product_id: str
    warehouse_id: str | None = None
    to_warehouse_id: str | None = None
    movement_type: str
    quantity: float
    unit_cost: float | None = None
    notes: str | None = None


class DocumentIn(BaseModel):
    customer_id: str | None = None
    supplier_id: str | None = None
    invoice_type: str | None = "sales"
    quote_id: str | None = None
    sales_order_id: str | None = None
    purchase_order_id: str | None = None
    issue_date: date | None = None
    valid_until: date | None = None
    expected_date: date | None = None
    due_date: date | None = None
    delivery_date: date | None = None
    discount: float = 0
    notes: str | None = None
    items: list[LineIn]


class PaymentIn(BaseModel):
    payment_type: str
    amount: float = Field(gt=0)
    payment_date: date | None = None
    method: str = "transfer"
    reference: str | None = None
    invoice_id: str | None = None
    customer_id: str | None = None
    supplier_id: str | None = None
    notes: str | None = None


class ExpenseIn(BaseModel):
    category: str
    amount: float = Field(gt=0)
    expense_date: date | None = None
    description: str | None = None
    vendor: str | None = None
    receipt_url: str | None = None


class EmployeeIn(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr | None = None
    phone: str | None = None
    position: str | None = None
    department: str | None = None
    hire_date: date | None = None
    status: str = "active"
    salary: float | None = None
    photo_url: str | None = None
    user_id: str | None = None


class TaskIn(BaseModel):
    title: str
    description: str | None = None
    assignee_id: str | None = None
    employee_id: str | None = None
    priority: str = "medium"
    due_date: date | None = None
    status: str = "todo"
    related_module: str | None = None
    related_id: str | None = None


class UserUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    avatar_url: str | None = None
    role_id: str | None = None
    status: str | None = None


class ReceiveIn(BaseModel):
    items: list[dict[str, Any]]
    notes: str | None = None


class InviteUser(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    role_id: str
    password: str = Field(min_length=8)
