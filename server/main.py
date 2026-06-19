"""
main.py
=======
QueryMind FastAPI application — v3.0 (Multi-Database Edition)
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import Base, engine
import models  # noqa: F401 — registers all ORM models with Base

from routers import databases_router, schema_router, query_router
from schemas.common import HealthResponse

# Self-healing database schema: Drop query_history table if it lacks the new user_id column
from sqlalchemy import inspect, text
inspector = inspect(engine)
if "query_history" in inspector.get_table_names():
    cols = [c["name"] for c in inspector.get_columns("query_history")]
    if "user_id" not in cols:
        print("Migrating schema: Dropping deprecated query_history table to recreate with new columns...")
        with engine.connect() as conn:
            conn.execute(text("DROP TABLE IF EXISTS query_history CASCADE"))
            conn.commit()
    elif "session_id" not in cols:
        print("Migrating schema: Adding session_id and session_title columns to query_history table...")
        with engine.connect() as conn:
            try:
                conn.execute(text("ALTER TABLE query_history ADD COLUMN session_id VARCHAR(255)"))
                conn.execute(text("ALTER TABLE query_history ADD COLUMN session_title VARCHAR(255)"))
                conn.commit()
            except Exception as e:
                print(f"Migration error (non-fatal): {e}")

# Create all metadata tables in Supabase on startup
Base.metadata.create_all(bind=engine)

# Create SQLite upload directory
os.makedirs(os.path.join(os.path.dirname(__file__), "uploads", "sqlite"), exist_ok=True)

app = FastAPI(
    title="QueryMind API",
    description="Multi-Database Text-to-SQL Platform with Dynamic Schema Discovery",
    version="3.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:5174", "http://127.0.0.1:5174",
        "http://localhost:3000", "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(databases_router)
app.include_router(schema_router)
app.include_router(query_router)


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/api/health", response_model=HealthResponse, tags=["health"])
def health():
    return HealthResponse(
        status="ok",
        database="supabase (metadata store)",
        providers=["gemini", "ollama"],
    )
