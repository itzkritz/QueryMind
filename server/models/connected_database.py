"""
models/connected_database.py
==============================
ORM model for user-connected databases stored in Supabase.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID

from database import Base
from config import DatabaseType, HealthStatus


class ConnectedDatabase(Base):
    __tablename__ = "connected_databases"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    owner_id    = Column(String(255), nullable=True, index=True)   # Supabase Auth user UUID

    # User-given label
    name        = Column(String(255), nullable=False)

    # DB type (enum stored as string)
    db_type     = Column(SAEnum(DatabaseType, name="database_type_enum", create_constraint=True),
                         nullable=False)

    # Connection parameters (nullable for SQLite)
    host            = Column(String(255), nullable=True)
    port            = Column(Integer, nullable=True)
    database_name   = Column(String(255), nullable=True)
    username        = Column(String(255), nullable=True)
    encrypted_password = Column(Text, nullable=True)      # Fernet-encrypted, NEVER returned by API
    sqlite_file_path   = Column(Text, nullable=True)      # Server-side path for uploaded .db files

    # Health tracking
    status          = Column(String(50), default=HealthStatus.PENDING, nullable=False)
    last_checked_at = Column(DateTime, nullable=True)

    # Lifecycle
    is_active       = Column(Boolean, default=True, nullable=False)
    created_at      = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_connected_at = Column(DateTime, nullable=True)

    # ORM relationships
    schema_catalogs = relationship(
        "SchemaCatalog", back_populates="database",
        cascade="all, delete-orphan", lazy="select"
    )
    query_histories = relationship(
        "QueryHistory", back_populates="database",
        cascade="all, delete-orphan", lazy="select"
    )
