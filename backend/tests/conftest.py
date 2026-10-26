from __future__ import annotations

import os
import tempfile
import uuid
from pathlib import Path

import httpx
import pytest

TEST_DB = Path(tempfile.gettempdir()) / f"kb_test_{uuid.uuid4().hex}.db"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{TEST_DB.as_posix()}"
os.environ["AUTO_SEED"] = "true"
os.environ["JWT_SECRET"] = "test-secret-key-0123456789-abcdefghijklmnop"
os.environ["ACCESS_TOKEN_MINUTES"] = "120"
os.environ["REFRESH_TOKEN_DAYS"] = "7"

from app.core.database import reset_db  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture
async def client():
    await reset_db()
    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as test_client:
            yield test_client


async def login(
    client: httpx.AsyncClient,
    username: str = "admin",
    password: str = "Admin@123",
) -> httpx.Response:
    return await client.post(
        "/api/auth/login",
        json={"username": username, "password": password},
    )
