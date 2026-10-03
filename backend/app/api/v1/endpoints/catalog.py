from fastapi import APIRouter, File, UploadFile
from fastapi.responses import StreamingResponse

from app.core.deps import UserDep
from app.core.errors import BadRequest
from app.repositories.db import Table, unwrap
from app.schemas.common import CategoryIn, ProductIn, StockMoveIn
from app.services.crud import create_row, delete_row, get_row, history, list_rows, update_row
from app.services.inventory import alerts, create_movement

products = APIRouter(prefix="/products", tags=["products"])
categories = APIRouter(prefix="/categories", tags=["categories"])
inventory = APIRouter(prefix="/inventory", tags=["inventory"])


@products.get("")
def list_products(
    user: UserDep,
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    category_id: str | None = None,
    status: str | None = None,
):
    user.require("products.read")
    return list_rows(
        "products",
        page=page,
        page_size=page_size,
        search=search,
        search_columns=["name", "sku"],
        filters={"category_id": category_id, "status": status},
        select="*, categories(name), suppliers(name)",
    )


@products.get("/export/csv")
def export_products(user: UserDep):
    user.require("products.read")
    rows = unwrap(Table("products").q().select("sku, name, sale_price, purchase_price, stock_quantity, unit, status").execute())
    header = "sku;name;sale_price;purchase_price;stock_quantity;unit;status"
    lines = [header] + [";".join(str(r.get(k) or "") for k in header.split(";")) for r in rows]
    return StreamingResponse(
        iter(["\ufeff" + "\n".join(lines)]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=produits.csv"},
    )


@products.post("/import/csv")
async def import_products(user: UserDep, file: UploadFile = File(...)):
    user.require("products.write")
    raw = (await file.read()).decode("utf-8-sig")
    lines = [ln.strip() for ln in raw.splitlines() if ln.strip()]
    if len(lines) < 2:
        raise BadRequest("Fichier CSV vide.")
    header = [h.strip().lower() for h in lines[0].replace(",", ";").split(";")]
    created = 0
    for line in lines[1:]:
        cols = [c.strip() for c in line.replace(",", ";").split(";")]
        row = dict(zip(header, cols))
        sku = row.get("sku")
        name = row.get("name") or row.get("nom")
        if not sku or not name:
            continue
        payload = {
            "sku": sku,
            "name": name,
            "sale_price": float(row.get("sale_price") or row.get("prix") or 0),
            "purchase_price": float(row.get("purchase_price") or 0),
            "unit": row.get("unit") or "unité",
            "status": row.get("status") or "active",
            "created_by": user.id,
        }
        try:
            Table("products").insert(payload)
            created += 1
        except Exception:
            continue
    return {"message": f"{created} produit(s) importé(s).", "created": created}


@products.get("/{item_id}")
def product_detail(item_id: str, user: UserDep):
    user.require("products.read")
    row = get_row("products", item_id)
    row["movements"] = history("stock_movements", {"product_id": item_id})
    return row


@products.post("")
def create_product(body: ProductIn, user: UserDep):
    user.require("products.write")
    return create_row("products", body.model_dump(), user.id)


@products.patch("/{item_id}")
def update_product(item_id: str, body: ProductIn, user: UserDep):
    user.require("products.write")
    return update_row("products", item_id, body.model_dump(), user.id)


@products.delete("/{item_id}")
def delete_product(item_id: str, user: UserDep):
    user.require("products.delete")
    delete_row("products", item_id, user.id)
    return {"message": "Produit supprimé."}


@categories.get("")
def list_categories(user: UserDep):
    user.require("products.read")
    return unwrap(Table("categories").q().select("*").order("name").execute())


@categories.post("")
def create_category(body: CategoryIn, user: UserDep):
    user.require("products.write")
    slug = body.name.lower().replace(" ", "-")
    return create_row("categories", {**body.model_dump(), "slug": slug}, user.id)


@categories.delete("/{item_id}")
def delete_category(item_id: str, user: UserDep):
    user.require("products.write")
    delete_row("categories", item_id, user.id)
    return {"message": "Catégorie supprimée."}


@inventory.get("/warehouses")
def warehouses(user: UserDep):
    user.require("inventory.read")
    return unwrap(Table("warehouses").q().select("*").execute())


@inventory.get("/movements")
def movements(
    user: UserDep,
    page: int = 1,
    page_size: int = 20,
    product_id: str | None = None,
    movement_type: str | None = None,
):
    user.require("inventory.read")
    return list_rows(
        "stock_movements",
        page=page,
        page_size=page_size,
        search=None,
        search_columns=[],
        filters={"product_id": product_id, "movement_type": movement_type},
        select="*, products(name, sku), warehouses(name)",
    )


@inventory.post("/movements")
def add_movement(body: StockMoveIn, user: UserDep):
    user.require("inventory.write")
    return create_movement(body.model_dump(), user.id)


@inventory.get("/alerts")
def stock_alerts(user: UserDep):
    user.require("inventory.read")
    return alerts()
