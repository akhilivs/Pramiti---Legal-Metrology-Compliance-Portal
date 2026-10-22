"""Inspection report PDF (fpdf2).

Uses a Unicode TTF when one is available so Hindi / regional label text renders correctly;
otherwise falls back to the core Helvetica font with non-Latin characters replaced.
"""
import datetime
import os
from pathlib import Path

from fpdf import FPDF
from fpdf.enums import XPos, YPos
from fpdf.fonts import FontFace

from config import PDF_FONT_PATH
from rules_kb import STATE_NAMES

INDIGO = (34, 48, 94)
SAFFRON = (217, 118, 43)
GREEN = (31, 107, 69)
MAROON = (138, 31, 29)
GOLD = (176, 141, 62)
INK = (42, 31, 20)
MUTED = (107, 93, 75)
IVORY = (250, 246, 238)
SAND = (234, 223, 200)

VERDICT = {
    "compliant": ("COMPLIANT", GREEN),
    "non_compliant": ("NON-COMPLIANT", MAROON),
    "needs_review": ("NEEDS MANUAL REVIEW", SAFFRON),
}
STATUS = {
    "pass": ("PASS", GREEN),
    "fail": ("FAIL", MAROON),
    "unclear": ("UNCLEAR", SAFFRON),
    "not_applicable": ("N/A", MUTED),
}

_FONT_DIRS = [Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts", Path("/usr/share/fonts"),
              Path("/Library/Fonts"), Path("/System/Library/Fonts/Supplemental")]
_REGULAR = ["arial.ttf", "DejaVuSans.ttf", "NotoSans-Regular.ttf", "Arial.ttf"]
_BOLD = ["arialbd.ttf", "DejaVuSans-Bold.ttf", "NotoSans-Bold.ttf", "Arial Bold.ttf"]
_INDIC = ["ARIALUNI.ttf", "NotoSansDevanagari-Regular.ttf", "Arial Unicode.ttf", "FreeSans.ttf"]


def _find(names: list[str]) -> str | None:
    for d in _FONT_DIRS:
        if not d.exists():
            continue
        for n in names:
            direct = d / n
            if direct.exists():
                return str(direct)
            for hit in d.rglob(n):
                return str(hit)
    return None


