"""
connectors/base.py
==================
Abstract base class for all database connectors.
Every connector must implement build_url() and validate_params().
"""

from __future__ import annotations
from abc import ABC, abstractmethod
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine


class DatabaseConnector(ABC):
    """
    Abstract adapter that wraps a specific database driver.
    Subclasses provide the SQLAlchemy connection URL and
    any driver-specific engine kwargs.
    """

    @abstractmethod
    def build_url(self) -> str:
        """Return a fully-formed SQLAlchemy connection URL string."""
        ...

    @abstractmethod
    def validate_params(self) -> None:
        """Raise ValueError if required connection parameters are missing."""
        ...

    def engine_kwargs(self) -> dict:
        """Override to pass extra kwargs to create_engine() (e.g. connect_args)."""
        return {"pool_pre_ping": True}

    def get_engine(self) -> Engine:
        """Build and return a SQLAlchemy engine."""
        self.validate_params()
        return create_engine(self.build_url(), **self.engine_kwargs())

    def test_connection(self) -> bool:
        """
        Probe the database with SELECT 1.
        Returns True on success, raises on failure.
        """
        engine = self.get_engine()
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
