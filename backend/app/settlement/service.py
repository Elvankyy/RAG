from __future__ import annotations

import json
import re
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Faq, KnowledgeGap, KnowledgeUnit, QaAccessLog, User
from app.knowledge.service import create_unit
from app.knowledge.text import tokenize
from app.permissions.engine import check_access


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def normalized(text: str) -> str:
    return re.sub(r"[\s，。！？、；：,.!?;:~`\"'“”‘’（）()【】\[\]]+", "", text or "").lower()


def similarity(left: str, right: str) -> float:
    left_tokens = set(tokenize(left))
    right_tokens = set(tokenize(right))
    if not left_tokens or not right_tokens:
        return 0.0
    return len(left_tokens & right_tokens) / len(left_tokens | right_tokens)


async def get_summary(db: AsyncSession) -> dict:
    pending = (
        await db.scalar(select(func.count(Faq.id)).where(Faq.status == "pending_review")) or 0
    )
    published = await db.scalar(select(func.count(Faq.id)).where(Faq.status == "published")) or 0
    unresolved = (
        await db.scalar(
            select(func.count(KnowledgeGap.id)).where(KnowledgeGap.status == "unresolved")
        )
        or 0
    )
    hits = await db.scalar(select(func.sum(Faq.hit_count))) or 0
    return {
        "pending_faqs": pending,
        "published_faqs": published,
        "unresolved_gaps": unresolved,
        "faq_hits": int(hits),
    }


async def find_faq(db: AsyncSession, user: User, question: str) -> Faq | None:
    faqs = (await db.scalars(select(Faq).where(Faq.status == "published"))).all()
    target = normalized(question)
    best: tuple[float, Faq] | None = None
    for faq in faqs:
        score = 1.0 if normalized(faq.question) == target else similarity(faq.question, question)
        if score < 0.9:
            continue
        if faq.related_unit_id:
            authorized, _ = await check_access(db, user, [faq.related_unit_id])
            if not authorized:
                continue
        if best is None or score > best[0]:
            best = (score, faq)
    return best[1] if best else None


async def serialize_faqs(db: AsyncSession, faqs: list[Faq]) -> list[dict]:
    unit_ids = {faq.related_unit_id for faq in faqs if faq.related_unit_id}
    units: dict[int, KnowledgeUnit] = {}
    if unit_ids:
        rows = await db.scalars(select(KnowledgeUnit).where(KnowledgeUnit.id.in_(unit_ids)))
        units = {unit.id: unit for unit in rows.all()}
    return [
        {
            "id": faq.id,
            "question": faq.question,
            "answer": faq.answer,
            "category": faq.category,
            "related_unit_id": faq.related_unit_id,
            "related_unit_title": units.get(faq.related_unit_id or 0).title
            if units.get(faq.related_unit_id or 0)
            else None,
            "source_type": faq.source_type,
            "status": faq.status,
            "hit_count": faq.hit_count,
            "recommend_count": faq.recommend_count,
            "cache_status": faq.cache_status,
            "reviewed_at": faq.reviewed_at.isoformat() if faq.reviewed_at else None,
            "created_at": faq.created_at.isoformat() if faq.created_at else None,
        }
        for faq in faqs
    ]


def clean_answer(answer: str) -> str:
    text = re.sub(r"另有 \d+ 个相关知识单元因权限限制未展示.*$", "", answer or "")
    return text.strip()[:600]


async def mine_faqs(db: AsyncSession) -> int:
    logs = (
        await db.scalars(
            select(QaAccessLog)
            .where(
                QaAccessLog.result_type == "answered",
                QaAccessLog.hit_faq_id.is_(None),
            )
            .order_by(QaAccessLog.id.desc())
            .limit(1000)
        )
    ).all()
    if not logs:
        return 0

    clusters: list[dict] = []
    for log in logs:
        question = (log.question or "").strip()
        if len(question) < 4:
            continue
        matched = next(
            (cluster for cluster in clusters if similarity(cluster["question"], question) >= 0.65),
            None,
        )
        if matched:
            matched["count"] += 1
            matched["logs"].append(log)
        else:
            clusters.append({"question": question, "count": 1, "logs": [log]})

    existing = (await db.scalars(select(Faq))).all()
    existing_questions = [faq.question for faq in existing]
    created = 0
    for cluster in clusters:
        if cluster["count"] < 3:
            continue
        question = cluster["question"]
        if any(similarity(question, item) >= 0.8 for item in existing_questions):
            continue
        latest = cluster["logs"][0]
        try:
            authorized = json.loads(latest.authorized_unit_ids_json or "[]")
        except json.JSONDecodeError:
            authorized = []
        unit = await db.get(KnowledgeUnit, authorized[0]) if authorized else None
        db.add(
            Faq(
                question=question[:500],
                answer=clean_answer(latest.answer) or "待管理员补充标准答案。",
                category=unit.category if unit else "通用",
                related_unit_id=unit.id if unit else None,
                source_type="auto_mined",
                status="pending_review",
                recommend_count=cluster["count"],
                cache_status="pending",
            )
        )
        existing_questions.append(question)
        created += 1
    if created:
        await db.commit()
    return created


