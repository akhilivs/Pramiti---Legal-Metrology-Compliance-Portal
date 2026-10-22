"""Show-cause notice workflow: draft (inspector) -> approved -> issued (controller) -> replied -> closed."""
import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from auth import audit, current_user, profile, require_role
from database import get_db
from notice_pdf import generate_notice_pdf
from pdf_generator import reference_no
from rules_kb import PENALTIES
from services import effective_status

router = APIRouter(prefix="/api/notices", tags=["notices"])


def notice_view(db: Session, n: models.Notice) -> dict:
    scan = db.get(models.Scan, n.scan_id)
    return {
        "id": n.id, "number": n.number, "status": n.status, "scan_id": n.scan_id,
        "scan_ref": reference_no(scan) if scan else None,
        "product_name": scan.product_name if scan else None, "brand": scan.brand if scan else None,
        "addressee": n.addressee, "violations": n.violations or [], "sections": n.sections or [],
        "reply_days": n.reply_days, "remarks": n.remarks, "reply_text": n.reply_text, "outcome": n.outcome,
        "created_by": n.created_by, "created_at": n.created_at.isoformat() + "Z",
        "approved_by": n.approved_by, "approved_at": n.approved_at.isoformat() + "Z" if n.approved_at else None,
        "issued_at": n.issued_at.isoformat() + "Z" if n.issued_at else None,
        "reply_due": n.reply_due.isoformat() + "Z" if n.reply_due else None,
        "closed_at": n.closed_at.isoformat() + "Z" if n.closed_at else None,
        "overdue": bool(n.status == "issued" and n.reply_due and n.reply_due < models.utcnow()),
        "is_demo": bool(n.is_demo),
    }


def _get(db: Session, notice_id: int) -> models.Notice:
    n = db.get(models.Notice, notice_id)
    if not n:
        raise HTTPException(status_code=404, detail="Notice not found")
    return n


class CreateBody(BaseModel):
    scan_id: int
    reply_days: int = 15
    remarks: str | None = None
    addressee: str | None = None
    check_ids: list[str] | None = None  # default: every failed check


