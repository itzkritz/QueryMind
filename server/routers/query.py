"""
routers/query.py
================
Text-to-SQL query endpoint — now database_id aware, no hardcoded schemas.
"""

import time
import re
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from database import get_db
from security import get_current_user
from config import settings
from schemas.query import QueryRequest, QueryResponse, HistoryItem, ChartMeta, SQLExplanation
from models.query_history import QueryHistory
from services.database_registry import get_database, get_current_catalog
from services.connection_manager import connection_manager
from services.chart_recommender import ChartRecommender
from services.sql_explainer import SQLExplainerService
from connectors.factory import build_connector

# LLM imports
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
import requests as http_requests

router = APIRouter(prefix="/api", tags=["query"])

SYSTEM_PROMPT = """You are an expert SQL analyst. Given the database schema below and a user question, write a single valid SQL SELECT query.

Rules:
- Output ONLY the SQL query, no explanations, no markdown code fences.
- Always LIMIT results to {max_rows} rows.
- Use only tables and columns that exist in the schema below.

Schema:
{schema}

Question: {question}
SQL:"""

FORBIDDEN_KEYWORDS = ["DROP","DELETE","UPDATE","INSERT","TRUNCATE","ALTER","CREATE","GRANT","REVOKE","RENAME","MERGE"]


def _clean_sql(raw: str) -> str:
    raw = raw.strip()
    raw = re.sub(r"^```(?:sql)?\s*", "", raw, flags=re.IGNORECASE)
    raw = re.sub(r"\s*```$", "", raw)
    return raw.strip()


def _validate_sql(sql: str, allowed_tables: set[str]) -> str:
    sql_clean = sql.strip()
    if not sql_clean:
        raise ValueError("Generated SQL is empty.")
    sql_upper = re.sub(r"--.*", "", sql_clean).upper()
    if not sql_upper.strip().startswith("SELECT"):
        raise ValueError("Only SELECT queries are allowed.")
    for kw in FORBIDDEN_KEYWORDS:
        if re.search(r"\b" + kw + r"\b", sql_upper):
            raise ValueError(f"Forbidden keyword '{kw}' detected.")
    if allowed_tables:
        found = re.findall(r"\b(?:FROM|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_]*)\b", sql_clean, re.IGNORECASE)
        ignore_keywords = {"lateral", "unnest", "values", "select", "generate_series", "json_to_record", "jsonb_each"}
        for t in found:
            if t.lower() in ignore_keywords:
                continue
            if t.lower() not in {a.lower() for a in allowed_tables}:
                raise ValueError(f"Table '{t}' is not in the connected database schema.")
    return sql_clean


def _generate_gemini(prompt: str) -> str:
    if not settings.GOOGLE_API_KEY:
        raise ValueError("GOOGLE_API_KEY not configured.")
    llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", google_api_key=settings.GOOGLE_API_KEY, temperature=0)
    return llm.invoke([HumanMessage(content=prompt)]).content


def _generate_ollama(prompt: str) -> str:
    resp = http_requests.post(
        f"{settings.OLLAMA_HOST}/api/generate",
        json={"model": settings.OLLAMA_MODEL, "prompt": prompt, "stream": False, "options": {"temperature": 0}},
        timeout=300,
    )
    resp.raise_for_status()
    return resp.json()["response"]


def _execute_sql(engine, sql: str) -> list[dict]:
    with engine.connect() as conn:
        result = conn.execute(text(sql))
        keys = list(result.keys())
        rows = []
        for row in result.fetchall():
            rows.append({
                k: (float(v) if hasattr(v, "__float__") and not isinstance(v, (int, str, bool, type(None))) else v)
                for k, v in zip(keys, row)
            })
    return rows


@router.post("/query", response_model=QueryResponse)
def run_query(
    request: QueryRequest,
    db: Session = Depends(get_db),
    owner_id: str = Depends(get_current_user),
):
    if request.provider not in ("gemini", "ollama"):
        raise HTTPException(status_code=400, detail=f"Unknown provider: {request.provider}")

    # Load database record (owner-scoped)
    db_record = get_database(db, request.database_id, owner_id)
    if not db_record:
        raise HTTPException(status_code=404, detail="Database not found or access denied.")

    # Load current schema catalog
    catalog = get_current_catalog(db, request.database_id)
    if not catalog:
        raise HTTPException(status_code=422, detail="Schema not discovered. Refresh the database schema first.")

    schema_text = catalog.schema_text or ""
    allowed_tables = set(catalog.catalog_json.get("tables", {}).keys())
    model_used = f"{request.provider}/{settings.OLLAMA_MODEL}" if request.provider == "ollama" else "gemini/gemini-2.5-flash"

    start = time.time()
    sql = None
    error = None
    validated = False
    rows = []
    sql_explanation = None

    try:
        prompt = SYSTEM_PROMPT.format(schema=schema_text, question=request.question, max_rows=settings.MAX_ROWS)
        raw = _generate_gemini(prompt) if request.provider == "gemini" else _generate_ollama(prompt)
        sql = _clean_sql(raw)
        sql = _validate_sql(sql, allowed_tables)
        validated = True
        engine = connection_manager.get_engine(db_record)
        rows = _execute_sql(engine, sql)
    except Exception as exc:
        error = str(exc)

    execution_time = round(time.time() - start, 2)

    # Generate SQL explanation only if validation passed, query was built, and no error occurred
    if validated and not error and sql:
        try:
            sql_explanation = SQLExplainerService.explain(sql, request.question, schema_text, request.provider)
        except Exception as expl_exc:
            print(f"Explanation generation error (non-fatal): {expl_exc}")

    # ── Chart recommendation ──────────────────────────────────────────────────
    chart_meta_dict = ChartRecommender.recommend(rows, sql, request.question)
    chart_meta = ChartMeta(**chart_meta_dict)

    # Persist to history
    entry = QueryHistory(
        user_id=owner_id,
        database_id=db_record.id,
        question=request.question,
        generated_sql=sql,
        sql_explanation=sql_explanation,
        model_used=model_used,
        execution_time=execution_time,
        status="success" if not error else "error",
        session_id=request.session_id,
        session_title=request.session_title or request.question[:50],
    )
    db.add(entry)
    db.commit()

    return QueryResponse(
        question=request.question,
        database_id=request.database_id,
        sql=sql,
        rows=rows,
        error=error,
        validated=validated,
        execution_time=execution_time,
        model_used=model_used,
        session_id=entry.session_id,
        session_title=entry.session_title,
        chart_meta=chart_meta,
        sql_explanation=sql_explanation,
    )


@router.get("/history", response_model=List[HistoryItem])
def get_history(
    limit: int = 20,
    db: Session = Depends(get_db),
    owner_id: str = Depends(get_current_user),
):
    return (
        db.query(QueryHistory)
        .filter(QueryHistory.user_id == owner_id)
        .order_by(QueryHistory.created_at.desc())
        .limit(limit)
        .all()
    )


@router.delete("/history/session/{session_id}")
def delete_session(
    session_id: str,
    db: Session = Depends(get_db),
    owner_id: str = Depends(get_current_user),
):
    # Delete all query history items under this session_id for the owner
    deleted_count = (
        db.query(QueryHistory)
        .filter(QueryHistory.session_id == session_id, QueryHistory.user_id == owner_id)
        .delete(synchronize_session=False)
    )
    db.commit()
    return {"message": "Session deleted successfully", "deleted_count": deleted_count}

