"""Demonstration data: fictional manufacturers, drawn labels, inspections, reviews, notices, complaints.

Every record is flagged is_demo=True and can be removed from the Admin page (or `python seed_demo.py --clear`).
All company and brand names are fictional.

    python seed_demo.py           # (re)load demo data
    python seed_demo.py --clear   # remove demo data
"""
import datetime
import random
import sys
import uuid

from PIL import Image, ImageDraw, ImageFont

import models
import photo_store
from config import UPLOAD_DIR
from pdf_generator import _BOLD, _REGULAR, _find
from quantity import parse_quantity
from rules_kb import LABEL, LISTING, PENALTIES, checks_for
from services import build_checks, compute_verdict, manufacturer_key

BRANDS = [
    dict(company="Saptarishi Foods Pvt. Ltd.", brand="Saptarishi", addr="Plot 14, MIDC Bhosari, Pune 411026, Maharashtra",
         states=["MH", "GJ", "KA"], colour=(178, 34, 34), risk=0.75, typical=["mrp", "unit_sale_price", "consumer_care", "font_size"],
         products=[("Masala Peanuts", "Roasted Peanuts", "200 g", 45), ("Bhujia Sev", "Namkeen", "400 g", 90), ("Chakli", "Rice Snack", "150 g", 40)],
         category="Food"),
    dict(company="Nilgiri Valley Beverages LLP", brand="Nilgiri Fresh", addr="12 Coonoor Road, Ooty 643001, Tamil Nadu",
         states=["TN", "KL", "KA"], colour=(31, 107, 69), risk=0.4, typical=["best_before", "unit_sale_price"],
         products=[("Green Tea", "Tea", "100 g", 180), ("Masala Chai", "Tea", "250 g", 140)], category="Beverage"),
    dict(company="Shreeji Dairy Products", brand="Shreeji Gold", addr="GIDC Estate, Anand 388001, Gujarat",
         states=["GJ", "RJ", "MP"], colour=(214, 160, 40), risk=0.12, typical=["unit_sale_price"],
         products=[("Pure Cow Ghee", "Ghee", "1 L", 650), ("Desi Ghee", "Ghee", "500 ml", 330)], category="Food"),
    dict(company="Pushpak Home Care Ltd.", brand="Pushpak", addr="Sector 63, Noida 201301, Uttar Pradesh",
         states=["UP", "BR", "DL", "JH"], colour=(34, 48, 94), risk=0.8, typical=["mrp_integrity", "mrp", "price_arithmetic", "manufacturer"],
         products=[("Detergent Powder", "Washing Powder", "1 kg", 110), ("Dishwash Bar", "Dishwash Bar", "300 g", 30)],
         category="Household"),
    dict(company="Kesar Kanta Snacks", brand="Kesar Kanta", addr="Sitapura Industrial Area, Jaipur 302022, Rajasthan",
         states=["RJ", "MP", "UP", "HR"], colour=(217, 118, 43), risk=0.7, typical=["date", "consumer_care", "net_quantity", "pdp_legibility"],
         products=[("Aloo Bhujia", "Namkeen", "350 g", 85), ("Moong Dal", "Namkeen", "200 g", 50)], category="Food"),
    dict(company="Dhanvantari Herbals", brand="Dhanvantari", addr="SIDCUL, Haridwar 249403, Uttarakhand",
         states=["UK", "HP", "PB"], colour=(90, 120, 60), risk=0.45, typical=["best_before", "font_size"],
         products=[("Neem Face Wash", "Face Wash", "100 ml", 120), ("Herbal Hair Oil", "Hair Oil", "200 ml", 160)],
         category="Personal care"),
    dict(company="Meghdoot Aqua Pvt. Ltd.", brand="Meghdoot", addr="Dankuni Industrial Estate, Hooghly 712311, West Bengal",
         states=["WB", "OD", "AS"], colour=(40, 120, 180), risk=0.15, typical=["unit_sale_price"],
         products=[("Packaged Drinking Water", "Drinking Water", "1 L", 20)], category="Beverage"),
    dict(company="Tejas Power Cells", brand="Tejas", addr="Importer: Electronic City Phase 2, Bengaluru 560100, Karnataka",
         states=["KA", "TG", "AP"], colour=(60, 60, 60), risk=0.6, typical=["country_of_origin", "date", "consumer_care"],
         products=[("AA Alkaline Batteries", "Batteries", "4 N", 120), ("AAA Batteries", "Batteries", "2 N", 70)],
         category="Electronics", imported=True),
    dict(company="Chandni Cosmetics", brand="Chandni", addr="Okhla Phase 1, New Delhi 110020",
         states=["DL", "HR", "PB"], colour=(160, 60, 120), risk=0.65, typical=["manufacturer", "unit_sale_price", "consumer_care"],
         products=[("Kajal", "Kohl Pencil", "0.35 g", 199), ("Matte Lipstick", "Lipstick", "4.2 g", 349)],
         category="Personal care"),
    dict(company="Annadata Agro Mills", brand="Annadata Atta", addr="Focal Point, Ludhiana 141010, Punjab",
         states=["PB", "HR", "UP"], colour=(150, 100, 50), risk=0.55, typical=["quantity_verification", "unit_sale_price"],
         products=[("Whole Wheat Atta", "Wheat Flour", "5 kg", 285), ("Chakki Atta", "Wheat Flour", "10 kg", 520)],
         category="Food"),
]

