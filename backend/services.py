"""Shared inspection logic used by single scans, batches, e-commerce checks and complaints."""
import io
import re
import uuid

from fastapi import HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy.orm import Session

import models
import photo_store
from analyzer import analyze
from config import MAX_UPLOAD_MB, UPLOAD_DIR
from quantity import price_arithmetic_check, quantity_check
from rules_kb import CHECKS, LABEL, STATE_NAMES

_COMPANY_SUFFIX = re.compile(
    r"\b(pvt|private|ltd|limited|llp|inc|co|company|corp|corporation|industries|india|the|and|&)\b\.?", re.I
)


def manufacturer_key(name: str | None) -> str | None:
    """'M/s. Shreeji Dairy Products Pvt. Ltd.' -> 'shreeji dairy products' (for grouping repeat offenders)."""
    if not name:
        return None
    s = re.sub(r"^(m/s\.?|messrs\.?)\s*", "", name.strip(), flags=re.I)
    s = _COMPANY_SUFFIX.sub(" ", s.lower())
    s = re.sub(r"[^a-z0-9ऀ-ॿ ]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s or None


# ---------------------------------------------------------------- images
async def read_images(files: list[UploadFile], max_count: int) -> list[Image.Image]:
    if len(files) > max_count:
        raise HTTPException(status_code=400, detail=f"Upload at most {max_count} images.")
    images = []
    for f in files:
        data = await f.read()
        # decoding is CPU work; off the event loop so other requests are not held up
        images.append(await run_in_threadpool(load_image, data, f.filename or "image"))
    return images


def load_image(data: bytes, name: str) -> Image.Image:
    if len(data) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"'{name}' is larger than {MAX_UPLOAD_MB} MB.")
    try:
        image = Image.open(io.BytesIO(data))
        image.draft("RGB", (2400, 2400))  # JPEGs decode straight at reduced size: several times faster
        image = ImageOps.exif_transpose(image).convert("RGB")
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status_code=400, detail=f"'{name}' is not a readable image (use JPG, PNG or WEBP).")
    image.thumbnail((2400, 2400))
    return image


def save_images(images: list[Image.Image]) -> list[str]:
    names = []
    for image in images:
        name = f"{uuid.uuid4().hex}.jpg"
        image.save(UPLOAD_DIR / name, format="JPEG", quality=88)
        names.append(name)
    return names


# ---------------------------------------------------------------- checks & verdict
def build_checks(mode: str, ai_checks: dict, fields: dict, measured_quantity: str | None) -> list[dict]:
    checks = []
    for meta in CHECKS:
        if mode not in meta["modes"]:
            continue
        cid = meta["id"]
        if cid == "price_arithmetic":
            c = price_arithmetic_check(fields.get("mrp"), fields.get("net_quantity"), fields.get("unit_sale_price"))
        elif cid == "quantity_verification":
            c = quantity_check(fields.get("net_quantity"), measured_quantity)
            if c is None:
                continue  # officer did not weigh the pack
        else:
            c = ai_checks.get(cid) or {"status": "unclear", "evidence": "Not assessed by the model.", "recommendation": None}
        checks.append({
            "id": cid,
            "rule": meta["rule"],
            "title": meta["title"],
            "source": meta["source"],
            "status": c["status"],
            "evidence": c.get("evidence") or "",
            "recommendation": c.get("recommendation"),
            **({"detail": c["detail"]} if c.get("detail") else {}),
            "officer_status": None,
            "officer_note": None,
        })
    return checks


def effective_status(check: dict) -> str:
    return check.get("officer_status") or check["status"]


def compute_verdict(checks: list[dict], use_officer: bool = True) -> tuple[str, float]:
    statuses = [effective_status(c) if use_officer else c["status"] for c in checks]
    applicable = [s for s in statuses if s != "not_applicable"]
    passed = sum(s == "pass" for s in applicable)
    score = round(100 * passed / len(applicable), 1) if applicable else 100.0
    if "fail" in statuses:
        return "non_compliant", score
    if "unclear" in statuses:
        return "needs_review", score
    return "compliant", score


def refresh_verdict(scan: models.Scan):
    scan.verdict, scan.score = compute_verdict(scan.checks or [])


