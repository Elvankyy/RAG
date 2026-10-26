from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_permission
from app.core.models import Faq, KnowledgeGap, KnowledgeUnit, User
from app.settlement import service

router = APIRouter(prefix="/api/settlement", tags=["知识沉淀"])


class ReviewPayload(BaseModel):
    action: str = Field(pattern="^(approve|reject)$")
    edited_answer: str | None = None


class FaqCreatePayload(BaseModel):
    question: str = Field(min_length=4, max_length=500)
    answer: str = Field(min_length=1)
    category: str = "通用"
    related_unit_id: int | None = None


class GapResolvePayload(BaseModel):
    unit_id: int | None = None


class GapCreateUnitPayload(BaseModel):
    title: str | None = None
    category: str = ""
    content: str | None = None


@router.get("/summary")
async def summary(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("settlement:read")),
) -> dict:
    return await service.get_summary(db)


@router.get("/faqs/recommendations")
async def recommendations(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("settlement:read")),
) -> dict:
    return await service.list_recommendations(db)


@router.get("/faqs")
async def list_faqs(
    status_filter: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("settlement:read")),
) -> dict:
    faqs = await service.list_faqs(db, status_filter)
    return {"items": await service.serialize_faqs(db, faqs), "total": len(faqs)}


@router.post("/faqs", status_code=status.HTTP_201_CREATED)
async def create_faq(
    payload: FaqCreatePayload,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_permission("settlement:review")),
) -> dict:
    if payload.related_unit_id and not await db.get(KnowledgeUnit, payload.related_unit_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "关联知识单元不存在")
    faq = await service.create_manual_faq(
        db,
        question=payload.question.strip(),
        answer=payload.answer.strip(),
        category=payload.category,
        related_unit_id=payload.related_unit_id,
        reviewer=current,
    )
    return (await service.serialize_faqs(db, [faq]))[0]


@router.post("/faqs/{faq_id}/review")
async def review_faq(
    faq_id: int,
    payload: ReviewPayload,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_permission("settlement:review")),
) -> dict:
    faq = await db.get(Faq, faq_id)
    if not faq:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "FAQ 不存在")
    if faq.status == "published" and payload.action == "approve":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "该 FAQ 已发布")
    await service.review_faq(db, faq, payload.action, payload.edited_answer, current)
    return (await service.serialize_faqs(db, [faq]))[0]


@router.post("/faqs/{faq_id}/offline")
async def offline_faq(
    faq_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("settlement:review")),
) -> dict:
    faq = await db.get(Faq, faq_id)
    if not faq:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "FAQ 不存在")
    await service.offline_faq(db, faq)
    return {"message": "FAQ 已下线，缓存已失效"}


@router.delete("/faqs/{faq_id}")
async def delete_faq(
    faq_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("settlement:review")),
) -> dict:
    faq = await db.get(Faq, faq_id)
    if not faq:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "FAQ 不存在")
    await db.execute(delete(Faq).where(Faq.id == faq_id))
    await db.commit()
    return {"message": "FAQ 已删除"}


@router.get("/knowledge-gaps")
async def list_gaps(
    status_filter: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("settlement:read")),
) -> dict:
    gaps = await service.list_gaps(db, status_filter)
    return {"items": await service.serialize_gaps(db, gaps), "total": len(gaps)}


@router.post("/knowledge-gaps/{gap_id}/resolve")
async def resolve_gap(
    gap_id: int,
    payload: GapResolvePayload,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("settlement:gap-manage")),
) -> dict:
    gap = await db.get(KnowledgeGap, gap_id)
    if not gap:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "知识缺口不存在")
    if payload.unit_id and not await db.get(KnowledgeUnit, payload.unit_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "关联知识单元不存在")
    await service.resolve_gap(db, gap, payload.unit_id)
    return {"message": "知识缺口已标记为已解决"}


@router.post("/knowledge-gaps/{gap_id}/ignore")
async def ignore_gap(
    gap_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("settlement:gap-manage")),
) -> dict:
    gap = await db.get(KnowledgeGap, gap_id)
    if not gap:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "知识缺口不存在")
    await service.ignore_gap(db, gap)
    return {"message": "已忽略该知识缺口"}


@router.post("/knowledge-gaps/{gap_id}/create-unit", status_code=status.HTTP_201_CREATED)
async def create_unit_from_gap(
    gap_id: int,
    payload: GapCreateUnitPayload,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_permission("settlement:gap-manage")),
) -> dict:
    gap = await db.get(KnowledgeGap, gap_id)
    if not gap:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "知识缺口不存在")
    unit = await service.create_unit_from_gap(db, gap, current, payload)
    return {
        "unit_id": unit.id,
        "unit_code": unit.unit_code,
        "message": "已创建知识单元，请继续完善内容并配置数据权限",
    }
