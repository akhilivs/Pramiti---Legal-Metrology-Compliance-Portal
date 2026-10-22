from fastapi import APIRouter, Depends, HTTPException
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from auth import audit, authenticate, create_token, current_user, hash_password, profile, verify_password
from config import GOOGLE_CLIENT_ID
from database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginBody(BaseModel):
    email: str
    password: str


class GoogleBody(BaseModel):
    credential: str  # ID token from the "Sign in with Google" button


class PasswordBody(BaseModel):
    current_password: str
    new_password: str


@router.post("/login")
def login(body: LoginBody, db: Session = Depends(get_db)):
    user = authenticate(db, body.email, body.password)
    if not user:
        audit(db, body.email.strip().lower(), "auth.login_failed")
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid official ID or password.")
    audit(db, user.email, "auth.login")
    db.commit()
    return {"token": create_token(user), "officer": profile(user)}


_google_transport = google_requests.Request()


@router.post("/google")
def google_login(body: GoogleBody, db: Session = Depends(get_db)):
    """Sign in with a Google ID token. Only existing, active officer accounts are let in -
    a Google account never creates an officer; an admin adds the e-mail first."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured on this server.")
    try:
        # checks Google's signature, expiry, issuer and that the token was minted for our client ID
        info = id_token.verify_oauth2_token(body.credential, _google_transport, GOOGLE_CLIENT_ID, clock_skew_in_seconds=10)
    except ValueError:
        raise HTTPException(status_code=401, detail="Google sign-in could not be verified. Please try again.")
    email = (info.get("email") or "").strip().lower()
    if not email or not info.get("email_verified"):
        raise HTTPException(status_code=401, detail="Your Google account e-mail is not verified.")
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user or not user.active:
        audit(db, email, "auth.google_denied")
        db.commit()
        raise HTTPException(
            status_code=403,
            detail=f"{email} is not registered as an officer. Ask an administrator to add this e-mail.",
        )
    audit(db, user.email, "auth.login", details="google")
    db.commit()
    return {"token": create_token(user), "officer": profile(user)}


@router.get("/me")
def me(user: models.User = Depends(current_user)):
    return profile(user)


@router.post("/password")
def change_password(body: PasswordBody, db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters.")
    user.password_hash = hash_password(body.new_password)
    audit(db, user.email, "auth.password_changed")
    db.commit()
    return {"ok": True}
