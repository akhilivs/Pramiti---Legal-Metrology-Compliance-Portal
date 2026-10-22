"""Back up the Pramiti database and uploaded photos; restore from a backup.

    python backup.py                 make a backup now (safe while the server is running)
    python backup.py --list          show existing backups
    python backup.py --verify        check the newest backup opens and has data
    python backup.py --restore NAME  restore a backup (stop the server first)

Each backup is a folder backups/YYYY-MM-DD_HHMMSS/ holding a consistent copy of the SQLite database
(taken with SQLite's online-backup API, so it is never half-written) and a ZIP of the photos.
Backups older than BACKUP_KEEP_DAYS (default 14) are deleted after a successful run.

Schedule it daily - see "Backups" in README.md. For PostgreSQL (DATABASE_URL=postgresql://...)
use the provider's automated backups or pg_dump instead; this script covers the SQLite default.
"""
import argparse
import os
import shutil
import sqlite3
import sys
import time
import zipfile
from datetime import datetime, timedelta
from pathlib import Path

from config import BASE_DIR, DATABASE_URL, UPLOAD_DIR

BACKUP_DIR = Path(os.getenv("BACKUP_DIR", str(BASE_DIR / "backups")))
KEEP_DAYS = int(os.getenv("BACKUP_KEEP_DAYS", "14"))
STAMP = "%Y-%m-%d_%H%M%S"


def _db_path() -> Path:
    if not DATABASE_URL.startswith("sqlite:///"):
        sys.exit("DATABASE_URL is not SQLite - use your database provider's backups (e.g. pg_dump).")
    return Path(DATABASE_URL.removeprefix("sqlite:///"))


def backup() -> Path:
    db = _db_path()
    if not db.exists():
        sys.exit(f"Database not found: {db}")
    target = BACKUP_DIR / datetime.now().strftime(STAMP)
    target.mkdir(parents=True)

    started = time.time()
    src, dst = sqlite3.connect(db), sqlite3.connect(target / db.name)
    with dst:
        src.backup(dst)  # consistent snapshot even while the API is writing
    src.close()
    dst.close()

    photos = 0
    with zipfile.ZipFile(target / "uploads.zip", "w", zipfile.ZIP_STORED) as z:  # JPEGs don't compress
        for f in sorted(UPLOAD_DIR.glob("*")):
            if f.is_file():
                z.write(f, f.name)
                photos += 1

    _prune()
    print(f"Backup written to {target} ({photos} photos, {time.time() - started:.1f}s)")
    return target


def _backups() -> list[Path]:
    return sorted((p for p in BACKUP_DIR.glob("*") if p.is_dir()), reverse=True) if BACKUP_DIR.exists() else []


def _prune():
    cutoff = datetime.now() - timedelta(days=KEEP_DAYS)
    kept = _backups()
    for p in kept[1:]:  # never delete the newest
        try:
            if datetime.strptime(p.name, STAMP) < cutoff:
                shutil.rmtree(p)
                print(f"Removed old backup {p.name}")
        except ValueError:
            pass  # not one of ours


def verify(path: Path | None = None) -> bool:
    path = path or next(iter(_backups()), None)
    if not path:
        print("No backups found.")
        return False
    db = path / _db_path().name
    con = sqlite3.connect(f"file:{db.as_posix()}?mode=ro", uri=True)
    ok = con.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
    counts = {t: con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] for t in ("users", "scans")}
    con.close()
    with zipfile.ZipFile(path / "uploads.zip") as z:
        bad = z.testzip()
        photos = len(z.namelist())
    ok = ok and bad is None and counts["users"] > 0
    print(f"{path.name}: integrity {'ok' if ok else 'FAILED'} - {counts['users']} users, {counts['scans']} scans, {photos} photos")
    return ok


def restore(name: str):
    path = BACKUP_DIR / name
    if not path.is_dir():
        sys.exit(f"No backup named {name}. Run with --list.")
    if not verify(path):
        sys.exit("Backup failed verification - not restoring.")
    db = _db_path()
    # keep what is being replaced, so a wrong restore can be undone
    if db.exists():
        shutil.copy2(db, db.with_suffix(f".before-restore-{datetime.now().strftime(STAMP)}.db"))
    shutil.copy2(path / db.name, db)
    with zipfile.ZipFile(path / "uploads.zip") as z:
        z.extractall(UPLOAD_DIR)
    print(f"Restored {name}. Start the server again.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--list", action="store_true")
    g.add_argument("--verify", action="store_true")
    g.add_argument("--restore", metavar="NAME")
    args = ap.parse_args()
    if args.list:
        for p in _backups():
            print(p.name)
    elif args.verify:
        sys.exit(0 if verify() else 1)
    elif args.restore:
        restore(args.restore)
    else:
        backup()
        sys.exit(0 if verify() else 1)
