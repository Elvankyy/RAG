from __future__ import annotations

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.service import revoke_user_sessions
from app.core.models import (
    Department,
    Role,
    RolePermission,
    User,
    UserRole,
)
from app.core.rbac import PERMISSION_BY_CODE
from app.core.security import hash_password


def iso(value) -> str | None:
    return value.isoformat() if value else None


def serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "display_name": user.display_name,
        "department_id": user.department_id,
        "department_name": user.department.name if user.department else None,
        "status": user.status,
        "role_ids": [role.id for role in user.roles],
        "role_names": [role.role_name for role in user.roles],
        "roles": [
            {"id": role.id, "role_name": role.role_name, "role_code": role.role_code}
            for role in user.roles
        ],
        "created_at": iso(user.created_at),
    }


async def get_user(db: AsyncSession, user_id: int) -> User | None:
    return await db.scalar(select(User).where(User.id == user_id))


async def list_departments(db: AsyncSession) -> list[dict]:
    departments = (
        await db.scalars(select(Department).order_by(Department.sort_order, Department.id))
    ).all()
    users = (await db.scalars(select(User))).all()
    user_map = {user.id: user.display_name for user in users}
    member_counts: dict[int, int] = {}
    for user in users:
        if user.department_id:
            member_counts[user.department_id] = member_counts.get(user.department_id, 0) + 1

    items = [
        {
            "id": department.id,
            "parent_id": department.parent_id,
            "name": department.name,
            "leader_id": department.leader_id,
            "leader_name": user_map.get(department.leader_id or 0, ""),
            "member_count": member_counts.get(department.id, 0),
            "sort_order": department.sort_order,
        }
        for department in departments
    ]
    by_parent: dict[int | None, list[dict]] = {}
    for item in items:
        item["children"] = []
        by_parent.setdefault(item["parent_id"], []).append(item)
    for item in items:
        item["children"] = by_parent.get(item["id"], [])
    return items


def build_department_tree(items: list[dict]) -> list[dict]:
    by_parent: dict[int | None, list[dict]] = {}
    for item in items:
        by_parent.setdefault(item["parent_id"], []).append(item)
    return by_parent.get(None, [])


async def list_users(
    db: AsyncSession,
    keyword: str | None,
    department_id: int | None,
    status_filter: str | None,
) -> list[User]:
    stmt = select(User).order_by(User.id)
    if keyword:
        like = f"%{keyword.strip()}%"
        stmt = stmt.where((User.username.like(like)) | (User.display_name.like(like)))
    if department_id:
        stmt = stmt.where(User.department_id == department_id)
    if status_filter:
        stmt = stmt.where(User.status == status_filter)
    return list((await db.scalars(stmt)).all())


async def create_user(db: AsyncSession, payload) -> User:
    user = User(
        username=payload.username.strip(),
        password_hash=hash_password(payload.password),
        display_name=payload.display_name.strip(),
        department_id=payload.department_id,
        status=payload.status,
    )
    db.add(user)
    await db.flush()
    await replace_user_roles(db, user.id, payload.role_ids)
    await db.commit()
    await db.refresh(user, attribute_names=["department", "roles"])
    return user


async def replace_user_roles(db: AsyncSession, user_id: int, role_ids: list[int]) -> None:
    await db.execute(delete(UserRole).where(UserRole.user_id == user_id))
    for role_id in dict.fromkeys(role_ids):
        role = await db.get(Role, role_id)
        if role:
            db.add(UserRole(user_id=user_id, role_id=role_id))


async def update_user(db: AsyncSession, user: User, payload) -> User:
    data = payload.model_dump(exclude_unset=True)
    role_ids = data.pop("role_ids", None)
    for key, value in data.items():
        setattr(user, key, value)
    if role_ids is not None:
        await replace_user_roles(db, user.id, role_ids)
    await db.commit()
    await db.refresh(user, attribute_names=["department", "roles"])
    return user


async def reset_user_password(db: AsyncSession, user: User, new_password: str) -> None:
    user.password_hash = hash_password(new_password)
    user.token_version += 1
    await revoke_user_sessions(db, user.id)
    await db.commit()


async def set_user_status(db: AsyncSession, user: User, status: str) -> None:
    user.status = status
    if status == "disabled":
        user.token_version += 1
        await revoke_user_sessions(db, user.id)
    await db.commit()


async def delete_user(db: AsyncSession, user: User) -> None:
    await db.execute(delete(UserRole).where(UserRole.user_id == user.id))
    await db.execute(delete(User).where(User.id == user.id))
    await db.commit()


async def create_department(db: AsyncSession, payload) -> Department:
    department = Department(
        name=payload.name.strip(),
        parent_id=payload.parent_id,
        leader_id=payload.leader_id,
        sort_order=payload.sort_order,
    )
    db.add(department)
    await db.commit()
    await db.refresh(department)
    return department


async def update_department(db: AsyncSession, department: Department, payload) -> Department:
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(department, key, value)
    await db.commit()
    await db.refresh(department)
    return department


async def is_descendant(db: AsyncSession, department_id: int, candidate_parent_id: int) -> bool:
    current = await db.get(Department, candidate_parent_id)
    seen: set[int] = set()
    while current and current.id not in seen:
        if current.id == department_id:
            return True
        seen.add(current.id)
        current = await db.get(Department, current.parent_id) if current.parent_id else None
    return False


async def list_roles(db: AsyncSession) -> list[dict]:
    roles = (await db.scalars(select(Role).order_by(Role.id))).all()
    counts = dict(
        (
            await db.execute(
                select(UserRole.role_id, func.count(UserRole.user_id)).group_by(UserRole.role_id)
            )
        ).all()
    )
    return [
        {
            "id": role.id,
            "role_name": role.role_name,
            "role_code": role.role_code,
            "description": role.description,
            "is_builtin": role.is_builtin,
            "permission_codes": sorted(
                permission.permission_code for permission in role.permissions
            ),
            "user_count": counts.get(role.id, 0),
        }
        for role in roles
    ]


async def serialize_role(db: AsyncSession, role: Role) -> dict:
    count = await db.scalar(
        select(func.count(UserRole.user_id)).where(UserRole.role_id == role.id)
    )
    codes = await db.scalars(
        select(RolePermission.permission_code).where(RolePermission.role_id == role.id)
    )
    return {
        "id": role.id,
        "role_name": role.role_name,
        "role_code": role.role_code,
        "description": role.description,
        "is_builtin": role.is_builtin,
        "permission_codes": sorted(codes.all()),
        "user_count": count or 0,
    }


async def create_role(db: AsyncSession, payload) -> Role:
    role = Role(
        role_name=payload.role_name.strip(),
        role_code=payload.role_code.strip(),
        description=payload.description,
    )
    db.add(role)
    await db.flush()
    await replace_role_permissions(db, role.id, payload.permission_codes)
    await db.commit()
    refreshed = await db.get(Role, role.id)
    assert refreshed is not None
    return refreshed


async def replace_role_permissions(
    db: AsyncSession, role_id: int, permission_codes: list[str]
) -> None:
    await db.execute(delete(RolePermission).where(RolePermission.role_id == role_id))
    for code in dict.fromkeys(permission_codes):
        item = PERMISSION_BY_CODE.get(code)
        if item:
            db.add(
                RolePermission(
                    role_id=role_id,
                    permission_code=code,
                    permission_type=item["type"],
                )
            )


async def set_role_permissions(db: AsyncSession, role: Role, codes: list[str]) -> Role:
    await replace_role_permissions(db, role.id, codes)
    await db.commit()
    refreshed = await db.get(Role, role.id)
    assert refreshed is not None
    return refreshed
