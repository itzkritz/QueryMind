"""
connectors/postgresql.py
========================
PostgreSQL connector using psycopg2.
"""

import urllib.parse
from connectors.base import DatabaseConnector


class PostgreSQLConnector(DatabaseConnector):
    def __init__(self, host: str, port: int, database_name: str, username: str, password: str):
        self.host          = host
        self.port          = port or 5432
        self.database_name = database_name
        self.username      = username
        self.password      = password

    def validate_params(self) -> None:
        missing = [f for f, v in {
            "host": self.host, "database_name": self.database_name,
            "username": self.username, "password": self.password,
        }.items() if not v]
        if missing:
            raise ValueError(f"PostgreSQL connection missing required fields: {', '.join(missing)}")

    def build_url(self) -> str:
        pw = urllib.parse.quote_plus(self.password)
        return f"postgresql+psycopg2://{self.username}:{pw}@{self.host}:{self.port}/{self.database_name}"