# ---------------------------------------------------------------- create
def create_scan(
    db: Session,
    *,
    images: list[Image.Image],
    inspector: str,
    mode: str = LABEL,
    source: str | None = None,
    listing_text: str | None = None,
    source_url: str | None = None,
    original_filename: str = "capture.jpg",
    location: str | None = None,
    state: str | None = None,
    district: str | None = None,
    measured_quantity: str | None = None,
    notes: str | None = None,
    batch_id: int | None = None,
) -> models.Scan:
    """Analyse, then persist images and the scan. Raises AnalysisError on AI failure (nothing is saved)."""
    result = analyze(images, mode=mode, listing_text=listing_text)
    fields = result["fields"]
    measured_quantity = (measured_quantity or "").strip() or None
    checks = build_checks(mode, result["ai_checks"], fields, measured_quantity)
    ai_verdict, score = compute_verdict(checks, use_officer=False)
    # The model writes its summary before Pramiti's computed checks run - add what they found
    computed_fails = [c for c in checks if c["source"] == "rule" and c["status"] == "fail"]
    if computed_fails:
        result["summary"] = (result["summary"] or "").rstrip() + " However, Pramiti's computed checks found: " + "; ".join(
            c["evidence"] for c in computed_fails)
        result["summary_hi"] = (result["summary_hi"] or "").rstrip() + " किंतु Pramiti की गणना-आधारित जाँच में त्रुटि पाई गई: " + "; ".join(
            {"price_arithmetic": "इकाई विक्रय मूल्य एमआरपी ÷ मात्रा से मेल नहीं खाता",
             "quantity_verification": "मापी गई मात्रा अनुमेय त्रुटि से कम है"}.get(c["id"], c["title"]) for c in computed_fails) + "।"

    names = save_images(images)
    photo_store.keep(db, names)
    state = (state or "").strip().upper() or None
    scan = models.Scan(
        inspector=inspector,
        source=source or mode,
        source_url=source_url,
        batch_id=batch_id,
        original_filename=original_filename,
        image_file=names[0] if names else None,
        images=names,
        location=(location or "").strip() or None,
        state=state if state in STATE_NAMES else None,
        district=(district or "").strip() or None,
        measured_quantity=measured_quantity,
        notes=(notes or "").strip() or None,
        product_name=fields.get("product_name"),
        brand=fields.get("brand"),
        manufacturer_name=fields.get("manufacturer_name"),
        manufacturer_key=manufacturer_key(fields.get("manufacturer_name") or fields.get("brand")),
        category=fields.get("category"),
        verdict=ai_verdict,
        ai_verdict=ai_verdict,
        score=score,
        summary=result["summary"],
        summary_hi=result["summary_hi"],
        raw_text=result["raw_text"],
        fields=fields,
        checks=checks,
        regions=result["regions"],
        model=result["model"],
    )
    db.add(scan)
    db.flush()
    return scan


# ---------------------------------------------------------------- serialisation
def upload_url(request: Request, name: str) -> str:
    return str(request.base_url) + f"uploads/{name}"


def scan_summary(request: Request, s: models.Scan) -> dict:
    checks = s.checks or []
    return {
        "id": s.id,
        "created_at": s.created_at.isoformat() + "Z",
        "product_name": s.product_name,
        "brand": s.brand,
        "manufacturer_name": s.manufacturer_name,
        "manufacturer_key": s.manufacturer_key,
        "category": s.category,
        "source": s.source,
        "source_url": s.source_url,
        "original_filename": s.original_filename,
        "image_url": upload_url(request, s.image_file) if s.image_file else None,
        "verdict": s.verdict,
        "ai_verdict": s.ai_verdict,
        "score": s.score,
        "location": s.location,
        "state": s.state,
        "district": s.district,
        "review_status": s.review_status,
        "is_demo": bool(s.is_demo),
        "fail_count": sum(effective_status(c) == "fail" for c in checks),
        "unclear_count": sum(effective_status(c) == "unclear" for c in checks),
    }


def scan_detail(request: Request, s: models.Scan, db: Session) -> dict:
    notices = db.query(models.Notice).filter(models.Notice.scan_id == s.id).order_by(models.Notice.id.desc()).all()
    complaint = db.query(models.Complaint).filter(models.Complaint.scan_id == s.id).first()
    return {
        **scan_summary(request, s),
        "inspector": s.inspector,
        "image_urls": [upload_url(request, f) for f in (s.images or ([s.image_file] if s.image_file else []))],
        "measured_quantity": s.measured_quantity,
        "notes": s.notes,
        "summary": s.summary,
        "summary_hi": s.summary_hi,
        "raw_text": s.raw_text,
        "fields": s.fields or {},
        "checks": s.checks or [],
        "regions": s.regions or [],
        "model": s.model,
        "reviewed_by": s.reviewed_by,
        "reviewed_at": s.reviewed_at.isoformat() + "Z" if s.reviewed_at else None,
        "notices": [{"id": n.id, "number": n.number, "status": n.status} for n in notices],
        "complaint": {"id": complaint.id, "code": complaint.code, "status": complaint.status} if complaint else None,
    }

