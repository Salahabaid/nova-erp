def recompute(moves: list[tuple[str, float]]) -> float:
    stock = 0.0
    for t, q in moves:
        if t == "in":
            stock += q
        elif t == "out":
            stock -= q
        elif t == "adjustment":
            stock += q
        elif t == "inventory":
            stock = q
    return stock


def test_stock_formula():
    assert recompute([("in", 10), ("out", 3), ("adjustment", -1)]) == 6
    assert recompute([("in", 5), ("inventory", 12)]) == 12
    assert recompute([("in", 8), ("transfer", 3)]) == 8
