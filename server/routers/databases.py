"""
routers/databases.py
=====================
All /api/databases/* routes.
"""

import os
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from database import get_db
from security import get_current_user
from config import DatabaseType, HealthStatus, settings
from schemas.database import ConnectDatabaseRequest, DatabaseResponse, DatabaseListItem
from schemas.common import MessageResponse
from services.database_validator import validate_connection
from services.database_registry import (
    create_database, get_database, list_databases,
    soft_delete_database, discover_and_save_schema, get_current_catalog,
)
from services.connection_manager import connection_manager

router = APIRouter(prefix="/api/databases", tags=["databases"])


# ── POST /api/databases/connect ───────────────────────────────────────────────

@router.post("/connect", response_model=DatabaseResponse, status_code=201)
def connect_database(
    request: ConnectDatabaseRequest,
    db: Session = Depends(get_db),
    owner_id: str = Depends(get_current_user),
):
    """Connect a PostgreSQL or MySQL database. Validates connection before saving."""
    # 1. Validate connection (test before persisting credentials)
    try:
        validate_connection(
            db_type=request.db_type,
            host=request.host,
            port=request.port,
            database_name=request.database_name,
            username=request.username,
            password=request.password,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # 2. Persist connection record (password will be encrypted inside create_database)
    record = create_database(
        db=db,
        owner_id=owner_id,
        name=request.name,
        db_type=request.db_type,
        host=request.host,
        port=request.port,
        database_name=request.database_name,
        username=request.username,
        password=request.password,
    )

    # 3. Discover schema
    try:
        catalog = discover_and_save_schema(db, record)
    except Exception as exc:
        catalog = None  # Schema discovery failed but connection was saved

    return DatabaseResponse.from_orm_with_catalog(record, catalog)


# ── POST /api/databases/connect/sqlite ───────────────────────────────────────

@router.post("/connect/sqlite", response_model=DatabaseResponse, status_code=201)
async def connect_sqlite(
    name: str = Form(...),
    file: UploadFile = File(..., description="SQLite .db file"),
    db: Session = Depends(get_db),
    owner_id: str = Depends(get_current_user),
):
    """Upload a SQLite .db file and connect it."""
    if not file.filename.endswith(".db"):
        raise HTTPException(status_code=400, detail="Only .db files are accepted for SQLite.")

    # Save file to uploads directory
    os.makedirs(settings.SQLITE_UPLOAD_DIR, exist_ok=True)
    file_id   = str(uuid.uuid4())
    file_path = os.path.join(settings.SQLITE_UPLOAD_DIR, f"{file_id}.db")

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    # Validate
    try:
        validate_connection(db_type=DatabaseType.SQLITE, sqlite_file_path=file_path)
    except ValueError as exc:
        os.remove(file_path)
        raise HTTPException(status_code=400, detail=str(exc))

    # Save
    record = create_database(
        db=db, owner_id=owner_id,
        name=name, db_type=DatabaseType.SQLITE,
        sqlite_file_path=file_path,
    )

    try:
        catalog = discover_and_save_schema(db, record)
    except Exception:
        catalog = None

    return DatabaseResponse.from_orm_with_catalog(record, catalog)


# ── GET /api/databases ────────────────────────────────────────────────────────

@router.get("", response_model=List[DatabaseResponse])
def list_user_databases(
    db: Session = Depends(get_db),
    owner_id: str = Depends(get_current_user),
):
    records = list_databases(db, owner_id)
    result = []
    for r in records:
        catalog = get_current_catalog(db, str(r.id))
        result.append(DatabaseResponse.from_orm_with_catalog(r, catalog))
    return result


# ── GET /api/databases/{id} ───────────────────────────────────────────────────

@router.get("/{db_id}", response_model=DatabaseResponse)
def get_database_detail(
    db_id: str,
    db: Session = Depends(get_db),
    owner_id: str = Depends(get_current_user),
):
    record = get_database(db, db_id, owner_id)
    if not record:
        raise HTTPException(status_code=404, detail="Database not found.")
    catalog = get_current_catalog(db, db_id)
    return DatabaseResponse.from_orm_with_catalog(record, catalog)


# ── DELETE /api/databases/{id} ────────────────────────────────────────────────

@router.delete("/{db_id}", response_model=MessageResponse)
def delete_database(
    db_id: str,
    db: Session = Depends(get_db),
    owner_id: str = Depends(get_current_user),
):
    deleted = soft_delete_database(db, db_id, owner_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Database not found.")
    return MessageResponse(message="Database connection removed successfully.")


# ── POST /api/databases/{id}/refresh ─────────────────────────────────────────

@router.post("/{db_id}/refresh", response_model=DatabaseResponse)
def refresh_schema(
    db_id: str,
    db: Session = Depends(get_db),
    owner_id: str = Depends(get_current_user),
):
    record = get_database(db, db_id, owner_id)
    if not record:
        raise HTTPException(status_code=404, detail="Database not found.")
    connection_manager.evict(db_id)  # Force reconnect
    try:
        catalog = discover_and_save_schema(db, record)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Schema refresh failed: {exc}")
    return DatabaseResponse.from_orm_with_catalog(record, catalog)


# ── GET /api/databases/{id}/health ───────────────────────────────────────────

@router.get("/{db_id}/health", response_model=MessageResponse)
def check_health(
    db_id: str,
    db: Session = Depends(get_db),
    owner_id: str = Depends(get_current_user),
):
    from services.database_registry import update_health
    from connectors.factory import build_connector
    record = get_database(db, db_id, owner_id)
    if not record:
        raise HTTPException(status_code=404, detail="Database not found.")
    try:
        connector = build_connector(record)
        connector.test_connection()
        update_health(db, record, HealthStatus.CONNECTED)
        return MessageResponse(message="Connection is healthy.")
    except Exception as exc:
        update_health(db, record, HealthStatus.FAILED)
        raise HTTPException(status_code=503, detail=f"Connection failed: {exc}")
