from __future__ import annotations

import asyncio
import json
import re
import time
import uuid

from app.ai.llm import llm_available, stream_llm
from app.ai.retrieval import Hit, recall
from app.core.config import settings
from app.core.database import SessionLocal
from app.core.models import ChatMessage, ChatSession, KnowledgeUnit, QaAccessLog, User
from app.knowledge.text import estimate_tokens
from app.permissions.engine import check_access
from app.settlement.service import find_faq, record_gap


def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def snippet(text: str, limit: int = 120) -> str:
    clean = re.sub(r"(?m)^\s*#{1,6}\s*", "", text or "")
    clean = " ".join(clean.split())
    return clean[:limit] + ("…" if len(clean) > limit else "")


def citations_of(hits: list[Hit]) -> list[dict]:
    return [
        {
            "index": index,
            "unit_id": hit.unit_id,
            "unit_code": hit.unit_code,
            "title": hit.title,
            "category": hit.category,
            "score": hit.score,
            "snippet": snippet(hit.content),
        }
        for index, hit in enumerate(hits, start=1)
    ]


def build_local_answer(question: str, authorized: list[Hit], unauthorized: list[Hit]) -> str:
    if authorized:
        blocks = []
        for index, hit in enumerate(authorized[:3], start=1):
            blocks.append(f"**[{index}] {hit.title}**\n{snippet(hit.content, 220)}")
        answer = "根据知识库检索结果，为你整理如下：\n\n" + "\n\n".join(blocks)
        if unauthorized:
            answer += (
                f"\n\n另有 {len(unauthorized)} 个相关知识单元因权限限制未展示，"
                "请联系知识管理员申请访问。"
            )
        return answer
    if unauthorized:
        return (
            f"已从知识库召回 {len(unauthorized)} 个与「{question}」相关的知识单元，"
            "但当前账号均无数据访问权限。\n\n"
            "请确认您所属部门 / 角色是否在授权范围内，或联系知识管理员补充权限。"
        )
    return (
        f"抱歉，知识库中暂未检索到与「{question}」相关的可用内容。\n\n"
        "建议：\n- 换用更具体的关键词重新提问；\n"
        "- 确认相关文档是否已导入知识库；\n"
        "- 该问题已记录为知识缺口，管理员补充知识后可再次查询。"
    )


async def ensure_session(
    db, user_id: int, question: str, session_id: str | None
) -> ChatSession:
    if session_id:
        session = await db.get(ChatSession, session_id)
        if session and session.user_id == user_id:
            return session
    session = ChatSession(
        id=str(uuid.uuid4()),
        user_id=user_id,
        title=question[:30] or "新的对话",
        last_message=question[:255],
    )
    db.add(session)
    await db.flush()
    return session


def split_stream(text: str, size: int = 16) -> list[str]:
    return [text[index : index + size] for index in range(0, len(text), size)] or [""]


