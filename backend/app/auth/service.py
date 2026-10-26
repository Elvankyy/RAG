from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import User, UserSession
from app.core.security import (
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    refresh_expiry,
    verify_password,
)


async def authenticate(db: AsyncSession, username: str, password: str) -> User | None:
    user = await db.scalar(select(User).where(User.username == username.strip()))
    if not user or not verify_password(password, user.password_hash):
        return None
    return user


def serialize_user(user: User, permissions: list[str]) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "display_name": user.display_name,
        "status": user.status,
        "department": (
            {"id": user.department.id, "name": user.department.name}
            if user.department
            else None
        ),
        "roles": [
            {"id": role.id, "role_name": role.role_name, "role_code": role.role_code}
            for role in user.roles
        ],
        "permissions": permissions,
    }


async def create_session(db: AsyncSession, user: User, ip: str, user_agent: str) -> str:
    raw = generate_refresh_token()
    db.add(
        UserSession(
            user_id=user.id,
            refresh_token_hash=hash_refresh_token(raw),
            expires_at=refresh_expiry(),
            ip=ip[:64],
            user_agent=user_agent[:500],
        )
    )
    await db.flush()
    return raw


async def find_active_session(db: AsyncSession, raw: str) -> UserSession | None:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    return await db.scalar(
        select(UserSession).where(
            UserSession.refresh_token_hash == hash_refresh_token(raw),
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > now,
        )
    )


async def revoke_session(db: AsyncSession, session: UserSession) -> None:
    session.revoked_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.flush()


async def revoke_user_sessions(db: AsyncSession, user_id: int) -> None:
    await db.execute(
        update(UserSession)
        .where(UserSession.user_id == user_id, UserSession.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc).replace(tzinfo=None))
    )


async def change_password(db: AsyncSession, user: User, new_password: str) -> None:
    user.password_hash = hash_password(new_password)
    user.token_version += 1
    await revoke_user_sessions(db, user.id)
    await db.flush()
