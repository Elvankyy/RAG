from __future__ import annotations

import httpx

from tests.conftest import login


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def token_for(client: httpx.AsyncClient, username: str, password: str) -> str:
    response = await login(client, username, password)
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


async def create_unit(client, headers, title, permissions):
    response = await client.post(
        "/api/knowledge/units",
        headers=headers,
        json={
            "title": title,
            "content": f"# {title}\n\n这是 {title} 的内容，用于权限测试。",
            "permissions": permissions,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


async def setup_units(client):
    km = await token_for(client, "km", "Km@12345")
    headers = auth(km)
    units = {
        "global": await create_unit(client, headers, "全局单元", [{"target_type": "global"}]),
        "dept": await create_unit(
            client, headers, "技术部单元", [{"target_type": "department", "target_id": 2}]
        ),
        "root_dept": await create_unit(
            client, headers, "根部门单元", [{"target_type": "department", "target_id": 1}]
        ),
        "role": await create_unit(
            client, headers, "普通用户角色单元", [{"target_type": "role", "target_id": 3}]
        ),
        "user": await create_unit(
            client, headers, "赵子涵个人单元", [{"target_type": "user", "target_id": 5}]
        ),
        "none": await create_unit(client, headers, "无权限单元", []),
    }
    return headers, units


async def test_check_permissions_or_logic_and_ancestors(client: httpx.AsyncClient):
    headers, units = await setup_units(client)
    unit_ids = [unit["id"] for unit in units.values()]

    alice = await client.post(
        "/api/knowledge/check-permissions",
        headers=headers,
        json={"user_id": 3, "unit_ids": unit_ids},
    )
    assert alice.status_code == 200, alice.text
    authorized = set(alice.json()["authorized_unit_ids"])
    unauthorized = set(alice.json()["unauthorized_unit_ids"])
    assert units["global"]["id"] in authorized
    assert units["dept"]["id"] in authorized
    assert units["root_dept"]["id"] in authorized
    assert units["role"]["id"] in authorized
    assert units["user"]["id"] in unauthorized
    assert units["none"]["id"] in unauthorized

    carol = await client.post(
        "/api/knowledge/check-permissions",
        headers=headers,
        json={"user_id": 5, "unit_ids": unit_ids},
    )
    carol_authorized = set(carol.json()["authorized_unit_ids"])
    assert units["global"]["id"] in carol_authorized
    assert units["role"]["id"] in carol_authorized
    assert units["user"]["id"] in carol_authorized
    assert units["dept"]["id"] not in carol_authorized
    assert units["none"]["id"] not in carol_authorized


async def test_self_check_does_not_require_user_read(client: httpx.AsyncClient):
    headers, units = await setup_units(client)
    alice_token = await token_for(client, "alice", "User@123")
    response = await client.post(
        "/api/knowledge/check-permissions",
        headers=auth(alice_token),
        json={"unit_ids": [units["global"]["id"], units["none"]["id"]]},
    )
    assert response.status_code == 200
    assert response.json()["authorized_unit_ids"] == [units["global"]["id"]]
    assert response.json()["unauthorized_unit_ids"] == [units["none"]["id"]]


async def test_knowledge_list_and_detail_filtered_by_acl(client: httpx.AsyncClient):
    headers, units = await setup_units(client)
    admin_token = await token_for(client, "admin", "Admin@123")
    admin_headers = auth(admin_token)

    created_role = await client.post(
        "/api/org/roles",
        headers=admin_headers,
        json={
            "role_name": "读者",
            "role_code": "reader",
            "permission_codes": ["menu:knowledge", "knowledge:read", "ai:access"],
        },
    )
    role_id = created_role.json()["id"]
    created_user = await client.post(
        "/api/org/users",
        headers=admin_headers,
        json={
            "username": "reader",
            "password": "Reader@123",
            "display_name": "只读用户",
            "department_id": 2,
            "role_ids": [role_id],
            "status": "active",
        },
    )
    assert created_user.status_code == 201

    reader_token = await token_for(client, "reader", "Reader@123")
    listed = await client.get(
        "/api/knowledge/units", headers=auth(reader_token), params={"page_size": 50}
    )
    assert listed.status_code == 200
    visible_ids = {item["id"] for item in listed.json()["items"]}
    assert units["global"]["id"] in visible_ids
    assert units["dept"]["id"] in visible_ids
    assert units["root_dept"]["id"] in visible_ids
    assert units["role"]["id"] not in visible_ids
    assert units["user"]["id"] not in visible_ids
    assert units["none"]["id"] not in visible_ids
    assert listed.json()["total"] == len(visible_ids)

    forbidden = await client.get(
        f"/api/knowledge/units/{units['none']['id']}", headers=auth(reader_token)
    )
    assert forbidden.status_code == 403

    admin_list = await client.get("/api/knowledge/units", headers=headers, params={"page_size": 50})
    assert admin_list.json()["total"] >= len(units)
