"""
routers/schema_router.py
=========================
Schema catalog endpoints for a connected database.
"""

from typing import List, Any, Dict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from security import get_current_user
from services.database_registry import get_database, get_current_catalog

router = APIRouter(prefix="/api/databases", tags=["schema"])


@router.get("/{db_id}/schema")
def get_full_schema(
    db_id: str,
    db: Session = Depends(get_db),
    owner_id: str = Depends(get_current_user),
) -> Dict[str, Any]:
    """Return the full JSON schema catalog for a database."""
    record = get_database(db, db_id, owner_id)
    if not record:
        raise HTTPException(status_code=404, detail="Database not found.")
    catalog = get_current_catalog(db, db_id)
    if not catalog:
        raise HTTPException(status_code=404, detail="Schema not yet discovered. Try POST /refresh first.")
    return {
        "database_id": db_id,
        "version":     catalog.version,
        "table_count": catalog.table_count,
        "discovered_at": catalog.discovered_at.isoformat(),
        "schema":      catalog.catalog_json,
    }


@router.get("/{db_id}/tables")
def get_tables(
    db_id: str,
    db: Session = Depends(get_db),
    owner_id: str = Depends(get_current_user),
) -> Dict[str, Any]:
    """Return a lightweight list of table names and column counts."""
    record = get_database(db, db_id, owner_id)
    if not record:
        raise HTTPException(status_code=404, detail="Database not found.")
    catalog = get_current_catalog(db, db_id)
    if not catalog:
        raise HTTPException(status_code=404, detail="Schema not yet discovered.")
    tables = catalog.catalog_json.get("tables", {})
    return {
        "database_id": db_id,
        "tables": [
            {
                "name":         t,
                "column_count": len(info.get("columns", [])),
                "row_count":    info.get("row_count", -1),
            }
            for t, info in tables.items()
        ],
    }


@router.get("/{db_id}/relationships")
def get_relationships(
    db_id: str,
    db: Session = Depends(get_db),
    owner_id: str = Depends(get_current_user),
) -> Dict[str, Any]:
    """Return all foreign key relationships discovered in the database."""
    record = get_database(db, db_id, owner_id)
    if not record:
        raise HTTPException(status_code=404, detail="Database not found.")
    catalog = get_current_catalog(db, db_id)
    if not catalog:
        raise HTTPException(status_code=404, detail="Schema not yet discovered.")
    return {
        "database_id":   db_id,
        "relationships": catalog.catalog_json.get("relationships", []),
    }


@router.get("/{db_id}/schema/text")
def get_schema_text(
    db_id: str,
    db: Session = Depends(get_db),
    owner_id: str = Depends(get_current_user),
) -> Dict[str, str]:
    """Return the plain-text schema representation (ChromaDB-ready)."""
    record = get_database(db, db_id, owner_id)
    if not record:
        raise HTTPException(status_code=404, detail="Database not found.")
    catalog = get_current_catalog(db, db_id)
    if not catalog:
        raise HTTPException(status_code=404, detail="Schema not yet discovered.")
    return {"database_id": db_id, "schema_text": catalog.schema_text or ""}
