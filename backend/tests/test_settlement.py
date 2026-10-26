from __future__ import annotations

import httpx

from tests.conftest import login
from tests.test_ai import answer_of, auth, chat, event_of, token_for


async def test_faq_mining_review_and_cache(client: httpx.AsyncClient):
    alice = await token_for(client, "alice", "User@123")
    for _ in range(3):
        events = await chat(client, alice, "报销流程是什么？")
        assert event_of(events, "meta")["faq_hit"] is False

    km = await token_for(client, "km", "Km@12345")
    recommendations = await client.get(
        "/api/settlement/faqs/recommendations", headers=auth(km)
    )
    assert recommendations.status_code == 200
    items = recommendations.json()["items"]
    target = next((item for item in items if "报销流程" in item["question"]), None)
    assert target is not None
    assert target["recommend_count"] >= 3
    assert target["source_type"] == "auto_mined"

    reviewed = await client.post(
        f"/api/settlement/faqs/{target['id']}/review",
        headers=auth(km),
        json={"action": "approve", "edited_answer": "编辑后的标准答案：报销需在 30 天内提交。"},
    )
    assert reviewed.status_code == 200
    assert reviewed.json()["status"] == "published"
    assert reviewed.json()["cache_status"] == "synced"

    cached = await chat(client, alice, "报销流程是什么？")
    meta = event_of(cached, "meta")
    done = event_of(cached, "done")
    assert meta["faq_hit"] is True
    assert done["faq_hit"] is True
    assert done["total_tokens"] == 0
    assert "编辑后的标准答案" in answer_of(cached)

    offline = await client.post(
        f"/api/settlement/faqs/{target['id']}/offline", headers=auth(km)
    )
    assert offline.status_code == 200

    normal = await chat(client, alice, "报销流程是什么？")
    assert event_of(normal, "meta")["faq_hit"] is False


async def test_faq_acl_blocks_unauthorized_cache(client: httpx.AsyncClient):
    km = await token_for(client, "km", "Km@12345")
    units = await client.get(
        "/api/knowledge/units", headers=auth(km), params={"keyword": "高管薪酬", "page_size": 10}
    )
    secret = units.json()["items"][0]

    created = await client.post(
        "/api/settlement/faqs",
        headers=auth(km),
        json={
            "question": "高管薪酬结构是什么？",
            "answer": "基本年薪、绩效年薪与长期激励三部分。",
            "category": "人力资源",
            "related_unit_id": secret["id"],
        },
    )
    assert created.status_code == 201
    assert created.json()["status"] == "published"

    bob = await token_for(client, "bob", "User@123")
    events = await chat(client, bob, "高管薪酬结构是什么？")
    meta = event_of(events, "meta")
    answer = answer_of(events)
    assert meta["faq_hit"] is False
    assert "基本年薪" not in answer
    assert meta["unauthorized_count"] >= 1


async def test_gap_flow_create_unit_and_ignore(client: httpx.AsyncClient):
    alice = await token_for(client, "alice", "User@123")
    km = await token_for(client, "km", "Km@12345")

    await chat(client, alice, "火星出差补贴怎么申请？")
    await chat(client, alice, "量子计算机采购流程是什么？")

    gaps = await client.get(
        "/api/settlement/knowledge-gaps", headers=auth(km), params={"status": "all"}
    )
    assert gaps.status_code == 200
    items = gaps.json()["items"]
    assert len(items) >= 2

    target = next(item for item in items if "火星出差" in item["question_pattern"])
    created = await client.post(
        f"/api/settlement/knowledge-gaps/{target['id']}/create-unit",
        headers=auth(km),
        json={"category": "行政管理", "content": "# 火星出差补贴\n\n补充说明。"},
    )
    assert created.status_code == 201
    assert created.json()["unit_code"].startswith("KU-")

    after = await client.get(
        "/api/settlement/knowledge-gaps", headers=auth(km), params={"status": "all"}
    )
    resolved = next(item for item in after.json()["items"] if item["id"] == target["id"])
    assert resolved["status"] == "resolved"
    assert resolved["resolved_unit_title"]

    other = next(
        item
        for item in after.json()["items"]
        if item["id"] != target["id"] and item["status"] == "unresolved"
    )
    ignored = await client.post(
        f"/api/settlement/knowledge-gaps/{other['id']}/ignore", headers=auth(km)
    )
    assert ignored.status_code == 200


async def test_dashboard_metrics_rankings_and_stats(client: httpx.AsyncClient):
    alice = await token_for(client, "alice", "User@123")
    await chat(client, alice, "报销流程是什么？")

    km = await token_for(client, "km", "Km@12345")
    metrics = await client.get("/api/dashboard/metrics", headers=auth(km))
    assert metrics.status_code == 200
    body = metrics.json()
    assert body["visits"] >= 1
    assert body["uv"] >= 1
    assert body["unit_count"] >= 5
    assert body["total_tokens"] > 0

    questions = await client.get(
        "/api/dashboard/rankings/questions", headers=auth(km), params={"limit": 5}
    )
    assert any("报销" in item["question"] for item in questions.json()["items"])

    units = await client.get(
        "/api/dashboard/rankings/units", headers=auth(km), params={"limit": 5}
    )
    assert any("报销" in item["title"] for item in units.json()["items"])

    stats = await client.get(
        "/api/dashboard/stats/tokens", headers=auth(km), params={"days": 14}
    )
    assert len(stats.json()["items"]) == 14
    assert len(stats.json()["response_distribution"]) == 5

    forbidden = await client.get("/api/dashboard/metrics", headers=auth(alice))
    assert forbidden.status_code == 403
