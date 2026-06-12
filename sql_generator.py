"""
sql_generator.py
================
Text-to-SQL orchestration module supporting LLM providers:
  1. Gemini  (Google AI Studio - free tier, recommended)
  2. Ollama (local, fully free)

Usage:
    from sql_generator import SQLGenerator
    gen = SQLGenerator(provider="gemini")  # or "ollama"
    result = gen.query("What is the total revenue per channel?")
    print(result)
"""

import os
import re
import urllib.parse
import requests
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

# ── Database ────────────────────────────────────────────────────────────────
DB_HOST     = os.getenv("DB_HOST")
DB_PORT     = os.getenv("DB_PORT", "5432")
DB_NAME     = os.getenv("DB_NAME", "postgres")
DB_USER     = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD")

# ── LLM keys ────────────────────────────────────────────────────────────────
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
OLLAMA_HOST    = os.getenv("OLLAMA_HOST", "http://localhost:11434")

# ── Ollama model (change to any model you have pulled locally via `ollama pull`) ─
OLLAMA_MODEL = "qwen2.5-coder:1.5b"

MAX_ROWS = 100  # Safety limit on query result rows

# ── Prompt template ──────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are an expert PostgreSQL data analyst.
Given the database schema below and a user question, write a single valid PostgreSQL SELECT query that answers the question.

Rules:
- Output ONLY the SQL query, no explanations, no markdown code fences.
- Write the query on a single line.
- Always use LIMIT {max_rows} at the end to prevent huge results.
- Use lowercase table and column names.
- Only use tables and columns that exist in the schema.

Schema:
{schema}

