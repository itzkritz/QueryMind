"""
schemas/database.py
====================
Pydantic v2 models for database connection API endpoints.
Passwords NEVER appear in response schemas.
"""

from __future__ import annotations
from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field, model_validator
from config import DatabaseType, HealthStatus


# ── Requests ──────────────────────────────────────────────────────────────────

class ConnectDatabaseRequest(BaseModel):
    name:          str         = Field(..., min_length=1, max_length=255, description="Human-readable label for this connection")
    db_type:       DatabaseType = Field(..., description="One of: POSTGRESQL, MYSQL, SQLITE")

    # Network databases (PostgreSQL, MySQL)
    host:          Optional[str] = None
    port:          Optional[int] = None
    database_name: Optional[str] = None
    username:      Optional[str] = None
    password:      Optional[str] = None   # Will be encrypted before storage — never returned

    @model_validator(mode="after")
    def validate_required_for_type(self):
        if self.db_type in (DatabaseType.POSTGRESQL, DatabaseType.MYSQL):
            missing = [f for f, v in {
                "host": self.host, "database_name": self.database_name,
                "username": self.username, "password": self.password,
            }.items() if not v]
            if missing:
                raise ValueError(f"{self.db_type} requires: {', '.join(missing)}")
        return self


# ── Insights ──────────────────────────────────────────────────────────────────

class TableInsight(BaseModel):
    name:         str
    row_count:    int
    column_count: int
    fk_count:     int


class TableSummary(BaseModel):
    name:      str
    row_count: int


class DatabaseInsights(BaseModel):
    total_tables:        int
    total_columns:       int
    total_rows:          int
    largest_table:       Optional[TableSummary] = None
    smallest_table:      Optional[TableSummary] = None
    total_relationships: int
    db_engine:           str
    tables:              List[TableInsight] = []
    generated_at:        Optional[str] = None


# ── Responses ─────────────────────────────────────────────────────────────────

class DatabaseResponse(BaseModel):
    id:               str
    name:             str
    db_type:          DatabaseType
    host:             Optional[str]
    port:             Optional[int]
    database_name:    Optional[str]
    username:         Optional[str]
    status:           HealthStatus
    last_checked_at:  Optional[datetime]
    last_connected_at: Optional[datetime]
    created_at:       datetime
    table_count:      Optional[int] = None
    insights:         Optional[DatabaseInsights] = None
    # NOTE: encrypted_password and sqlite_file_path are intentionally excluded

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_with_catalog(cls, record, catalog=None):
        insights = None
        if catalog and catalog.insights_json:
            try:
                insights = DatabaseInsights(**catalog.insights_json)
            except Exception:
                insights = None

        return cls(
            id=str(record.id),
            name=record.name,
            db_type=record.db_type,
            host=record.host,
            port=record.port,
            database_name=record.database_name,
            username=record.username,
            status=record.status,
            last_checked_at=record.last_checked_at,
            last_connected_at=record.last_connected_at,
            created_at=record.created_at,
            table_count=catalog.table_count if catalog else None,
            insights=insights,
        )


class DatabaseListItem(BaseModel):
    id:            str
    name:          str
    db_type:       DatabaseType
    status:        HealthStatus
    table_count:   Optional[int]
    created_at:    datetime

    class Config:
        from_attributes = True
