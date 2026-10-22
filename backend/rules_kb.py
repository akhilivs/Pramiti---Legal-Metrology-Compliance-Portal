"""Curated knowledge base of the Legal Metrology (Packaged Commodities) Rules, 2011.

The bundled Gazette PDF is a scanned image without a text layer, so these summaries are
always available to the analyser. `build_rules_index.py` can additionally transcribe the
full PDF for retrieval (see rag_engine.py).

The CHECKS list defines every check the analyser must answer, in display order.
"""

RULES = [
    {
        "id": "rule-2",
        "rule": "Rule 2",
        "title": "Definitions",
        "text": (
            "'Principal display panel' (PDP) means the total surface area of the package where the "
            "information required under these rules is given, in a manner that it is easily visible "
            "to the consumer at the time of purchase. 'Retail sale price' means the maximum price at "
            "which the commodity in packaged form may be sold to the consumer, inclusive of all taxes. "
            "'Retail package' means packages intended for retail sale to the ultimate consumer. "
            "'Pre-packed commodity' means a commodity which, without the purchaser being present, is "
            "placed in a package so that the quantity contained cannot be altered without the package "
            "being opened or undergoing perceptible modification."
        ),
    },
    {
        "id": "rule-3",
        "rule": "Rule 3",
        "title": "Applicability of Chapter II",
        "text": (
            "Chapter II (retail packages) does not apply to (a) packages of commodities containing more "
            "than 25 kg or 25 litre, excluding cement and fertiliser sold in bags up to 50 kg; and "
            "(b) packaged commodities meant for industrial or institutional consumers buying directly "
            "from the manufacturer."
        ),
    },
    {
        "id": "rule-4",
        "rule": "Rule 4",
        "title": "Regulation of pre-packing and sale",
        "text": (
            "No person shall pre-pack, or cause or permit to be pre-packed, any commodity for sale, "
            "distribution or delivery unless the package bears thereon a label securely affixed "
            "containing the declarations required under these rules."
        ),
    },
    {
        "id": "rule-6",
        "rule": "Rule 6",
        "title": "Declarations to be made on every package",
        "text": (
            "Rule 6(1): every package shall bear a definite, plain and conspicuous declaration of "
            "(a) the name and address of the manufacturer; where the manufacturer is not the packer, the "
            "name and address of the manufacturer and the packer; for imported packages, the name and "
            "address of the importer (a name and address without 'manufactured by' / 'packed by' is "
            "presumed to be the manufacturer's); "
            "(b) the common or generic name of the commodity, and for packages with more than one "
            "product, the name and number or quantity of each; "
            "(c) the net quantity in terms of the standard unit of weight or measure, or in number; "
            "(d) the month and year in which the commodity is manufactured, pre-packed or imported; "
            "(e) the retail sale price of the package, declared as 'Maximum (or Max.) retail price Rs. ... "
            "inclusive of all taxes'; "
            "(f) dimensions of the commodity where sizes are relevant. "
            "Rule 6(2): every package shall bear the name, address, telephone number and e-mail address "
            "(if available) of the person or office to be contacted in case of consumer complaints. "
            "Rule 6(3): individual stickers shall not be affixed to alter or make the required declarations. "
            "Later amendments added: 'best before' / 'use by' date for commodities that may become unfit "
            "for consumption, country of origin for imported packages (2017), and the unit sale price "
            "alongside the MRP (2021)."
        ),
    },
    {
        "id": "rule-7",
        "rule": "Rule 7",
        "title": "Principal display panel - size of letters and numerals",
        "text": (
            "Rule 7(2) of the 2011 Rules: the height of any numeral in the declarations on the principal "
            "display panel shall not be less than - Table I (net quantity declared by weight or volume): "
            "up to 200 g/ml: 1 mm (2 mm when blown, formed, moulded, embossed or perforated); above 200 g/ml "
            "up to 500 g/ml: 2 mm (4 mm); above 500 g/ml: 4 mm (6 mm). Table II (net quantity declared by "
            "length, area or number; by area of principal display panel): up to 100 sq cm: 1 mm (2 mm); "
            "above 100 up to 500 sq cm: 2 mm (4 mm); above 500 up to 2500 sq cm: 4 mm (6 mm); above 2500 sq "
            "cm: 6 mm (6 mm). Rule 7(3): letters shall be at least 1 mm high (2 mm when blown, formed, "
            "moulded, embossed or perforated), and the width of a letter or numeral at least one-third of "
            "its height (except numeral 1 and letters i, I, l). The 2017 amendment applies the "
            "display-panel-area table to all declarations."
        ),
    },
    {
        "id": "rule-8",
        "rule": "Rule 8",
        "title": "Where declarations appear",
        "text": (
            "Every declaration required under these rules shall appear on the principal display panel, "
            "and the area surrounding the quantity declaration shall be free from other printed matter. Declarations shall be legible, prominent, definite, plain and unambiguous, in a "
            "colour contrasting conspicuously with the background, and in English or Hindi (Devanagari) "
            "with optional additional languages. The MRP shall not be obliterated, and a sticker with a "
            "higher MRP shall not be affixed over the printed MRP."
        ),
    },
    {
        "id": "net-quantity-units",
        "rule": "Net quantity",
        "title": "Units for net quantity",
        "text": (
            "Net quantity shall be expressed in standard units: mass in g or kg, volume in ml or L, "
            "length in mm, cm or m, area in square units, or by number. Symbols such as 'gms', 'Kgs', "
            "'ltrs' are non-standard. The declaration should be accompanied by words like 'Net quantity', "
            "'Net weight', 'Net volume' or 'Net contents'."
        ),
    },
    {
        "id": "rule-6-ecommerce",
        "rule": "Rule 6(10)",
        "title": "E-commerce listings (2017 amendment)",
        "text": (
            "An e-commerce entity shall ensure that the declarations required on the package (name and "
            "address of manufacturer/packer/importer, generic name, net quantity, retail sale price, "
            "consumer care details, country of origin, unit sale price etc.) are displayed on the digital "
            "and electronic network used for the e-commerce transaction."
        ),
    },
    {
        "id": "schedule-1",
        "rule": "First Schedule",
        "title": "Maximum permissible error on net quantity",
        "text": (
            "Declared by weight or volume (g or ml): up to 50 - 9%; 50 to 100 - 4.5 g/ml; 100 to 200 - "
            "4.5%; 200 to 300 - 9 g/ml; 300 to 500 - 3%; 500 to 1000 - 15 g/ml; 1000 to 10000 - 1.5%; "
            "10000 to 15000 - 150 g/ml; more than 15000 - 1%. By length: 2% up to 10 m, thereafter 1%. "
            "By area: 4% up to 10 sq m, thereafter 1%. By number: 2%. Percentages are rounded to the "
            "nearest 0.1 g/ml up to 1000 g/ml and to the next whole g/ml above."
        ),
    },
    {
        "id": "act-penalties",
        "rule": "LM Act 2009, s.36",
        "title": "Penalties for non-standard packages",
        "text": (
            "Section 18 of the Legal Metrology Act, 2009 requires pre-packaged commodities to bear the "
            "prescribed declarations. Section 36(1): selling or distributing packages that do not conform "
            "to the declarations is punishable with fine up to Rs 25,000; second offence up to Rs 50,000; "
            "subsequent offences fine not less than Rs 50,000 extending to Rs 1,00,000, or imprisonment up "
            "to one year, or both. Section 36(2): net quantity less than declared beyond the permissible "
            "error is punishable with fine not less than Rs 10,000 extending to Rs 50,000; subsequent "
            "offences up to Rs 1,00,000, or imprisonment up to one year, or both. Offences may be "
            "compounded under Section 48."
        ),
    },
]


