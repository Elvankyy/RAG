from __future__ import annotations

from pydantic import BaseModel, Field


class DepartmentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    parent_id: int | None = None
    leader_id: int | None = None
    sort_order: int = 0


class DepartmentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=64)
    parent_id: int | None = None
    leader_id: int | None = None
    sort_order: int | None = None


class UserCreate(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    password: str = Field(min_length=6, max_length=64)
    display_name: str = Field(min_length=1, max_length=64)
    department_id: int | None = None
    role_ids: list[int] = Field(default_factory=list)
    status: str = "active"


class UserUpdate(BaseModel):
    display_name: str | None = None
    department_id: int | None = None
    role_ids: list[int] | None = None
    status: str | None = None


class ResetPasswordRequest(BaseModel):
    new_password: str = Field(min_length=6, max_length=64)


class UserStatusRequest(BaseModel):
    status: str = Field(pattern="^(active|disabled)$")


class RoleCreate(BaseModel):
    role_name: str = Field(min_length=1, max_length=64)
    role_code: str = Field(pattern="^[a-z][a-z0-9_]*$", max_length=64)
    description: str = ""
    permission_codes: list[str] = Field(default_factory=list)


class RoleUpdate(BaseModel):
    role_name: str | None = None
    description: str | None = None


class RolePermissionUpdate(BaseModel):
    permission_codes: list[str] = Field(default_factory=list)
