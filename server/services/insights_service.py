"""
services/insights_service.py
=============================
Computes a Database Insights report from an already-discovered catalog_json.
Pure computation — no LLM, no DB calls. Instant and reliable.
"""

from __future__ import annotations
from datetime import datetime, timezone
from typing import Any


class DatabaseInsightsService:
    """
    Derives all insight statistics from the catalog_json stored in SchemaCatalog.
    Input: the dict returned by SchemaCatalogBuilder.build_json() (i.e. SchemaDiscoveryService.discover_all())
    """

    @staticmethod
    def generate(catalog_json: dict, db_type: str) -> dict[str, Any]:
        """
        Compute and return a complete insights dict.

        Returns:
        {
          "total_tables": int,
          "total_columns": int,
          "total_rows": int,           # sum of all row counts (-1 rows excluded)
          "largest_table": {"name": str, "row_count": int},
          "smallest_table": {"name": str, "row_count": int},
          "total_relationships": int,  # FK relationship count
          "db_engine": str,            # e.g. "PostgreSQL"
          "tables": [
            {"name": str, "row_count": int, "column_count": int, "fk_count": int}
          ],
          "generated_at": str          # ISO 8601
        }
        """
        tables_raw: dict = catalog_json.get("tables", {})
        relationships: list = catalog_json.get("relationships", [])

        table_summaries = []
        for table_name, table_info in tables_raw.items():
            row_count = table_info.get("row_count", -1)
            col_count = len(table_info.get("columns", []))
            fk_count  = len(table_info.get("foreign_keys", []))
            table_summaries.append({
                "name":         table_name,
                "row_count":    row_count,
                "column_count": col_count,
                "fk_count":     fk_count,
            })

        # Sort by row count descending for display
        valid_rows = [t for t in table_summaries if t["row_count"] >= 0]
        sorted_tables = sorted(valid_rows, key=lambda t: t["row_count"], reverse=True)

        total_tables  = len(table_summaries)
        total_columns = sum(t["column_count"] for t in table_summaries)
        total_rows    = sum(t["row_count"] for t in valid_rows)

        largest_table  = sorted_tables[0]  if sorted_tables else None
        smallest_table = sorted_tables[-1] if sorted_tables else None

        # Map db_type string to a human-readable engine name
        engine_map = {
            "POSTGRESQL": "PostgreSQL",
            "MYSQL":      "MySQL",
            "SQLITE":     "SQLite",
        }
        db_engine = engine_map.get(str(db_type).upper(), str(db_type))

        return {
            "total_tables":        total_tables,
            "total_columns":       total_columns,
            "total_rows":          total_rows,
            "largest_table":       largest_table,
            "smallest_table":      smallest_table,
            "total_relationships": len(relationships),
            "db_engine":           db_engine,
            "tables":              sorted_tables,
            "generated_at":        datetime.now(timezone.utc).isoformat(),
        }
