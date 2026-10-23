"""Keeps a copy of every inspection photo in the database when that database is not SQLite.

Free hosting (Render's free plan) wipes the local disk on every restart or deploy, so with an external
database (e.g. Neon Postgres) photos are mirrored into it and written back to uploads/: all of them in
the background after startup, and any one that is asked for sooner on demand, so startup never waits.
With the local SQLite database photos live only on disk, as before.
"""
import os
import threading
import uuid

from sqlalchemy.orm import Session

import models
from config import DATABASE_URL, UPLOAD_DIR

ENABLED = not DATABASE_URL.startswith("sqlite")


def keep(db: Session, names: list[str]):
    """Copy freshly saved uploads into the database, in the caller's transaction."""
    if not ENABLED:
        return
    for name in names:
        db.merge(models.Photo(name=name, data=(UPLOAD_DIR / name).read_bytes()))


def forget(db: Session, names: list[str]):
    if ENABLED and names:
        db.query(models.Photo).filter(models.Photo.name.in_(names)).delete(synchronize_session=False)


def _write(name: str, data: bytes):
    # write-then-rename, so a half-written file is never served if the background copy and an
    # on-demand fetch race for the same photo
    part = UPLOAD_DIR / f".{name}.{uuid.uuid4().hex}.part"
    part.write_bytes(data)
    os.replace(part, UPLOAD_DIR / name)


def fetch(name: str) -> bool:
    """Make sure one photo is on disk, loading it from the database if needed. True if it now exists."""
    path = UPLOAD_DIR / name
    if path.exists():
        return True
    if not ENABLED or "/" in name or "\\" in name or name.startswith("."):
        return False
    from database import SessionLocal

    with SessionLocal() as db:
        photo = db.get(models.Photo, name)
        if photo is None:
            return False
        _write(name, photo.data)
    return True


def ensure(names: list[str]):
    for name in names:
        fetch(name)


def restore() -> int:
    """Write back any photos missing from uploads/ (e.g. after a restart on a fresh disk)."""
    if not ENABLED:
        return 0
    from database import SessionLocal

    with SessionLocal() as db:
        missing = [n for (n,) in db.query(models.Photo.name) if not (UPLOAD_DIR / n).exists()]
        for name in missing:
            if not (UPLOAD_DIR / name).exists():  # may have been fetched on demand meanwhile
                _write(name, db.get(models.Photo, name).data)
    return len(missing)


def restore_in_background():
    if not ENABLED:
        return

    def run():
        try:
            restored = restore()
            if restored:
                print(f"Restored {restored} photos from the database.")
        except Exception as e:  # photos are still fetched on demand
            print(f"Background photo restore stopped: {e}")

    threading.Thread(target=run, name="photo-restore", daemon=True).start()
