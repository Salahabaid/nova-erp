from fastapi import APIRouter

from app.api.v1.endpoints import auth, catalog, commerce_api, core, hr, reports_api

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(core.router)
api_router.include_router(catalog.products)
api_router.include_router(catalog.categories)
api_router.include_router(catalog.inventory)
api_router.include_router(commerce_api.quotes)
api_router.include_router(commerce_api.orders)
api_router.include_router(commerce_api.purchases)
api_router.include_router(commerce_api.invoices)
api_router.include_router(commerce_api.payments)
api_router.include_router(commerce_api.expenses)
api_router.include_router(hr.employees)
api_router.include_router(hr.tasks)
api_router.include_router(hr.documents)
api_router.include_router(reports_api.router)

from app.api.v1.endpoints.crm import customers, suppliers

api_router.include_router(customers)
api_router.include_router(suppliers)
