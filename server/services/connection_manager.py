"""
services/connection_manager.py
===============================
In-memory LRU cache for SQLAlchemy engines.
Avoids reconnecting on every query — engines are reused until
the database is deleted, refreshed, or the server restarts.
"""

from __future__ import annotations
from functools import lru_cache
from sqlalchemy.engine import Engine
from connectors.factory import build_connector


class ConnectionManager:
    """Thread-safe singleton engine pool keyed by database UUID string."""

    _pool: dict[str, Engine] = {}

    def get_engine(self, db_record) -> Engine:
        """
        Return the cached Engine for this database record, or build a new one.
        db_record — a ConnectedDatabase ORM instance.
        """
        key = str(db_record.id)
        if key not in self._pool:
            connector = build_connector(db_record)
            self._pool[key] = connector.get_engine()
        return self._pool[key]

    def evict(self, db_id: str) -> None:
        """Remove a cached engine (call on DELETE or schema refresh)."""
        engine = self._pool.pop(str(db_id), None)
        if engine:
            engine.dispose()

    def evict_all(self) -> None:
        """Dispose all cached engines (e.g. server shutdown)."""
        for engine in self._pool.values():
            engine.dispose()
        self._pool.clear()

    def is_cached(self, db_id: str) -> bool:
        return str(db_id) in self._pool


# Singleton instance
connection_manager = ConnectionManager()
