from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.ai.router import router as ai_router
from app.auth.router import router as auth_router
from app.dashboard.router import router as dashboard_router
from app.core.config import settings
from app.core.database import init_db
from app.core.health import router as health_router
from app.knowledge.router import router as knowledge_router
from app.org.router import router as org_router
from app.settlement.router import router as settlement_router
from app.seed import seed


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await init_db()
    if settings.auto_seed:
        await seed()
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="知识库管理平台：认证、组织权限、知识维护、AI 鉴权问答、看板与知识沉淀",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(org_router)
app.include_router(knowledge_router)
app.include_router(ai_router)
app.include_router(dashboard_router)
app.include_router(settlement_router)


@app.get("/")
async def root() -> dict:
    return {
        "name": settings.app_name,
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/health",
    }
