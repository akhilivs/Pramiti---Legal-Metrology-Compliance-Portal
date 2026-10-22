"""Show-cause notice PDF raised from a non-compliant inspection."""
import datetime

from fpdf.enums import XPos, YPos
from fpdf.fonts import FontFace

from config import OFFICE_ADDRESS, OFFICE_NAME
from pdf_generator import GOLD, INDIGO, INK, MAROON, MUTED, SAND, Report, reference_no
from rules_kb import STATE_NAMES

IST = datetime.timezone(datetime.timedelta(hours=5, minutes=30))


def _ist(dt: datetime.datetime | None) -> str:
    if not dt:
        return "-"
    return dt.replace(tzinfo=datetime.timezone.utc).astimezone(IST).strftime("%d %B %Y")


class NoticeReport(Report):
    def __init__(self, draft: bool):
        super().__init__()
        self.draft = draft

    def footer(self):
        self.set_y(-15)
        self.set_draw_color(*SAND)
        self.line(16, self.get_y(), self.w - 16, self.get_y())
        self.ln(1.5)
        self.font(7.5, color=MUTED)
        self.cell(self.w - 32 - 20, 4, "Generated through the Pramiti Legal Metrology Compliance Portal")
        self.cell(0, 4, f"Page {self.page_no()}/{{nb}}", align="R")

    def header(self):
        super().header()
        if self.draft:
            with self.local_context(fill_opacity=0.08):
                self.font(90, True, MAROON)
                with self.rotation(35, self.w / 2, self.h / 2):
                    self.text(self.w / 2 - 60, self.h / 2 + 10, "DRAFT")


def generate_notice_pdf(notice, scan, signatory: dict | None) -> bytes:
    draft = notice.status in ("draft", "approved")
    pdf = NoticeReport(draft)
    pdf.alias_nb_pages()
    pdf.add_page()
    W = pdf.w - 32

    # Letterhead
    pdf.font(13, True, INDIGO)
    pdf.multi_cell(W, 6, pdf.txt(OFFICE_NAME.upper()), align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.font(9, color=MUTED)
    pdf.multi_cell(W, 4.6, pdf.txt(OFFICE_ADDRESS), align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(2)
    pdf.set_draw_color(*GOLD)
    pdf.set_line_width(0.5)
    pdf.line(16, pdf.get_y(), pdf.w - 16, pdf.get_y())
    pdf.set_line_width(0.2)
    pdf.ln(4)

    pdf.font(10, True, INK)
    pdf.cell(W / 2, 5, pdf.txt(f"No. {notice.number or 'LM/SCN/____ (to be allotted on issue)'}"))
    issued = notice.issued_at or datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    pdf.cell(W / 2, 5, pdf.txt(f"Date: {_ist(issued) if notice.issued_at else '__________'}"), align="R",
             new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(4)

    pdf.font(14, True, MAROON)
    pdf.cell(W, 7, "SHOW-CAUSE NOTICE", align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.font(8.5, color=MUTED)
    pdf.cell(W, 4.5, "(Under the Legal Metrology Act, 2009 and the Legal Metrology (Packaged Commodities) Rules, 2011)",
             align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(4)

    pdf.font(10, True, INK)
    pdf.cell(W, 5, "To,", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.font(10, color=INK)
    pdf.multi_cell(W * 0.7, 5, pdf.txt(notice.addressee or "The Manufacturer / Packer"), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(3)

    product = scan.product_name or (scan.fields or {}).get("generic_name") or "the commodity"
    place = ", ".join(x for x in (scan.location, scan.district, STATE_NAMES.get(scan.state or "")) if x)
    if scan.source == "ecommerce":
        where = f"on the e-commerce listing {scan.source_url or ''}".strip()
    else:
        where = f"at {place}" if place else "during inspection"

    pdf.font(10, True, INK)
    pdf.multi_cell(W, 5, pdf.txt(f"Subject: Contravention of the Legal Metrology (Packaged Commodities) Rules, 2011 in "
                                 f"respect of '{product}' - reg."), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(2)
    pdf.font(10, color=INK)
    body = (
        f"Whereas the pre-packaged commodity '{product}'"
        + (f" (brand {scan.brand})" if scan.brand else "")
        + f" was examined {where} on {_ist(scan.created_at)} (inspection reference {reference_no(scan)}), "
        "and the following contraventions of the Legal Metrology Act, 2009 and the rules made thereunder were observed:"
    )
    pdf.multi_cell(W, 5.2, pdf.txt(body), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(2)

    pdf.set_fill_color(255, 255, 255)
    pdf.set_draw_color(*SAND)
    pdf.font(9, color=INK)
    with pdf.table(col_widths=(10, 34, 134), line_height=4.8, padding=1.6, text_align="LEFT",
                   headings_style=FontFace(emphasis="BOLD", color=INDIGO), borders_layout="HORIZONTAL_LINES",
                   cell_fill_mode="NONE") as table:
        head = table.row()
        for h in ("Sl.", "Provision", "Contravention observed"):
            head.cell(h)
        for i, v in enumerate(notice.violations or [], start=1):
            row = table.row()
            row.cell(str(i))
            row.cell(pdf.txt(v.get("rule", "")), style=FontFace(emphasis="BOLD", color=MUTED))
            row.cell(pdf.txt(f"{v.get('title', '')}: {v.get('evidence', '')}"))
    pdf.ln(3)

    pdf.font(10, color=INK)
    pdf.multi_cell(W, 5.2, "And whereas the above contraventions attract the following penal provisions:",
                   new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    for sec in notice.sections or []:
        pdf.set_x(22)
        pdf.multi_cell(W - 6, 5, pdf.txt(f"- {sec}"), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(2)

    days = notice.reply_days or 15
    pdf.multi_cell(W, 5.2, pdf.txt(
        f"Now, therefore, you are hereby directed to show cause, within {days} days of receipt of this notice, why "
        "action should not be initiated against you under the said provisions. You may, if you so desire, apply for "
        "compounding of the offence under Section 48 of the Legal Metrology Act, 2009. If no reply is received within "
        "the stipulated period, it shall be presumed that you have nothing to submit and further action shall be "
        "taken as per law without further reference to you."
    ), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    if notice.reply_due:
        pdf.ln(1)
        pdf.font(10, True, INK)
        pdf.cell(W, 5, pdf.txt(f"Reply due by: {_ist(notice.reply_due)}"), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    if notice.remarks:
        pdf.ln(2)
        pdf.font(10, color=INK)
        pdf.multi_cell(W, 5.2, pdf.txt(f"Remarks: {notice.remarks}"), new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.ln(14)
    x = pdf.w - 16 - 75
    pdf.set_x(x)
    pdf.font(10, color=INK)
    pdf.cell(75, 5, "(Signature)", align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_x(x)
    pdf.font(10, True, INK)
    pdf.cell(75, 5, pdf.txt((signatory or {}).get("name", "Authorised Officer")), align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_x(x)
    pdf.font(9, color=MUTED)
    pdf.cell(75, 4.6, pdf.txt((signatory or {}).get("designation") or "Legal Metrology"), align="C",
             new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.ln(8)
    pdf.font(8.5, color=MUTED)
    pdf.multi_cell(W, 4.4, pdf.txt(
        "Copy to: Office file.  Enclosure: Inspection report " + reference_no(scan) +
        (".  This is a demonstration document." if notice.is_demo else ".")
    ), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    return bytes(pdf.output())
