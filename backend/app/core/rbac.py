ROLE_HOME: dict[str, str] = {
    "super_admin": "/",
    "admin": "/",
    "manager": "/",
    "sales": "/customers",
    "accountant": "/invoices",
    "employee": "/tasks",
}

# Permissions requises par module (utilisé par le frontend via /auth/me)
MODULE_PERMS = {
    "dashboard": ["dashboard.read"],
    "sales": ["sales.read"],
    "purchases": ["purchases.read"],
    "products": ["products.read"],
    "inventory": ["inventory.read"],
    "customers": ["customers.read"],
    "suppliers": ["suppliers.read"],
    "invoices": ["invoices.read"],
    "payments": ["payments.read"],
    "expenses": ["expenses.read"],
    "employees": ["employees.read"],
    "tasks": ["tasks.read"],
    "documents": ["documents.read"],
    "reports": ["reports.read"],
    "settings": ["settings.read", "users.manage", "system.configure"],
}
