from __future__ import annotations

import json
from collections import Counter
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_permission
from app.core.models import KnowledgeUnit, QaAccessLog, User
from app.settlement.service import similarity


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)

router = APIRouter(prefix="/api/dashboard", tags=["数据看板"])


def parse_ids(raw: str) -> list[int]:
    try:
        return [int(item) for item in json.loads(raw or "[]")]
    except (ValueError, TypeError):
        return []


def growth(current: float, previous: float) -> float:
    if not previous:
        return 100.0 if current else 0.0
    return round((current - previous) / previous * 100, 1)


@router.get("/metrics")
async def metrics(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("dashboard:read")),
) -> dict:
    total_visits = await db.scalar(select(func.count(QaAccessLog.id))) or 0
    uv = await db.scalar(select(func.count(func.distinct(QaAccessLog.user_id)))) or 0
    unit_count = (
        await db.scalar(
            select(func.count(KnowledgeUnit.id)).where(KnowledgeUnit.status == "active")
        )
        or 0
    )
    total_tokens = await db.scalar(select(func.sum(QaAccessLog.total_tokens))) or 0
    avg_ms = await db.scalar(select(func.avg(QaAccessLog.response_time_ms))) or 0

    now = utc_now()
    today_start = datetime(now.year, now.month, now.day)
    week_start = today_start - timedelta(days=6)
    prev_week_start = week_start - timedelta(days=7)

    today_visits = (
        await db.scalar(
            select(func.count(QaAccessLog.id)).where(QaAccessLog.created_at >= today_start)
        )
        or 0
    )
    today_uv = (
        await db.scalar(
            select(func.count(func.distinct(QaAccessLog.user_id))).where(
                QaAccessLog.created_at >= today_start
            )
        )
        or 0
    )
    week_tokens = (
        await db.scalar(
            select(func.sum(QaAccessLog.total_tokens)).where(QaAccessLog.created_at >= week_start)
        )
        or 0
    )
    prev_week_tokens = (
        await db.scalar(
            select(func.sum(QaAccessLog.total_tokens)).where(
                QaAccessLog.created_at >= prev_week_start,
                QaAccessLog.created_at < week_start,
            )
        )
        or 0
    )
    week_visits = (
        await db.scalar(
            select(func.count(QaAccessLog.id)).where(QaAccessLog.created_at >= week_start)
        )
        or 0
    )
    prev_week_visits = (
        await db.scalar(
            select(func.count(QaAccessLog.id)).where(
                QaAccessLog.created_at >= prev_week_start,
                QaAccessLog.created_at < week_start,
            )
        )
        or 0
    )

    return {
        "visits": total_visits,
        "uv": uv,
        "unit_count": unit_count,
        "total_tokens": int(total_tokens),
        "avg_response_ms": round(float(avg_ms), 1),
        "today_visits": today_visits,
        "today_uv": today_uv,
        "week_tokens": int(week_tokens),
        "visits_growth": growth(week_visits, prev_week_visits),
        "tokens_growth": growth(week_tokens, prev_week_tokens),
    }


@router.get("/rankings/questions")
async def question_ranking(
    limit: int = Query(5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("dashboard:read")),
) -> dict:
    logs = (
        await db.scalars(select(QaAccessLog).order_by(QaAccessLog.id.desc()).limit(800))
    ).all()
    clusters: list[dict] = []
    for log in logs:
        question = (log.question or "").strip()
        if not question:
            continue
        matched = next(
            (cluster for cluster in clusters if similarity(cluster["question"], question) >= 0.62),
            None,
        )
        if matched:
            matched["count"] += 1
            matched["last_asked_at"] = max(matched["last_asked_at"], log.created_at)
            if len(question) < len(matched["question"]):
                matched["question"] = question
        else:
            clusters.append(
                {"question": question, "count": 1, "last_asked_at": log.created_at}
            )
    clusters.sort(key=lambda item: (item["count"], item["last_asked_at"]), reverse=True)
    return {
        "items": [
            {
                "question": item["question"],
                "count": item["count"],
                "last_asked_at": item["last_asked_at"].isoformat()
                if item["last_asked_at"]
                else None,
            }
            for item in clusters[:limit]
        ]
    }


@router.get("/rankings/units")
async def unit_ranking(
    limit: int = Query(5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("dashboard:read")),
) -> dict:
    rows = await db.scalars(select(QaAccessLog.authorized_unit_ids_json))
    counter: Counter[int] = Counter()
    for raw in rows.all():
        counter.update(set(parse_ids(raw)))
    top = counter.most_common(limit)
    units: dict[int, KnowledgeUnit] = {}
    if top:
        unit_rows = await db.scalars(
            select(KnowledgeUnit).where(KnowledgeUnit.id.in_([unit_id for unit_id, _ in top]))
        )
        units = {unit.id: unit for unit in unit_rows.all()}
    items = []
    for unit_id, count in top:
        unit = units.get(unit_id)
        if not unit:
            continue
        items.append(
            {
                "unit_id": unit.id,
                "unit_code": unit.unit_code,
                "title": unit.title,
                "category": unit.category,
                "count": count,
            }
        )
    return {"items": items}


@router.get("/stats/tokens")
async def token_stats(
    days: int = Query(14, ge=7, le=90),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("dashboard:read")),
) -> dict:
    now = utc_now()
    start = datetime(now.year, now.month, now.day) - timedelta(days=days - 1)
    logs = (await db.scalars(select(QaAccessLog).where(QaAccessLog.created_at >= start))).all()
    buckets: dict[str, dict] = {}
    for offset in range(days):
        day = (start + timedelta(days=offset)).strftime("%Y-%m-%d")
        buckets[day] = {"date": day, "visits": 0, "tokens": 0, "response_total": 0, "users": set()}
    for log in logs:
        day = log.created_at.strftime("%Y-%m-%d")
        bucket = buckets.get(day)
        if not bucket:
            continue
        bucket["visits"] += 1
        bucket["tokens"] += log.total_tokens
        bucket["response_total"] += log.response_time_ms
        bucket["users"].add(log.user_id)
    items = [
        {
            "date": bucket["date"],
            "visits": bucket["visits"],
            "uv": len(bucket["users"]),
            "tokens": bucket["tokens"],
            "avg_response_ms": round(bucket["response_total"] / bucket["visits"], 1)
            if bucket["visits"]
            else 0,
        }
        for bucket in sorted(buckets.values(), key=lambda item: item["date"])
    ]
    ranges = [(0, 500), (500, 1000), (1000, 2000), (2000, 5000), (5000, None)]
    labels = ["< 0.5s", "0.5–1s", "1–2s", "2–5s", "> 5s"]
    distribution = []
    for (low, high), label in zip(ranges, labels):
        count = 0
        for log in logs:
            if high is None:
                if log.response_time_ms >= low:
                    count += 1
            elif low <= log.response_time_ms < high:
                count += 1
        distribution.append({"label": label, "count": count})
    return {"items": items, "response_distribution": distribution}
