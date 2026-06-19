"""
security.py
===========
Credential encryption (Fernet AES-128) and Supabase JWT auth dependency.
"""

from __future__ import annotations
import os
from typing import Optional
from fastapi import Header, HTTPException, status
from cryptography.fernet import Fernet, InvalidToken
from jose import jwt, JWTError

from config import settings

# ── Fernet Encryption ─────────────────────────────────────────────────────────

def _get_fernet() -> Fernet:
    key = settings.ENCRYPTION_KEY
    if not key:
        raise RuntimeError(
            "ENCRYPTION_KEY is not set in .env. "
            "Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_password(plain: str) -> str:
    """Encrypt a database password for safe storage."""
    return _get_fernet().encrypt(plain.encode()).decode()


def decrypt_password(token: str) -> str:
    """Decrypt a stored encrypted password. Raises ValueError on tamper."""
    try:
        return _get_fernet().decrypt(token.encode()).decode()
    except InvalidToken:
        raise ValueError("Failed to decrypt credential — key mismatch or data corruption.")


# ── Supabase JWT Auth ──────────────────────────────────────────────────────────

DEV_USER_ID = "dev-user-00000000-0000-0000-0000-000000000000"


def get_current_user(authorization: Optional[str] = Header(default=None)) -> str:
    """
    FastAPI dependency that extracts the authenticated user ID.

    - If AUTH_REQUIRED=false (development mode): returns a fixed dev user ID.
    - If AUTH_REQUIRED=true: validates the Supabase JWT and returns the sub claim.
    """
    if not settings.AUTH_REQUIRED:
        return DEV_USER_ID

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header. Expected: Bearer <token>",
        )

    token = authorization[len("Bearer "):]
    secret = settings.SUPABASE_JWT_SECRET
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_JWT_SECRET is not configured on the server.",
        )

    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            options={"verify_aud": False},  # Supabase does not always include aud
        )
        user_id: str = payload.get("sub", "")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing user ID (sub).")
        return user_id
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {e}",
        )
