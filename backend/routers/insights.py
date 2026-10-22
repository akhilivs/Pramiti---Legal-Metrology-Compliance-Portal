"""Dashboard statistics, state-wise map, repeat offenders and AI accuracy."""
import datetime
import json
from collections import Counter, defaultdict

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

import models
from auth import current_user, require_role
from config import DATA_DIR
from database import get_db
from rules_kb import CHECK_BY_ID, STATES
from services import effective_status, scan_summary

router = APIRouter(prefix="/api", tags=["insights"])


@router.get("/stats")
def stats(db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    scans = db.query(models.Scan).all()
    verdicts = Counter(s.verdict for s in scans)
    failed = Counter()
    for s in scans:
        for c in s.checks or []:
            if effective_status(c) == "fail":
                failed[c["id"]] += 1

    today = datetime.datetime.now(datetime.timezone.utc).date()
    days = [today - datetime.timedelta(days=i) for i in range(13, -1, -1)]
    per_day = Counter(s.created_at.date() for s in scans)
    per_day_bad = Counter(s.created_at.date() for s in scans if s.verdict == "non_compliant")

    return {
        "total": len(scans),
        "compliant": verdicts.get("compliant", 0),
        "non_compliant": verdicts.get("non_compliant", 0),
        "needs_review": verdicts.get("needs_review", 0),
        "pending_review": sum(s.review_status != "reviewed" for s in scans),
        "ecommerce": sum(s.source == "ecommerce" for s in scans),
        "open_complaints": db.query(models.Complaint).filter(models.Complaint.status.in_(["received", "under_review"])).count(),
        "notices_pending": db.query(models.Notice).filter(models.Notice.status.in_(["draft", "approved"])).count(),
        "notices_issued": db.query(models.Notice).filter(models.Notice.status.in_(["issued", "replied"])).count(),
        "has_demo": any(s.is_demo for s in scans),
        "average_score": round(sum(s.score or 0 for s in scans) / len(scans), 1) if scans else None,
        "top_violations": [
            {"id": cid, "rule": CHECK_BY_ID[cid]["rule"], "title": CHECK_BY_ID[cid]["title"], "count": n}
            for cid, n in failed.most_common(5) if cid in CHECK_BY_ID
        ],
        "daily": [
            {"date": d.isoformat(), "scans": per_day.get(d, 0), "non_compliant": per_day_bad.get(d, 0)}
            for d in days
        ],
    }


def _risk(total: int, bad: int) -> str:
    rate = bad / total if total else 0
    if bad >= 3 or (bad >= 2 and rate >= 0.6):
        return "high"
    if bad >= 1 and rate >= 0.3:
        return "medium"
    return "low"


def offenders_data(db: Session) -> list[dict]:
    groups: dict[str, list[models.Scan]] = defaultdict(list)
    for s in db.query(models.Scan).filter(models.Scan.manufacturer_key.isnot(None)).all():
        groups[s.manufacturer_key].append(s)
    notice_counts = Counter()
    for n, key in db.query(models.Notice, models.Scan.manufacturer_key).join(models.Scan, models.Scan.id == models.Notice.scan_id).all():
        if n.status in ("issued", "replied", "closed"):
            notice_counts[key] += 1
    out = []
    for key, scans in groups.items():
        names = Counter(s.manufacturer_name or s.brand for s in scans if s.manufacturer_name or s.brand)
        brands = sorted({s.brand for s in scans if s.brand})
        bad = sum(s.verdict == "non_compliant" for s in scans)
        violations = Counter(c["id"] for s in scans for c in (s.checks or []) if effective_status(c) == "fail")
        out.append({
            "key": key,
            "name": names.most_common(1)[0][0] if names else key.title(),
            "brands": brands[:6],
            "inspections": len(scans),
            "non_compliant": bad,
            "rate": round(100 * bad / len(scans), 1),
            "states": sorted({s.state for s in scans if s.state}),
            "last_seen": max(s.created_at for s in scans).isoformat() + "Z",
            "notices": notice_counts.get(key, 0),
            "risk": _risk(len(scans), bad),
            "top_violations": [
                {"id": cid, "title": CHECK_BY_ID[cid]["title"], "rule": CHECK_BY_ID[cid]["rule"], "count": n}
                for cid, n in violations.most_common(4) if cid in CHECK_BY_ID
            ],
            "is_demo": all(s.is_demo for s in scans),
        })
    rank = {"high": 0, "medium": 1, "low": 2}
    out.sort(key=lambda o: (rank[o["risk"]], -o["non_compliant"], -o["rate"], o["name"]))
    return out


@router.get("/insights")
def insights(db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    scans = db.query(models.Scan).all()
    by_state = {code: {"code": code, "name": name, "col": col, "row": row, "total": 0, "non_compliant": 0,
                       "compliant": 0, "needs_review": 0} for code, name, col, row in STATES}
    for s in scans:
        if s.state in by_state:
            st = by_state[s.state]
            st["total"] += 1
            st[s.verdict] = st.get(s.verdict, 0) + 1
    for st in by_state.values():
        st["rate"] = round(100 * st["non_compliant"] / st["total"], 1) if st["total"] else None

    rules = Counter(c["id"] for s in scans for c in (s.checks or []) if effective_status(c) == "fail")
    sources = Counter(s.source for s in scans)
    categories = Counter((s.category or "Other") for s in scans if s.verdict == "non_compliant")
    return {
        "states": list(by_state.values()),
        "offenders": offenders_data(db)[:50],
        "rules": [{"id": cid, "title": CHECK_BY_ID[cid]["title"], "rule": CHECK_BY_ID[cid]["rule"], "count": n}
                  for cid, n in rules.most_common() if cid in CHECK_BY_ID],
        "sources": dict(sources),
        "categories": [{"name": k, "count": v} for k, v in categories.most_common(8)],
        "unlocated": sum(1 for s in scans if not s.state),
    }


@router.get("/offenders/{key}")
def offender(key: str, request: Request, db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    data = next((o for o in offenders_data(db) if o["key"] == key), None)
    if not data:
        raise HTTPException(status_code=404, detail="Manufacturer not found")
    scans = db.query(models.Scan).filter(models.Scan.manufacturer_key == key).order_by(models.Scan.created_at.desc()).all()
    return {**data, "scans": [scan_summary(request, s) for s in scans]}


@router.get("/accuracy")
def accuracy(include_demo: bool = True, db: Session = Depends(get_db), user: models.User = Depends(require_role("controller"))):
    """How often officers agreed with the AI, per check - from the review workflow."""
    q = db.query(models.Scan).filter(models.Scan.review_status == "reviewed")
    if not include_demo:
        q = q.filter(models.Scan.is_demo.is_(False))
    reviewed = q.all()
    per: dict[str, dict] = {}
    total = agree = 0
    for s in reviewed:
        for c in s.checks or []:
            if c.get("source") == "rule":
                continue  # deterministic checks are not AI judgements
            final = effective_status(c)
            d = per.setdefault(c["id"], {"id": c["id"], "title": c["title"], "rule": c["rule"], "reviewed": 0, "agreed": 0,
                                         "tp": 0, "fp": 0, "fn": 0})
            d["reviewed"] += 1
            total += 1
            if final == c["status"]:
                d["agreed"] += 1
                agree += 1
            ai_fail, real_fail = c["status"] == "fail", final == "fail"
            d["tp"] += ai_fail and real_fail
            d["fp"] += ai_fail and not real_fail
            d["fn"] += (not ai_fail) and real_fail
    rows = []
    for d in per.values():
        d["agreement"] = round(100 * d["agreed"] / d["reviewed"], 1) if d["reviewed"] else None
        d["precision"] = round(100 * d["tp"] / (d["tp"] + d["fp"]), 1) if d["tp"] + d["fp"] else None
        d["recall"] = round(100 * d["tp"] / (d["tp"] + d["fn"]), 1) if d["tp"] + d["fn"] else None
        rows.append(d)
    rows.sort(key=lambda r: list(CHECK_BY_ID).index(r["id"]) if r["id"] in CHECK_BY_ID else 99)
    verdict_agree = sum(s.ai_verdict == s.verdict for s in reviewed)

    bench_file = DATA_DIR / "benchmark_results.json"
    benchmark = json.loads(bench_file.read_text(encoding="utf-8")) if bench_file.exists() else None
    return {
        "reviewed_scans": len(reviewed),
        "demo_scans": sum(bool(s.is_demo) for s in reviewed),
        "check_agreement": round(100 * agree / total, 1) if total else None,
        "verdict_agreement": round(100 * verdict_agree / len(reviewed), 1) if reviewed else None,
        "checks": rows,
        "benchmark": benchmark,
    }
