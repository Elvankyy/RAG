from __future__ import annotations

import json
import math
from collections import Counter
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.models import KnowledgeUnit, UnitChunk
from app.knowledge.text import cosine, embed, tokenize


@dataclass
class Hit:
    unit_id: int
    unit_code: str
    title: str
    category: str
    content: str
    score: float
    chunk_index: int


async def recall(
    db: AsyncSession, question: str, top_k: int | None = None
) -> tuple[list[Hit], float]:
    top_k = top_k or settings.recall_top_k
    rows = (
        await db.execute(
            select(UnitChunk, KnowledgeUnit)
            .join(KnowledgeUnit, UnitChunk.unit_id == KnowledgeUnit.id)
            .where(
                KnowledgeUnit.status == "active",
                UnitChunk.version == KnowledgeUnit.version,
            )
        )
    ).all()
    if not rows:
        return [], 0.0

    query_vector = embed(question)
    query_tokens = list(dict.fromkeys(tokenize(question)))
    if not query_tokens:
        return [], 0.0

    tokenized_docs = [tokenize(f"{chunk.content} {unit.title}") for chunk, unit in rows]
    doc_freq: Counter[str] = Counter()
    for tokens in tokenized_docs:
        doc_freq.update(set(tokens))
    total_docs = len(rows)
    avg_len = sum(len(tokens) for tokens in tokenized_docs) / max(1, total_docs)

    query_token_set = set(query_tokens)
    bm25_scores: list[float] = []
    vector_scores: list[float] = []
    coverage_scores: list[float] = []
    for (chunk, unit), tokens in zip(rows, tokenized_docs):
        counts = Counter(tokens)
        length = len(tokens)
        score = 0.0
        for token in query_tokens:
            frequency = counts.get(token, 0)
            if not frequency:
                continue
            idf = math.log(1 + (total_docs - doc_freq[token] + 0.5) / (doc_freq[token] + 0.5))
            denominator = frequency + 1.2 * (0.25 + 0.75 * length / max(1.0, avg_len))
            score += idf * frequency * 2.2 / denominator
        bm25_scores.append(score)
        coverage_scores.append(
            len(query_token_set & set(tokens)) / max(1, len(query_token_set))
        )
        try:
            chunk_vector = json.loads(chunk.embedding_json or "[]")
        except json.JSONDecodeError:
            chunk_vector = []
        vector_scores.append(max(0.0, cosine(query_vector, chunk_vector)))

    max_bm25 = max(bm25_scores) or 1.0
    best_by_unit: dict[int, Hit] = {}
    for index, (chunk, unit) in enumerate(rows):
        coverage = coverage_scores[index]
        if coverage < 0.25:
            continue
        keyword_score = bm25_scores[index] / max_bm25
        vector_score = vector_scores[index]
        score = 0.7 * coverage + 0.2 * keyword_score + 0.1 * vector_score
        current = best_by_unit.get(unit.id)
        if current is None or score > current.score:
            best_by_unit[unit.id] = Hit(
                unit_id=unit.id,
                unit_code=unit.unit_code,
                title=unit.title,
                category=unit.category,
                content=chunk.content,
                score=round(score, 4),
                chunk_index=chunk.chunk_index,
            )

    hits = sorted(best_by_unit.values(), key=lambda hit: hit.score, reverse=True)
    hits = [hit for hit in hits if hit.score >= settings.retrieval_min_score][:top_k]
    return hits, (hits[0].score if hits else 0.0)
