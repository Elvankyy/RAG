from __future__ import annotations

import json

import httpx

from tests.conftest import login


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def token_for(client: httpx.AsyncClient, username: str, password: str) -> str:
    response = await login(client, username, password)
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


async def chat(
    client: httpx.AsyncClient, token: str, question: str, session_id: str | None = None
) -> list[tuple[str, dict]]:
    events: list[tuple[str, dict]] = []
    async with client.stream(
        "POST",
        "/api/ai/chat/stream",
        headers=auth(token),
        json={"question": question, "session_id": session_id},
    ) as response:
        assert response.status_code == 200, await response.aread()
        event_name = "message"
        async for line in response.aiter_lines():
            if line.startswith("event:"):
                event_name = line[6:].strip()
            elif line.startswith("data:"):
                events.append((event_name, json.loads(line[5:].strip())))
    return events


def answer_of(events: list[tuple[str, dict]]) -> str:
    return "".join(data.get("content", "") for name, data in events if name == "delta")


def event_of(events: list[tuple[str, dict]], name: str) -> dict:
    return next(data for event, data in events if event == name)


async def test_chat_stream_with_citations(client: httpx.AsyncClient):
    token = await token_for(client, "alice", "User@123")
    events = await chat(client, token, "报销流程是什么？")

    names = [name for name, _ in events]
    assert names[0] == "meta"
    assert names[-1] == "done"
    assert names.count("usage") == 1
    answer = answer_of(events)
    assert "30 天" in answer
    assert "费用报销管理规范" in answer

    meta = event_of(events, "meta")
    assert meta["unauthorized_count"] == 0
    assert any(item["title"] == "费用报销管理规范" for item in meta["citations"])

    done = event_of(events, "done")
    assert done["total_tokens"] > 0
    assert done["response_time_ms"] >= 0
    session_id = done["session_id"]

    sessions = await client.get("/api/ai/sessions", headers=auth(token))
    assert any(item["id"] == session_id for item in sessions.json()["items"])

    messages = await client.get(
        f"/api/ai/sessions/{session_id}/messages", headers=auth(token)
    )
    assert messages.status_code == 200
    assert len(messages.json()["items"]) == 2
    assert messages.json()["items"][1]["role"] == "assistant"


async def test_unauthorized_content_not_leaked(client: httpx.AsyncClient):
    token = await token_for(client, "bob", "User@123")
    events = await chat(client, token, "研发代码规范与发布流程是什么？")
    meta = event_of(events, "meta")
    answer = answer_of(events)

    assert meta["unauthorized_count"] >= 1
    assert "权限" in answer
    assert "hotfix" not in answer
    assert "回滚上一稳定版本" not in answer
    assert all(item["title"] != "研发代码规范与发布流程" for item in meta["citations"])


async def test_gap_when_no_retrieval(client: httpx.AsyncClient):
    token = await token_for(client, "alice", "User@123")
    events = await chat(client, token, "火星出差补贴怎么申请？")
    answer = answer_of(events)
    assert "暂未检索到" in answer
    done = event_of(events, "done")
    assert done["unauthorized_count"] == 0
    assert done["citations"] == []


async def test_session_delete(client: httpx.AsyncClient):
    token = await token_for(client, "alice", "User@123")
    events = await chat(client, token, "年假有多少天？")
    session_id = event_of(events, "done")["session_id"]

    deleted = await client.delete(f"/api/ai/sessions/{session_id}", headers=auth(token))
    assert deleted.status_code == 200

    sessions = await client.get("/api/ai/sessions", headers=auth(token))
    assert all(item["id"] != session_id for item in sessions.json()["items"])


async def test_chat_requires_ai_permission(client: httpx.AsyncClient):
    admin = await token_for(client, "admin", "Admin@123")
    created = await client.post(
        "/api/org/users",
        headers=auth(admin),
        json={
            "username": "noai",
            "password": "Noai@123",
            "display_name": "无权用户",
            "department_id": 1,
            "role_ids": [],
            "status": "active",
        },
    )
    assert created.status_code == 201
    token = await token_for(client, "noai", "Noai@123")
    response = await client.post(
        "/api/ai/chat/stream",
        headers=auth(token),
        json={"question": "报销流程是什么？"},
    )
    assert response.status_code == 403
