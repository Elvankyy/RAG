from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.service import chat_events
from app.core.database import get_db
from app.core.deps import get_current_user, require_permission
from app.core.models import ChatMessage, ChatSession, QaAccessLog, User

router = APIRouter(prefix="/api/ai", tags=["AI 问答"])


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    session_id: str | None = None


def serialize_message(message: ChatMessage) -> dict:
    try:
        citations = json.loads(message.citations_json or "[]")
    except json.JSONDecodeError:
        citations = []
    try:
        usage = json.loads(message.usage_json or "{}")
    except json.JSONDecodeError:
        usage = {}
    return {
        "id": message.id,
        "role": message.role,
        "content": message.content,
        "citations": citations,
        "unauthorizedCount": message.unauthorized_count,
        "usage": usage,
        "faqHit": message.faq_hit,
        "status": "done",
        "createdAt": message.created_at.isoformat() if message.created_at else None,
    }


@router.post("/chat/stream")
async def chat_stream(
    payload: ChatRequest,
    user: User = Depends(require_permission("ai:access")),
) -> StreamingResponse:
    question = payload.question.strip()
    if not question:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "问题不能为空")

    async def generator():
        async for event in chat_events(user.id, question, payload.session_id):
            yield event

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/sessions")
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    sessions = (
        await db.scalars(
            select(ChatSession)
            .where(ChatSession.user_id == user.id)
            .order_by(ChatSession.updated_at.desc())
            .limit(50)
        )
    ).all()
    return {
        "items": [
            {
                "id": session.id,
                "title": session.title,
                "last_message": session.last_message,
                "updated_at": session.updated_at.isoformat() if session.updated_at else None,
                "created_at": session.created_at.isoformat() if session.created_at else None,
            }
            for session in sessions
        ]
    }


@router.get("/sessions/{session_id}/messages")
async def list_messages(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    session = await db.get(ChatSession, session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "会话不存在")
    messages = (
        await db.scalars(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.id)
        )
    ).all()
    return {
        "session": {"id": session.id, "title": session.title},
        "items": [serialize_message(message) for message in messages],
    }


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    session = await db.get(ChatSession, session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "会话不存在")
    await db.execute(delete(ChatMessage).where(ChatMessage.session_id == session_id))
    await db.execute(delete(QaAccessLog).where(QaAccessLog.session_id == session_id))
    await db.delete(session)
    await db.commit()
    return {"message": "会话已删除"}
