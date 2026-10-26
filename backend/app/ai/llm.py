from __future__ import annotations

import json
from collections.abc import AsyncIterator

import httpx

from app.ai.retrieval import Hit
from app.core.config import settings

SYSTEM_PROMPT = """你是企业知识库智能助手。请严格依据提供的知识片段回答用户问题：
1. 只使用与问题相关且已授权的内容，不得编造；
2. 回答使用中文 Markdown，先结论后要点；
3. 引用知识时标注来源编号，如 [1]；
4. 资料不足时说明“知识库中暂未找到足够依据”；
5. 不要提及“片段”“上下文”等实现细节。"""


def llm_available() -> bool:
    return bool(settings.llm_enabled and settings.llm_api_key)


def build_context(hits: list[Hit]) -> str:
    parts = []
    for index, hit in enumerate(hits, start=1):
        parts.append(f"[{index}] {hit.title}（{hit.unit_code}，{hit.category}）\n{hit.content}")
    return "\n\n".join(parts)


async def stream_llm(question: str, hits: list[Hit]) -> AsyncIterator[str]:
    payload = {
        "model": settings.llm_model,
        "temperature": 0.2,
        "stream": True,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"知识片段：\n{build_context(hits)}\n\n用户问题：{question}",
            },
        ],
    }
    headers = {
        "Authorization": f"Bearer {settings.llm_api_key}",
        "Content-Type": "application/json",
    }
    url = settings.llm_base_url.rstrip("/") + "/chat/completions"
    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream("POST", url, json=payload, headers=headers) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    break
                try:
                    event = json.loads(data)
                except json.JSONDecodeError:
                    continue
                choices = event.get("choices") or []
                if not choices:
                    continue
                delta = choices[0].get("delta") or {}
                content = delta.get("content")
                if content:
                    yield content
