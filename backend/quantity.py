"""Deterministic checks: unit-price arithmetic and measured quantity vs the First Schedule.

These do not depend on the AI's judgement - they parse the declared values and do the maths,
which makes them reliable evidence for enforcement.
"""
import math
import re

# unit -> (dimension, factor to base unit). Base units: g, ml, m, m2, number
UNITS = {
    "mg": ("mass", 0.001), "g": ("mass", 1), "gm": ("mass", 1), "gms": ("mass", 1), "gram": ("mass", 1),
    "grams": ("mass", 1), "kg": ("mass", 1000), "kgs": ("mass", 1000), "kilogram": ("mass", 1000),
    "ml": ("volume", 1), "millilitre": ("volume", 1), "milliliter": ("volume", 1), "cl": ("volume", 10),
    "l": ("volume", 1000), "ltr": ("volume", 1000), "ltrs": ("volume", 1000), "litre": ("volume", 1000),
    "liter": ("volume", 1000), "litres": ("volume", 1000),
    "mm": ("length", 0.001), "cm": ("length", 0.01), "m": ("length", 1), "metre": ("length", 1), "meter": ("length", 1),
    "sqm": ("area", 1), "m2": ("area", 1), "sqcm": ("area", 0.0001), "cm2": ("area", 0.0001),
    "n": ("number", 1), "no": ("number", 1), "nos": ("number", 1), "pc": ("number", 1), "pcs": ("number", 1),
    "piece": ("number", 1), "pieces": ("number", 1), "unit": ("number", 1), "units": ("number", 1),
    "tablets": ("number", 1), "sachets": ("number", 1), "count": ("number", 1),
}
_UNIT_RE = "|".join(sorted((re.escape(u) for u in UNITS), key=len, reverse=True))
QTY_RE = re.compile(rf"(\d+(?:[.,]\d+)?)\s*({_UNIT_RE})\b", re.I)
MONEY_RE = re.compile(r"(?:₹|rs\.?|inr|mrp)\s*[:.]?\s*(\d+(?:,\d{3})*(?:\.\d+)?)", re.I)
BARE_NUMBER_RE = re.compile(r"(\d+(?:,\d{3})*(?:\.\d+)?)")
# "₹24 per 100 g", "Rs 0.24/g", "₹240/kg", "₹ 1.20 per ml"
UNIT_PRICE_RE = re.compile(
    rf"(?:₹|rs\.?|inr)?\s*(\d+(?:,\d{{3}})*(?:\.\d+)?)\s*(?:/|per)\s*(\d+(?:\.\d+)?)?\s*({_UNIT_RE})\b", re.I
)


def _num(s: str) -> float:
    return float(s.replace(",", ""))


def parse_quantity(text: str | None) -> tuple[float, str, str] | None:
    """'Net Wt. 1.5 kg' -> (1500.0, 'mass', '1.5 kg'). Returns base-unit value."""
    if not text:
        return None
    m = QTY_RE.search(text.replace("ltr.", "ltr"))
    if not m:
        return None
    dim, factor = UNITS[m.group(2).lower()]
    return _num(m.group(1).replace(",", ".") if m.group(1).count(",") == 1 and "." not in m.group(1) else m.group(1)) * factor, dim, m.group(0)


def parse_money(text: str | None) -> float | None:
    if not text:
        return None
    m = MONEY_RE.search(text)
    if m:
        return _num(m.group(1))
    m = BARE_NUMBER_RE.search(text)
    return _num(m.group(1)) if m else None


def parse_unit_price(text: str | None) -> tuple[float, str] | None:
    """'₹24.00 per 100 g' -> (0.24, 'mass')  i.e. price per base unit."""
    if not text:
        return None
    m = UNIT_PRICE_RE.search(text)
    if not m:
        return None
    price = _num(m.group(1))
    per = float(m.group(2)) if m.group(2) else 1.0
    dim, factor = UNITS[m.group(3).lower()]
    return price / (per * factor), dim


def _fmt(v: float) -> str:
    return f"{v:,.2f}".rstrip("0").rstrip(".")


# ------------------------------------------------------------ First Schedule (Table I and II)