PLACES = {
    "MH": ("Pune", "Shivajinagar Market"), "GJ": ("Ahmedabad", "Manek Chowk"), "KA": ("Bengaluru", "KR Market"),
    "TN": ("Chennai", "T. Nagar"), "KL": ("Kochi", "Broadway"), "RJ": ("Jaipur", "Johari Bazaar"),
    "MP": ("Indore", "Sarafa Bazaar"), "UP": ("Lucknow", "Aminabad"), "BR": ("Patna", "Boring Road"),
    "DL": ("New Delhi", "Lajpat Nagar"), "JH": ("Ranchi", "Main Road"), "HR": ("Gurugram", "Sadar Bazaar"),
    "UK": ("Dehradun", "Paltan Bazaar"), "HP": ("Shimla", "Lower Bazaar"), "PB": ("Ludhiana", "Chaura Bazaar"),
    "WB": ("Kolkata", "New Market"), "OD": ("Bhubaneswar", "Unit 1 Market"), "AS": ("Guwahati", "Fancy Bazaar"),
    "TG": ("Hyderabad", "Begum Bazaar"), "AP": ("Vijayawada", "Besant Road"),
}

SHORT_EN = {
    "manufacturer": "the manufacturer's address", "generic_name": "the generic name", "net_quantity": "the net quantity unit",
    "date": "the month and year of manufacture", "mrp": "the MRP declaration", "mrp_integrity": "an MRP over-sticker",
    "unit_sale_price": "the unit sale price", "price_arithmetic": "the unit price arithmetic",
    "consumer_care": "the consumer care details", "best_before": "the best-before date", "country_of_origin": "the country of origin",
    "pdp_legibility": "legibility on the display panel", "font_size": "numeral height (Rule 7)",
    "ecommerce_display": "declarations on the listing page", "quantity_verification": "short quantity",
}

CHECK_HI = {
    "manufacturer": "निर्माता का नाम-पता", "generic_name": "सामान्य नाम", "net_quantity": "शुद्ध मात्रा",
    "date": "निर्माण माह-वर्ष", "mrp": "अधिकतम खुदरा मूल्य", "mrp_integrity": "एमआरपी से छेड़छाड़",
    "unit_sale_price": "इकाई विक्रय मूल्य", "price_arithmetic": "इकाई मूल्य गणना", "consumer_care": "उपभोक्ता सेवा विवरण",
    "best_before": "उपयोग की अंतिम तिथि", "country_of_origin": "मूल देश", "pdp_legibility": "मुख्य पैनल पर स्पष्टता",
    "font_size": "अंकों की न्यूनतम ऊँचाई", "ecommerce_display": "लिस्टिंग पर घोषणाएँ", "quantity_verification": "मापी गई मात्रा",
}

