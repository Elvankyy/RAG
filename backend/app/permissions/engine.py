from __future__ import annotations

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Department, UnitPermission, User


async def ancestor_department_ids(db: AsyncSession, department_id: int | None) -> set[int]:
    ids: set[int] = set()
    current = department_id
    while current and current not in ids:
        ids.add(current)
        department = await db.get(Department, current)
        current = department.parent_id if department else None
    return ids


async def user_subject(db: AsyncSession, user: User) -> dict:
    department_ids = await ancestor_department_ids(db, user.department_id)
    return {
        "user_id": user.id,
        "department_ids": department_ids,
        "role_ids": {role.id for role in user.roles},
    }


async def authorized_unit_ids(db: AsyncSession, user: User) -> list[int]:
    subject = await user_subject(db, user)
    conditions = [UnitPermission.target_type == "global"]
    if subject["department_ids"]:
        conditions.append(
            and_(
                UnitPermission.target_type == "department",
                UnitPermission.target_id.in_(subject["department_ids"]),
            )
        )
    if subject["role_ids"]:
        conditions.append(
            and_(
                UnitPermission.target_type == "role",
                UnitPermission.target_id.in_(subject["role_ids"]),
            )
        )
    conditions.append(
        and_(
            UnitPermission.target_type == "user",
            UnitPermission.target_id == subject["user_id"],
        )
    )
    rows = await db.scalars(select(UnitPermission.unit_id).where(or_(*conditions)).distinct())
    return sorted(set(rows.all()))


async def check_access(
    db: AsyncSession, user: User, unit_ids: list[int]
) -> tuple[list[int], list[int]]:
    unique_ids = list(dict.fromkeys(unit_ids))
    allowed = set(await authorized_unit_ids(db, user))
    authorized = [unit_id for unit_id in unique_ids if unit_id in allowed]
    unauthorized = [unit_id for unit_id in unique_ids if unit_id not in allowed]
    return authorized, unauthorized
