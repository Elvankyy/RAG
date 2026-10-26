from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

router = APIRouter(tags=["基础设施"])


@router.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "knowledge-platform-backend", "version": "0.1.0"}


@router.get("/ready")
async def ready(db: AsyncSession = Depends(get_db)) -> dict:
    await db.execute(text("SELECT 1"))
    return {"status": "ready", "database": "ok"}
