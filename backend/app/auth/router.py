from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.schemas import (
    ChangePasswordRequest,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
)
from app.auth.service import (
    authenticate,
    change_password,
    create_session,
    find_active_session,
    revoke_session,
    revoke_user_sessions,
    serialize_user,
)
from app.core.database import get_db
from app.core.deps import get_current_user, get_user_permission_codes
from app.core.models import User
from app.core.security import create_access_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["认证"])


def client_meta(request: Request) -> tuple[str, str]:
    ip = request.client.host if request.client else ""
    return ip, request.headers.get("User-Agent", "")


async def token_payload(db: AsyncSession, user: User, refresh_token: str) -> dict:
    permissions = await get_user_permission_codes(db, user)
    return {
        "access_token": create_access_token(user),
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user_info": serialize_user(user, permissions),
        "permissions": permissions,
    }


@router.post("/login")
async def login(
    payload: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    user = await authenticate(db, payload.username, payload.password)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "用户名或密码错误")
    if user.status != "active":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "账号已被禁用，请联系管理员")

    ip, user_agent = client_meta(request)
    refresh_token = await create_session(db, user, ip, user_agent)
    result = await token_payload(db, user, refresh_token)
    await db.commit()
    return result


@router.post("/refresh")
async def refresh(
    payload: RefreshRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    session = await find_active_session(db, payload.refresh_token)
    if not session:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "刷新令牌无效或已过期")
    user = await db.get(User, session.user_id)
    if not user or user.status != "active":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "账号不可用")

    await revoke_session(db, session)
    ip, user_agent = client_meta(request)
    refresh_token = await create_session(db, user, ip, user_agent)
    result = await token_payload(db, user, refresh_token)
    await db.commit()
    return result


@router.post("/logout")
async def logout(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    payload: LogoutRequest | None = None,
) -> dict:
    if payload and payload.refresh_token:
        session = await find_active_session(db, payload.refresh_token)
        if session and session.user_id == user.id:
            await revoke_session(db, session)
    else:
        await revoke_user_sessions(db, user.id)
    await db.commit()
    return {"message": "已退出登录"}


@router.get("/me")
async def me(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    permissions = await get_user_permission_codes(db, user)
    return serialize_user(user, permissions)


@router.put("/password")
async def update_password(
    payload: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if not verify_password(payload.old_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "原密码不正确")
    if payload.old_password == payload.new_password:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "新密码不能与原密码相同")
    await change_password(db, user, payload.new_password)
    await db.commit()
    return {"message": "密码修改成功，请重新登录"}
