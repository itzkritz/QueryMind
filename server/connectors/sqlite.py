"""
connectors/sqlite.py
====================
SQLite connector for uploaded .db files.
No host/port/credentials needed.
"""

from connectors.base import DatabaseConnector
from sqlalchemy import text


class SQLiteConnector(DatabaseConnector):
    def __init__(self, file_path: str):
        self.file_path = file_path

    def validate_params(self) -> None:
        if not self.file_path:
            raise ValueError("SQLite connection requires a file_path to the .db file.")
        import os
        if not os.path.exists(self.file_path):
            raise ValueError(f"SQLite file not found at path: {self.file_path}")

    def build_url(self) -> str:
        return f"sqlite:///{self.file_path}"

    def engine_kwargs(self) -> dict:
        return {
            "pool_pre_ping": True,
            "connect_args": {"check_same_thread": False},
        }

    def test_connection(self) -> bool:
        """Override to use SQLite-compatible ping."""
        engine = self.get_engine()
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
