"""Users, audit log, demo data and reference metadata."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from auth import audit, current_user, hash_password, profile, require_role
from database import get_db
from rules_kb import CHECKS, RULES, STATES

router = APIRouter(prefix="/api", tags=["admin"])


# ---------------------------------------------------------------- reference data
@router.get("/meta")
def meta():
    """Public: states list for forms (also used by the complaint portal)."""
    return {"states": [{"code": c, "name": n} for c, n, _, _ in sorted(STATES, key=lambda s: s[1])]}


@router.get("/rules")
def rules(user: models.User = Depends(current_user)):
    return {"rules": RULES, "checks": CHECKS}


# ---------------------------------------------------------------- users
def user_view(u: models.User) -> dict:
    return {**profile(u), "active": u.active, "created_at": u.created_at.isoformat() + "Z"}


@router.get("/users")
def list_users(db: Session = Depends(get_db), user: models.User = Depends(require_role("admin"))):
    return [user_view(u) for u in db.query(models.User).order_by(models.User.id).all()]


class NewUser(BaseModel):
    email: str
    name: str
    designation: str | None = None
    role: str = "inspector"
    password: str


@router.post("/users")
def create_user(body: NewUser, db: Session = Depends(get_db), user: models.User = Depends(require_role("admin"))):
    email = body.email.strip().lower()
    if body.role not in models.ROLES:
        raise HTTPException(status_code=400, detail="Unknown role")
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(status_code=409, detail="A user with this e-mail already exists.")
    u = models.User(email=email, name=body.name.strip(), designation=(body.designation or "").strip() or None,
                    role=body.role, password_hash=hash_password(body.password))
    db.add(u)
    audit(db, user.email, "user.create", f"user:{email}", body.role)
    db.commit()
    return user_view(u)


class UserUpdate(BaseModel):
    name: str | None = None
    designation: str | None = None
    role: str | None = None
    active: bool | None = None
    password: str | None = None


@router.patch("/users/{user_id}")
def update_user(user_id: int, body: UserUpdate, db: Session = Depends(get_db), user: models.User = Depends(require_role("admin"))):
    u = db.get(models.User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if u.id == user.id and (body.active is False or (body.role and body.role != "admin")):
        raise HTTPException(status_code=400, detail="You cannot deactivate or demote your own account.")
    changes = []
    if body.name is not None:
        u.name = body.name.strip()
    if body.designation is not None:
        u.designation = body.designation.strip() or None
    if body.role is not None:
        if body.role not in models.ROLES:
            raise HTTPException(status_code=400, detail="Unknown role")
        changes.append(f"role={body.role}")
        u.role = body.role
    if body.active is not None:
        changes.append(f"active={body.active}")
        u.active = body.active
    if body.password:
        if len(body.password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
        u.password_hash = hash_password(body.password)
        changes.append("password reset")
    audit(db, user.email, "user.update", f"user:{u.email}", ", ".join(changes) or "profile")
    db.commit()
    return user_view(u)


# ---------------------------------------------------------------- audit
@router.get("/audit")
def audit_log(actor: str | None = None, action: str | None = None, limit: int = 300,
              db: Session = Depends(get_db), user: models.User = Depends(require_role("admin"))):
    q = db.query(models.AuditLog)
    if actor:
        q = q.filter(models.AuditLog.actor.ilike(f"%{actor}%"))
    if action:
        q = q.filter(models.AuditLog.action.ilike(f"{action}%"))
    rows = q.order_by(models.AuditLog.id.desc()).limit(min(limit, 2000)).all()
    return [{"id": r.id, "at": r.at.isoformat() + "Z", "actor": r.actor, "action": r.action, "target": r.target,
             "details": r.details} for r in rows]


# ---------------------------------------------------------------- demo data
@router.post("/admin/demo")
def load_demo(db: Session = Depends(get_db), user: models.User = Depends(require_role("admin"))):
    from seed_demo import clear_demo, seed_demo

    clear_demo(db)
    counts = seed_demo(db)
    audit(db, user.email, "demo.load", None, str(counts))
    db.commit()
    return counts


@router.delete("/admin/demo")
def remove_demo(db: Session = Depends(get_db), user: models.User = Depends(require_role("admin"))):
    from seed_demo import clear_demo

    counts = clear_demo(db)
    audit(db, user.email, "demo.clear", None, str(counts))
    db.commit()
    return counts