@router.post("")
def create_notice(body: CreateBody, db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    scan = db.get(models.Scan, body.scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Inspection not found")
    failed = [c for c in scan.checks or [] if effective_status(c) == "fail"]
    if body.check_ids:
        failed = [c for c in failed if c["id"] in body.check_ids]
    if not failed:
        raise HTTPException(status_code=400, detail="There are no failed checks to cite in a notice.")
    violations = [{"id": c["id"], "rule": c["rule"], "title": c["title"],
                   "evidence": (c.get("officer_note") if c.get("officer_status") else None) or c.get("evidence", "")}
                  for c in failed]
    sections = [PENALTIES["declarations"]]
    if any(c["id"] == "quantity_verification" for c in failed):
        sections.append(PENALTIES["quantity"])
    fields = scan.fields or {}
    addressee = (body.addressee or "").strip() or fields.get("manufacturer") or scan.manufacturer_name or "The Manufacturer / Packer"
    if scan.source == "ecommerce" and fields.get("seller"):
        addressee += f"\n(Seller on e-commerce platform: {fields['seller']})"
    n = models.Notice(scan_id=scan.id, addressee=addressee, violations=violations, sections=sections,
                      reply_days=max(1, min(90, body.reply_days)), remarks=(body.remarks or "").strip() or None,
                      created_by=user.email, is_demo=bool(scan.is_demo))
    db.add(n)
    db.flush()
    audit(db, user.email, "notice.draft", f"notice:{n.id}", f"scan:{scan.id}")
    db.commit()
    return notice_view(db, n)


@router.get("")
def list_notices(status: str | None = None, db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    q = db.query(models.Notice)
    if status:
        q = q.filter(models.Notice.status == status)
    return [notice_view(db, n) for n in q.order_by(models.Notice.id.desc()).limit(500).all()]


@router.get("/{notice_id}")
def get_notice(notice_id: int, db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    return notice_view(db, _get(db, notice_id))


class UpdateBody(BaseModel):
    addressee: str | None = None
    remarks: str | None = None
    reply_days: int | None = None


@router.patch("/{notice_id}")
def update_notice(notice_id: int, body: UpdateBody, db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    n = _get(db, notice_id)
    if n.status not in ("draft", "approved"):
        raise HTTPException(status_code=409, detail="An issued notice cannot be edited.")
    if body.addressee is not None:
        n.addressee = body.addressee.strip()
    if body.remarks is not None:
        n.remarks = body.remarks.strip() or None
    if body.reply_days is not None:
        n.reply_days = max(1, min(90, body.reply_days))
    n.status = "draft"  # edits need fresh approval
    n.approved_by = n.approved_at = None
    audit(db, user.email, "notice.edit", f"notice:{n.id}")
    db.commit()
    return notice_view(db, n)


def _transition(db: Session, n: models.Notice, allowed: tuple[str, ...], to: str, user: models.User, detail: str | None = None):
    if n.status not in allowed:
        raise HTTPException(status_code=409, detail=f"A notice in '{n.status}' status cannot move to '{to}'.")
    n.status = to
    audit(db, user.email, f"notice.{to}", f"notice:{n.id}", detail)


@router.post("/{notice_id}/approve")
def approve(notice_id: int, db: Session = Depends(get_db), user: models.User = Depends(require_role("controller"))):
    n = _get(db, notice_id)
    _transition(db, n, ("draft",), "approved", user)
    n.approved_by, n.approved_at = user.email, models.utcnow()
    db.commit()
    return notice_view(db, n)


@router.post("/{notice_id}/issue")
def issue(notice_id: int, db: Session = Depends(get_db), user: models.User = Depends(require_role("controller"))):
    n = _get(db, notice_id)
    _transition(db, n, ("approved",), "issued", user)
    now = models.utcnow()
    year_count = db.query(models.Notice).filter(models.Notice.number.like(f"LM/SCN/{now.year}/%"),
                                                models.Notice.is_demo.is_(False)).count()
    n.number = f"LM/SCN/{now.year}/{year_count + 1:04d}"
    n.issued_at = now
    n.reply_due = now + datetime.timedelta(days=n.reply_days or 15)
    db.commit()
    return notice_view(db, n)


class ReplyBody(BaseModel):
    reply_text: str


@router.post("/{notice_id}/reply")
def record_reply(notice_id: int, body: ReplyBody, db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    n = _get(db, notice_id)
    _transition(db, n, ("issued",), "replied", user)
    n.reply_text = body.reply_text.strip()
    db.commit()
    return notice_view(db, n)


class CloseBody(BaseModel):
    outcome: str


@router.post("/{notice_id}/close")
def close(notice_id: int, body: CloseBody, db: Session = Depends(get_db), user: models.User = Depends(require_role("controller"))):
    n = _get(db, notice_id)
    _transition(db, n, ("issued", "replied"), "closed", user, body.outcome[:200])
    n.outcome, n.closed_at = body.outcome.strip(), models.utcnow()
    db.commit()
    return notice_view(db, n)


@router.delete("/{notice_id}")
def delete_draft(notice_id: int, db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    n = _get(db, notice_id)
    if n.status != "draft":
        raise HTTPException(status_code=409, detail="Only draft notices can be deleted.")
    db.delete(n)
    audit(db, user.email, "notice.delete", f"notice:{notice_id}")
    db.commit()
    return {"deleted": notice_id}


@router.get("/{notice_id}/pdf")
def notice_pdf(notice_id: int, db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    n = _get(db, notice_id)
    scan = db.get(models.Scan, n.scan_id)
    signer = db.query(models.User).filter(models.User.email == n.approved_by).first() if n.approved_by else None
    pdf = generate_notice_pdf(n, scan, profile(signer) if signer else None)
    name = (n.number or f"draft_{n.id}").replace("/", "-")
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="Notice_{name}.pdf"'})