FAIL_TEXT = {
    "manufacturer": ("Only the brand name is printed; the manufacturer's postal address is missing.",
                     "Print the full name and address of the manufacturer / packer."),
    "net_quantity": ("Net quantity is printed as '{qty_bad}' - a non-standard unit symbol.",
                     "Declare net quantity in standard units (g, kg, ml, L)."),
    "date": ("No month and year of manufacture or packing is printed on any visible face.",
             "Print the month and year of manufacture / packing."),
    "mrp": ("MRP is shown as '{mrp_bad}' without the words 'inclusive of all taxes'.",
            "Declare 'MRP Rs ... (inclusive of all taxes)'."),
    "mrp_integrity": ("A sticker reading '{sticker}' is pasted over the printed MRP.",
                      "Remove the over-sticker; MRP declarations must not be altered by stickers."),
    "unit_sale_price": ("No unit sale price (price per kg / L / unit) is declared.",
                        "Declare the unit sale price alongside the MRP."),
    "consumer_care": ("Only an e-mail address is given; no telephone number or postal address for complaints.",
                      "Add the address and telephone number of the consumer care office."),
    "best_before": ("No 'best before' or 'use by' date is printed for this perishable product.",
                    "Print the best before / use by date."),
    "country_of_origin": ("The product is imported but no country of origin is declared.",
                          "Declare the country of origin or manufacture."),
    "pdp_legibility": ("MRP and net quantity are printed on the back panel in low-contrast text, not on the principal display panel.",
                       "Move the declarations to the principal display panel in a contrasting colour."),
    "font_size": ("Net quantity numerals are about 1.2 mm high on a panel of roughly 300 cm², below the 2 mm minimum.",
                  "Increase numeral height to meet Rule 7."),
    "ecommerce_display": ("The listing shows MRP and quantity only; manufacturer and consumer care details are not displayed.",
                          "Display all mandatory declarations on the listing page."),
}

FONT_R = _find(_REGULAR)
FONT_B = _find(_BOLD) or FONT_R


def _font(size: int, bold: bool = False):
    path = FONT_B if bold else FONT_R
    return ImageFont.truetype(path, size) if path else ImageFont.load_default()


def draw_label(brand: dict, product: tuple, fields: dict, issues: set) -> tuple[Image.Image, list[dict]]:
    """Draw a fictional pack label; returns the image and the regions of each declaration (0-1000 boxes)."""
    W, H = 800, 1100
    img = Image.new("RGB", (W, H), brand["colour"])
    d = ImageDraw.Draw(img)
    # decorative band
    for i in range(0, W, 40):
        d.polygon([(i, 0), (i + 20, 30), (i + 40, 0)], fill=tuple(min(255, c + 40) for c in brand["colour"]))
    d.text((W / 2, 110), brand["brand"].upper(), font=_font(78, True), fill="white", anchor="mm")
    d.text((W / 2, 190), product[0], font=_font(46), fill=(255, 245, 225), anchor="mm")
    d.ellipse((W / 2 - 150, 240, W / 2 + 150, 520), fill=tuple(min(255, c + 60) for c in brand["colour"]), outline="white", width=4)
    d.text((W / 2, 380), product[1], font=_font(34, True), fill="white", anchor="mm")

    panel = (50, 560, W - 50, H - 40)
    d.rounded_rectangle(panel, 18, fill=(252, 249, 240))
    regions, y = [], panel[1] + 30
    small = "font_size" in issues

    def line(key, text, size=26, bold=False, colour=(40, 30, 20)):
        nonlocal y
        if not text:
            return
        f = _font(max(14, size - 10) if small and key in ("net_quantity", "mrp") else size, bold)
        box = d.textbbox((80, y), text, font=f)
        if box[2] > W - 70:  # wrap long lines once
            words, first = text.split(), ""
            while words and d.textbbox((80, y), first + " " + words[0], font=f)[2] < W - 70:
                first = (first + " " + words.pop(0)).strip()
            line(key, first, size, bold, colour)
            line(key, " ".join(words), size, bold, colour)
            return
        d.text((80, y), text, font=f, fill=colour)
        regions.append({"field": key, "image_index": 0,
                        "box": [int(1000 * box[1] / H), int(1000 * box[0] / W), int(1000 * box[3] / H), int(1000 * box[2] / W)]})
        y = box[3] + 14

    line("net_quantity", fields.get("net_quantity") and f"Net Qty: {fields['net_quantity']}", 34, True)
    if fields.get("mrp"):
        mrp_y = y
        line("mrp", f"MRP {fields['mrp']}", 32, True)
        if "mrp_integrity" in issues:
            d.rectangle((70, mrp_y - 6, 420, mrp_y + 44), fill=(255, 221, 51), outline=(120, 90, 0), width=2)
            d.text((90, mrp_y + 2), fields.get("_sticker", "MRP ₹ 135.00"), font=_font(30, True), fill=(60, 20, 0))
    line("unit_sale_price", fields.get("unit_sale_price") and f"Unit sale price: {fields['unit_sale_price']}", 22)
    line("date", fields.get("date") and f"Mfd: {fields['date']}", 24)
    line("best_before", fields.get("best_before") and f"Best before: {fields['best_before']}", 24)
    line("manufacturer", fields.get("manufacturer") and f"Mfd. by: {fields['manufacturer']}", 21)
    line("country_of_origin", fields.get("country_of_origin") and f"Country of origin: {fields['country_of_origin']}", 22)
    line("consumer_care", fields.get("consumer_care") and f"Consumer care: {fields['consumer_care']}", 21)
    return img, regions


