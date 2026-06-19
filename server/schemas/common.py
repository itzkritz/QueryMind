"""schemas/common.py — Shared response types."""
from pydantic import BaseModel
from typing import List

class HealthResponse(BaseModel):
    status: str
    database: str
    providers: List[str]

class MessageResponse(BaseModel):
    message: str
    success: bool = True
