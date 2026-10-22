from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

import batch_worker
import models
from auth import audit, current_user
from database import get_db

router = APIRouter(prefix="/api/batches", tags=["batches"])
MAX_ITEMS = 200


def batch_view(db: Session, b: models.Batch, with_items: bool = False) -> dict:
    items = db.query(models.BatchItem).filter(models.BatchItem.batch_id == b.id).order_by(models.BatchItem.id).all()
    scans = {}
    if with_items:
        ids = [i.scan_id for i in items if i.scan_id]
        scans = {s.id: s for s in db.query(models.Scan).filter(models.Scan.id.in_(ids)).all()} if ids else {}
    counts = {k: sum(i.status == k for i in items) for k in ("queued", "running", "done", "failed")}
    view = {
        "id": b.id, "name": b.name, "created_by": b.created_by, "created_at": b.created_at.isoformat() + "Z",
        "status": b.status, "state": b.state, "location": b.location, "total": len(items), **counts,
        "non_compliant": sum(1 for i in items if i.scan_id and scans.get(i.scan_id) and scans[i.scan_id].verdict == "non_compliant"),
    }
    if with_items:
        view["items"] = [
            {
                "id": i.id, "kind": i.kind, "label": i.label, "status": i.status, "error": i.error, "scan_id": i.scan_id,
                "verdict": scans[i.scan_id].verdict if i.scan_id in scans else None,
                "score": scans[i.scan_id].score if i.scan_id in scans else None,
                "product_name": scans[i.scan_id].product_name if i.scan_id in scans else None,
            }
            for i in items
        ]
    return view


@router.post("")
async def create_batch(
    name: str | None = Form(None),
    files: list[UploadFile] = File(default=[], description="Photos (one product each) and/or ZIP files"),
    urls: str | None = Form(None, description="E-commerce listing URLs, one per line"),
    state: str | None = Form(None),
    location: str | None = Form(None),
    db: Session = Depends(get_db),
    user: models.User = Depends(current_user),
):
    entries: list[tuple[str, str, list]] = []  # (kind, label, payload)
    for f in files:
        data = await f.read()
        fname = f.filename or "upload"
        if Path(fname).suffix.lower() == ".zip":
            try:
                entries += [("files", label, names) for label, names in batch_worker.items_from_zip(data, MAX_ITEMS)]
            except Exception:
                raise HTTPException(status_code=400, detail=f"'{fname}' is not a valid ZIP file.")
        elif Path(fname).suffix.lower() in batch_worker.IMAGE_EXT or (f.content_type or "").startswith("image/"):
            entries.append(("files", fname, [batch_worker.stash(data, fname)]))
    for line in (urls or "").splitlines():
        line = line.strip().strip(",")
        if line.startswith(("http://", "https://")):
            entries.append(("url", line, [line]))
    if not entries:
        raise HTTPException(status_code=400, detail="Add product photos, a ZIP of photos, or listing URLs.")
    if len(entries) > MAX_ITEMS:
        raise HTTPException(status_code=400, detail=f"A batch can hold at most {MAX_ITEMS} products.")

    batch = models.Batch(name=(name or "").strip() or f"Batch of {len(entries)}", created_by=user.email,
                         state=(state or "").strip().upper() or None, location=(location or "").strip() or None)
    db.add(batch)
    db.flush()
    for kind, label, payload in entries:
        db.add(models.BatchItem(batch_id=batch.id, kind=kind, label=label[:300], payload=payload))
    audit(db, user.email, "batch.create", f"batch:{batch.id}", f"{len(entries)} items")
    db.commit()
    batch_worker.kick()
    return batch_view(db, batch, with_items=True)


@router.get("")
def list_batches(db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    batches = db.query(models.Batch).order_by(models.Batch.id.desc()).limit(50).all()
    return [batch_view(db, b) for b in batches]


@router.get("/{batch_id}")
def get_batch(batch_id: int, db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    b = db.get(models.Batch, batch_id)
    if not b:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch_view(db, b, with_items=True)
