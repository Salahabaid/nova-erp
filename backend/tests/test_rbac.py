from app.core.rbac import MODULE_PERMS


def test_every_nav_module_has_permission():
    expected = {
        "dashboard",
        "sales",
        "purchases",
        "products",
        "inventory",
        "customers",
        "suppliers",
        "invoices",
        "payments",
        "expenses",
        "employees",
        "tasks",
        "documents",
        "reports",
        "settings",
    }
    assert expected == set(MODULE_PERMS)
