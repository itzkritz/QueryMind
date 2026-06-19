"""
models.py
=========
SQLAlchemy ORM models.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text
from database import Base


class QueryHistory(Base):
    __tablename__ = "query_history"

    id          = Column(Integer, primary_key=True, index=True)
    question    = Column(Text, nullable=False)
    generated_sql = Column(Text, nullable=True)
    provider    = Column(String(50), nullable=False, default="gemini")
    status      = Column(String(20), nullable=False, default="success")  # "success" | "error"
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)
