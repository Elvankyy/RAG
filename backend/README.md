# 知识库管理平台 · 后端

FastAPI + SQLAlchemy 异步 + PostgreSQL（本地默认 SQLite）。已完成 **M01–M06**：认证与 RBAC、组织架构、知识单元与导入、四维数据权限、AI 鉴权问答、数据看板与知识沉淀。

## 快速开始

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

- API 文档：http://127.0.0.1:8000/docs
- 健康检查：`GET /health`、`GET /ready`
- 默认 SQLite：`backend/data/app.db`，首次启动自动建表并写入示例数据（组织、用户、5 个知识单元）。
- 若端口 8000 被占用，改用 `--port 8010`。

### 使用 PostgreSQL

```bash
DATABASE_URL=postgresql+asyncpg://kb:kb_password@localhost:5432/kb \
uv run uvicorn app.main:app --port 8000
```

Compose 方式：

```bash
cd deploy
docker compose up -d                    # PostgreSQL + Redis + 后端
docker compose --profile full up -d     # 含 MongoDB / MinIO / etcd / Milvus
```

## 示例账号

| 角色 | 用户名 | 密码 | 权限 |
|---|---|---|---|
| 系统管理员 | `admin` | `Admin@123` | 全部菜单与操作 |
| 知识管理员 | `km` | `Km@12345` | 知识维护、沉淀、看板；组织只读 |
| 普通用户 | `alice` | `User@123` | AI 对话、个人中心 |

另有 `bob`、`carol`、`david`、`emma`（密码均为 `User@123`），用于角色、部门与数据权限演示。

## 配置

复制 `.env.example` 为 `.env`（根目录或 `backend/`，根目录优先）：

| 变量 | 默认 | 说明 |
|---|---|---|
| `DATABASE_URL` | SQLite | `sqlite+aiosqlite:///...` 或 `postgresql+asyncpg://...` |
| `AUTO_SEED` | `true` | 用户表为空时写入示例数据 |
| `JWT_SECRET` | demo 值 | 生产必须替换，长度 ≥ 32 字节 |
| `ACCESS_TOKEN_MINUTES` | 120 | Access token 有效期 |
| `REFRESH_TOKEN_DAYS` | 7 | Refresh token 有效期，刷新时轮换 |
| `LLM_ENABLED` | `false` | 开启后走 OpenAI 兼容网关；默认本地抽取式回答 |
| `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` | — | 远程模型配置 |
| `RECALL_TOP_K` | 8 | 召回数量 |
| `RETRIEVAL_MIN_SCORE` | 0.2 | 逐命中阈值，低于该分数视为未命中 |

## 接口

### 认证

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/login` | 登录，返回 access/refresh、用户与权限 |
| POST | `/api/auth/refresh` | 刷新并轮换 refresh token |
| POST | `/api/auth/logout` | 吊销 refresh token |
| GET | `/api/auth/me` | 当前用户、部门、角色、权限 |
| PUT | `/api/auth/password` | 修改密码，使旧 access 失效 |

### 组织

`GET/POST/PUT/DELETE /api/org/departments`、`GET/POST/PUT/DELETE /api/org/users`、`POST /api/org/users/{id}/reset-password|status`、`GET/POST/PUT/DELETE /api/org/roles`、`GET /api/org/permissions`、`POST /api/org/roles/{id}/permissions`。

### 知识

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/knowledge/categories` | 分类统计 |
| GET | `/api/knowledge/units` | 分页、关键词、分类、状态；非管理员按 ACL 过滤 |
| POST | `/api/knowledge/units` | 手工创建知识单元 |
| GET/PUT/DELETE | `/api/knowledge/units/{id}`、`/api/knowledge/units` | 详情 / 更新（递增版本） / 批量删除 |
| GET/POST | `/api/knowledge/units/{id}/permissions` | 四维数据权限 |
| GET | `/api/knowledge/units/{id}/versions` | 版本列表 |
| POST | `/api/knowledge/units/{id}/versions/{v}/rollback` | 回滚版本 |
| POST | `/api/knowledge/units/{id}/reindex` | 重建切片与向量 |
| POST | `/api/knowledge/import` | 多文件上传（PDF / DOCX / MD / TXT） |
| GET | `/api/knowledge/import/batches/{id}` | 批次与任务状态 |
| POST | `/api/knowledge/import/tasks/{id}/retry` | 失败重试 |
| POST | `/api/knowledge/check-permissions` | 批量鉴权：授权 / 未授权 ID |

