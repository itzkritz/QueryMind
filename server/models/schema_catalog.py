"""
models/schema_catalog.py
========================
ORM model for discovered schema catalogs and version history.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, Integer, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID

from database import Base


class SchemaCatalog(Base):
    __tablename__ = "schema_catalogs"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    database_id = Column(UUID(as_uuid=True), ForeignKey("connected_databases.id", ondelete="CASCADE"), nullable=False, index=True)

    version         = Column(Integer, default=1, nullable=False)
    catalog_json    = Column(JSON, nullable=False)           # Full structured schema (tables, columns, PKs, FKs, row_count, sample_values)
    schema_text     = Column(Text, nullable=True)            # ChromaDB-ready plain text representation
    table_count     = Column(Integer, default=0, nullable=False)
    insights_json   = Column(JSON, nullable=True)            # Computed database statistics (row counts, relationships, etc.)
    is_current      = Column(Boolean, default=True, nullable=False, index=True)
    discovered_at   = Column(DateTime, default=datetime.utcnow, nullable=False)

    # ORM relationship
    database = relationship("ConnectedDatabase", back_populates="schema_catalogs")
