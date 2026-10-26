from __future__ import annotations

import httpx

from tests.conftest import login


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def token_for(client: httpx.AsyncClient, username: str, password: str) -> str:
    response = await login(client, username, password)
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


async def test_admin_read_endpoints(client: httpx.AsyncClient):
    token = await token_for(client, "admin", "Admin@123")
    departments = await client.get("/api/org/departments", headers=auth(token))
    users = await client.get("/api/org/users", headers=auth(token))
    roles = await client.get("/api/org/roles", headers=auth(token))
    permissions = await client.get("/api/org/permissions", headers=auth(token))

    assert departments.status_code == 200
    assert len(departments.json()["items"]) == 7
    assert departments.json()["tree"][0]["name"] == "云启科技"
    assert users.status_code == 200
    assert users.json()["total"] == 7
    assert roles.status_code == 200
    assert len(roles.json()["items"]) == 6
    assert permissions.status_code == 200
    assert len(permissions.json()["items"]) == 31


async def test_rbac_read_write_split(client: httpx.AsyncClient):
    km_token = await token_for(client, "km", "Km@12345")
    alice_token = await token_for(client, "alice", "User@123")

    km_read = await client.get("/api/org/users", headers=auth(km_token))
    assert km_read.status_code == 200

    km_create = await client.post(
        "/api/org/users",
        headers=auth(km_token),
        json={
            "username": "blocked",
            "password": "Blocked@123",
            "display_name": "越权用户",
            "department_id": 2,
            "role_ids": [3],
            "status": "active",
        },
    )
    assert km_create.status_code == 403

    alice_read = await client.get("/api/org/users", headers=auth(alice_token))
    assert alice_read.status_code == 403


async def test_department_crud_and_guards(client: httpx.AsyncClient):
    token = await token_for(client, "admin", "Admin@123")
    headers = auth(token)

    created = await client.post(
        "/api/org/departments",
        headers=headers,
        json={"name": "测试部门", "parent_id": 1, "sort_order": 9},
    )
    assert created.status_code == 201
    department_id = created.json()["id"]

    updated = await client.put(
        f"/api/org/departments/{department_id}", headers=headers, json={"name": "测试部门改名"}
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "测试部门改名"

    child = await client.post(
        "/api/org/departments",
        headers=headers,
        json={"name": "测试子部门", "parent_id": department_id},
    )
    assert child.status_code == 201
    child_id = child.json()["id"]

    blocked_parent = await client.delete(f"/api/org/departments/{department_id}", headers=headers)
    assert blocked_parent.status_code == 400

    assert (await client.delete(f"/api/org/departments/{child_id}", headers=headers)).status_code == 200
    assert (await client.delete(f"/api/org/departments/{department_id}", headers=headers)).status_code == 200

    blocked_member = await client.delete("/api/org/departments/2", headers=headers)
    assert blocked_member.status_code == 400


async def test_user_crud_reset_and_status(client: httpx.AsyncClient):
    token = await token_for(client, "admin", "Admin@123")
    headers = auth(token)

    created = await client.post(
        "/api/org/users",
        headers=headers,
        json={
            "username": "testuser",
            "password": "Test@123",
            "display_name": "测试用户",
            "department_id": 2,
            "role_ids": [3],
            "status": "active",
        },
    )
    assert created.status_code == 201
    user_id = created.json()["id"]
    assert created.json()["role_names"] == ["普通用户"]

    duplicate = await client.post(
        "/api/org/users",
        headers=headers,
        json={
            "username": "testuser",
            "password": "Test@123",
            "display_name": "重复用户",
            "department_id": 2,
            "role_ids": [3],
        },
    )
    assert duplicate.status_code == 400

    filtered = await client.get(
        "/api/org/users", headers=headers, params={"keyword": "testuser"}
    )
    assert filtered.json()["total"] == 1

    updated = await client.put(
        f"/api/org/users/{user_id}",
        headers=headers,
        json={"display_name": "测试用户改", "role_ids": [3, 4], "department_id": 4},
    )
    assert updated.status_code == 200
    assert updated.json()["department_name"] == "产品部"
    assert len(updated.json()["role_ids"]) == 2

    reset = await client.post(
        f"/api/org/users/{user_id}/reset-password",
        headers=headers,
        json={"new_password": "Reset@123"},
    )
    assert reset.status_code == 200
    assert (await login(client, "testuser", "Reset@123")).status_code == 200
    assert (await login(client, "testuser", "Test@123")).status_code == 401

    disabled = await client.post(
        f"/api/org/users/{user_id}/status", headers=headers, json={"status": "disabled"}
    )
    assert disabled.status_code == 200
    assert (await login(client, "testuser", "Reset@123")).status_code == 403

    enabled = await client.post(
        f"/api/org/users/{user_id}/status", headers=headers, json={"status": "active"}
    )
    assert enabled.status_code == 200
    assert (await login(client, "testuser", "Reset@123")).status_code == 200

    deleted = await client.delete(f"/api/org/users/{user_id}", headers=headers)
    assert deleted.status_code == 200
    assert (await login(client, "testuser", "Reset@123")).status_code == 401


async def test_role_crud_and_permissions(client: httpx.AsyncClient):
    token = await token_for(client, "admin", "Admin@123")
    headers = auth(token)

    created = await client.post(
        "/api/org/roles",
        headers=headers,
        json={
            "role_name": "审计员",
            "role_code": "auditor",
            "description": "只读审计角色",
            "permission_codes": ["menu:chat", "ai:access", "knowledge:read"],
        },
    )
    assert created.status_code == 201
    role_id = created.json()["id"]
    assert sorted(created.json()["permission_codes"]) == sorted(
        ["menu:chat", "ai:access", "knowledge:read"]
    )

    updated = await client.put(
        f"/api/org/roles/{role_id}", headers=headers, json={"role_name": "审计员V2"}
    )
    assert updated.status_code == 200
    assert updated.json()["role_name"] == "审计员V2"

    assigned = await client.post(
        f"/api/org/roles/{role_id}/permissions",
        headers=headers,
        json={"permission_codes": ["menu:chat", "ai:access", "settlement:read"]},
    )
    assert assigned.status_code == 200
    assert "settlement:read" in assigned.json()["permission_codes"]
    assert "knowledge:read" not in assigned.json()["permission_codes"]

    builtin = await client.delete("/api/org/roles/1", headers=headers)
    assert builtin.status_code == 400

    assigned_role = await client.delete("/api/org/roles/3", headers=headers)
    assert assigned_role.status_code == 400

    deleted = await client.delete(f"/api/org/roles/{role_id}", headers=headers)
    assert deleted.status_code == 200