# Every check, in display order. `source` says who answers it:
#   ai   - the vision model, from the photos / listing
#   rule - computed deterministically by quantity.py from the extracted fields / officer input
# `modes` limits a check to product labels and/or e-commerce listings.
LABEL, LISTING = "label", "ecommerce"
CHECKS = [
    {"id": "manufacturer", "rule": "Rule 6(1)(a)", "title": "Manufacturer / packer / importer name & address",
     "source": "ai", "modes": [LABEL, LISTING],
     "requirement": "Full name AND postal address of the manufacturer (and packer, if different; importer if imported)."},
    {"id": "generic_name", "rule": "Rule 6(1)(b)", "title": "Common or generic name of commodity",
     "source": "ai", "modes": [LABEL, LISTING],
     "requirement": "What the product is (e.g. 'Toned Milk', 'Wheat Flour (Atta)'), not just a brand name."},
    {"id": "net_quantity", "rule": "Rule 6(1)(c)", "title": "Net quantity in standard units",
     "source": "ai", "modes": [LABEL, LISTING],
     "requirement": "Net quantity with a standard unit symbol (g, kg, ml, L, m, number). Flag non-standard units like 'gms'/'ltrs'."},
    {"id": "date", "rule": "Rule 6(1)(d)", "title": "Month & year of manufacture / packing / import",
     "source": "ai", "modes": [LABEL],
     "requirement": "At least month and year of manufacture, pre-packing or import."},
    {"id": "mrp", "rule": "Rule 6(1)(e)", "title": "Retail sale price (MRP) inclusive of all taxes",
     "source": "ai", "modes": [LABEL, LISTING],
     "requirement": "MRP in Rupees with the words 'inclusive of all taxes' (or equivalent). Fail if MRP is missing or the tax-inclusive phrase is missing."},
    {"id": "mrp_integrity", "rule": "Rule 6(3)", "title": "MRP not tampered (no over-sticker / overwriting)",
     "source": "ai", "modes": [LABEL],
     "requirement": "Look for a sticker pasted over the printed MRP, two different MRPs, an overwritten, scratched or re-stamped price, or a price that looks altered. Tell-tale signs: a patch of different colour, font or texture on the price, a label edge or shadow around it, or printed text (e.g. '...inclusive of all taxes') that is cut off or hidden under it. Fail with a description if any is seen; pass only if the printed MRP is clean."},
    {"id": "unit_sale_price", "rule": "Rule 6 (2021 amdt.)", "title": "Unit sale price",
     "source": "ai", "modes": [LABEL, LISTING],
     "requirement": "Price per standard unit (e.g. Rs/kg, Rs/g, Rs/L, Rs/ml, Rs/unit) alongside MRP. Not applicable for single-unit commodities sold by number = 1."},
    {"id": "price_arithmetic", "rule": "Rule 6 (2021 amdt.)", "title": "Unit sale price matches MRP / quantity",
     "source": "rule", "modes": [LABEL, LISTING],
     "requirement": "Computed by Pramiti from the declared MRP, net quantity and unit sale price."},
    {"id": "consumer_care", "rule": "Rule 6(2)", "title": "Consumer care details",
     "source": "ai", "modes": [LABEL, LISTING],
     "requirement": "Name/office, address and telephone number (plus e-mail if available) for consumer complaints. Mark 'fail' if address or telephone is missing, saying which."},
    {"id": "best_before", "rule": "Rule 6 (amdt.)", "title": "Best before / use by date",
     "source": "ai", "modes": [LABEL],
     "requirement": "Required only for commodities that may become unfit for consumption (food, cosmetics, medicines, batteries etc.). Use 'not_applicable' otherwise."},
    {"id": "country_of_origin", "rule": "Rule 6 (2017 amdt.)", "title": "Country of origin (imported goods)",
     "source": "ai", "modes": [LABEL, LISTING],
     "requirement": "Required only if the product is imported. Use 'not_applicable' for domestic products."},
    {"id": "pdp_legibility", "rule": "Rule 8", "title": "Legible, prominent, on principal display panel",
     "source": "ai", "modes": [LABEL],
     "requirement": "Net quantity and MRP visible on the principal display panel, in contrasting colour, in English or Hindi, not obscured."},
    {"id": "font_size", "rule": "Rule 7", "title": "Minimum numeral height for PDP area",
     "source": "ai", "modes": [LABEL],
     "requirement": "Estimate the net quantity, the display panel area and the numeral height of the net-quantity/MRP declaration from the package size; compare with Rule 7 Table I (by net quantity) or Table II (by panel area). Fail only if clearly below the minimum; use 'unclear' if scale cannot be judged."},
    {"id": "ecommerce_display", "rule": "Rule 6(10)", "title": "Declarations displayed on the listing page",
     "source": "ai", "modes": [LISTING],
     "requirement": "All mandatory declarations are visible on the product listing itself (text, specification table or listing images), not only on the physical pack."},
    {"id": "quantity_verification", "rule": "First Schedule", "title": "Measured quantity within permissible error",
     "source": "rule", "modes": [LABEL],
     "requirement": "Computed by Pramiti when the officer enters the measured net quantity."},
]

