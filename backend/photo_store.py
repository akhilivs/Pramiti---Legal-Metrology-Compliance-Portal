"""Keeps a copy of every inspection photo in the database when that database is not SQLite.

Free hosting (Render's free plan) wipes the local disk on every restart or deploy, so with an external
database (e.g. Neon Postgres) photos are mirrored into it and written back to uploads/ on startup.
With the local SQLite database photos live only on disk, as before.
"""
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


def restore() -> int:
    """Write back any photos missing from uploads/ (e.g. after a restart on a fresh disk)."""
    if not ENABLED:
        return 0
    from database import SessionLocal

    with SessionLocal() as db:
        missing = [n for (n,) in db.query(models.Photo.name) if not (UPLOAD_DIR / n).exists()]
        for name in missing:
            (UPLOAD_DIR / name).write_bytes(db.get(models.Photo, name).data)
    return len(missing)