async def chat_events(user_id: int, question: str, session_id: str | None):
    started = time.perf_counter()
    async with SessionLocal() as db:
        user = await db.get(User, user_id)
        if not user or user.status != "active":
            yield sse("error", {"message": "登录状态失效，请重新登录"})
            return

        session = await ensure_session(db, user.id, question, session_id)

        faq = await find_faq(db, user, question)
        if faq:
            faq_citations = []
            if faq.related_unit_id:
                unit = await db.get(KnowledgeUnit, faq.related_unit_id)
                if unit:
                    faq_citations = [
                        {
                            "index": 1,
                            "unit_id": unit.id,
                            "unit_code": unit.unit_code,
                            "title": unit.title,
                            "category": unit.category,
                            "score": 1.0,
                            "snippet": snippet(unit.summary or unit.content),
                        }
                    ]
            yield sse(
                "meta",
                {
                    "session_id": session.id,
                    "faq_hit": True,
                    "citations": faq_citations,
                    "unauthorized_count": 0,
                    "recalled_count": 0,
                    "authorized_count": len(faq_citations),
                },
            )
            for piece in split_stream(faq.answer):
                yield sse("delta", {"content": piece})
                await asyncio.sleep(0)
            yield sse(
                "usage",
                {
                    "prompt_tokens": 0,
                    "completion_tokens": 0,
                    "total_tokens": 0,
                    "token_source": "estimate",
                },
            )
            elapsed = int((time.perf_counter() - started) * 1000)
            db.add(
                ChatMessage(
                    session_id=session.id,
                    user_id=user.id,
                    role="user",
                    content=question,
                )
            )
            db.add(
                ChatMessage(
                    session_id=session.id,
                    user_id=user.id,
                    role="assistant",
                    content=faq.answer,
                    citations_json=json.dumps(faq_citations, ensure_ascii=False),
                    unauthorized_count=0,
                    usage_json=json.dumps(
                        {
                            "prompt_tokens": 0,
                            "completion_tokens": 0,
                            "total_tokens": 0,
                            "token_source": "estimate",
                        }
                    ),
                    faq_hit=True,
                )
            )
            log = QaAccessLog(
                session_id=session.id,
                user_id=user.id,
                question=question,
                answer=faq.answer,
                recalled_unit_ids_json="[]",
                authorized_unit_ids_json=json.dumps(
                    [item["unit_id"] for item in faq_citations]
                ),
                unauthorized_unit_ids_json="[]",
                prompt_tokens=0,
                completion_tokens=0,
                total_tokens=0,
                response_time_ms=elapsed,
                result_type="faq_hit",
                hit_faq_id=faq.id,
            )
            db.add(log)
            faq.hit_count += 1
            session.last_message = question[:255]
            if session.title == "新的对话":
                session.title = question[:30] or "新的对话"
            await db.commit()
            yield sse(
                "done",
                {
                    "log_id": log.id,
                    "session_id": session.id,
                    "response_time_ms": elapsed,
                    "first_token_ms": 0,
                    "total_tokens": 0,
                    "prompt_tokens": 0,
                    "completion_tokens": 0,
                    "token_source": "estimate",
                    "citations": faq_citations,
                    "unauthorized_count": 0,
                    "faq_hit": True,
                    "permission_notice": "",
                },
            )
            return

        hits, best_score = await recall(db, question)
        if best_score < settings.retrieval_min_score:
            hits = []
        authorized_ids, unauthorized_ids = await check_access(
            db, user, [hit.unit_id for hit in hits]
        )
        allowed = set(authorized_ids)
        authorized_hits = [hit for hit in hits if hit.unit_id in allowed]
        unauthorized_hits = [hit for hit in hits if hit.unit_id not in allowed]
        citations = citations_of(authorized_hits[:5])
        permission_notice = (
            f"另有 {len(unauthorized_hits)} 个相关知识单元因权限限制未展示。"
            if unauthorized_hits
            else ""
        )

        yield sse(
            "meta",
            {
                "session_id": session.id,
                "faq_hit": False,
                "citations": citations,
                "unauthorized_count": len(unauthorized_hits),
                "recalled_count": len(hits),
                "authorized_count": len(authorized_hits),
            },
        )

        answer_parts: list[str] = []
        first_token_ms: int | None = None
        used_llm = False

        if llm_available() and authorized_hits:
            used_llm = True
            try:
                async for piece in stream_llm(question, authorized_hits):
                    if first_token_ms is None:
                        first_token_ms = int((time.perf_counter() - started) * 1000)
                    answer_parts.append(piece)
                    yield sse("delta", {"content": piece})
            except Exception:
                if not answer_parts:
                    used_llm = False
                else:
                    note = "\n\n（生成中断，请重试）"
                    answer_parts.append(note)
                    yield sse("delta", {"content": note})

        if not used_llm:
            answer = build_local_answer(question, authorized_hits, unauthorized_hits)
            for piece in split_stream(answer):
                if first_token_ms is None:
                    first_token_ms = int((time.perf_counter() - started) * 1000)
                answer_parts.append(piece)
                yield sse("delta", {"content": piece})
                await asyncio.sleep(0)

        answer_text = "".join(answer_parts)
        context_text = "\n".join(hit.content for hit in authorized_hits)
        prompt_tokens = estimate_tokens(question + context_text)
        completion_tokens = estimate_tokens(answer_text)
        total_tokens = prompt_tokens + completion_tokens
        elapsed = int((time.perf_counter() - started) * 1000)

        if not authorized_hits:
            result_type = "permission_miss" if unauthorized_hits else "gap"
        else:
            result_type = "answered"

        yield sse(
            "usage",
            {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": total_tokens,
                "token_source": "estimate",
            },
        )

        db.add(
            ChatMessage(
                session_id=session.id,
                user_id=user.id,
                role="user",
                content=question,
            )
        )
        db.add(
            ChatMessage(
                session_id=session.id,
                user_id=user.id,
                role="assistant",
                content=answer_text,
                citations_json=json.dumps(citations, ensure_ascii=False),
                unauthorized_count=len(unauthorized_hits),
                usage_json=json.dumps(
                    {
                        "prompt_tokens": prompt_tokens,
                        "completion_tokens": completion_tokens,
                        "total_tokens": total_tokens,
                        "token_source": "estimate",
                    }
                ),
            )
        )
        log = QaAccessLog(
            session_id=session.id,
            user_id=user.id,
            question=question,
            answer=answer_text,
            recalled_unit_ids_json=json.dumps([hit.unit_id for hit in hits]),
            authorized_unit_ids_json=json.dumps(authorized_ids),
            unauthorized_unit_ids_json=json.dumps(unauthorized_ids),
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            response_time_ms=elapsed,
            result_type=result_type,
        )
        db.add(log)
        if result_type == "gap":
            await record_gap(db, question)
        session.last_message = question[:255]
        if session.title == "新的对话":
            session.title = question[:30] or "新的对话"
        await db.commit()

        yield sse(
            "done",
            {
                "log_id": log.id,
                "session_id": session.id,
                "response_time_ms": elapsed,
                "first_token_ms": first_token_ms or elapsed,
                "total_tokens": total_tokens,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "token_source": "estimate",
                "citations": citations,
                "unauthorized_count": len(unauthorized_hits),
                "faq_hit": False,
                "permission_notice": permission_notice,
            },
        )
