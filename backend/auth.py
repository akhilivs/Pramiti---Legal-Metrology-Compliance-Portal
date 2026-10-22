"""Users, roles and signed-token auth (HMAC-SHA256, PBKDF2 password hashes - stdlib only).

Roles are cumulative: inspector < controller < admin.
  inspector  - inspect, review findings, draft notices, handle complaints
  controller - approve / issue notices, view accuracy and insights
  admin      - manage users, audit log, demo data
"""
import base64
import hashlib
import hmac
import json
import secrets
import time

from fastapi import Depends, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

import models
from config import ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD, IS_PRODUCTION, SECRET_KEY, TOKEN_TTL_HOURS
from database import get_db

_bearer = HTTPBearer(auto_error=False)
ROLE_RANK = {r: i for i, r in enumerate(models.ROLES)}

# Accounts created on first start so every role can be demonstrated. Change the passwords in the
# Users page (admin) before real use.
DEFAULT_USERS = [
    (ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, "Controller of Legal Metrology", "admin"),
    ("controller@metrology.gov.in", "controller123", "Deputy Controller", "Deputy Controller, Legal Metrology", "controller"),
    ("inspector@metrology.gov.in", "inspector123", "Field Inspector", "Inspector, Legal Metrology", "inspector"),
]


# ---------------------------------------------------------------- passwords
def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 200_000)
    return f"pbkdf2${_b64(salt)}${_b64(digest)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, salt, digest = stored.split("$")
        check = hashlib.pbkdf2_hmac("sha256", password.encode(), _unb64(salt), 200_000)
        return hmac.compare_digest(check, _unb64(digest))
    except Exception:
        return False


def ensure_default_users(db: Session):
    if db.query(models.User).count():
        return
    # the controller/inspector demo accounts have published passwords, so production gets only the admin
    for email, pw, name, designation, role in DEFAULT_USERS[:1] if IS_PRODUCTION else DEFAULT_USERS:
        db.add(models.User(email=email, name=name, designation=designation, role=role, password_hash=hash_password(pw)))
    db.commit()


# ---------------------------------------------------------------- tokens
def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def _sign(payload: str) -> str:
    return _b64(hmac.new(SECRET_KEY.encode(), payload.encode(), hashlib.sha256).digest())


def create_token(user: models.User) -> str:
    payload = _b64(json.dumps({"sub": user.id, "exp": int(time.time()) + TOKEN_TTL_HOURS * 3600}).encode())
    return f"{payload}.{_sign(payload)}"


def verify_token(token: str) -> dict | None:
    try:
        payload, sig = token.split(".", 1)
        if not hmac.compare_digest(sig, _sign(payload)):
            return None
        data = json.loads(_unb64(payload))
        if data.get("exp", 0) < time.time():
            return None
        return data
    except Exception:
        return None


def authenticate(db: Session, email: str, password: str) -> models.User | None:
    user = db.query(models.User).filter(models.User.email == email.strip().lower()).first()
    if user and user.active and verify_password(password, user.password_hash):
        return user
    return None


def profile(user: models.User) -> dict:
    return {"id": user.id, "email": user.email, "name": user.name, "designation": user.designation, "role": user.role}


# ---------------------------------------------------------------- dependencies
def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    token: str | None = Query(None, description="Alternative to the Authorization header (for links)"),
    db: Session = Depends(get_db),
) -> models.User:
    raw = creds.credentials if creds else token
    data = verify_token(raw) if raw else None
    user = db.get(models.User, data["sub"]) if data and isinstance(data.get("sub"), int) else None
    if not user or not user.active:
        raise HTTPException(status_code=401, detail="Your session has expired. Please sign in again.")
    return user


def require_role(minimum: str):
    def dep(user: models.User = Depends(current_user)) -> models.User:
        if ROLE_RANK.get(user.role, -1) < ROLE_RANK[minimum]:
            raise HTTPException(status_code=403, detail=f"This action needs the {minimum} role.")
        return user

    return dep


def audit(db: Session, actor: str, action: str, target: str | None = None, details: str | None = None):
    """Record an action; committed together with the caller's transaction."""
    db.add(models.AuditLog(actor=actor, action=action, target=target, details=details))
