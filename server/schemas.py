"""
schemas.py
==========
Pydantic v2 request and response schemas.
"""

from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ── Request schemas ────────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    question: str = Field(..., min_length=3, description="Natural language question to answer")
    provider: str = Field(default="gemini", description="LLM provider: 'gemini' or 'ollama'")


# ── Response schemas ───────────────────────────────────────────────────────────

class QueryResponse(BaseModel):
    question: str
    sql: Optional[str] = None
    rows: List[Dict[str, Any]] = []
    error: Optional[str] = None
    validated: bool = False
    execution_time: float = 0.0


class HistoryItem(BaseModel):
    id: int
    question: str
    generated_sql: Optional[str]
    provider: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class SchemaColumn(BaseModel):
    name: str
    data_type: str
    foreign_key: Optional[str] = None


class SchemaTable(BaseModel):
    table_name: str
    columns: List[SchemaColumn]


class SchemaResponse(BaseModel):
    tables: List[SchemaTable]


class HealthResponse(BaseModel):
    status: str
    database: str
    providers: List[str]
