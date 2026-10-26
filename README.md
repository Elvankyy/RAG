# 知识库管理平台

依据 `PRD.md` 2.9 建设的知识库管理平台：知识导入与版本、组织与四维数据权限、AI 鉴权检索问答、数据看板、FAQ 与知识缺口沉淀。

## 当前进度

| 阶段 | 状态 | 产物 |
|---|---|---|
| 需求与技术框架 | 已完成 v1.2 | `docs/需求文档.md` |
| 前端原型（pen.dev） | 已完成 13 屏 | `docs/design/frontend-prototype.html`、`docs/design/screens/` |
| 前端 12 页 | 已完成 | `frontend/`（Vue 3 + TS + Element Plus + MSW + ECharts，42 项 E2E 通过） |
| 后端 M01–M06 | 已完成 | FastAPI + JWT + 四维权限 + 问答 + 看板 + 沉淀；pytest 36/36 |
| 前端 M07 / 交付 M08 | 已完成 | 12 页、示例数据、Mock/真实联调、验收与部署文档 |
| 前后端联调 | 已完成 | `npm run e2e:live` 8/8 |
| 验收与接口文档 | 已完成 | `docs/验收报告.md`、`docs/接口说明.md` |

## 目录

```
RAG/
├─ PRD.md                  # 原始需求
├─ docs/
│  ├─ 需求文档.md          # 技术选型、架构、存储、权限、接口、M01–M08
│  ├─ 接口说明.md          # 认证、组织、知识、AI、看板、沉淀接口
│  ├─ 验收报告.md          # PRD 2.9.11 对照与验证结果
│  ├─ 开发进度.md          # 模块进度与变更记录
│  ├─ 演示操作手册.md      # 15–20 分钟演示脚本与预期结果
│  ├─ skills.md            # Claude Code skill 来源与许可证
│  └─ design/              # pen 原型、设计规范、逐屏截图
├─ backend/                # FastAPI 后端（M01–M06）
├─ frontend/               # Vue 3 前端（12 路由页 + MSW + E2E）
├─ demo-files/             # 演示用文档（Markdown/TXT/Word）
├─ deploy/                 # Docker Compose 与部署说明
└─ .claude/skills/         # 可选加载的工程 skill 包
```

## 快速开始

### 1. 后端

```bash
cd backend
uv sync
uv run uvicorn app.main:app --port 8010 --reload
```

- API 文档：http://127.0.0.1:8010/docs
- 首次启动自动建表并写入示例组织、用户与 5 个知识单元。
- 默认 SQLite；使用 PostgreSQL 时设置 `DATABASE_URL=postgresql+asyncpg://...`。

### 2. 前端（Mock 模式）

```bash
cd frontend
npm install
npm run dev
```

Mock 模式无需后端，使用 MSW 返回所有接口数据。

### 3. 前端（真实后端）

```bash
cd frontend
VITE_USE_MOCK=false VITE_API_BASE_URL=http://127.0.0.1:8010 npm run dev -- --port 5175
```

### 演示账号

| 角色 | 用户名 | 密码 |
|---|---|---|
| 系统管理员 | `admin` | `Admin@123` |
| 知识管理员 | `km` | `Km@12345` |
| 普通用户 | `alice` | `User@123` |

## 测试

```bash
cd backend && uv run pytest -q        # 36 项
cd frontend && npm run e2e:all        # Mock 模式 42 项
cd frontend && npm run e2e:live       # 真实后端 8 项（需先启动后端与 5175 前端）
```

## 文档

- 需求与技术框架：[docs/需求文档.md](docs/需求文档.md)
- 接口说明：[docs/接口说明.md](docs/接口说明.md)
- 演示操作手册：[docs/演示操作手册.md](docs/演示操作手册.md)
- 验收报告：[docs/验收报告.md](docs/验收报告.md)
- 开发进度：[docs/开发进度.md](docs/开发进度.md)
- 设计规范与页面映射：[docs/design/README.md](docs/design/README.md)
- 前端说明：[frontend/README.md](frontend/README.md)
- 后端说明：[backend/README.md](backend/README.md)
- 部署说明：[deploy/README.md](deploy/README.md)

## 当前边界

向量检索、导入任务、FAQ 缓存、会话消息目前分别使用数据库 / 同步处理 / DB 状态 / PostgreSQL 实现；Milvus、Celery、Redis、MongoDB、MinIO 已在需求与 Compose 中预留，尚未接入代码。详见 [docs/验收报告.md](docs/验收报告.md) 第 4 节。

## 安全约定

- `.env` 不入库；只提交 `.env.example`。
- 后端密钥、数据库口令通过环境变量注入，日志不打印密钥。
- 未授权知识内容不进入 Prompt、SSE 或引用；只返回未授权数量。
