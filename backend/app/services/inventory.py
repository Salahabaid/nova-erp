from app.core.errors import BadRequest
from app.repositories.db import Table, audit, get_admin_client, one, unwrap
from app.utils.money import qty


def _recompute_product_stock(product_id: str) -> float:
    db = get_admin_client()
    moves = unwrap(db.table("stock_movements").select("movement_type, quantity").eq("product_id", product_id).execute())
    stock = 0.0
    for m in moves:
        t = m["movement_type"]
        q = float(m["quantity"] or 0)
        if t == "in":
            stock += q
        elif t == "out":
            stock -= q
        elif t == "adjustment":
            stock += q
        elif t == "inventory":
            stock = q
        # transfer: net stock unchanged at product level
    stock = qty(stock)
    db.table("products").update({"stock_quantity": stock}).eq("id", product_id).execute()
    return stock


def create_movement(payload: dict, user_id: str | None, is_demo: bool = False) -> dict:
    mtype = payload["movement_type"]
    if mtype not in {"in", "out", "transfer", "adjustment", "inventory"}:
        raise BadRequest("Type de mouvement invalide.")
    quantity = float(payload["quantity"])
    if mtype != "adjustment" and quantity <= 0:
        raise BadRequest("La quantité doit être supérieure à 0.")
    if mtype == "transfer" and not payload.get("to_warehouse_id"):
        raise BadRequest("Un entrepôt de destination est requis pour un transfert.")

    product = Table("products").get(payload["product_id"])
    if mtype == "out" and float(product.get("stock_quantity") or 0) < quantity:
        raise BadRequest("Stock insuffisant pour cette sortie.")

    if mtype == "inventory":
        current = float(product.get("stock_quantity") or 0)
        payload = {**payload, "movement_type": "adjustment", "quantity": qty(quantity - current), "notes": payload.get("notes") or f"Inventaire (compté {quantity})"}

    row = {
        "product_id": payload["product_id"],
        "warehouse_id": payload.get("warehouse_id"),
        "to_warehouse_id": payload.get("to_warehouse_id"),
        "movement_type": payload["movement_type"],
        "quantity": qty(payload["quantity"]),
        "unit_cost": payload.get("unit_cost"),
        "notes": payload.get("notes"),
        "reference_type": payload.get("reference_type"),
        "reference_id": payload.get("reference_id"),
        "created_by": user_id,
        "is_demo": is_demo,
    }
    movement = Table("stock_movements").insert(row)
    stock = _recompute_product_stock(payload["product_id"])
    _maybe_low_stock_alert(product, stock)
    audit(user_id, "create", "stock_movements", movement["id"], row)
    movement["stock_after"] = stock
    return movement


def _maybe_low_stock_alert(product: dict, stock: float) -> None:
    min_stock = float(product.get("min_stock") or 0)
    if stock > min_stock:
        return
    db = get_admin_client()
    settings = unwrap(db.table("company_settings").select("notify_low_stock").limit(1).execute())
    if settings and not settings[0].get("notify_low_stock", True):
        return
    admins = unwrap(db.table("profiles").select("id").eq("status", "active").execute())
    title = "Alerte stock faible" if stock > 0 else "Produit en rupture"
    for p in admins[:20]:
        db.table("notifications").insert(
            {
                "user_id": p["id"],
                "type": "low_stock",
                "title": title,
                "message": f"{product.get('name')} ({product.get('sku')}) : stock {stock}",
                "related_type": "products",
                "related_id": product["id"],
            }
        ).execute()


def alerts() -> dict:
    db = get_admin_client()
    products = unwrap(db.table("products").select("*").eq("status", "active").execute())
    low = [p for p in products if float(p.get("stock_quantity") or 0) <= float(p.get("min_stock") or 0) and float(p.get("stock_quantity") or 0) > 0]
    out = [p for p in products if float(p.get("stock_quantity") or 0) <= 0]
    valuation = sum(float(p.get("stock_quantity") or 0) * float(p.get("purchase_price") or 0) for p in products)
    return {"low_stock": low, "out_of_stock": out, "valuation": round(valuation, 2), "product_count": len(products)}


