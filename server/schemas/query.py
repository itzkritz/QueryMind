"""schemas/query.py — Query request/response schemas with chart metadata."""
from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class QueryRequest(BaseModel):
    database_id: str = Field(..., description="UUID of the connected database to query")
    question:    str = Field(..., min_length=3)
    provider:    str = Field(default="gemini", description="'gemini' or 'ollama'")
    session_id:  Optional[str] = None
    session_title: Optional[str] = None


class ChartMeta(BaseModel):
    """Chart recommendation metadata returned alongside query results."""
    suitable:   bool = False
    chart_type: Optional[str] = None   # "line" | "bar" | "pie" | "area"
    x_key:      Optional[str] = None   # column name for X axis / category
    y_keys:     List[str] = []         # column names for Y axis / values
    title:      Optional[str] = None   # auto-generated chart title


class SQLExplanation(BaseModel):
    summary:          str
    tables_used:      List[str] = []
    joins:            str
    filters:          str
    aggregations:     List[str] = []
    sorting_grouping: str


class QueryResponse(BaseModel):
    question:       str
    database_id:    Any
    sql:            Optional[str] = None
    rows:           List[Dict[str, Any]] = []
    error:          Optional[str] = None
    validated:      bool = False
    execution_time: float = 0.0
    model_used:     Optional[str] = None
    session_id:     Optional[str] = None
    session_title:  Optional[str] = None
    chart_meta:     Optional[ChartMeta] = None
    sql_explanation: Optional[SQLExplanation] = None


class HistoryItem(BaseModel):
    id:            int
    user_id:       Optional[str]
    database_id:   Optional[Any] = None
    question:      str
    generated_sql: Optional[str]
    model_used:    str
    execution_time: Optional[float]
    status:        str
    created_at:    datetime
    session_id:    Optional[str] = None
    session_title: Optional[str] = None
    sql_explanation: Optional[SQLExplanation] = None

    class Config:
        from_attributes = True