CHECK_IDS = [c["id"] for c in CHECKS]
CHECK_BY_ID = {c["id"]: c for c in CHECKS}


def checks_for(mode: str, source: str | None = None) -> list[dict]:
    return [c for c in CHECKS if mode in c["modes"] and (source is None or c["source"] == source)]


# Penalty provisions cited in show-cause notices
PENALTIES = {
    "declarations": "Section 36(1) of the Legal Metrology Act, 2009 read with Section 18 and Rule 6 of the "
                    "Legal Metrology (Packaged Commodities) Rules, 2011: fine up to Rs 25,000 for the first "
                    "offence, up to Rs 50,000 for the second, and not less than Rs 50,000 extending to "
                    "Rs 1,00,000 or imprisonment up to one year or both for subsequent offences.",
    "quantity": "Section 36(2) of the Legal Metrology Act, 2009: where the net quantity is less than declared "
                "beyond the maximum permissible error, fine not less than Rs 10,000 extending to Rs 50,000, "
                "and for subsequent offences up to Rs 1,00,000 or imprisonment up to one year or both.",
}

# States and Union Territories, with positions on the tile-grid map (col, row)
STATES = [
    ("JK", "Jammu & Kashmir", 2, 0), ("LA", "Ladakh", 3, 0),
    ("CH", "Chandigarh", 1, 1), ("PB", "Punjab", 2, 1), ("HP", "Himachal Pradesh", 3, 1),
    ("UK", "Uttarakhand", 4, 1), ("SK", "Sikkim", 6, 1), ("AR", "Arunachal Pradesh", 8, 1),
    ("RJ", "Rajasthan", 1, 2), ("HR", "Haryana", 2, 2), ("DL", "Delhi", 3, 2), ("UP", "Uttar Pradesh", 4, 2),
    ("BR", "Bihar", 5, 2), ("WB", "West Bengal", 6, 2), ("AS", "Assam", 7, 2), ("NL", "Nagaland", 8, 2),
    ("GJ", "Gujarat", 1, 3), ("MP", "Madhya Pradesh", 2, 3), ("CG", "Chhattisgarh", 3, 3),
    ("JH", "Jharkhand", 4, 3), ("ML", "Meghalaya", 7, 3), ("MN", "Manipur", 8, 3),
    ("DN", "Dadra & Nagar Haveli and Daman & Diu", 0, 4), ("MH", "Maharashtra", 1, 4),
    ("TG", "Telangana", 2, 4), ("OD", "Odisha", 4, 4), ("TR", "Tripura", 7, 4), ("MZ", "Mizoram", 8, 4),
    ("GA", "Goa", 1, 5), ("KA", "Karnataka", 2, 5), ("AP", "Andhra Pradesh", 3, 5),
    ("LD", "Lakshadweep", 0, 6), ("KL", "Kerala", 2, 6), ("TN", "Tamil Nadu", 3, 6),
    ("PY", "Puducherry", 4, 6), ("AN", "Andaman & Nicobar Islands", 6, 6),
]
STATE_NAMES = {code: name for code, name, _, _ in STATES}
