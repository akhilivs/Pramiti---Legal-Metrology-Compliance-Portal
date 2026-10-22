"""Consumer complaint portal (public) and the officers' complaint desk."""
import secrets
import time
from collections import defaultdict

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from analyzer import AnalysisError
from auth import audit, current_user
from config import COMPLAINTS_PER_HOUR, MAX_IMAGES
from database import get_db
from pdf_generator import reference_no
from rules_kb import STATE_NAMES
from services import create_scan, read_images, scan_summary

router = APIRouter(prefix="/api", tags=["complaints"])
STATUSES = ("received", "under_review", "action_taken", "closed")
_hits: dict[str, list[float]] = defaultdict(list)


def _rate_limit(ip: str):
    now = time.time()
    _hits[ip] = [t for t in _hits[ip] if now - t < 3600]
    if len(_hits[ip]) >= COMPLAINTS_PER_HOUR:
        raise HTTPException(status_code=429, detail="Too many complaints from this connection. Please try again later.")
    _hits[ip].append(now)


def _code() -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "LM-" + "".join(secrets.choice(alphabet) for _ in range(6))


def public_view(c: models.Complaint, scan: models.Scan | None) -> dict:
    return {
        "code": c.code,
        "status": c.status,
        "submitted_at": c.created_at.isoformat() + "Z",
        "updated_at": c.updated_at.isoformat() + "Z",
        "officer_note": c.officer_note,
        "product_name": scan.product_name if scan else None,
        "preliminary": {
            "verdict": scan.ai_verdict,
            "summary": scan.summary,
            "summary_hi": scan.summary_hi,
            "issues": [ch["title"] for ch in (scan.checks or []) if ch["status"] == "fail"],
        } if scan else None,
    }


@router.post("/public/complaints")
async def submit_complaint(
    request: Request,
    files: list[UploadFile] = File(..., description="1-4 photos of the product"),
    description: str = Form(...),
    name: str | None = Form(None),
    contact: str | None = Form(None),
    state: str | None = Form(None),
    place: str | None = Form(None),
    purchased_online: bool = Form(False),
    db: Session = Depends(get_db),
):
    _rate_limit(request.client.host if request.client else "unknown")
    if not files:
        raise HTTPException(status_code=400, detail="Please attach at least one clear photo of the product label.")
    images = await read_images(files, MAX_IMAGES)
    state = (state or "").strip().upper() or None
    try:
        scan = create_scan(db, images=images, inspector="public", source="complaint",
                           original_filename=files[0].filename or "complaint.jpg",
                           location=place, state=state, notes=f"Consumer complaint: {description.strip()[:1000]}")
    except AnalysisError as e:
        raise HTTPException(status_code=422, detail=str(e))
    code = _code()
    while db.query(models.Complaint).filter(models.Complaint.code == code).first():
        code = _code()
    c = models.Complaint(code=code, scan_id=scan.id, name=(name or "").strip() or None, contact=(contact or "").strip() or None,
                         state=state if state in STATE_NAMES else None, place=(place or "").strip() or None,
                         purchased_online=purchased_online, description=description.strip()[:2000])
    db.add(c)
    audit(db, "public", "complaint.create", f"complaint:{code}", f"scan:{scan.id}")
    db.commit()
    return public_view(c, scan)


@router.get("/public/complaints/{code}")
def track_complaint(code: str, db: Session = Depends(get_db)):
    c = db.query(models.Complaint).filter(models.Complaint.code == code.strip().upper()).first()
    if not c:
        raise HTTPException(status_code=404, detail="No complaint found with this tracking number.")
    return public_view(c, db.get(models.Scan, c.scan_id) if c.scan_id else None)


# ---------------------------------------------------------------- officers
def officer_view(request: Request, db: Session, c: models.Complaint) -> dict:
    scan = db.get(models.Scan, c.scan_id) if c.scan_id else None
    return {
        "id": c.id, "code": c.code, "status": c.status, "name": c.name, "contact": c.contact,
        "state": c.state, "place": c.place, "purchased_online": c.purchased_online, "description": c.description,
        "officer_note": c.officer_note, "assigned_to": c.assigned_to, "is_demo": bool(c.is_demo),
        "created_at": c.created_at.isoformat() + "Z", "updated_at": c.updated_at.isoformat() + "Z",
        "scan": {**scan_summary(request, scan), "reference": reference_no(scan)} if scan else None,
    }


@router.get("/complaints")
def list_complaints(request: Request, status: str | None = None, db: Session = Depends(get_db),
                    user: models.User = Depends(current_user)):
    q = db.query(models.Complaint)
    if status:
        q = q.filter(models.Complaint.status == status)
    return [officer_view(request, db, c) for c in q.order_by(models.Complaint.id.desc()).limit(500).all()]


class ComplaintUpdate(BaseModel):
    status: str | None = None
    officer_note: str | None = None
    assign_to_me: bool = False


@router.patch("/complaints/{complaint_id}")
def update_complaint(complaint_id: int, body: ComplaintUpdate, request: Request, db: Session = Depends(get_db),
                     user: models.User = Depends(current_user)):
    c = db.get(models.Complaint, complaint_id)
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if body.status:
        if body.status not in STATUSES:
            raise HTTPException(status_code=400, detail="Unknown status")
        c.status = body.status
    if body.officer_note is not None:
        c.officer_note = body.officer_note.strip() or None
    if body.assign_to_me:
        c.assigned_to = user.email
    c.updated_at = models.utcnow()
    audit(db, user.email, "complaint.update", f"complaint:{c.code}", c.status)
    db.commit()
    return officer_view(request, db, c)
