# 知识库管理平台 · 前端

Vue 3 + TypeScript + Vite + Element Plus 的后台前端。当前已完成 **12 个路由页 + 403/404 兜底**：登录、个人中心、AI 对话、知识导入、知识单元列表/详情、用户/角色/部门、数据看板、FAQ 管理、知识缺口。全部接口由 MSW 模拟，可直接切换到真实后端。

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | Vue 3.5 + TypeScript |
| 构建 | Vite 8 |
| 路由 | Vue Router |
| 状态 | Pinia |
| UI | Element Plus + @element-plus/icons-vue |
| 请求 | Axios |
| Mock | MSW 3（Service Worker） |
| 辅助 | dayjs、markdown-it、DOMPurify、ECharts、@microsoft/fetch-event-source（后续页面使用） |

## 快速开始

```bash
cd frontend
npm install
npm run dev
```

默认 `VITE_USE_MOCK=true`，MSW 会拦截 `/api/*`，无需后端即可登录。Vite 默认端口 5173，被占用时自动顺延（如 5174）。

```bash
npm run build       # vue-tsc 类型检查 + 生产构建
npm run preview     # 预览构建产物
npm run e2e:smoke       # 登录/权限冒烟
npm run e2e:chat        # AI 对话
npm run e2e:knowledge   # 知识维护
npm run e2e:org         # 组织架构
npm run e2e:dashboard   # 数据看板
npm run e2e:settlement  # 知识沉淀
npm run e2e:all         # Mock 模式全量 42 项
npm run e2e:live        # 真实后端联调（需先启动后端与 VITE_USE_MOCK=false 的 5175 前端）
```

## 演示账号

| 角色 | 用户名 | 密码 | 可见菜单 |
|---|---|---|---|
| 系统管理员 | `admin` | `Admin@123` | 全部 |
| 知识管理员 | `km` | `Km@12345` | AI、看板、知识维护、知识沉淀 |
| 普通用户 | `alice` | `User@123` | AI 对话、个人中心 |

Mock 数据位于 `src/mocks/data.ts`；登录接口会签发 `mock-token.<username>` 并写入 `localStorage` 的 `kb_token`。

## 已实现

- 登录页：表单校验、记住用户名、演示账号点击填充、错误提示、登录后跳转 `redirect`。
- 应用外壳：232px 深色侧边栏、顶栏面包屑、全局搜索占位、通知与头像下拉。
- 动态菜单：按 `menu:*` 权限过滤；路由守卫同时校验 `menu:*` 与动作权限，不足跳 `/403`。
- 会话恢复：刷新后读取 token，调用 `GET /api/auth/me` 恢复用户与权限；401 自动回登录页。
- 个人中心：用户信息、角色、权限统计、修改密码（修改成功后强制重新登录）。
- 兜底页：403（布局内）与 404（独立页）。
- AI 对话：会话列表、SSE 流式、Markdown、引用卡片、未授权数量提示、停止生成、FAQ 命中标识。
- 知识维护：导入（拖拽/目录/进度/重试）、知识单元列表（筛选/分页/批量删除/新建）、详情（正文编辑、四维权限、版本回滚、重建索引）。
- 组织架构：用户 CRUD/重置密码/启停用、角色与权限树、部门树与成员。
- 数据看板：指标卡、ECharts 访问/Token 趋势、响应分布、问题与单元排行。
- 知识沉淀：FAQ 推荐审核、已发布库、手动新建、下线/删除；知识缺口聚类列表、一键建档、解决/忽略。
- MSW：登录、当前用户、登出、修改密码。

## 目录结构

```
frontend/
├─ src/
│  ├─ api/            # http 实例、auth 接口
│  ├─ components/     # AppSidebar、AppTopbar、PagePlaceholder
│  ├─ config/         # 菜单配置
│  ├─ layouts/        # AppLayout
│  ├─ mocks/          # MSW browser、handlers、mock 数据
│  ├─ router/         # 路由与守卫
│  ├─ stores/         # auth store
│  ├─ styles/         # tokens、base、Element Plus 覆盖
│  ├─ types/          # 接口类型、RouteMeta 扩展
│  ├─ utils/          # token 存取
│  └─ views/          # 登录、个人中心、占位页、403/404
├─ scripts/
│  └─ e2e-smoke.mjs   # Playwright-core + 本机 Chrome 冒烟测试
├─ public/
│  └─ mockServiceWorker.js
├─ .env.development
└─ .env.example
```

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `VITE_API_BASE_URL` | 空 | 后端地址；为空时同源请求，MSW 可直接拦截 |
| `VITE_USE_MOCK` | `true` | 开发环境是否启用 MSW |
| `VITE_APP_TITLE` | 知识库管理平台 | 页面标题前缀 |

## 真实后端联调

```bash
# 终端 1
cd backend && uv run uvicorn app.main:app --port 8010 --reload

# 终端 2
cd frontend
VITE_USE_MOCK=false VITE_API_BASE_URL=http://127.0.0.1:8010 npm run dev -- --port 5175

# 终端 3
cd frontend && npm run e2e:live
```

后端 `CORS_ORIGINS` 需包含前端地址。联调覆盖登录、SSE 问答、知识单元、看板与组织三页。

## 接口对齐

| 页面 | 接口 |
|---|---|
| 登录 | `POST /api/auth/login` |
| 会话恢复 | `GET /api/auth/me` |
| 登出 | `POST /api/auth/logout` |
| 修改密码 | `PUT /api/auth/password` |
| 占位页 | 见各路由 `meta.apiHint`，与 `docs/需求文档.md` 第 11 章一致 |

## 冒烟测试

```bash
npm run e2e:smoke
```

脚本会验证：

1. 知识管理员登录并进入 `/chat`；
2. 访问 `/org/users` 被重定向到 `/403`；
3. 退出登录回到 `/login`；
4. 系统管理员可打开 `/org/users`；
5. 退出后登录页正常渲染。

截图输出到 `frontend/artifacts/`（已加入 `.gitignore`）。可用环境变量覆盖：`BASE_URL`、`CHROME_PATH`。

## 待实现（M07 后续）

- 知识导入：拖拽/目录上传、进度轮询或 SSE、失败重试。
- 知识单元列表与详情：筛选分页、版本、附件、四维权限表单。
- 组织三页：用户/角色/部门。
- 数据看板：指标卡、排行榜、ECharts 趋势与分布。
- 知识沉淀：FAQ 推荐审核、已发布库、知识缺口。
- 全量 MSW handlers 与分页/筛选参数模拟。

原型与设计规范见 `docs/design/README.md`。
