"""FastAPI dependencies."""
from collections.abc import AsyncGenerator

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_db
from ..storage.minio import get_minio_client

__all__ = ["get_db", "get_minio_client"]
