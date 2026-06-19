"""
services/schema_catalog_builder.py
====================================
Builds two representations of a discovered schema:
  1. catalog_json — rich JSON for the API and future metadata queries
  2. schema_text  — human-readable text ready for ChromaDB embedding / LLM prompts
"""

from __future__ import annotations


class SchemaCatalogBuilder:
    """
    Transforms raw schema discovery output (from SchemaDiscoveryService.discover_all())
    into the two canonical formats stored in schema_catalogs.
    """

    def __init__(self, raw_schema: dict):
        """raw_schema: dict returned by SchemaDiscoveryService.discover_all()"""
        self.raw = raw_schema

    # ── JSON Catalog ──────────────────────────────────────────────────────────

    def build_json(self) -> dict:
        """Return the schema as a structured JSON-serialisable dict."""
        return self.raw  # Already structured by SchemaDiscoveryService

    # ── Text Catalog (ChromaDB / LLM prompt ready) ────────────────────────────

    def build_text(self) -> str:
        """
        Generate a clean plain-text schema description.
        Optimised for LLM prompt injection and future ChromaDB embedding.
        
        Example output:
        
            Table: customers (175 rows)
              customer_id (INTEGER) [PK] | Sample: 1, 2, 3
              email (VARCHAR) | Sample: alice@ex.com, bob@ex.com
              city_id (INTEGER) [FK -> cities.id] | Sample: 4, 7, 12
            
            Relationships:
              customers.city_id -> cities.id
        """
        lines = []
        tables = self.raw.get("tables", {})
        relationships = self.raw.get("relationships", [])

        for table_name, table_info in tables.items():
            row_count = table_info.get("row_count", -1)
            count_str = f"{row_count:,} rows" if row_count >= 0 else "row count unavailable"
            lines.append(f"\nTable: {table_name} ({count_str})")

            for col in table_info.get("columns", []):
                parts = []

                # data type
                parts.append(f"  {col['name']} ({col['data_type']})")

                # PK / FK annotations
                flags = []
                if col.get("is_primary_key"):
                    flags.append("[PK]")
                if col.get("is_foreign_key") and col.get("foreign_key_ref"):
                    flags.append(f"[FK -> {col['foreign_key_ref']}]")
                if not col.get("nullable", True):
                    flags.append("[NOT NULL]")
                if flags:
                    parts.append(" ".join(flags))

                # Sample values
                samples = col.get("sample_values", [])
                if samples:
                    sample_str = ", ".join(str(s) for s in samples[:5])
                    parts.append(f"| Sample: {sample_str}")

                lines.append(" ".join(parts))

        if relationships:
            lines.append("\nRelationships:")
            for rel in relationships:
                lines.append(
                    f"  {rel['from_table']}.{rel['from_column']} -> "
                    f"{rel['to_table']}.{rel['to_column']}"
                )

        return "\n".join(lines)

    def table_count(self) -> int:
        return len(self.raw.get("tables", {}))