def receive_purchase(order_id: str, items: list[dict], user_id: str | None, notes: str | None = None) -> dict:
    db = get_admin_client()
    order = one(db.table("purchase_orders").select("*").eq("id", order_id).limit(1).execute())
    if order["status"] in ("cancelled", "received"):
        raise BadRequest("Cette commande ne peut plus être réceptionnée.")
    po_items = unwrap(db.table("purchase_order_items").select("*").eq("purchase_order_id", order_id).execute())
    by_id = {i["id"]: i for i in po_items}

    for rec in items:
        line = by_id.get(rec["id"])
        if not line:
            continue
        qty_recv = float(rec.get("quantity") or 0)
        if qty_recv <= 0:
            continue
        already = float(line.get("received_qty") or 0)
        remaining = float(line["quantity"]) - already
        if qty_recv > remaining + 0.0001:
            raise BadRequest(f"Quantité reçue supérieure au reste pour {line['description']}.")
        if line.get("product_id"):
            create_movement(
                {
                    "product_id": line["product_id"],
                    "movement_type": "in",
                    "quantity": qty_recv,
                    "unit_cost": line.get("unit_price"),
                    "notes": notes or f"Réception {order['number']}",
                    "reference_type": "purchase_orders",
                    "reference_id": order_id,
                },
                user_id,
            )
        db.table("purchase_order_items").update({"received_qty": qty(already + qty_recv)}).eq("id", line["id"]).execute()

    refreshed = unwrap(db.table("purchase_order_items").select("*").eq("purchase_order_id", order_id).execute())
    total_qty = sum(float(i["quantity"]) for i in refreshed)
    rec_qty = sum(float(i.get("received_qty") or 0) for i in refreshed)
    if rec_qty <= 0:
        status = order["status"]
    elif rec_qty + 0.0001 >= total_qty:
        status = "received"
    else:
        status = "partially_received"
    db.table("purchase_orders").update({"status": status}).eq("id", order_id).execute()
    return one(db.table("purchase_orders").select("*, suppliers(*), purchase_order_items(*)").eq("id", order_id).limit(1).execute())


def deliver_sales(order_id: str, items: list[dict], user_id: str | None, notes: str | None = None) -> dict:
    db = get_admin_client()
    order = one(db.table("sales_orders").select("*").eq("id", order_id).limit(1).execute())
    if order["status"] in ("cancelled", "delivered", "invoiced"):
        raise BadRequest("Cette commande ne peut plus être livrée.")
    so_items = unwrap(db.table("sales_order_items").select("*").eq("sales_order_id", order_id).execute())
    by_id = {i["id"]: i for i in so_items}

    delivery = Table("deliveries").insert(
        {"sales_order_id": order_id, "notes": notes, "created_by": user_id}
    )
    for rec in items:
        line = by_id.get(rec["id"])
        if not line:
            continue
        qty_del = float(rec.get("quantity") or 0)
        if qty_del <= 0:
            continue
        already = float(line.get("delivered_qty") or 0)
        remaining = float(line["quantity"]) - already
        if qty_del > remaining + 0.0001:
            raise BadRequest(f"Quantité livrée supérieure au reste pour {line['description']}.")
        if line.get("product_id"):
            create_movement(
                {
                    "product_id": line["product_id"],
                    "movement_type": "out",
                    "quantity": qty_del,
                    "notes": notes or f"Livraison {order['number']}",
                    "reference_type": "sales_orders",
                    "reference_id": order_id,
                },
                user_id,
            )
        db.table("sales_order_items").update({"delivered_qty": qty(already + qty_del)}).eq("id", line["id"]).execute()
        Table("delivery_items").insert(
            {"delivery_id": delivery["id"], "sales_order_item_id": line["id"], "quantity": qty_del}
        )

    refreshed = unwrap(db.table("sales_order_items").select("*").eq("sales_order_id", order_id).execute())
    total_qty = sum(float(i["quantity"]) for i in refreshed)
    del_qty = sum(float(i.get("delivered_qty") or 0) for i in refreshed)
    if del_qty <= 0:
        status = order["status"]
    elif del_qty + 0.0001 >= total_qty:
        status = "delivered"
    else:
        status = "partially_delivered"
    db.table("sales_orders").update({"status": status}).eq("id", order_id).execute()
    return one(db.table("sales_orders").select("*, customers(*), sales_order_items(*)").eq("id", order_id).limit(1).execute())
