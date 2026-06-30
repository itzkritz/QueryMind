"""
routers/auth.py
===============
Custom email+password auth using bcrypt + HS256 JWT.
Completely independent of Supabase Auth — uses our own qm_users table.
"""

import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from jose import jwt
import bcrypt

from database import get_db
from models.user import User
from config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])

# ── Crypto ────────────────────────────────────────────────────────────────────

JWT_SECRET = settings.ENCRYPTION_KEY
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 30


def _hash(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def _verify(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def _make_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.utcnow() + timedelta(days=JWT_EXPIRE_DAYS),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


# ── Schemas ───────────────────────────────────────────────────────────────────

class AuthRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str


class MeResponse(BaseModel):
    user_id: str
    email: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/signup", response_model=AuthResponse, status_code=201)
def signup(req: AuthRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    user = User(
        id=uuid.uuid4(),
        email=req.email.lower().strip(),
        password_hash=_hash(req.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = _make_token(str(user.id), user.email)
    return AuthResponse(access_token=token, user_id=str(user.id), email=user.email)


@router.post("/signin", response_model=AuthResponse)
def signin(req: AuthRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.lower().strip()).first()
    if not user or not _verify(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")

    token = _make_token(str(user.id), user.email)
    return AuthResponse(access_token=token, user_id=str(user.id), email=user.email)