async def list_recommendations(db: AsyncSession) -> dict:
    created = await mine_faqs(db)
    faqs = (
        await db.scalars(
            select(Faq)
            .where(Faq.status == "pending_review")
            .order_by(Faq.recommend_count.desc(), Faq.id.desc())
        )
    ).all()
    return {
        "items": await serialize_faqs(db, list(faqs)),
        "newly_mined": created,
        "total": len(faqs),
    }


async def list_faqs(db: AsyncSession, status_filter: str | None) -> list[Faq]:
    stmt = select(Faq).order_by(Faq.id.desc())
    if status_filter and status_filter != "all":
        stmt = stmt.where(Faq.status == status_filter)
    return list((await db.scalars(stmt)).all())


async def review_faq(
    db: AsyncSession, faq: Faq, action: str, edited_answer: str | None, reviewer: User
) -> Faq:
    if edited_answer and edited_answer.strip():
        faq.answer = edited_answer.strip()
    faq.status = "published" if action == "approve" else "rejected"
    faq.cache_status = "synced" if action == "approve" else "pending"
    faq.reviewer_id = reviewer.id
    faq.reviewed_at = utc_now()
    await db.commit()
    return faq


async def offline_faq(db: AsyncSession, faq: Faq) -> None:
    faq.status = "offline"
    faq.cache_status = "pending"
    await db.commit()


async def create_manual_faq(
    db: AsyncSession,
    *,
    question: str,
    answer: str,
    category: str,
    related_unit_id: int | None,
    reviewer: User,
) -> Faq:
    faq = Faq(
        question=question,
        answer=answer,
        category=category,
        related_unit_id=related_unit_id,
        source_type="manual",
        status="published",
        cache_status="synced",
        reviewer_id=reviewer.id,
        reviewed_at=utc_now(),
    )
    db.add(faq)
    await db.commit()
    await db.refresh(faq)
    return faq


async def serialize_gaps(db: AsyncSession, gaps: list[KnowledgeGap]) -> list[dict]:
    unit_ids = {gap.resolved_unit_id for gap in gaps if gap.resolved_unit_id}
    units: dict[int, KnowledgeUnit] = {}
    if unit_ids:
        rows = await db.scalars(select(KnowledgeUnit).where(KnowledgeUnit.id.in_(unit_ids)))
        units = {unit.id: unit for unit in rows.all()}
    return [
        {
            "id": gap.id,
            "question_pattern": gap.question_pattern,
            "sample_questions": json.loads(gap.sample_questions_json or "[]"),
            "ask_count": gap.ask_count,
            "last_asked_at": gap.last_asked_at.isoformat() if gap.last_asked_at else None,
            "status": gap.status,
            "resolved_unit_id": gap.resolved_unit_id,
            "resolved_unit_title": units.get(gap.resolved_unit_id or 0).title
            if units.get(gap.resolved_unit_id or 0)
            else None,
            "created_at": gap.created_at.isoformat() if gap.created_at else None,
        }
        for gap in gaps
    ]


async def list_gaps(db: AsyncSession, status_filter: str | None) -> list[KnowledgeGap]:
    stmt = select(KnowledgeGap).order_by(
        KnowledgeGap.ask_count.desc(), KnowledgeGap.id.desc()
    )
    if status_filter and status_filter != "all":
        stmt = stmt.where(KnowledgeGap.status == status_filter)
    return list((await db.scalars(stmt)).all())


async def record_gap(db: AsyncSession, question: str) -> None:
    rows = (
        await db.scalars(
            select(KnowledgeGap).where(KnowledgeGap.status == "unresolved")
        )
    ).all()
    for gap in rows:
        if similarity(gap.question_pattern, question) >= 0.7:
            samples = json.loads(gap.sample_questions_json or "[]")
            if question not in samples:
                samples.append(question)
            gap.sample_questions_json = json.dumps(samples[-10:], ensure_ascii=False)
            gap.ask_count += 1
            gap.last_asked_at = utc_now()
            return
    db.add(
        KnowledgeGap(
            question_pattern=question[:500],
            sample_questions_json=json.dumps([question], ensure_ascii=False),
            ask_count=1,
            last_asked_at=utc_now(),
            status="unresolved",
        )
    )


async def resolve_gap(db, gap: KnowledgeGap, unit_id: int | None) -> None:
    gap.status = "resolved"
    gap.resolved_unit_id = unit_id
    await db.commit()


async def ignore_gap(db, gap: KnowledgeGap) -> None:
    gap.status = "ignored"
    await db.commit()


async def create_unit_from_gap(
    db, gap: KnowledgeGap, creator: User, payload
) -> KnowledgeUnit:
    title = (payload.title or gap.question_pattern).strip()[:120]
    samples = json.loads(gap.sample_questions_json or "[]")
    content = (payload.content or "").strip() or (
        f"# {title}\n\n> 该知识单元由知识缺口一键创建，请补充完整答案。\n\n典型提问：\n"
        + "\n".join(f"- {item}" for item in samples)
    )
    unit = await create_unit(
        db,
        title=title,
        content=content,
        creator_id=creator.id,
        category=payload.category or "未分类",
        file_type="manual",
    )
    gap.status = "resolved"
    gap.resolved_unit_id = unit.id
    await db.commit()
    return unit