def _evidence(cid: str, status: str, fields: dict) -> tuple[str, str | None]:
    if status == "fail":
        ev, rec = FAIL_TEXT.get(cid, ("Requirement not met.", "Correct the declaration."))
        return ev.format(qty_bad=fields.get("_qty_bad", ""), mrp_bad=fields.get("_mrp_bad", ""),
                         sticker=fields.get("_sticker", "")), rec
    if status == "unclear":
        return "Not clearly visible in the photograph; physical verification needed.", "Re-photograph or inspect the pack."
    if status == "not_applicable":
        return "Not applicable to this product.", None
    quote = {"manufacturer": "manufacturer", "generic_name": "generic_name", "net_quantity": "net_quantity", "date": "date",
             "mrp": "mrp", "unit_sale_price": "unit_sale_price", "consumer_care": "consumer_care",
             "best_before": "best_before", "country_of_origin": "country_of_origin"}.get(cid)
    if quote and fields.get(quote):
        return f"'{fields[quote]}'", None
    return {"mrp_integrity": "Printed MRP is clean, with no sticker or overwriting.",
            "pdp_legibility": "Net quantity and MRP are on the front panel in contrasting colour.",
            "font_size": "Numerals appear well above the Rule 7 minimum for this panel size.",
            "ecommerce_display": "All mandatory declarations are shown in the listing's specification table."}.get(cid, "Satisfied."), None


def _summary(verdict: str, failed: list[str], product: str) -> tuple[str, str]:
    if verdict == "compliant":
        return (f"All mandatory declarations on '{product}' are present and correctly made. No action is required.",
                f"'{product}' पर सभी अनिवार्य घोषणाएँ सही पाई गईं। कोई कार्रवाई आवश्यक नहीं है।")
    if verdict == "needs_review":
        return (f"Most declarations on '{product}' are in order, but some could not be verified from the photographs. "
                "A physical check of the pack is recommended.",
                f"'{product}' की कुछ घोषणाएँ फोटो से स्पष्ट नहीं हैं; पैक की भौतिक जाँच की सिफ़ारिश की जाती है।")
    names = ", ".join(failed[:4])
    hi = ", ".join(CHECK_HI.get(c, c) for c in failed[:4])
    return (f"'{product}' does not comply with the Packaged Commodities Rules: problems found with {names}. "
            "Consider issuing a show-cause notice to the manufacturer.",
            f"'{product}' पैकेजबंद वस्तु नियमों का पालन नहीं करता: {hi} में कमियाँ पाई गईं। निर्माता को कारण बताओ नोटिस जारी करने पर विचार करें।")