def max_permissible_error(declared: float, dim: str) -> float | None:
    """Maximum permissible error in base units for a declared quantity (First Schedule)."""
    if dim in ("mass", "volume"):
        q = declared
        table = [
            (50, ("pct", 9)), (100, ("abs", 4.5)), (200, ("pct", 4.5)), (300, ("abs", 9)),
            (500, ("pct", 3)), (1000, ("abs", 15)), (10000, ("pct", 1.5)), (15000, ("abs", 150)),
            (math.inf, ("pct", 1.0)),
        ]
        for upper, (kind, v) in table:
            if q <= upper:
                err = q * v / 100 if kind == "pct" else v
                # rounded to nearest 0.1 up to 1000 g/ml, next whole unit above
                return round(err, 1) if q <= 1000 else math.ceil(err)
    if dim == "length":
        return declared * (0.02 if declared <= 10 else 0.01)
    if dim == "area":
        return declared * (0.04 if declared <= 10 else 0.01)
    if dim == "number":
        return declared * 0.02
    return None


BASE_LABEL = {"mass": "g", "volume": "ml", "length": "m", "area": "m²", "number": "units"}


def quantity_check(declared_text: str | None, measured_text: str | None) -> dict | None:
    """Officer-measured quantity vs declared quantity. None if nothing was measured."""
    if not measured_text:
        return None
    base = {"id": "quantity_verification"}
    declared = parse_quantity(declared_text)
    measured = parse_quantity(measured_text)
    if not declared or not measured:
        return {**base, "status": "unclear",
                "evidence": f"Could not compare declared '{declared_text or '-'}' with measured '{measured_text}'.",
                "recommendation": "Enter the measured quantity with a unit, e.g. '482 g'."}
    (dq, ddim, draw), (mq, mdim, mraw) = declared, measured
    if ddim != mdim:
        return {**base, "status": "unclear", "evidence": f"Declared {draw} and measured {mraw} use different kinds of unit.",
                "recommendation": "Measure in the same kind of unit as declared."}
    mpe = max_permissible_error(dq, ddim)
    shortfall = dq - mq
    unit = BASE_LABEL[ddim]
    detail = {"declared": dq, "measured": mq, "shortfall": round(shortfall, 3), "mpe": mpe, "unit": unit}
    if shortfall <= 0:
        return {**base, "status": "pass", "evidence": f"Measured {mraw} is not less than declared {draw}.", "recommendation": None,
                "detail": detail}
    if shortfall <= mpe:
        return {**base, "status": "pass",
                "evidence": f"Short by {_fmt(shortfall)} {unit}, within the permissible error of {_fmt(mpe)} {unit} for {draw}.",
                "recommendation": None, "detail": detail}
    return {**base, "status": "fail",
            "evidence": f"Measured {mraw} against declared {draw}: short by {_fmt(shortfall)} {unit}, exceeding the "
                        f"maximum permissible error of {_fmt(mpe)} {unit} (First Schedule).",
            "recommendation": "Seize the lot and test a statistical sample under Rule 19; action under Section 36(2).",
            "detail": detail}


def price_arithmetic_check(mrp_text: str | None, qty_text: str | None, usp_text: str | None) -> dict:
    base = {"id": "price_arithmetic"}
    mrp = parse_money(mrp_text)
    qty = parse_quantity(qty_text)
    usp = parse_unit_price(usp_text)
    if not usp_text:
        return {**base, "status": "not_applicable", "evidence": "No unit sale price declared, so there is nothing to verify.",
                "recommendation": None}
    if mrp is None or qty is None or usp is None:
        return {**base, "status": "unclear",
                "evidence": f"Could not read all of MRP ('{mrp_text or '-'}'), net quantity ('{qty_text or '-'}') and "
                            f"unit price ('{usp_text}') as numbers.",
                "recommendation": "Verify the unit sale price manually."}
    q, qdim, qraw = qty
    per_base, udim = usp
    if qdim != udim:
        return {**base, "status": "unclear", "evidence": f"Unit price '{usp_text}' and quantity '{qraw}' use different units.",
                "recommendation": "Verify the unit sale price manually."}
    expected = mrp / q
    diff = abs(per_base - expected) / expected if expected else 0
    show = 1000 if qdim in ("mass", "volume") else 1
    show_unit = {"mass": "kg", "volume": "L"}.get(qdim, BASE_LABEL[qdim])
    msg = (f"MRP ₹{_fmt(mrp)} ÷ {qraw} = ₹{_fmt(expected * show)} per {show_unit}; "
           f"label declares ₹{_fmt(per_base * show)} per {show_unit}.")
    if diff <= 0.02:  # allow rounding to paise
        return {**base, "status": "pass", "evidence": msg, "recommendation": None}
    return {**base, "status": "fail", "evidence": msg + f" Difference {diff * 100:.1f}%.",
            "recommendation": "Correct the unit sale price so it equals MRP divided by net quantity."}
