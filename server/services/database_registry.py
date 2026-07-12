"""
services/database_registry.py
==============================
CRUD operations against connected_databases and schema_catalogs tables.
All methods are owner-scoped — users can only see/modify their own databases.
"""

from __future__ import annotations
import uuid
from datetime import datetime
from sqlalchemy.orm import Session

from models.connected_database import ConnectedDatabase
from models.schema_catalog import SchemaCatalog
from config import DatabaseType, HealthStatus
from security import encrypt_password
from services.connection_manager import connection_manager
from services.schema_discovery import SchemaDiscoveryService
from services.schema_catalog_builder import SchemaCatalogBuilder
from services.insights_service import DatabaseInsightsService
from connectors.factory import build_connector


# ── Database CRUD ─────────────────────────────────────────────────────────────

def create_database(
    db: Session,
    owner_id: str,
    name: str,
    db_type: DatabaseType,
    host: str = None,
    port: int = None,
    database_name: str = None,
    username: str = None,
    password: str = None,
    sqlite_file_path: str = None,
) -> ConnectedDatabase:
    record = ConnectedDatabase(
        id=uuid.uuid4(),
        owner_id=owner_id,
        name=name,
        db_type=db_type,
        host=host,
        port=port,
        database_name=database_name,
        username=username,
        encrypted_password=encrypt_password(password) if password else None,
        sqlite_file_path=sqlite_file_path,
        status=HealthStatus.PENDING,
        created_at=datetime.utcnow(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_database(db: Session, db_id: str, owner_id: str) -> ConnectedDatabase | None:
    return (
        db.query(ConnectedDatabase)
        .filter(ConnectedDatabase.id == db_id, ConnectedDatabase.owner_id == owner_id, ConnectedDatabase.is_active == True)
        .first()
    )


def list_databases(db: Session, owner_id: str) -> list[ConnectedDatabase]:
    return (
        db.query(ConnectedDatabase)
        .filter(ConnectedDatabase.owner_id == owner_id, ConnectedDatabase.is_active == True)
        .order_by(ConnectedDatabase.created_at.desc())
        .all()
    )


def soft_delete_database(db: Session, db_id: str, owner_id: str) -> bool:
    record = get_database(db, db_id, owner_id)
    if not record:
        return False
    record.is_active = False
    connection_manager.evict(str(db_id))
    db.commit()
    return True


def update_health(db: Session, record: ConnectedDatabase, status: HealthStatus) -> None:
    record.status = status
    record.last_checked_at = datetime.utcnow()
    if status == HealthStatus.CONNECTED:
        record.last_connected_at = datetime.utcnow()
    db.commit()


# ── Schema Catalog CRUD ───────────────────────────────────────────────────────

def get_current_catalog(db: Session, database_id: str) -> SchemaCatalog | None:
    return (
        db.query(SchemaCatalog)
        .filter(SchemaCatalog.database_id == database_id, SchemaCatalog.is_current == True)
        .first()
    )


def save_catalog(
    db: Session,
    database_id: str,
    catalog_json: dict,
    schema_text: str,
    table_count: int,
    insights_json: dict | None = None,
) -> SchemaCatalog:
    """
    Mark all previous catalogs for this database as not current,
    then insert a new current catalog (versions are preserved).
    """
    # Determine next version number
    latest = (
        db.query(SchemaCatalog)
        .filter(SchemaCatalog.database_id == database_id)
        .order_by(SchemaCatalog.version.desc())
        .first()
    )
    next_version = (latest.version + 1) if latest else 1

    # Archive old current
    db.query(SchemaCatalog).filter(
        SchemaCatalog.database_id == database_id,
        SchemaCatalog.is_current == True
    ).update({"is_current": False})

    # Insert new current
    new_catalog = SchemaCatalog(
        id=uuid.uuid4(),
        database_id=database_id,
        version=next_version,
        catalog_json=catalog_json,
        schema_text=schema_text,
        table_count=table_count,
        insights_json=insights_json,
        is_current=True,
        discovered_at=datetime.utcnow(),
    )
    db.add(new_catalog)
    db.commit()
    db.refresh(new_catalog)
    return new_catalog


# ── Full Connect Flow ─────────────────────────────────────────────────────────

def discover_and_save_schema(db: Session, db_record: ConnectedDatabase) -> SchemaCatalog:
    """
    Get (or build) a live engine, run full schema discovery,
    build catalog + text + insights, save to Supabase, update health status.
    """
    try:
        engine = connection_manager.get_engine(db_record)
        discovery = SchemaDiscoveryService(engine)
        raw = discovery.discover_all()
        builder = SchemaCatalogBuilder(raw)
        catalog_json = builder.build_json()
        schema_text = builder.build_text()
        table_count = builder.table_count()

        # Compute insights from the catalog (pure computation — no LLM)
        insights_json = DatabaseInsightsService.generate(catalog_json, str(db_record.db_type.value))

        catalog = save_catalog(db, str(db_record.id), catalog_json, schema_text, table_count, insights_json)
        update_health(db, db_record, HealthStatus.CONNECTED)
        return catalog

    except Exception as exc:
        update_health(db, db_record, HealthStatus.FAILED)
        raise exc
