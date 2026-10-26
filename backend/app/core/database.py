from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.core.config import settings


class Base(DeclarativeBase):
    pass


engine_kwargs: dict[str, object] = {"echo": False, "future": True}
if settings.database_url.startswith("sqlite"):
    engine_kwargs["poolclass"] = NullPool

engine = create_async_engine(settings.database_url, **engine_kwargs)


@event.listens_for(engine.sync_engine, "connect")
def _sqlite_pragma(dbapi_connection, _connection_record) -> None:  # pragma: no cover
    if settings.database_url.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()


SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session


async def init_db() -> None:
    from app.core import models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def reset_db() -> None:
    """清空演示数据（测试用）；不执行 DROP，避免 SQLite 循环外键限制。"""
    from sqlalchemy import delete, update

    from app.core import models
    from app.core.models import (
        Department,
        ChatMessage,
        ChatSession,
        Faq,
        ImportBatch,
        ImportTask,
        KnowledgeGap,
        KnowledgeUnit,
        QaAccessLog,
        Role,
        RolePermission,
        UnitChunk,
        UnitPermission,
        UnitVersion,
        User,
        UserRole,
        UserSession,
    )

    await init_db()
    async with SessionLocal() as session:
        await session.execute(
            update(Department).values(leader_id=None, parent_id=None)
        )
        for model in (
            UserSession,
            RolePermission,
            UserRole,
            ChatMessage,
            QaAccessLog,
            ChatSession,
            Faq,
            KnowledgeGap,
            ImportTask,
            ImportBatch,
            UnitChunk,
            UnitVersion,
            UnitPermission,
            KnowledgeUnit,
            User,
            Department,
            Role,
        ):
            await session.execute(delete(model))
        await session.commit()
