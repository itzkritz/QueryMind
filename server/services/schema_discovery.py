"""
services/schema_discovery.py
=============================
Database-agnostic schema introspection using SQLAlchemy inspect().
Discovers tables, columns, PKs, FKs, indexes, row counts, and sample values.
Works identically for PostgreSQL, MySQL, and SQLite.
"""

from __future__ import annotations
from typing import Any
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine
from config import settings


class SchemaDiscoveryService:
    """
    Discovers the complete schema of any SQLAlchemy-compatible database.
    No hardcoded table names or column names.
    """

    def __init__(self, engine: Engine):
        self.engine   = engine
        self.inspector = inspect(engine)

    def get_table_names(self) -> list[str]:
        return self.inspector.get_table_names()

    def get_row_count(self, table_name: str) -> int:
        try:
            with self.engine.connect() as conn:
                result = conn.execute(text(f'SELECT COUNT(*) FROM "{table_name}"'))
                return result.scalar() or 0
        except Exception:
            return -1  # -1 signals "count unavailable"

    def get_sample_values(self, table_name: str, column_name: str) -> list[Any]:
        """Return up to SAMPLE_VALUE_LIMIT non-null distinct sample values for a column, normalized to JSON serializable types."""
        limit = settings.SAMPLE_VALUE_LIMIT
        try:
            with self.engine.connect() as conn:
                result = conn.execute(text(
                    f'SELECT DISTINCT "{column_name}" FROM "{table_name}" '
                    f'WHERE "{column_name}" IS NOT NULL LIMIT {limit}'
                ))
                rows = result.fetchall()
                samples = []
                for row in rows:
                    val = row[0]
                    if val is None:
                        continue
                    import datetime, decimal, uuid
                    if isinstance(val, (datetime.date, datetime.datetime, datetime.time, uuid.UUID)):
                        val = str(val)
                    elif isinstance(val, decimal.Decimal):
                        val = float(val)
                    elif not isinstance(val, (int, float, str, bool)):
                        try:
                            val = str(val)
                        except Exception:
                            val = repr(val)
                    samples.append(val)
                return samples
        except Exception:
            return []

    def discover_table(self, table_name: str) -> dict:
        """Discover all metadata for a single table."""
        raw_columns = self.inspector.get_columns(table_name)
        pk_info     = self.inspector.get_pk_constraint(table_name)
        fk_info     = self.inspector.get_foreign_keys(table_name)
        index_info  = self.inspector.get_indexes(table_name)

        pk_cols = set(pk_info.get("constrained_columns", []))

        # Build FK lookup: local_col -> "ref_table.ref_col"
        fk_map: dict[str, str] = {}
        fk_list = []
        for fk in fk_info:
            for local_col, ref_col in zip(fk["constrained_columns"], fk["referred_columns"]):
                ref = f"{fk['referred_table']}.{ref_col}"
                fk_map[local_col] = ref
                fk_list.append({
                    "from_column": local_col,
                    "to_table":    fk["referred_table"],
                    "to_column":   ref_col,
                })

        columns = []
        for col in raw_columns:
            col_name = col["name"]
            col_type = str(col["type"])
            columns.append({
                "name":           col_name,
                "data_type":      col_type,
                "nullable":       col.get("nullable", True),
                "is_primary_key": col_name in pk_cols,
                "is_foreign_key": col_name in fk_map,
                "foreign_key_ref": fk_map.get(col_name),
                "default":        str(col.get("default")) if col.get("default") is not None else None,
                "sample_values":  self.get_sample_values(table_name, col_name),
            })

        return {
            "row_count":   self.get_row_count(table_name),
            "columns":     columns,
            "primary_keys": list(pk_cols),
            "foreign_keys": fk_list,
            "indexes":     [
                {
                    "name":    idx.get("name"),
                    "columns": idx.get("column_names", []),
                    "unique":  idx.get("unique", False),
                }
                for idx in index_info
            ],
        }

    def discover_all(self) -> dict:
        """
        Discover all tables and return a complete schema dict.
        
        Returns:
        {
          "tables": {
            "table_name": {
              "row_count": int,
              "columns": [...],
              "primary_keys": [...],
              "foreign_keys": [...],
              "indexes": [...]
            }
          },
          "relationships": [
            { "from_table": ..., "from_column": ..., "to_table": ..., "to_column": ... }
          ]
        }
        """
        tables = {}
        relationships = []

        for table_name in self.get_table_names():
            table_data = self.discover_table(table_name)
            tables[table_name] = table_data

            for fk in table_data["foreign_keys"]:
                relationships.append({
                    "from_table":  table_name,
                    "from_column": fk["from_column"],
                    "to_table":    fk["to_table"],
                    "to_column":   fk["to_column"],
                })

        return {"tables": tables, "relationships": relationships}
