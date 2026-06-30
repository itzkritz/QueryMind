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

    Priority:
    1. If a Bearer token is provided, try decoding with our OWN JWT secret first (custom auth).
    2. Then try the Supabase JWT secret as fallback.
    3. If no token and AUTH_REQUIRED=false → return dev user ID.
    4. Otherwise raise 401.
    """
    if authorization and authorization.startswith("Bearer "):
        token = authorization[len("Bearer "):]

        # ── Try our own JWT first ──────────────────────────────────────────────
        own_secret = settings.ENCRYPTION_KEY
        if own_secret:
            try:
                payload = jwt.decode(token, own_secret, algorithms=["HS256"])
                user_id: str = payload.get("sub", "")
                if user_id:
                    return user_id
            except JWTError:
                pass  # Not our token — try Supabase next

        # ── Try Supabase JWT ───────────────────────────────────────────────────
        supabase_secret = settings.SUPABASE_JWT_SECRET
        if supabase_secret:
            try:
                payload = jwt.decode(
                    token,
                    supabase_secret,
                    algorithms=["HS256"],
                    options={"verify_aud": False},
                )
                user_id = payload.get("sub", "")
                if user_id:
                    return user_id
            except JWTError as e:
                if settings.AUTH_REQUIRED:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail=f"Invalid or expired token: {e}",
                    )

    if not settings.AUTH_REQUIRED:
        return DEV_USER_ID

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing or invalid Authorization header.",
    )
