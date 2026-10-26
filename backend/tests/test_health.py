from __future__ import annotations

import httpx


async def test_health(client: httpx.AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "knowledge-platform-backend"


async def test_ready(client: httpx.AsyncClient):
    response = await client.get("/ready")
    assert response.status_code == 200
    assert response.json()["database"] == "ok"


async def test_root(client: httpx.AsyncClient):
    response = await client.get("/")
    assert response.status_code == 200
    assert response.json()["docs"] == "/docs"