Question: {question}
SQL Query:"""


def _build_connection_str() -> str:
    enc_pw = urllib.parse.quote_plus(DB_PASSWORD)
    return f"postgresql+psycopg2://{DB_USER}:{enc_pw}@{DB_HOST}:{DB_PORT}/{DB_NAME}"


def _get_schema_text() -> str:
    """Dynamically fetch table schema from PostgreSQL information_schema."""
    engine = create_engine(_build_connection_str())
    with engine.connect() as conn:
        # Columns
        cols = conn.execute(text("""
            SELECT table_name, column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name IN ('customers','products','regions','state_regions','sales_orders')
            ORDER BY table_name, ordinal_position
        """)).fetchall()

        # Foreign keys
        fks = conn.execute(text("""
            SELECT tc.table_name, kcu.column_name,
                   ccu.table_name AS ref_table, ccu.column_name AS ref_col
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage ccu
              ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
        """)).fetchall()

    fk_map = {(r[0], r[1]): (r[2], r[3]) for r in fks}

    tables: dict = {}
    for row in cols:
        t, c, dt = row
        tables.setdefault(t, []).append((c, dt))

    lines = []
    for t_name, t_cols in sorted(tables.items()):
        lines.append(f"Table: {t_name}")
        for col, dtype in t_cols:
            fk_note = ""
            if (t_name, col) in fk_map:
                ref_t, ref_c = fk_map[(t_name, col)]
                fk_note = f"  --> FK to {ref_t}.{ref_c}"
            lines.append(f"  - {col} ({dtype}){fk_note}")
        lines.append("")
    return "\n".join(lines)


def _clean_sql(raw: str) -> str:
    """Strip markdown fences, extra whitespace, and non-SQL preambles."""
    # Remove code fences
    raw = re.sub(r"```(?:sql)?", "", raw, flags=re.IGNORECASE)
    raw = raw.strip().strip("`").strip()
    # If the model included multiple lines, take only the first SELECT statement
    match = re.search(r"(SELECT\b.+?)(?:;|$)", raw, re.IGNORECASE | re.DOTALL)
    if match:
        return match.group(1).strip().rstrip(";")
    return raw.strip().rstrip(";")


def _execute_sql(sql: str) -> list[dict]:
    """Run a SQL query against Supabase and return rows as a list of dicts."""
    engine = create_engine(_build_connection_str())
    with engine.connect() as conn:
        result = conn.execute(text(sql))
        keys = list(result.keys())
        return [dict(zip(keys, row)) for row in result.fetchall()]


# ── Provider: Gemini ─────────────────────────────────────────────────────────
def _generate_gemini(prompt: str) -> str:
    from langchain_google_genai import ChatGoogleGenerativeAI
    from langchain_core.messages import HumanMessage

    if not GOOGLE_API_KEY:
        raise ValueError(
            "GOOGLE_API_KEY not set in .env\n"
            "Get your free key at: https://aistudio.google.com/app/apikey\n"
            "Note: The key must start with 'AIza...' (from Google AI Studio, not Google Cloud Console)"
        )

    if not GOOGLE_API_KEY.startswith("AIza"):
        raise ValueError(
            f"GOOGLE_API_KEY looks invalid (got prefix '{GOOGLE_API_KEY[:4]}...').\n"
            "Gemini API keys from Google AI Studio start with 'AIza'.\n"
            "Get your correct key at: https://aistudio.google.com/app/apikey"
        )

    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=GOOGLE_API_KEY,
        temperature=0,
    )
    response = llm.invoke([HumanMessage(content=prompt)])
    return response.content


# ── Validation Layer ─────────────────────────────────────────────────────────
def validate_sql(sql: str) -> str:
    """
    Validation Layer to ensure queries are safe and read-only.
    - Must be a SELECT statement.
    - Must not contain destructive DDL/DML keywords (DROP, DELETE, UPDATE, INSERT, ALTER, TRUNCATE, etc.).
    - Must only reference tables inside our allowed schema.
    """
    sql_clean = sql.strip()
    if not sql_clean:
        raise ValueError("Safety Validation Failure: Generated SQL is empty.")

    # Remove inline and block comments to prevent bypasses
    sql_no_comments = re.sub(r"--.*", "", sql_clean)
    sql_no_comments = re.sub(r"/\*.*?\*/", "", sql_no_comments, flags=re.DOTALL)
    sql_no_comments = sql_no_comments.strip()

    sql_upper = sql_no_comments.upper()

    # 1. Must start with SELECT
    if not sql_upper.startswith("SELECT"):
        raise ValueError("Safety Validation Failure: Only read-only SELECT queries are allowed.")

    # 2. Block destructive commands
    forbidden_keywords = [
        "DROP", "DELETE", "UPDATE", "INSERT", "TRUNCATE", "ALTER", 
        "CREATE", "GRANT", "REVOKE", "RENAME", "REPLACE", "MERGE"
    ]
    for kw in forbidden_keywords:
        pattern = r"\b" + kw + r"\b"
        if re.search(pattern, sql_upper):
            raise ValueError(f"Safety Validation Failure: Forbidden command '{kw}' detected.")

    # 3. Restrict tables to the allowed schema tables
    allowed_tables = {"customers", "products", "regions", "state_regions", "sales_orders"}
    # Match any word following FROM or JOIN
    tables_found = re.findall(r"\b(?:FROM|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_]*)\b", sql_clean, re.IGNORECASE)
    for t in tables_found:
        if t.lower() not in allowed_tables:
            raise ValueError(f"Safety Validation Failure: Table '{t}' is not in the allowed schema list.")

    return sql_clean


# ── Provider: Ollama ─────────────────────────────────────────────────────────
def _generate_ollama(prompt: str) -> str:
    url = f"{OLLAMA_HOST}/api/generate"
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0, "num_predict": 150},
    }
    # Large local models can be slow on CPU — allow up to 5 minutes
    resp = requests.post(url, json=payload, timeout=300)
    resp.raise_for_status()
    return resp.json()["response"]


# ── Public API ────────────────────────────────────────────────────────────────
class SQLGenerator:
    """
    High-level interface for Text-to-SQL generation and execution.

    Parameters
    ----------
    provider : str
        One of "gemini" or "ollama".
    """

    PROVIDERS = {
        "gemini": _generate_gemini,
        "ollama": _generate_ollama,
    }

    def __init__(self, provider: str = "gemini"):
        provider = provider.lower().strip()
        if provider not in self.PROVIDERS:
            raise ValueError(f"Unknown provider '{provider}'. Choose from: {list(self.PROVIDERS)}")
        self.provider = provider
        self._generate = self.PROVIDERS[provider]
        self._schema: str | None = None

    def _get_or_fetch_schema(self) -> str:
        if self._schema is None:
            self._schema = _get_schema_text()
        return self._schema

    def generate_sql(self, question: str) -> str:
        """Generate a SQL query from a natural language question."""
        schema = self._get_or_fetch_schema()

        # Use a shorter prompt for Ollama to reduce CPU load on large local models
        if self.provider == "ollama":
            prompt = (
                f"Write a single PostgreSQL SELECT query (no explanation, no markdown) "
                f"that answers: {question}\n\n"
                f"Schema:\n{schema}\n"
                f"Rules: output only SQL, use LIMIT {MAX_ROWS}.\nSQL:"
            )
        else:
            prompt = SYSTEM_PROMPT.format(
                schema=schema,
                question=question,
                max_rows=MAX_ROWS,
            )
        raw = self._generate(prompt)
        return _clean_sql(raw)

    def query(self, question: str) -> dict:
        """
        Full pipeline: generate SQL, validate SQL, execute it, return results.

        Returns
        -------
        dict with keys:
            - question   : the original question
            - sql        : the generated SQL
            - rows       : list of result dicts
            - error      : error message (None if successful)
            - validated  : bool indicating if validation passed
        """
        sql = None
        try:
            sql = self.generate_sql(question)
            # Run query through the Validation Layer
            sql = validate_sql(sql)
            rows = _execute_sql(sql)
            return {"question": question, "sql": sql, "rows": rows, "error": None, "validated": True}
        except Exception as exc:
            return {"question": question, "sql": sql, "rows": [], "error": str(exc), "validated": False}