class Report(FPDF):
    def __init__(self):
        super().__init__(format="A4")
        self.set_margins(16, 18, 16)
        self.set_auto_page_break(True, margin=22)
        self.unicode = False
        regular = PDF_FONT_PATH or _find(_REGULAR)
        bold = _find(_BOLD)
        if regular:
            self.add_font("Body", "", regular)
            self.add_font("Body", "B", bold or regular)
            self.unicode = True
            indic = _find(_INDIC)
            if indic:
                self.add_font("Indic", "", indic)
                self.set_fallback_fonts(["Indic"], exact_match=False)
            try:
                self.set_text_shaping(True)
            except Exception:
                pass
        self.font_name = "Body" if self.unicode else "Helvetica"

    def txt(self, s) -> str:
        s = "" if s is None else str(s)
        if self.unicode:
            return s
        return s.replace("₹", "Rs.").encode("latin-1", "replace").decode("latin-1")

    def font(self, size: float, bold: bool = False, color=INK):
        self.set_font(self.font_name, "B" if bold else "", size)
        self.set_text_color(*color)

    def header(self):
        w = self.w / 3
        for i, c in enumerate((SAFFRON, (255, 255, 255), GREEN)):
            self.set_fill_color(*c)
            self.rect(i * w, 0, w, 3, "F")
        self.set_fill_color(*INDIGO)
        self.rect(self.w / 2 - 1.5, 0, 3, 3, "F")
        self.set_draw_color(*GOLD)
        self.set_line_width(0.3)
        self.line(16, 5.5, self.w - 16, 5.5)
        self.set_y(9)
        self.font(8, color=MUTED)
        self.cell(0, 4, self.txt("Pramiti  |  Legal Metrology Compliance Portal"), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(4)

    def footer(self):
        self.set_y(-15)
        self.set_draw_color(*SAND)
        self.line(16, self.get_y(), self.w - 16, self.get_y())
        self.ln(1.5)
        self.font(7.5, color=MUTED)
        self.cell(self.w - 32 - 20, 4, self.txt("AI-assisted preliminary assessment under the Legal Metrology "
                                                "(Packaged Commodities) Rules, 2011. To be verified by the officer."))
        self.cell(0, 4, f"Page {self.page_no()}/{{nb}}", align="R")

    def section(self, title: str):
        self.ln(4)
        self.font(11.5, True, INDIGO)
        self.cell(0, 7, self.txt(title), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_draw_color(*SAFFRON)
        self.set_line_width(0.6)
        self.line(16, self.get_y(), 40, self.get_y())
        self.set_line_width(0.2)
        self.ln(3)


def reference_no(scan) -> str:
    return f"PRAMITI/{scan.created_at:%Y}/{scan.id:05d}"


def generate_pdf_report(scan, upload_dir: Path) -> bytes:
    pdf = Report()
    pdf.alias_nb_pages()
    pdf.add_page()
    fields = scan.fields or {}

    # Title block
    pdf.font(19, True, INDIGO)
    pdf.cell(0, 9, pdf.txt("Inspection Report"), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.font(9.5, color=MUTED)
    kind = {"ecommerce": "E-commerce listing", "complaint": "Consumer complaint"}.get(scan.source, "Pre-packaged commodity label")
    review = f"Reviewed by {scan.reviewed_by}" if scan.review_status == "reviewed" else "AI findings - officer review pending"
    pdf.cell(0, 5, pdf.txt(f"{kind}  |  Reference {reference_no(scan)}  |  {review}"),
             new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    if scan.is_demo:
        pdf.font(8.5, True, SAFFRON)
        pdf.cell(0, 5, "DEMONSTRATION RECORD - not an actual inspection", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(5)

    # Verdict panel with image on the right
    top = pdf.get_y()
    img_w = 52
    text_w = pdf.w - 32 - img_w - 6
    label, colour = VERDICT.get(scan.verdict, ("UNKNOWN", MUTED))
    pdf.set_fill_color(*IVORY)
    pdf.set_draw_color(*GOLD)
    pdf.rect(16, top, text_w, 62, "DF")
    pdf.set_fill_color(*colour)
    pdf.rect(16, top, 2.2, 62, "F")

    pdf.set_xy(22, top + 5)
    pdf.font(8, True, MUTED)
    pdf.cell(text_w - 10, 4, "VERDICT", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_x(22)
    pdf.font(17, True, colour)
    pdf.cell(text_w - 10, 9, label, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_x(22)
    pdf.font(9.5, color=INK)
    pdf.cell(text_w - 10, 5, pdf.txt(f"Compliance score: {scan.score:.0f}% of applicable checks passed"),
             new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(2)
    created = scan.created_at.replace(tzinfo=datetime.timezone.utc).astimezone(
        datetime.timezone(datetime.timedelta(hours=5, minutes=30)))
    meta = [
        ("Product", scan.product_name or fields.get("generic_name") or "-"),
        ("Brand", scan.brand or "-"),
        ("Inspected", created.strftime("%d %b %Y, %I:%M %p IST")),
        ("Officer", scan.inspector or "-"),
        ("Location", ", ".join(x for x in (scan.location, scan.district, STATE_NAMES.get(scan.state or "")) if x) or "-"),
    ]
    if scan.source_url:
        meta.append(("Listing", scan.source_url))
    for k, v in meta:
        pdf.set_x(22)
        pdf.font(8.5, True, MUTED)
        pdf.cell(22, 5.2, k)
        pdf.font(9, color=INK)
        pdf.cell(text_w - 34, 5.2, pdf.txt(v)[:70], new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    img_path = upload_dir / scan.image_file if scan.image_file else None
    if img_path and img_path.exists():
        pdf.image(str(img_path), x=pdf.w - 16 - img_w, y=top, w=img_w, h=62, keep_aspect_ratio=True)
        pdf.set_draw_color(*GOLD)
        pdf.rect(pdf.w - 16 - img_w, top, img_w, 62)
    pdf.set_y(top + 66)

    if scan.summary:
        pdf.font(9.5, color=INK)
        pdf.multi_cell(0, 5, pdf.txt(scan.summary), new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="L")

    # Checks
    pdf.section("Rule-wise findings")
    pdf.set_fill_color(255, 255, 255)
    pdf.set_draw_color(*SAND)
    pdf.font(8.5, color=INK)
    head_style = FontFace(emphasis="BOLD", color=INDIGO)
    with pdf.table(col_widths=(22, 46, 20, 90), line_height=4.6, padding=1.6, headings_style=head_style,
                   borders_layout="HORIZONTAL_LINES", text_align="LEFT", cell_fill_mode="NONE") as table:
        head = table.row()
        for h in ("Rule", "Requirement", "Status", "Observation / Action"):
            head.cell(h)
        for c in scan.checks or []:
            eff = c.get("officer_status") or c["status"]
            st, st_col = STATUS.get(eff, ("?", MUTED))
            obs = c.get("evidence") or ""
            if c.get("officer_status") and c["officer_status"] != c["status"]:
                obs += f"\nOfficer override (AI said {STATUS[c['status']][0]}): {c.get('officer_note') or 'no note'}"
            if c.get("recommendation") and eff not in ("pass", "not_applicable"):
                obs += f"\nAction: {c['recommendation']}"
            row = table.row()
            row.cell(pdf.txt(c["rule"]), style=FontFace(emphasis="BOLD", color=MUTED))
            row.cell(pdf.txt(c["title"]))
            row.cell(st, style=FontFace(emphasis="BOLD", color=st_col))
            row.cell(pdf.txt(obs))

    # Fields
    pdf.section("Declarations read from the label")
    rows = [
        ("Generic name", "generic_name"), ("Manufacturer / Packer", "manufacturer"),
        ("Net quantity", "net_quantity"), ("MRP", "mrp"), ("Unit sale price", "unit_sale_price"),
        ("Mfg / Pkd date", "date"), ("Best before", "best_before"), ("Consumer care", "consumer_care"),
        ("Country of origin", "country_of_origin"), ("Batch no.", "batch_no"), ("FSSAI licence", "fssai_license"),
    ]
    pdf.font(9, color=INK)
    pdf.set_draw_color(*SAND)
    with pdf.table(col_widths=(45, 133), line_height=4.8, padding=1.6, first_row_as_headings=False,
                   borders_layout="HORIZONTAL_LINES", text_align="LEFT", cell_fill_mode="NONE") as table:
        for label_, key in rows:
            val = fields.get(key)
            row = table.row()
            row.cell(label_, style=FontFace(emphasis="BOLD", color=MUTED))
            row.cell(pdf.txt(val or "Not found on label"), style=None if val else FontFace(color=MAROON))

    extra = [f for f in (scan.images or [])[1:] if (upload_dir / f).exists()]
    if extra:
        pdf.section("Additional photographs")
        y = pdf.get_y()
        if y + 48 > pdf.h - 25:
            pdf.add_page()
            y = pdf.get_y()
        for n, f in enumerate(extra):
            x = 16 + n * 46
            pdf.image(str(upload_dir / f), x=x, y=y, w=42, h=42, keep_aspect_ratio=True)
            pdf.set_draw_color(*GOLD)
            pdf.rect(x, y, 42, 42)
        pdf.set_y(y + 46)

    if scan.measured_quantity:
        pdf.section("Physical verification")
        pdf.font(9.5, color=INK)
        pdf.multi_cell(0, 5, pdf.txt(f"Declared net quantity: {fields.get('net_quantity') or '-'}.  "
                                     f"Measured by officer: {scan.measured_quantity}."),
                       new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="L")

    if scan.notes:
        pdf.section("Officer's notes")
        pdf.font(9.5, color=INK)
        pdf.multi_cell(0, 5, pdf.txt(scan.notes), new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="L")

    pdf.section("Full text transcribed from label")
    pdf.font(8.5, color=MUTED)
    pdf.multi_cell(0, 4.4, pdf.txt(scan.raw_text or "No text detected."), new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="L")

    pdf.ln(10)
    pdf.font(9, color=INK)
    pdf.cell(90, 5, "______________________________")
    pdf.cell(0, 5, "______________________________", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.font(8, color=MUTED)
    pdf.cell(90, 4.5, "Signature of Inspecting Officer")
    pdf.cell(0, 4.5, "Seal / Date", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    return bytes(pdf.output())
