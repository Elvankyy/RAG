from __future__ import annotations

import httpx
from sqlalchemy import func, select

from app.core.database import SessionLocal
from app.core.models import Department, Role, User
from tests.conftest import login


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def test_seed_data(client: httpx.AsyncClient):
    async with SessionLocal() as db:
        users = await db.scalar(select(func.count(User.id)))
        roles = await db.scalar(select(func.count(Role.id)))
        departments = await db.scalar(select(func.count(Department.id)))
    assert users == 7
    assert roles == 6
    assert departments == 7


async def test_login_success(client: httpx.AsyncClient):
    response = await login(client)
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["user_info"]["username"] == "admin"
    assert body["user_info"]["department"]["name"] == "云启科技"
    assert "knowledge:update" in body["permissions"]
    assert "menu:org" in body["permissions"]


async def test_login_invalid_password(client: httpx.AsyncClient):
    response = await login(client, password="wrong-password")
    assert response.status_code == 401
    assert "用户名或密码错误" in response.json()["detail"]


async def test_login_unknown_user(client: httpx.AsyncClient):
    response = await login(client, username="nobody", password="whatever")
    assert response.status_code == 401


async def test_me_requires_token(client: httpx.AsyncClient):
    response = await client.get("/api/auth/me")
    assert response.status_code == 401


async def test_me_returns_current_user(client: httpx.AsyncClient):
    token = (await login(client, "km", "Km@12345")).json()["access_token"]
    response = await client.get("/api/auth/me", headers=auth_header(token))
    assert response.status_code == 200
    body = response.json()
    assert body["username"] == "km"
    assert body["roles"][0]["role_code"] == "knowledge_admin"
    assert "settlement:review" in body["permissions"]
    assert "user:create" not in body["permissions"]


async def test_refresh_rotation(client: httpx.AsyncClient):
    body = (await login(client)).json()
    first_refresh = body["refresh_token"]

    refreshed = await client.post("/api/auth/refresh", json={"refresh_token": first_refresh})
    assert refreshed.status_code == 200
    second_refresh = refreshed.json()["refresh_token"]
    assert second_refresh != first_refresh

    reused = await client.post("/api/auth/refresh", json={"refresh_token": first_refresh})
    assert reused.status_code == 401

    valid = await client.post("/api/auth/refresh", json={"refresh_token": second_refresh})
    assert valid.status_code == 200


async def test_logout_revokes_refresh(client: httpx.AsyncClient):
    body = (await login(client)).json()
    response = await client.post(
        "/api/auth/logout",
        headers=auth_header(body["access_token"]),
        json={"refresh_token": body["refresh_token"]},
    )
    assert response.status_code == 200

    refreshed = await client.post(
        "/api/auth/refresh", json={"refresh_token": body["refresh_token"]}
    )
    assert refreshed.status_code == 401


async def test_change_password_invalidates_access(client: httpx.AsyncClient):
    body = (await login(client)).json()
    access = body["access_token"]
    headers = auth_header(access)

    wrong = await client.put(
        "/api/auth/password",
        headers=headers,
        json={"old_password": "wrong", "new_password": "NewAdmin@123"},
    )
    assert wrong.status_code == 400

    changed = await client.put(
        "/api/auth/password",
        headers=headers,
        json={"old_password": "Admin@123", "new_password": "NewAdmin@123"},
    )
    assert changed.status_code == 200

    old_token = await client.get("/api/auth/me", headers=headers)
    assert old_token.status_code == 401

    old_login = await login(client, password="Admin@123")
    assert old_login.status_code == 401

    new_login = await login(client, password="NewAdmin@123")
    assert new_login.status_code == 200


async def test_permissions_by_role(client: httpx.AsyncClient):
    admin = (await login(client)).json()["permissions"]
    normal = (await login(client, "alice", "User@123")).json()["permissions"]

    assert len(admin) >= 30
    assert "knowledge:delete" in admin
    assert "ai:access" in normal
    assert "knowledge:delete" not in normal
    assert "menu:org" not in normal


async def test_disabled_user_cannot_login(client: httpx.AsyncClient):
    async with SessionLocal() as db:
        user = await db.scalar(select(User).where(User.username == "alice"))
        assert user is not None
        user.status = "disabled"
        await db.commit()

    response = await login(client, "alice", "User@123")
    assert response.status_code == 403
