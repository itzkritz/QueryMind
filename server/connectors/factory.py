"""
connectors/factory.py
=====================
Connector factory — builds the right DatabaseConnector from ORM model data.
"""

from __future__ import annotations
from config import DatabaseType
from connectors.base import DatabaseConnector
from connectors.postgresql import PostgreSQLConnector
from connectors.mysql import MySQLConnector
from connectors.sqlite import SQLiteConnector
from security import decrypt_password


def build_connector(db_record) -> DatabaseConnector:
    """
    Given a ConnectedDatabase ORM object, decrypt credentials and
    return the appropriate DatabaseConnector instance.
    """
    db_type = DatabaseType(db_record.db_type)
    password = decrypt_password(db_record.encrypted_password) if db_record.encrypted_password else ""

    if db_type == DatabaseType.POSTGRESQL:
        return PostgreSQLConnector(
            host=db_record.host,
            port=db_record.port or 5432,
            database_name=db_record.database_name,
            username=db_record.username,
            password=password,
        )
    elif db_type == DatabaseType.MYSQL:
        return MySQLConnector(
            host=db_record.host,
            port=db_record.port or 3306,
            database_name=db_record.database_name,
            username=db_record.username,
            password=password,
        )
    elif db_type == DatabaseType.SQLITE:
        return SQLiteConnector(file_path=db_record.sqlite_file_path)
    else:
        raise ValueError(f"Unsupported database type: {db_type}")


__all__ = ["build_connector"]
