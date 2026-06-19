"""
services/database_validator.py
================================
Validates a database connection BEFORE saving credentials.
"""

from __future__ import annotations
from config import DatabaseType
from connectors.postgresql import PostgreSQLConnector
from connectors.mysql import MySQLConnector
from connectors.sqlite import SQLiteConnector


def validate_connection(
    db_type: DatabaseType,
    *,
    host: str = None,
    port: int = None,
    database_name: str = None,
    username: str = None,
    password: str = None,
    sqlite_file_path: str = None,
) -> None:
    """
    Build a temporary connector and test the connection.
    Raises ValueError with a human-readable message on failure.
    No credentials are persisted at this stage.
    """
    try:
        if db_type == DatabaseType.POSTGRESQL:
            connector = PostgreSQLConnector(
                host=host, port=port or 5432,
                database_name=database_name,
                username=username, password=password,
            )
        elif db_type == DatabaseType.MYSQL:
            connector = MySQLConnector(
                host=host, port=port or 3306,
                database_name=database_name,
                username=username, password=password,
            )
        elif db_type == DatabaseType.SQLITE:
            connector = SQLiteConnector(file_path=sqlite_file_path)
        else:
            raise ValueError(f"Unsupported database type: {db_type}")

        connector.validate_params()
        connector.test_connection()

    except ValueError:
        raise
    except Exception as exc:
        # Sanitise error — never include password in message
        msg = str(exc)
        for secret in [password or "", username or ""]:
            if secret and secret in msg:
                msg = msg.replace(secret, "***")
        raise ValueError(f"Connection test failed: {msg}")
