from __future__ import annotations

from collections.abc import Callable

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.models import RolePermission, User
from app.core.security import decode_access_token


async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "未登录或登录已过期")
    payload = decode_access_token(header[7:].strip())
    if not payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "未登录或登录已过期")
    user = await db.get(User, int(payload["sub"]))
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "账号不存在")
    if user.status != "active":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "账号已被禁用")
    if int(payload.get("ver", -1)) != user.token_version:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "登录状态已失效，请重新登录")
    return user


async def get_user_permission_codes(db: AsyncSession, user: User) -> list[str]:
    role_ids = [role.id for role in user.roles]
    if not role_ids:
        return []
    rows = await db.scalars(
        select(RolePermission.permission_code).where(RolePermission.role_id.in_(role_ids))
    )
    return sorted(set(rows.all()))


def require_permission(*codes: str) -> Callable:
    async def checker(
        user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
    ) -> User:
        granted = set(await get_user_permission_codes(db, user))
        if not granted.intersection(codes):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "当前账号无此操作权限")
        return user

    return checker
