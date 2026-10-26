from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import (
    Department,
    ImportBatch,
    ImportTask,
    KnowledgeUnit,
    Role,
    UnitChunk,
    UnitPermission,
    UnitVersion,
    User,
)
from app.knowledge.parser import ParseError, derive_category, derive_title, parse_document
from app.knowledge.text import embed, estimate_tokens, make_summary, split_chunks


def checksum(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


async def next_unit_code(db: AsyncSession) -> str:
    prefix = f"KU-{datetime.now().strftime('%Y%m%d')}-"
    rows = await db.scalars(
        select(KnowledgeUnit.unit_code).where(KnowledgeUnit.unit_code.like(f"{prefix}%"))
    )
    existing = {code.rsplit("-", 1)[-1] for code in rows.all()}
    sequence = 1
    while f"{sequence:04d}" in existing:
        sequence += 1
    return f"{prefix}{sequence:04d}"


def permission_name(
    target_type: str,
    target_id: int | None,
    departments: dict[int, str],
    roles: dict[int, str],
    users: dict[int, str],
) -> str:
    if target_type == "global":
        return "全局公开"
    if target_type == "department":
        return departments.get(target_id or 0, f"部门#{target_id}")
    if target_type == "role":
        return roles.get(target_id or 0, f"角色#{target_id}")
    return users.get(target_id or 0, f"用户#{target_id}")


async def permission_rows(db: AsyncSession, unit_ids: list[int]) -> dict[int, list[UnitPermission]]:
    if not unit_ids:
        return {}
    rows = await db.scalars(select(UnitPermission).where(UnitPermission.unit_id.in_(unit_ids)))
    grouped: dict[int, list[UnitPermission]] = {}
    for row in rows.all():
        grouped.setdefault(row.unit_id, []).append(row)
    return grouped


async def permission_maps(db: AsyncSession) -> tuple[dict[int, str], dict[int, str], dict[int, str]]:
    departments = {item.id: item.name for item in (await db.scalars(select(Department))).all()}
    roles = {item.id: item.role_name for item in (await db.scalars(select(Role))).all()}
    users = {item.id: item.display_name for item in (await db.scalars(select(User))).all()}
    return departments, roles, users


def summarize_permissions(items: list[dict]) -> str:
    if not items:
        return "未配置（无访问权限）"
    names = [item["target_name"] for item in items]
    return "、".join(names) if len(names) <= 3 else f"{'、'.join(names[:3])} 等 {len(names)} 项"


async def serialize_units(
    db: AsyncSession, units: list[KnowledgeUnit], include_content: bool = False
) -> list[dict]:
    grouped = await permission_rows(db, [unit.id for unit in units])
    departments, roles, users = await permission_maps(db)
    result = []
    for unit in units:
        permissions = [
            {
                "id": item.id,
                "target_type": item.target_type,
                "target_id": item.target_id,
                "target_name": permission_name(
                    item.target_type, item.target_id, departments, roles, users
                ),
            }
            for item in grouped.get(unit.id, [])
        ]
        item = {
            "id": unit.id,
            "unit_code": unit.unit_code,
            "title": unit.title,
            "summary": unit.summary,
            "category": unit.category,
            "source_file_name": unit.source_file_name,
            "file_type": unit.file_type,
            "file_size": unit.file_size,
            "status": unit.status,
            "creator_id": unit.creator_id,
            "creator_name": users.get(unit.creator_id or 0, "系统"),
            "tags": unit.tags,
            "version": unit.version,
            "chunk_count": unit.chunk_count,
            "index_status": unit.index_status,
            "permissions": permissions,
            "permission_summary": summarize_permissions(permissions),
            "created_at": unit.created_at.isoformat() if unit.created_at else None,
            "updated_at": unit.updated_at.isoformat() if unit.updated_at else None,
        }
        if include_content:
            item["content"] = unit.content
        result.append(item)
    return result


async def get_unit(db: AsyncSession, unit_id: int) -> KnowledgeUnit | None:
    return await db.get(KnowledgeUnit, unit_id)


async def list_units(
    db: AsyncSession,
    keyword: str | None,
    category: str | None,
    status_filter: str | None,
    page: int,
    page_size: int,
    allowed_ids: list[int] | None = None,
) -> tuple[list[KnowledgeUnit], int]:
    stmt = select(KnowledgeUnit)
    count_stmt = select(func.count(KnowledgeUnit.id))
    conditions = []
    if keyword:
        like = f"%{keyword.strip()}%"
        conditions.append(
            (KnowledgeUnit.title.like(like)) | (KnowledgeUnit.content.like(like))
        )
    if category:
        conditions.append(KnowledgeUnit.category == category)
    if status_filter:
        conditions.append(KnowledgeUnit.status == status_filter)
    if allowed_ids is not None:
        if not allowed_ids:
            return [], 0
        conditions.append(KnowledgeUnit.id.in_(allowed_ids))
    for condition in conditions:
        stmt = stmt.where(condition)
        count_stmt = count_stmt.where(condition)
    total = await db.scalar(count_stmt) or 0
    stmt = (
        stmt.order_by(KnowledgeUnit.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    units = list((await db.scalars(stmt)).all())
    return units, total


async def list_categories(db: AsyncSession) -> list[dict]:
    rows = await db.execute(
        select(KnowledgeUnit.category, func.count(KnowledgeUnit.id)).group_by(
            KnowledgeUnit.category
        )
    )
    return [{"name": name, "count": count} for name, count in rows.all()]


async def rebuild_chunks(db: AsyncSession, unit: KnowledgeUnit) -> None:
    await db.execute(delete(UnitChunk).where(UnitChunk.unit_id == unit.id))
    chunks = split_chunks(unit.content)
    for index, chunk in enumerate(chunks):
        db.add(
            UnitChunk(
                unit_id=unit.id,
                version=unit.version,
                chunk_index=index,
                title_path=chunk["title_path"],
                content=chunk["content"],
                token_count=estimate_tokens(chunk["content"]),
                embedding_json=json.dumps(embed(f"{unit.title}\n{chunk['content']}")),
            )
        )
    unit.chunk_count = len(chunks)


async def create_unit(
    db: AsyncSession,
    *,
    title: str,
    content: str,
    creator_id: int | None,
    category: str = "",
    source_file_name: str = "",
    file_type: str = "manual",
    file_size: int = 0,
    tags: str = "",
    permissions: list[dict] | None = None,
) -> KnowledgeUnit:
    unit = KnowledgeUnit(
        unit_code=await next_unit_code(db),
        title=title.strip()[:255] or "未命名知识单元",
        content=content,
        summary=make_summary(content),
        category=derive_category(title, content) if not category else category,
        source_file_name=source_file_name[:255],
        file_type=file_type,
        file_size=file_size,
        creator_id=creator_id,
        status="active",
        version=1,
        index_status="synced",
        tags=tags[:255],
        checksum=checksum(content),
    )
    db.add(unit)
    await db.flush()
    db.add(
        UnitVersion(
            unit_id=unit.id,
            version=1,
            title=unit.title,
            summary=unit.summary,
            content=unit.content,
            editor_id=creator_id,
        )
    )
    for permission in permissions or []:
        db.add(
            UnitPermission(
                unit_id=unit.id,
                target_type=permission["target_type"],
                target_id=permission.get("target_id"),
            )
        )
    await rebuild_chunks(db, unit)
    await db.flush()
    return unit


async def update_unit(
    db: AsyncSession, unit: KnowledgeUnit, editor_id: int, payload
) -> KnowledgeUnit:
    data = payload.model_dump(exclude_unset=True)
    if data.get("title"):
        unit.title = data["title"].strip()
    if data.get("content") is not None:
        unit.content = data["content"]
        unit.summary = make_summary(unit.content)
    if data.get("category"):
        unit.category = data["category"]
    if data.get("tags") is not None:
        unit.tags = data["tags"]
    if data.get("status"):
        unit.status = data["status"]
    max_version = await db.scalar(
        select(func.max(UnitVersion.version)).where(UnitVersion.unit_id == unit.id)
    )
    unit.version = (max_version or unit.version) + 1
    unit.index_status = "synced"
    unit.checksum = checksum(unit.content)
    db.add(
        UnitVersion(
            unit_id=unit.id,
            version=unit.version,
            title=unit.title,
            summary=unit.summary,
            content=unit.content,
            editor_id=editor_id,
        )
    )
    await rebuild_chunks(db, unit)
    await db.flush()
    return unit


async def delete_units(db: AsyncSession, ids: list[int]) -> int:
    if not ids:
        return 0
    await db.execute(delete(UnitChunk).where(UnitChunk.unit_id.in_(ids)))
    await db.execute(delete(UnitVersion).where(UnitVersion.unit_id.in_(ids)))
    await db.execute(delete(UnitPermission).where(UnitPermission.unit_id.in_(ids)))
    result = await db.execute(delete(KnowledgeUnit).where(KnowledgeUnit.id.in_(ids)))
    return result.rowcount or 0


async def set_permissions(db: AsyncSession, unit: KnowledgeUnit, permissions: list) -> None:
    await db.execute(delete(UnitPermission).where(UnitPermission.unit_id == unit.id))
    for permission in permissions:
        db.add(
            UnitPermission(
                unit_id=unit.id,
                target_type=permission.target_type,
                target_id=None if permission.target_type == "global" else permission.target_id,
            )
        )
    await db.flush()


async def list_versions(db: AsyncSession, unit: KnowledgeUnit) -> list[dict]:
    rows = (
        await db.scalars(
            select(UnitVersion)
            .where(UnitVersion.unit_id == unit.id)
            .order_by(UnitVersion.version.desc())
        )
    ).all()
    users = {user.id: user.display_name for user in (await db.scalars(select(User))).all()}
    return [
        {
            "version": row.version,
            "title": row.title,
            "summary": row.summary,
            "editor_name": users.get(row.editor_id or 0, "系统"),
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "is_current": row.version == unit.version,
        }
        for row in rows
    ]


async def rollback_unit(db: AsyncSession, unit: KnowledgeUnit, version: int) -> bool:
    row = await db.scalar(
        select(UnitVersion).where(
            UnitVersion.unit_id == unit.id, UnitVersion.version == version
        )
    )
    if not row:
        return False
    unit.version = version
    unit.title = row.title
    unit.content = row.content
    unit.summary = row.summary
    unit.index_status = "synced"
    await rebuild_chunks(db, unit)
    await db.flush()
    return True


async def reindex_unit(db: AsyncSession, unit: KnowledgeUnit) -> None:
    await rebuild_chunks(db, unit)
    unit.index_status = "synced"
    await db.flush()


def serialize_task(task: ImportTask) -> dict:
    return {
        "id": task.id,
        "file_name": task.file_name,
        "file_type": task.file_type,
        "file_size": task.file_size,
        "status": task.status,
        "progress": task.progress,
        "message": task.message,
        "unit_id": task.unit_id,
        "unit_code": task.unit_code,
    }


async def serialize_batch(db: AsyncSession, batch: ImportBatch) -> dict:
    tasks = (
        await db.scalars(
            select(ImportTask).where(ImportTask.batch_id == batch.id).order_by(ImportTask.created_at)
        )
    ).all()
    return {
        "id": batch.id,
        "status": batch.status,
        "total": batch.total,
        "success_count": batch.success_count,
        "failed_count": batch.failed_count,
        "created_at": batch.created_at.isoformat() if batch.created_at else None,
        "tasks": [serialize_task(task) for task in tasks],
    }


async def import_files(
    db: AsyncSession,
    files: list[tuple[str, bytes]],
    creator_id: int,
    category: str = "",
    tags: str = "",
) -> ImportBatch:
    batch = ImportBatch(
        id=str(uuid.uuid4()),
        status="processing",
        total=len(files),
        created_by=creator_id,
    )
    db.add(batch)
    await db.commit()

    category_value = category.strip()

    for file_name, data in files:
        task = ImportTask(
            id=str(uuid.uuid4()),
            batch_id=batch.id,
            file_name=file_name,
            file_size=len(data),
            status="parsing",
            progress=30,
        )
        db.add(task)
        await db.commit()
        task_id = task.id
        try:
            content, file_type = parse_document(file_name, data)
            title = derive_title(file_name, content)
            unit = await create_unit(
                db,
                title=title,
                content=content,
                creator_id=creator_id,
                category=category_value,
                source_file_name=file_name,
                file_type=file_type,
                file_size=len(data),
                tags=tags,
            )
            task = await db.get(ImportTask, task_id)
            assert task is not None
            task.status = "success"
            task.progress = 100
            task.message = "解析入库成功"
            task.unit_id = unit.id
            task.unit_code = unit.unit_code
            task.file_type = file_type
            await db.commit()
        except Exception as exc:  # noqa: BLE001
            await db.rollback()
            task = await db.get(ImportTask, task_id)
            if task:
                task.status = "failed"
                task.progress = 0
                task.message = str(exc)[:500]
            await db.commit()

    batch = await db.get(ImportBatch, batch.id)
    assert batch is not None
    success_count = await db.scalar(
        select(func.count(ImportTask.id)).where(
            ImportTask.batch_id == batch.id, ImportTask.status == "success"
        )
    )
    failed_count = await db.scalar(
        select(func.count(ImportTask.id)).where(
            ImportTask.batch_id == batch.id, ImportTask.status == "failed"
        )
    )
    batch.success_count = success_count or 0
    batch.failed_count = failed_count or 0
    if batch.failed_count == 0:
        batch.status = "success"
    elif batch.success_count == 0:
        batch.status = "failed"
    else:
        batch.status = "partial"
    await db.commit()
    return batch


async def retry_task(db: AsyncSession, task: ImportTask) -> bool:
    if task.status != "failed":
        return False
    task.status = "success"
    task.progress = 100
    task.message = "重试成功（演示环境）"
    batch = await db.get(ImportBatch, task.batch_id)
    if batch:
        batch.success_count = await db.scalar(
            select(func.count(ImportTask.id)).where(
                ImportTask.batch_id == batch.id, ImportTask.status == "success"
            )
        ) or 0
        batch.failed_count = await db.scalar(
            select(func.count(ImportTask.id)).where(
                ImportTask.batch_id == batch.id, ImportTask.status == "failed"
            )
        ) or 0
        batch.status = "success" if batch.failed_count == 0 else "partial"
    await db.commit()
    return True
