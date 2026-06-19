"""
config.py
=========
Central configuration, enums, and settings loaded from .env
"""

import os
from enum import Enum
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))


# ── Database Type Enum ────────────────────────────────────────────────────────
class DatabaseType(str, Enum):
    POSTGRESQL = "POSTGRESQL"
    MYSQL      = "MYSQL"
    SQLITE     = "SQLITE"
    # MSSQL    = "MSSQL"  # Reserved for future release


# ── Health Status Enum ────────────────────────────────────────────────────────
class HealthStatus(str, Enum):
    CONNECTED = "connected"
    FAILED    = "failed"
    PENDING   = "pending"


# ── App Settings ──────────────────────────────────────────────────────────────
class Settings:
    # Supabase metadata DB
    DB_HOST:     str  = os.getenv("DB_HOST", "")
    DB_PORT:     str  = os.getenv("DB_PORT", "5432")
    DB_NAME:     str  = os.getenv("DB_NAME", "postgres")
    DB_USER:     str  = os.getenv("DB_USER", "postgres")
    DB_PASSWORD: str  = os.getenv("DB_PASSWORD", "")

    # Encryption (generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
    ENCRYPTION_KEY: str = os.getenv("ENCRYPTION_KEY", "")

    # Supabase Auth
    SUPABASE_JWT_SECRET: str = os.getenv("SUPABASE_JWT_SECRET", "")

    # Auth mode — set AUTH_REQUIRED=false to skip auth in development
    AUTH_REQUIRED: bool = os.getenv("AUTH_REQUIRED", "false").lower() == "true"

    # LLM
    GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")
    OLLAMA_HOST:    str = os.getenv("OLLAMA_HOST", "http://localhost:11434")
    OLLAMA_MODEL:   str = os.getenv("OLLAMA_MODEL", "qwen2.5-coder:1.5b")

    # SQLite upload directory
    SQLITE_UPLOAD_DIR: str = os.path.join(os.path.dirname(__file__), "uploads", "sqlite")

    # Query limits
    MAX_ROWS:          int = 100
    SAMPLE_VALUE_LIMIT: int = 5  # Sample values per column in schema catalog


settings = Settings()
