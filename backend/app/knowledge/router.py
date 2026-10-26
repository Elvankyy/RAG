from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, get_user_permission_codes, require_permission
from app.core.models import ImportBatch, ImportTask, User
from app.knowledge import service
from app.permissions.engine import authorized_unit_ids, check_access
from app.knowledge.schemas import (
    BatchDeletePayload,
    CheckPermissionPayload,
    PermissionPayload,
    UnitCreate,
    UnitUpdate,
)

router = APIRouter(prefix="/api/knowledge", tags=["知识维护"])


@router.get("/categories")
async def list_categories(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("knowledge:read")),
) -> dict:
    return {"items": await service.list_categories(db)}


@router.get("/units")
async def list_units(
    keyword: str | None = Query(None),
    category: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_permission("knowledge:read")),
) -> dict:
    codes = set(await get_user_permission_codes(db, current))
    is_admin = bool(codes & {"knowledge:update", "knowledge:permission"})
    allowed_ids = None if is_admin else await authorized_unit_ids(db, current)
    units, total = await service.list_units(
        db, keyword, category, status_filter, page, page_size, allowed_ids
    )
    items = await service.serialize_units(db, units)
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("/units", status_code=status.HTTP_201_CREATED)
async def create_unit(
    payload: UnitCreate,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_permission("knowledge:create")),
) -> dict:
    unit = await service.create_unit(
        db,
        title=payload.title,
        content=payload.content,
        creator_id=current.id,
        category=payload.category,
        tags=payload.tags,
        file_type="manual",
        permissions=[
            {"target_type": item.target_type, "target_id": item.target_id}
            for item in payload.permissions
        ],
    )
    await db.commit()
    return (await service.serialize_units(db, [unit], include_content=True))[0]


@router.get("/units/{unit_id}")
async def get_unit(
    unit_id: int,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_permission("knowledge:read")),
) -> dict:
    unit = await service.get_unit(db, unit_id)
    if not unit:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "知识单元不存在")
    codes = set(await get_user_permission_codes(db, current))
    is_admin = bool(codes & {"knowledge:update", "knowledge:permission"})
    if not is_admin:
        authorized, _ = await check_access(db, current, [unit_id])
        if not authorized:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "缺少该知识单元的数据访问权限")
    return (await service.serialize_units(db, [unit], include_content=True))[0]


@router.put("/units/{unit_id}")
async def update_unit(
    unit_id: int,
    payload: UnitUpdate,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_permission("knowledge:update")),
) -> dict:
    unit = await service.get_unit(db, unit_id)
    if not unit:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "知识单元不存在")
    if payload.status is not None and payload.status not in {"active", "disabled"}:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "状态值不合法")
    await service.update_unit(db, unit, current.id, payload)
    await db.commit()
    return (await service.serialize_units(db, [unit], include_content=True))[0]


@router.delete("/units")
async def delete_units(
    payload: BatchDeletePayload,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("knowledge:delete")),
) -> dict:
    if not payload.ids:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "请选择要删除的知识单元")
    deleted = await service.delete_units(db, payload.ids)
    await db.commit()
    return {"deleted": deleted, "message": f"已删除 {deleted} 个知识单元"}


@router.get("/units/{unit_id}/permissions")
async def get_unit_permissions(
    unit_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("knowledge:read")),
) -> dict:
    unit = await service.get_unit(db, unit_id)
    if not unit:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "知识单元不存在")
    return {"items": (await service.serialize_units(db, [unit]))[0]["permissions"]}


@router.post("/units/{unit_id}/permissions")
async def set_unit_permissions(
    unit_id: int,
    payload: PermissionPayload,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("knowledge:permission")),
) -> dict:
    unit = await service.get_unit(db, unit_id)
    if not unit:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "知识单元不存在")
    for item in payload.permissions:
        if item.target_type != "global" and item.target_id is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "非全局权限必须指定目标对象")
    await service.set_permissions(db, unit, payload.permissions)
    await db.commit()
    return {"items": (await service.serialize_units(db, [unit]))[0]["permissions"]}


@router.get("/units/{unit_id}/versions")
async def list_versions(
    unit_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("knowledge:read")),
) -> dict:
    unit = await service.get_unit(db, unit_id)
    if not unit:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "知识单元不存在")
    return {"items": await service.list_versions(db, unit)}


@router.post("/units/{unit_id}/versions/{version}/rollback")
async def rollback_unit(
    unit_id: int,
    version: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("knowledge:update")),
) -> dict:
    unit = await service.get_unit(db, unit_id)
    if not unit:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "知识单元不存在")
    if not await service.rollback_unit(db, unit, version):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "版本不存在")
    await db.commit()
    return (await service.serialize_units(db, [unit], include_content=True))[0]


@router.post("/units/{unit_id}/reindex")
async def reindex_unit(
    unit_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("knowledge:update")),
) -> dict:
    unit = await service.get_unit(db, unit_id)
    if not unit:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "知识单元不存在")
    await service.reindex_unit(db, unit)
    await db.commit()
    return (await service.serialize_units(db, [unit]))[0]


@router.post("/import", status_code=status.HTTP_201_CREATED)
async def import_documents(
    files: list[UploadFile] = File(...),
    category: str = Form(""),
    tags: str = Form(""),
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_permission("knowledge:import")),
) -> dict:
    if not files:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "请至少选择一个文件")
    payload: list[tuple[str, bytes]] = []
    for upload in files:
        data = await upload.read()
        if len(data) > 50 * 1024 * 1024:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{upload.filename} 超过 50MB")
        if data:
            payload.append((upload.filename or "未命名文件", data))
    if not payload:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "文件内容为空")
    batch = await service.import_files(db, payload, current.id, category, tags)
    result = await service.serialize_batch(db, batch)
    result["batch_id"] = batch.id
    return result


@router.get("/import/batches/{batch_id}")
async def get_import_batch(
    batch_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("knowledge:import")),
) -> dict:
    batch = await db.get(ImportBatch, batch_id)
    if not batch:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "批次不存在")
    return await service.serialize_batch(db, batch)


@router.post("/import/tasks/{task_id}/retry")
async def retry_import_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("knowledge:import")),
) -> dict:
    task = await db.get(ImportTask, task_id)
    if not task:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "任务不存在")
    if not await service.retry_task(db, task):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "只有失败任务可以重试")
    return {"message": "已重新排队并完成（演示环境）"}


@router.post("/check-permissions")
async def check_permissions(
    payload: CheckPermissionPayload,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
) -> dict:
    target = current
    if payload.user_id and payload.user_id != current.id:
        codes = set(await get_user_permission_codes(db, current))
        if "user:read" not in codes:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "无权查询其他用户的数据权限")
        target = await db.get(User, payload.user_id)
        if not target:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "用户不存在")
    authorized, unauthorized = await check_access(db, target, payload.unit_ids)
    return {"authorized_unit_ids": authorized, "unauthorized_unit_ids": unauthorized}
