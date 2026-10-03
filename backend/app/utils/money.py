from decimal import ROUND_HALF_UP, Decimal


def d(value) -> Decimal:
    return Decimal(str(value or 0))


def money(value) -> float:
    return float(d(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def qty(value) -> float:
    return float(d(value).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP))


def compute_lines(items: list[dict]) -> tuple[list[dict], dict]:
    computed = []
    subtotal = Decimal("0")
    tax_amount = Decimal("0")
    for item in items:
        quantity = d(item.get("quantity") or 0)
        unit_price = d(item.get("unit_price") or 0)
        discount = d(item.get("discount") or 0)
        tax_rate = d(item.get("tax_rate") or 0)
        line_ht = (quantity * unit_price) - discount
        if line_ht < 0:
            line_ht = Decimal("0")
        line_tax = line_ht * tax_rate / Decimal("100")
        row = {
            **{k: v for k, v in item.items() if k != "id" or v},
            "quantity": qty(quantity),
            "unit_price": money(unit_price),
            "discount": money(discount),
            "tax_rate": float(tax_rate),
            "line_total": money(line_ht),
        }
        computed.append(row)
        subtotal += line_ht
        tax_amount += line_tax
    totals = {
        "subtotal": money(subtotal),
        "tax_amount": money(tax_amount),
        "total": money(subtotal + tax_amount),
    }
    return computed, totals


def apply_document_discount(totals: dict, discount: float) -> dict:
    disc = d(discount)
    if disc < 0:
        disc = Decimal("0")
    subtotal = d(totals["subtotal"]) - disc
    if subtotal < 0:
        subtotal = Decimal("0")
    # prorate tax
    original_sub = d(totals["subtotal"]) or Decimal("1")
    ratio = subtotal / original_sub if original_sub else Decimal("0")
    tax = d(totals["tax_amount"]) * ratio
    return {
        "subtotal": money(d(totals["subtotal"])),
        "discount": money(disc),
        "tax_amount": money(tax),
        "total": money(subtotal + tax),
    }


def invoice_status(total: float, paid: float, due_date, current_status: str) -> str:
    if current_status in ("draft", "cancelled"):
        return current_status
    remaining = money(d(total) - d(paid))
    if remaining <= 0:
        return "paid"
    if paid > 0:
        return "partially_paid"
    if due_date:
        from datetime import date

        due = due_date if hasattr(due_date, "isoformat") else str(due_date)
        try:
            if date.fromisoformat(str(due)[:10]) < date.today():
                return "overdue"
        except ValueError:
            pass
    return current_status if current_status in ("sent", "overdue") else "sent"
