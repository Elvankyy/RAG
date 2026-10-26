from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_permission
from app.core.models import Department, Role, User
from app.core.rbac import PERMISSION_CATALOG
from app.org import service
from app.org.schemas import (
    DepartmentCreate,
    DepartmentUpdate,
    ResetPasswordRequest,
    RoleCreate,
    RolePermissionUpdate,
    RoleUpdate,
    UserCreate,
    UserStatusRequest,
    UserUpdate,
)

router = APIRouter(prefix="/api/org", tags=["组织架构"])


async def department_item(db: AsyncSession, department_id: int) -> dict:
    items = await service.list_departments(db)
    for item in items:
        if item["id"] == department_id:
            return item
    raise HTTPException(status.HTTP_404_NOT_FOUND, "部门不存在")


@router.get("/departments")
async def list_departments(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("dept:read")),
) -> dict:
    items = await service.list_departments(db)
    return {"items": items, "tree": service.build_department_tree(items)}


@router.post("/departments", status_code=status.HTTP_201_CREATED)
async def create_department(
    payload: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("dept:create")),
) -> dict:
    if payload.parent_id is not None and not await db.get(Department, payload.parent_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "上级部门不存在")
    if payload.leader_id is not None and not await db.get(User, payload.leader_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "负责人不存在")
    department = await service.create_department(db, payload)
    return await department_item(db, department.id)


@router.put("/departments/{department_id}")
async def update_department(
    department_id: int,
    payload: DepartmentUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("dept:update")),
) -> dict:
    department = await db.get(Department, department_id)
    if not department:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "部门不存在")
    if payload.parent_id is not None:
        if payload.parent_id == department_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "上级部门不能是自身")
        if not await db.get(Department, payload.parent_id):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "上级部门不存在")
        if await service.is_descendant(db, department_id, payload.parent_id):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "不能移动到自己的子部门下")
    if payload.leader_id is not None and not await db.get(User, payload.leader_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "负责人不存在")
    await service.update_department(db, department, payload)
    return await department_item(db, department.id)


@router.delete("/departments/{department_id}")
async def delete_department(
    department_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("dept:delete")),
) -> dict:
    department = await db.get(Department, department_id)
    if not department:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "部门不存在")
    child = await db.scalar(select(Department).where(Department.parent_id == department_id))
    if child:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "请先删除子部门")
    member = await db.scalar(select(User).where(User.department_id == department_id))
    if member:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "部门下仍有成员，无法删除")
    await db.delete(department)
    await db.commit()
    return {"message": "部门已删除"}


@router.get("/users")
async def list_users(
    keyword: str | None = Query(None),
    department_id: int | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("user:read")),
) -> dict:
    users = await service.list_users(db, keyword, department_id, status_filter)
    return {"items": [service.serialize_user(user) for user in users], "total": len(users)}


@router.post("/users", status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("user:create")),
) -> dict:
    exists = await db.scalar(select(User).where(User.username == payload.username.strip()))
    if exists:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "用户名已存在")
    if payload.department_id is not None and not await db.get(Department, payload.department_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "部门不存在")
    if payload.status not in {"active", "disabled"}:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "状态值不合法")
    user = await service.create_user(db, payload)
    return service.serialize_user(user)


@router.put("/users/{user_id}")
async def update_user(
    user_id: int,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("user:update")),
) -> dict:
    user = await service.get_user(db, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "用户不存在")
    if payload.department_id is not None and not await db.get(Department, payload.department_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "部门不存在")
    if payload.status is not None and payload.status not in {"active", "disabled"}:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "状态值不合法")
    user = await service.update_user(db, user, payload)
    return service.serialize_user(user)


@router.post("/users/{user_id}/reset-password")
async def reset_password(
    user_id: int,
    payload: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("user:reset")),
) -> dict:
    user = await service.get_user(db, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "用户不存在")
    await service.reset_user_password(db, user, payload.new_password)
    return {"message": "密码已重置，旧登录状态已失效"}


@router.post("/users/{user_id}/status")
async def update_user_status(
    user_id: int,
    payload: UserStatusRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("user:update")),
) -> dict:
    user = await service.get_user(db, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "用户不存在")
    await service.set_user_status(db, user, payload.status)
    return {"message": "状态已更新"}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_permission("user:delete")),
) -> dict:
    if user_id == current.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "不能删除当前登录账号")
    user = await service.get_user(db, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "用户不存在")
    if user.username == "admin":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "不能删除内置系统管理员")
    await service.delete_user(db, user)
    return {"message": "用户已删除"}


@router.get("/roles")
async def list_roles(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("role:read")),
) -> dict:
    return {"items": await service.list_roles(db)}


@router.get("/permissions")
async def list_permissions(
    _: User = Depends(require_permission("role:read")),
) -> dict:
    return {"items": PERMISSION_CATALOG}


@router.post("/roles", status_code=status.HTTP_201_CREATED)
async def create_role(
    payload: RoleCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("role:create")),
) -> dict:
    exists = await db.scalar(select(Role).where(Role.role_code == payload.role_code))
    if exists:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "角色编码已存在")
    role = await service.create_role(db, payload)
    return await service.serialize_role(db, role)


@router.put("/roles/{role_id}")
async def update_role(
    role_id: int,
    payload: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("role:update")),
) -> dict:
    role = await db.get(Role, role_id)
    if not role:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "角色不存在")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(role, key, value)
    await db.commit()
    await db.refresh(role)
    return await service.serialize_role(db, role)


@router.delete("/roles/{role_id}")
async def delete_role(
    role_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("role:delete")),
) -> dict:
    role = await db.get(Role, role_id)
    if not role:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "角色不存在")
    if role.is_builtin:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "内置角色不可删除")
    assigned = await service.list_roles(db)
    target = next((item for item in assigned if item["id"] == role_id), None)
    if target and target["user_count"] > 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "角色已分配给用户，无法删除")
    await db.delete(role)
    await db.commit()
    return {"message": "角色已删除"}


@router.post("/roles/{role_id}/permissions")
async def update_role_permissions(
    role_id: int,
    payload: RolePermissionUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("role:assign")),
) -> dict:
    role = await db.get(Role, role_id)
    if not role:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "角色不存在")
    role = await service.set_role_permissions(db, role, payload.permission_codes)
    return await service.serialize_role(db, role)
