"""Background processing of bulk inspections (many photos, a ZIP of folders, or a list of URLs).

Items are processed one at a time so the Gemini rate limits are respected; the UI polls progress.
"""
import io
import shutil
import threading
import time
import uuid
import zipfile
from pathlib import Path, PurePosixPath

from PIL import Image

import models
from analyzer import AnalysisError
from auth import audit
from config import UPLOAD_DIR
from database import SessionLocal
from ecommerce import ListingError, fetch_listing
from rules_kb import LISTING
from services import create_scan, load_image

TMP_DIR = UPLOAD_DIR / "batch_tmp"
TMP_DIR.mkdir(exist_ok=True)
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}

_wake = threading.Event()
_started = False


def stash(data: bytes, name: str) -> str:
    """Save an uploaded file to the batch temp dir; returns the temp name."""
    tmp = f"{uuid.uuid4().hex}{Path(name).suffix.lower() or '.jpg'}"
    (TMP_DIR / tmp).write_bytes(data)
    return tmp


def items_from_zip(data: bytes, max_items: int = 200) -> list[tuple[str, list[str]]]:
    """A ZIP of photos. Images in the same folder are treated as photos of one product;
    images at the top level are one product each. Returns [(label, [temp names])]."""
    groups: dict[str, list[tuple[str, bytes]]] = {}
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        for info in zf.infolist():
            if info.is_dir() or info.file_size > 15 * 1024 * 1024:
                continue
            path = PurePosixPath(info.filename)
            if path.suffix.lower() not in IMAGE_EXT or any(p.startswith(("__MACOSX", ".")) for p in path.parts):
                continue
            key = str(path.parent) if str(path.parent) != "." else f"__single__/{path.name}"
            groups.setdefault(key, []).append((path.name, zf.read(info)))
    items = []
    for key, files in sorted(groups.items())[:max_items]:
        label = key.split("/", 1)[1] if key.startswith("__single__/") else key
        items.append((label, [stash(d, n) for n, d in sorted(files)[:4]]))
    return items


def ensure_worker():
    global _started
    if _started:
        return
    _started = True
    db = SessionLocal()
    try:  # items interrupted by a restart go back to the queue
        db.query(models.BatchItem).filter(models.BatchItem.status == "running").update({"status": "queued"})
        db.commit()
    finally:
        db.close()
    threading.Thread(target=_loop, name="batch-worker", daemon=True).start()


def kick():
    _wake.set()


def _loop():
    while True:
        db = SessionLocal()
        try:
            item = db.query(models.BatchItem).filter(models.BatchItem.status == "queued").order_by(models.BatchItem.id).first()
            if item is None:
                db.close()
                _wake.wait(timeout=30)
                _wake.clear()
                continue
            _process(db, item)
        except Exception as e:  # never let the worker die
            print(f"Batch worker error: {e}")
            db.rollback()
        finally:
            db.close()
        time.sleep(1)


def _process(db, item: models.BatchItem):
    batch = db.get(models.Batch, item.batch_id)
    item.status = "running"
    batch.status = "running"
    db.commit()
    try:
        if item.kind == "url":
            listing = fetch_listing(item.payload[0])
            scan = create_scan(db, images=listing["images"], inspector=batch.created_by, mode=LISTING,
                               source="ecommerce", listing_text=listing["text"], source_url=listing["url"],
                               original_filename=listing["title"][:120] or item.payload[0],
                               state=batch.state, location=batch.location, batch_id=batch.id)
        else:
            images: list[Image.Image] = [load_image((TMP_DIR / n).read_bytes(), n) for n in item.payload]
            scan = create_scan(db, images=images, inspector=batch.created_by, original_filename=item.label,
                               state=batch.state, location=batch.location, batch_id=batch.id)
        item.status, item.scan_id = "done", scan.id
        audit(db, batch.created_by, "scan.create", f"scan:{scan.id}", f"batch {batch.id}")
    except (AnalysisError, ListingError) as e:
        item.status, item.error = "failed", str(e)
    except Exception as e:
        item.status, item.error = "failed", getattr(e, "detail", None) or str(e)[:300]
    finally:
        if item.kind != "url":
            for n in item.payload:
                (TMP_DIR / n).unlink(missing_ok=True)
    remaining = db.query(models.BatchItem).filter(
        models.BatchItem.batch_id == batch.id, models.BatchItem.status.in_(["queued", "running"]),
        models.BatchItem.id != item.id).count()
    if remaining == 0:
        batch.status = "done"
    db.commit()


def cleanup_tmp():
    shutil.rmtree(TMP_DIR, ignore_errors=True)
    TMP_DIR.mkdir(exist_ok=True)
