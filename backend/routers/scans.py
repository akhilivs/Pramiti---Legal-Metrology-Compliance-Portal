from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

import models
import photo_store
from analyzer import AnalysisError
from auth import audit, current_user, require_role
from config import MAX_IMAGES, UPLOAD_DIR
from database import get_db
from ecommerce import ListingError, fetch_listing
from pdf_generator import generate_pdf_report
from rules_kb import LISTING
from services import create_scan, read_images, refresh_verdict, scan_detail, scan_summary

router = APIRouter(prefix="/api", tags=["scans"])


def get_scan_or_404(db: Session, scan_id: int) -> models.Scan:
    scan = db.get(models.Scan, scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Inspection not found")
    return scan


@router.post("/scan")
async def scan_package(
    request: Request,
    files: list[UploadFile] = File(..., description="1-4 photos of the same package"),
    location: str | None = Form(None),
    state: str | None = Form(None),
    district: str | None = Form(None),
    measured_quantity: str | None = Form(None),
    notes: str | None = Form(None),
    db: Session = Depends(get_db),
    user: models.User = Depends(current_user),
):
    if not files:
        raise HTTPException(status_code=400, detail="Add at least one photo of the package.")
    images = await read_images(files, MAX_IMAGES)
    try:
        scan = create_scan(db, images=images, inspector=user.email, original_filename=files[0].filename or "capture.jpg",
                           location=location, state=state, district=district,
                           measured_quantity=measured_quantity, notes=notes)
    except AnalysisError as e:
        raise HTTPException(status_code=422, detail=str(e))
    audit(db, user.email, "scan.create", f"scan:{scan.id}", scan.verdict)
    db.commit()
    return scan_detail(request, scan, db)


@router.post("/scan/listing")
async def scan_listing(
    request: Request,
    url: str | None = Form(None),
    listing_text: str | None = Form(None),
    files: list[UploadFile] = File(default=[], description="Optional screenshots of the listing"),
    state: str | None = Form(None),
    notes: str | None = Form(None),
    db: Session = Depends(get_db),
    user: models.User = Depends(current_user),
):
    """Rule 6(10): check an e-commerce product listing (URL, pasted text and/or screenshots)."""
    url = (url or "").strip() or None
    text = (listing_text or "").strip()
    images = await read_images(files, MAX_IMAGES) if files else []
    title = None
    if url and not text and not images:
        try:
            listing = fetch_listing(url)
        except ListingError as e:
            raise HTTPException(status_code=422, detail=str(e))
        text, images, title = listing["text"], listing["images"], listing["title"]
    elif url:
        text = f"URL: {url}\n{text}"
    if not text and not images:
        raise HTTPException(status_code=400, detail="Give a listing URL, paste the listing text, or upload screenshots.")
    try:
        scan = create_scan(db, images=images, inspector=user.email, mode=LISTING, source="ecommerce",
                           listing_text=text or None, source_url=url,
                           original_filename=(title or url or "Listing")[:200], state=state, notes=notes)
    except AnalysisError as e:
        raise HTTPException(status_code=422, detail=str(e))
    audit(db, user.email, "scan.create", f"scan:{scan.id}", f"ecommerce {scan.verdict}")
    db.commit()
    return scan_detail(request, scan, db)


@router.get("/scans")
def list_scans(
    request: Request,
    q: str | None = None,
    verdict: str | None = Query(None, pattern="^(compliant|non_compliant|needs_review)$"),
    source: str | None = Query(None, pattern="^(label|ecommerce|complaint)$"),
    state: str | None = None,
    review: str | None = Query(None, pattern="^(pending|reviewed)$"),
    manufacturer: str | None = None,
    batch_id: int | None = None,
    limit: int = Query(300, le=2000),
    db: Session = Depends(get_db),
    user: models.User = Depends(current_user),
):
    query = db.query(models.Scan)
    if verdict:
        query = query.filter(models.Scan.verdict == verdict)
    if source:
        query = query.filter(models.Scan.source == source)
    if state:
        query = query.filter(models.Scan.state == state.upper())
    if review:
        query = query.filter(models.Scan.review_status == review)
    if manufacturer:
        query = query.filter(models.Scan.manufacturer_key == manufacturer)
    if batch_id:
        query = query.filter(models.Scan.batch_id == batch_id)
    if q:
        like = f"%{q.strip()}%"
        filters = [models.Scan.product_name.ilike(like), models.Scan.brand.ilike(like),
                   models.Scan.manufacturer_name.ilike(like), models.Scan.original_filename.ilike(like),
                   models.Scan.location.ilike(like), models.Scan.district.ilike(like)]
        if q.strip().lstrip("#").isdigit():
            filters.append(models.Scan.id == int(q.strip().lstrip("#")))
        query = query.filter(or_(*filters))
    scans = query.order_by(models.Scan.created_at.desc()).limit(limit).all()
    return [scan_summary(request, s) for s in scans]


@router.get("/scans/{scan_id}")
def get_scan(scan_id: int, request: Request, db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    return scan_detail(request, get_scan_or_404(db, scan_id), db)


class CheckReview(BaseModel):
    id: str
    officer_status: str | None = None  # None = accept the AI finding
    officer_note: str | None = None


class ReviewBody(BaseModel):
    checks: list[CheckReview]
    notes: str | None = None


@router.post("/scans/{scan_id}/review")
def review_scan(scan_id: int, body: ReviewBody, request: Request, db: Session = Depends(get_db),
                user: models.User = Depends(current_user)):
    """Officer confirms or overrides each AI finding; the verdict is recomputed from the final statuses."""
    scan = get_scan_or_404(db, scan_id)
    by_id = {c.id: c for c in body.checks}
    changed = []
    checks = []
    for c in scan.checks or []:
        c = dict(c)
        r = by_id.get(c["id"])
        if r is not None:
            status = r.officer_status if r.officer_status in ("pass", "fail", "unclear", "not_applicable") else None
            if status == c["status"]:
                status = None
            if status and not (r.officer_note or "").strip():
                raise HTTPException(status_code=400, detail=f"Give a reason for overriding '{c['title']}'.")
            if status != c.get("officer_status"):
                changed.append(f"{c['id']}: {c['status']} -> {status or c['status']}")
            c["officer_status"] = status
            c["officer_note"] = (r.officer_note or "").strip() or None
        checks.append(c)
    scan.checks = checks
    if body.notes is not None:
        scan.notes = body.notes.strip() or None
    refresh_verdict(scan)
    scan.review_status = "reviewed"
    scan.reviewed_by = user.email
    scan.reviewed_at = models.utcnow()
    audit(db, user.email, "scan.review", f"scan:{scan.id}", "; ".join(changed) or "all AI findings confirmed")
    db.commit()
    return scan_detail(request, scan, db)


@router.delete("/scans/{scan_id}")
def delete_scan(scan_id: int, db: Session = Depends(get_db), user: models.User = Depends(require_role("controller"))):
    scan = get_scan_or_404(db, scan_id)
    if db.query(models.Notice).filter(models.Notice.scan_id == scan_id, models.Notice.status != "draft").count():
        raise HTTPException(status_code=409, detail="This inspection has an approved or issued notice and cannot be deleted.")
    db.query(models.Notice).filter(models.Notice.scan_id == scan_id).delete()
    db.query(models.Complaint).filter(models.Complaint.scan_id == scan_id).update({"scan_id": None})
    files = scan.images or ([scan.image_file] if scan.image_file else [])
    for f in files:
        (UPLOAD_DIR / f).unlink(missing_ok=True)
    photo_store.forget(db, files)
    db.delete(scan)
    audit(db, user.email, "scan.delete", f"scan:{scan_id}", scan.product_name)
    db.commit()
    return {"deleted": scan_id}


@router.get("/report/{scan_id}")
def download_pdf_report(scan_id: int, db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    scan = get_scan_or_404(db, scan_id)
    pdf_bytes = generate_pdf_report(scan, UPLOAD_DIR)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="Pramiti_inspection_{scan_id}.pdf"'},
    )

