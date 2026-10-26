from __future__ import annotations

from pydantic import BaseModel, Field


class PermissionItem(BaseModel):
    target_type: str = Field(pattern="^(global|department|role|user)$")
    target_id: int | None = None


class UnitCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1)
    category: str = ""
    tags: str = ""
    permissions: list[PermissionItem] = Field(default_factory=list)


class UnitUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    category: str | None = None
    tags: str | None = None
    status: str | None = None


class PermissionPayload(BaseModel):
    permissions: list[PermissionItem] = Field(default_factory=list)


class BatchDeletePayload(BaseModel):
    ids: list[int] = Field(default_factory=list)


class CheckPermissionPayload(BaseModel):
    user_id: int | None = None
    unit_ids: list[int] = Field(default_factory=list)