def seed_demo(db) -> dict:
    rng = random.Random(2026)
    now = models.utcnow()
    officers = [u.email for u in db.query(models.User).filter(models.User.role.in_(["inspector", "admin"])).all()] or ["inspector@metrology.gov.in"]
    controller = (db.query(models.User).filter(models.User.role == "controller").first() or
                  db.query(models.User).filter(models.User.role == "admin").first())
    created_scans: list[models.Scan] = []

    plan = []
    for b in BRANDS:
        n = 4 + int(b["risk"] * 4) + rng.randint(0, 1)
        plan += [b] * n
    rng.shuffle(plan)

    for i, b in enumerate(plan):
        product = rng.choice(b["products"])
        ecommerce = rng.random() < 0.18 and not b.get("imported")
        complaint = (not ecommerce) and rng.random() < 0.12
        mode = LISTING if ecommerce else LABEL
        state = rng.choice(b["states"])
        district, market = PLACES.get(state, ("", "Local market"))
        days_ago = int(abs(rng.gauss(0, 9))) % 28
        created = now - datetime.timedelta(days=days_ago, hours=rng.randint(0, 9), minutes=rng.randint(0, 59))

        bad = rng.random() < b["risk"]
        issues = set()
        if bad:
            pool = [c for c in b["typical"] if not (ecommerce and c in ("mrp_integrity", "font_size", "pdp_legibility", "date", "best_before", "quantity_verification"))]
            issues = set(rng.sample(pool, k=min(len(pool), rng.randint(1, 3)))) if pool else set()
            if ecommerce and rng.random() < 0.6:
                issues.add("ecommerce_display")
        unclear = set()
        if not ecommerce and rng.random() < 0.25:
            unclear.add(rng.choice(["font_size", "best_before", "date"]))
        unclear -= issues

        qty_text = product[2]
        q = parse_quantity(qty_text)
        mrp = product[3]
        base_unit = {"mass": ("kg", 1000), "volume": ("L", 1000), "number": ("unit", 1)}[q[1]]
        per = mrp / (q[0] / base_unit[1])
        fields = {
            "product_name": f"{b['brand']} {product[0]}", "brand": b["brand"], "generic_name": product[1],
            "manufacturer": f"{b['company']}, {b['addr']}", "manufacturer_name": b["company"],
            "net_quantity": qty_text, "mrp": f"₹{mrp:.2f} (Incl. of all taxes)",
            "unit_sale_price": f"₹{per:.2f} per {base_unit[0]}",
            "date": f"{rng.randint(1, 9):02d}/2026", "best_before": "9 months from manufacture" if b["category"] in ("Food", "Beverage", "Personal care") else None,
            "consumer_care": f"1800-{rng.randint(100, 999)}-{rng.randint(1000, 9999)}, care@{b['brand'].lower().replace(' ', '')}.example",
            "country_of_origin": "China" if b.get("imported") else None,
            "category": b["category"], "is_imported": bool(b.get("imported")), "languages": ["English", "Hindi"],
            "image_quality": "good", "seller": "Demo Retail Pvt. Ltd." if ecommerce else None,
        }
        if "manufacturer" in issues:
            fields["manufacturer"] = b["company"]
        if "net_quantity" in issues:
            fields["_qty_bad"] = qty_text.replace(" g", " gms").replace(" kg", " Kgs").replace(" L", " Ltrs")
            fields["net_quantity"] = fields["_qty_bad"]
        if "mrp" in issues:
            fields["_mrp_bad"] = f"₹{mrp}/-"
            fields["mrp"] = fields["_mrp_bad"]
        if "mrp_integrity" in issues:
            fields["_sticker"] = f"MRP ₹ {mrp + rng.choice([10, 15, 20]):.2f}"
        if "unit_sale_price" in issues:
            fields["unit_sale_price"] = None
        if "price_arithmetic" in issues:
            fields["unit_sale_price"] = f"₹{per * 1.25:.2f} per {base_unit[0]}"
        if "date" in issues:
            fields["date"] = None
        if "best_before" in issues:
            fields["best_before"] = None
        if "consumer_care" in issues:
            fields["consumer_care"] = f"care@{b['brand'].lower().replace(' ', '')}.example"
        if "country_of_origin" in issues:
            fields["country_of_origin"] = None

        measured = None
        if "quantity_verification" in issues:
            measured = f"{q[0] * 0.965 / (1000 if q[0] >= 1000 else 1):g} {'kg' if q[0] >= 1000 else 'g'}"
        elif not ecommerce and rng.random() < 0.2 and q[1] == "mass":
            measured = f"{q[0] * 0.995:g} g"

        ai_checks = {}
        for meta in checks_for(mode, "ai"):
            cid = meta["id"]
            status = "fail" if cid in issues else "unclear" if cid in unclear else "pass"
            if cid == "best_before" and not fields.get("best_before") and cid not in issues:
                status = "not_applicable"
            if cid == "country_of_origin" and not b.get("imported"):
                status = "not_applicable"
            ev, rec = _evidence(cid, status, fields)
            ai_checks[cid] = {"status": status, "evidence": ev, "recommendation": rec}
        checks = build_checks(mode, ai_checks, fields, measured)
        ai_verdict, score = compute_verdict(checks, use_officer=False)

        img, regions = draw_label(b, product, fields, issues)
        name = f"demo_{uuid.uuid4().hex}.jpg"
        img.save(UPLOAD_DIR / name, quality=85)
        photo_store.keep(db, [name])
        failed_ids = [c["id"] for c in checks if c["status"] == "fail"]
        failed_titles = [SHORT_EN.get(c["id"], c["title"].lower()) for c in checks if c["status"] == "fail"]
        summary = _summary(ai_verdict, failed_titles, fields["product_name"])[0]
        summary_hi = _summary(ai_verdict, failed_ids, fields["product_name"])[1]

        clean = {k: v for k, v in fields.items() if not k.startswith("_")}
        scan = models.Scan(
            created_at=created, inspector="public" if complaint else rng.choice(officers),
            source="ecommerce" if ecommerce else "complaint" if complaint else "label",
            source_url=f"https://shop.example.in/p/{b['brand'].lower().replace(' ', '-')}-{i}" if ecommerce else None,
            is_demo=True, original_filename=f"{b['brand']}_{product[0]}.jpg".replace(" ", "_"),
            image_file=name, images=[name], location=f"{market}" if not ecommerce else None, state=state,
            district=district if not ecommerce else None, measured_quantity=measured,
            product_name=clean["product_name"], brand=b["brand"], manufacturer_name=b["company"],
            manufacturer_key=manufacturer_key(b["company"]), category=b["category"], verdict=ai_verdict,
            ai_verdict=ai_verdict, score=score, summary=summary, summary_hi=summary_hi,
            raw_text="\n".join(str(v) for k, v in clean.items() if isinstance(v, str)), fields=clean, checks=checks,
            regions=regions, model="demo-data",
        )
        # Officer review on ~60% of older inspections, with occasional overrides
        if days_ago > 1 and rng.random() < 0.6:
            for c in scan.checks:
                if c["source"] == "ai" and c["status"] == "unclear":
                    c["officer_status"] = rng.choice(["pass", "fail"])
                    c["officer_note"] = "Verified on the physical pack during inspection."
                elif c["source"] == "ai" and c["status"] == "fail" and rng.random() < 0.08:
                    c["officer_status"] = "pass"
                    c["officer_note"] = "Declaration found on the side panel not covered by the photo."
                elif c["source"] == "ai" and c["status"] == "pass" and rng.random() < 0.03:
                    c["officer_status"] = "fail"
                    c["officer_note"] = "Declaration printed but illegible on the physical pack."
            scan.verdict, scan.score = compute_verdict(scan.checks)
            scan.review_status = "reviewed"
            scan.reviewed_by = scan.inspector if scan.inspector != "public" else officers[0]
            scan.reviewed_at = created + datetime.timedelta(hours=rng.randint(2, 30))
        db.add(scan)
        db.flush()
        created_scans.append(scan)

        if complaint:
            status = rng.choice(["received", "under_review", "action_taken", "closed"])
            db.add(models.Complaint(
                code=f"LM-D{uuid.uuid4().hex[:5].upper()}", scan_id=scan.id, name=rng.choice(["Priya S.", "Rahul K.", "Anita D.", None]),
                contact=None, state=state, place=f"{market}, {district}", purchased_online=False,
                description=rng.choice(["MRP sticker looks pasted over the original price.", "Pack feels lighter than declared.",
                                        "No expiry date on the pack.", "Shopkeeper charged more than MRP."]),
                status=status, officer_note=None if status == "received" else "Inspection team assigned; sample collected.",
                assigned_to=officers[0] if status != "received" else None, is_demo=True,
                created_at=created, updated_at=created + datetime.timedelta(days=1)))

    # Notices for a spread of non-compliant inspections
    bad_scans = [s for s in created_scans if s.verdict == "non_compliant" and s.review_status == "reviewed"]
    year = now.year
    serial = 0
    for s, status in zip(bad_scans, ["closed", "replied", "issued", "issued", "approved", "draft", "draft", "closed", "issued"]):
        failed = [c for c in s.checks if (c.get("officer_status") or c["status"]) == "fail"]
        sections = [PENALTIES["declarations"]] + ([PENALTIES["quantity"]] if any(c["id"] == "quantity_verification" for c in failed) else [])
        n = models.Notice(scan_id=s.id, status=status, addressee=s.fields.get("manufacturer") or s.manufacturer_name,
                          violations=[{"id": c["id"], "rule": c["rule"], "title": c["title"],
                                      "evidence": c.get("officer_note") if c.get("officer_status") else c["evidence"]} for c in failed],
                          sections=sections, reply_days=15, created_by=s.reviewed_by or officers[0], is_demo=True,
                          created_at=s.reviewed_at or s.created_at)
        if status != "draft":
            n.approved_by, n.approved_at = controller.email, n.created_at + datetime.timedelta(hours=6)
        if status in ("issued", "replied", "closed"):
            serial += 1
            n.number = f"LM/SCN/{year}/D{serial:03d}"
            n.issued_at = n.approved_at + datetime.timedelta(hours=2)
            n.reply_due = n.issued_at + datetime.timedelta(days=15)
        if status in ("replied", "closed"):
            n.reply_text = "We regret the lapse; labels have been corrected for all new batches and old stock withdrawn."
        if status == "closed":
            n.outcome = "Offence compounded under Section 48 on payment of Rs 10,000."
            n.closed_at = n.issued_at + datetime.timedelta(days=10)
        db.add(n)

    db.flush()
    return {"scans": len(created_scans), "notices": min(len(bad_scans), 9),
            "complaints": db.query(models.Complaint).filter(models.Complaint.is_demo.is_(True)).count()}


def clear_demo(db) -> dict:
    scans = db.query(models.Scan).filter(models.Scan.is_demo.is_(True)).all()
    ids = [s.id for s in scans]
    n_notices = db.query(models.Notice).filter(models.Notice.is_demo.is_(True)).delete(synchronize_session=False)
    n_complaints = db.query(models.Complaint).filter(models.Complaint.is_demo.is_(True)).delete(synchronize_session=False)
    for s in scans:
        for f in s.images or []:
            (UPLOAD_DIR / f).unlink(missing_ok=True)
        photo_store.forget(db, s.images or [])
        db.delete(s)
    db.flush()
    return {"scans": len(ids), "notices": n_notices, "complaints": n_complaints}


if __name__ == "__main__":
    from auth import ensure_default_users
    from database import SessionLocal, init_db

    init_db()
    session = SessionLocal()
    ensure_default_users(session)
    result = clear_demo(session)
    if "--clear" not in sys.argv:
        result = seed_demo(session)
    session.commit()
    print(result)
