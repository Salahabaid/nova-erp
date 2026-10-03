from app.utils.money import apply_document_discount, compute_lines, invoice_status, money


def test_line_totals_and_tax():
    lines, totals = compute_lines(
        [
            {"description": "A", "quantity": 2, "unit_price": 100, "tax_rate": 20, "discount": 0},
            {"description": "B", "quantity": 1, "unit_price": 50, "tax_rate": 10, "discount": 10},
        ]
    )
    assert lines[0]["line_total"] == 200
    assert lines[1]["line_total"] == 40
    assert totals["subtotal"] == 240
    assert totals["tax_amount"] == 44  # 40 + 4
    assert totals["total"] == 284


def test_document_discount_prorates_tax():
    totals = apply_document_discount({"subtotal": 200, "tax_amount": 40, "total": 240}, 20)
    assert totals["discount"] == 20
    assert totals["subtotal"] == 200
    assert totals["tax_amount"] == 36
    assert totals["total"] == 216


def test_invoice_status_paid_and_partial():
    assert invoice_status(100, 100, None, "sent") == "paid"
    assert invoice_status(100, 40, None, "sent") == "partially_paid"
    assert invoice_status(100, 0, None, "draft") == "draft"


def test_money_rounding():
    assert money(10.555) == 10.56
