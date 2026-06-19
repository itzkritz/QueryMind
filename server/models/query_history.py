"""
models/query_history.py
=======================
Updated QueryHistory model with user_id, database_id, and execution_time.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, Float, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID

from database import Base


class QueryHistory(Base):
    __tablename__ = "query_history"

    id              = Column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id         = Column(String(255), nullable=True, index=True)   # Supabase Auth user UUID
    database_id     = Column(UUID(as_uuid=True), ForeignKey("connected_databases.id", ondelete="SET NULL"), nullable=True, index=True)

    question        = Column(Text, nullable=False)
    generated_sql   = Column(Text, nullable=True)
    model_used      = Column(String(100), nullable=False, default="gemini")  # e.g. "gemini", "ollama/qwen2.5-coder:1.5b"
    execution_time  = Column(Float, nullable=True)                           # Seconds
    status          = Column(String(20), nullable=False, default="success")  # "success" | "error"
    session_id      = Column(String(255), nullable=True, index=True)         # ChatGPT-style chat session UUID
    session_title   = Column(String(255), nullable=True)                     # User-facing chat session name
    created_at      = Column(DateTime, default=datetime.utcnow, nullable=False)

    # ORM relationship
    database = relationship("ConnectedDatabase", back_populates="query_histories")
