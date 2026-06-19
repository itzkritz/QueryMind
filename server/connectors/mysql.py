"""
connectors/mysql.py
===================
MySQL connector using PyMySQL (pure-Python, no OS dependencies).
"""

import urllib.parse
from connectors.base import DatabaseConnector


class MySQLConnector(DatabaseConnector):
    def __init__(self, host: str, port: int, database_name: str, username: str, password: str):
        self.host          = host
        self.port          = port or 3306
        self.database_name = database_name
        self.username      = username
        self.password      = password

    def validate_params(self) -> None:
        missing = [f for f, v in {
            "host": self.host, "database_name": self.database_name,
            "username": self.username, "password": self.password,
        }.items() if not v]
        if missing:
            raise ValueError(f"MySQL connection missing required fields: {', '.join(missing)}")

    def build_url(self) -> str:
        pw = urllib.parse.quote_plus(self.password)
        return f"mysql+pymysql://{self.username}:{pw}@{self.host}:{self.port}/{self.database_name}?charset=utf8mb4"

    def engine_kwargs(self) -> dict:
        return {
            "pool_pre_ping": True,
            "connect_args": {"connect_timeout": 10},
        }
