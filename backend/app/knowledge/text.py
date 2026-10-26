from __future__ import annotations

import hashlib
import math
import re
from collections import Counter

EMBED_DIM = 256
STOPWORDS = {
    "的", "了", "和", "是", "在", "我", "有", "就", "不", "人", "都", "一", "一个",
    "上", "也", "很", "到", "说", "要", "去", "你", "会", "着", "没有", "看", "好",
    "这", "那", "什么", "怎么", "如何", "请问", "可以", "需要", "是否", "吗", "呢",
    "吧", "啊", "与", "及", "或", "对", "为", "从", "被", "把", "个", "中",
    "申请", "流程", "怎么", "如何", "什么", "多少", "哪里", "哪些", "办理", "操作",
    "the", "a", "an", "of", "to", "in", "is", "are", "and", "or", "for", "on",
}
TOKEN_RE = re.compile(r"[a-zA-Z][a-zA-Z0-9_.-]*|\d+(?:\.\d+)?|[一-鿿]+")


def tokenize(text: str) -> list[str]:
    tokens: list[str] = []
    for segment in TOKEN_RE.findall((text or "").lower()):
        if "一" <= segment[0] <= "鿿" and len(segment) > 1:
            tokens.append(segment)
            tokens.extend(segment[index : index + 2] for index in range(len(segment) - 1))
            continue
        tokens.append(segment)
    return [token for token in tokens if token not in STOPWORDS]


def _hash_feature(feature: str) -> tuple[int, float]:
    digest = hashlib.blake2b(feature.encode("utf-8"), digest_size=8).digest()
    value = int.from_bytes(digest, "little")
    return value % EMBED_DIM, 1.0 if (value >> 8) & 1 else -1.0


def embed(text: str) -> list[float]:
    vector = [0.0] * EMBED_DIM
    counts = Counter(tokenize(text))
    if not counts:
        return vector
    for token, count in counts.items():
        weight = 1.0 + math.log(1 + count)
        for feature in (token, f"bi:{token[:2]}", f"tri:{token[:3]}"):
            index, sign = _hash_feature(feature)
            vector[index] += sign * weight
    norm = math.sqrt(sum(value * value for value in vector))
    if norm > 0:
        vector = [round(value / norm, 6) for value in vector]
    return vector


def cosine(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    return float(sum(a * b for a, b in zip(left, right)))


def estimate_tokens(text: str) -> int:
    if not text:
        return 0
    chinese = len(re.findall(r"[一-鿿]", text))
    others = len(text) - chinese
    return max(1, int(chinese / 1.5 + others / 4))


def make_summary(content: str, limit: int = 150) -> str:
    text = re.sub(r"^#+\s.*$", "", content or "", flags=re.M)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit] + ("…" if len(text) > limit else "")


def split_chunks(content: str, max_chars: int = 600, overlap: int = 60) -> list[dict]:
    content = (content or "").replace("\r\n", "\n").strip()
    if not content:
        return []

    paragraphs = [item.strip() for item in re.split(r"\n\s*\n", content) if item.strip()]
    if not paragraphs:
        paragraphs = [content]

    chunks: list[dict] = []
    current: list[str] = []
    current_length = 0
    title_path = ""

    def flush() -> None:
        nonlocal current, current_length
        if not current:
            return
        text = "\n\n".join(current).strip()
        if text:
            chunks.append({"content": text, "title_path": title_path})
        tail = text[-overlap:] if len(text) > overlap else text
        current = [tail] if tail else []
        current_length = len(tail)

    for paragraph in paragraphs:
        heading = re.match(r"^(#{1,6})\s+(.*)$", paragraph.splitlines()[0]) if paragraph else None
        if heading and len(paragraph) < 120:
            title_path = heading.group(2).strip()

        if len(paragraph) > max_chars:
            flush()
            start = 0
            step = max_chars - overlap
            while start < len(paragraph):
                piece = paragraph[start : start + max_chars]
                chunks.append({"content": piece, "title_path": title_path})
                start += step
            current = []
            current_length = 0
            continue

        if current_length + len(paragraph) + 2 > max_chars:
            flush()
        current.append(paragraph)
        current_length += len(paragraph) + 2

    if current:
        text = "\n\n".join(current).strip()
        if text and (not chunks or chunks[-1]["content"] != text):
            chunks.append({"content": text, "title_path": title_path})

    return [chunk for chunk in chunks if chunk["content"].strip()]