### AI 问答

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/ai/chat/stream` | SSE：`meta → delta* → usage → done` |
| GET | `/api/ai/sessions` | 本人会话列表 |
| GET | `/api/ai/sessions/{id}/messages` | 会话消息 |
| DELETE | `/api/ai/sessions/{id}` | 删除会话 |

### 看板与沉淀

`GET /api/dashboard/metrics|rankings/questions|rankings/units|stats/tokens`；`GET /api/settlement/summary|faqs/recommendations|faqs|knowledge-gaps`，`POST /api/settlement/faqs`、`/faqs/{id}/review|offline`、`/knowledge-gaps/{id}/resolve|ignore|create-unit`。

## 测试

```bash
cd backend
uv run pytest -q
```

当前 **36 项**测试覆盖：

- M01：健康检查、种子数据、登录、refresh 轮换与重放、登出、改密、禁用账号、角色权限。
- M02：部门/用户/角色 CRUD、删除保护、重置密码、RBAC 读写分离。
- M03：知识单元 CRUD、版本/回滚、四维权限保存、MD/TXT/DOCX 导入、失败重试、分类筛选。
- M04：四维权限 OR 逻辑、祖先部门、默认拒绝、列表/详情 ACL 过滤、越权读取 403。
- M05：SSE 事件序列、引用卡片数据、未授权内容不泄露、无命中缺口、会话删除、`ai:access` 校验。
- M06：FAQ 挖掘/审核/缓存命中、FAQ ACL、知识缺口建档/忽略、看板指标/排行/趋势。

## 当前实现边界

- 向量检索：使用 `unit_chunks.embedding_json` + 本地哈希 embedding；接口分层已隔离，后续可替换为 Milvus 适配器。
- 导入：同步处理，批次/任务模型与前端进度结构已就绪，后续可切 Celery。
- FAQ 缓存：以数据库状态模拟，命中逻辑已实现 ACL 校验；后续可接 Redis。
- 会话消息：当前存 PostgreSQL `chat_messages`；需求文档规划 Mongo，后续替换 repository 实现即可。
- 未接入：Milvus、Celery、Redis、Mongo、MinIO、MinerU。

## 目录

```
backend/
├─ app/
│  ├─ main.py            # 应用装配、CORS、lifespan
│  ├─ seed.py            # 示例组织、用户与知识单元
│  ├─ core/              # 配置、数据库、模型、安全、RBAC、依赖、健康检查
│  ├─ auth/              # 登录/刷新/登出/me/改密
│  ├─ org/               # 部门、用户、角色
│  ├─ knowledge/         # 解析、切片、嵌入、CRUD、版本、导入
│  ├─ permissions/       # 四维权限引擎
│  ├─ ai/                # 召回、LLM、SSE 问答
│  ├─ dashboard/         # 指标、排行、趋势
│  └─ settlement/        # FAQ 挖掘/审核、知识缺口
├─ tests/                # pytest + httpx ASGI
├─ pyproject.toml
├─ Dockerfile
└─ .env.example
```

## 前端联调

```bash
# 前端
cd frontend
VITE_USE_MOCK=false VITE_API_BASE_URL=http://127.0.0.1:8000 npm run dev
```

后端需在 `CORS_ORIGINS` 中包含前端地址。
