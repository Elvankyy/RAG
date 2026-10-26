# 前端原型（pen.dev）

| 项目 | 内容 |
|---|---|
| 设计工具 | pen.dev（VS Code 扩展 `highagency.pencildev`） |
| 画布文档 | `C:\Users\52418\.pencil\documents\2552e3d7-1e1b-47a8-b501-dd652cb3f878\untitled.pen` |
| 画布尺寸 | 每屏 1440 × 900，桌面端 |
| 设计变量 | 颜色/字体定义在 `.pen` 文档变量中（primary、surface、border、sidebar 等） |
| 导出文件 | `frontend-prototype.html`（Tailwind CDN）、`frontend-prototype-css.html`（纯 CSS，离线可看）、`screens/*.png`（逐屏 2x） |
| 对齐依据 | `docs/需求文档.md` v1.2（接口、字段、权限码） |

> `.pen` 文件由 pen.dev 托管，直接在 pen.dev / VS Code 中打开上述路径即可继续编辑；导出的 HTML 与 PNG 是只读快照。

## 页面与接口映射

| # | 页面 | 截图 | 路由 | 主要接口 |
|---|---|---|---|---|
| 1 | 登录 | `screens/01-login.png` | `/login` | `POST /api/auth/login` |
| 2 | 个人中心 | `screens/02-profile.png` | `/profile` | `GET /api/auth/me`、`PUT /api/auth/password`、`POST /api/auth/logout` |
| 3 | AI 对话工作台 | `screens/03-ai-chat.png` | `/chat` | `POST /api/ai/chat/stream`（SSE：`meta/delta/usage/done`）、`GET /api/ai/sessions` |
| 4 | 知识导入 | `screens/04-knowledge-import.png` | `/knowledge/import` | `POST /api/knowledge/import`、`GET /api/knowledge/import/batches/{id}`、`GET /api/knowledge/import/tasks/{id}/events`、`POST /api/knowledge/import/tasks/{id}/retry` |
| 5 | 知识单元列表 | `screens/05-knowledge-units.png` | `/knowledge/units` | `GET /api/knowledge/units`、`GET /api/knowledge/categories` |
| 6 | 知识单元详情 | `screens/06-unit-detail.png` | `/knowledge/units/:id` | `GET /api/knowledge/units/{id}`、`POST /api/knowledge/units/{id}/permissions`、`POST /api/knowledge/units/{id}/reindex`、`GET /api/knowledge/units/{id}/versions` |
| 7 | 用户管理 | `screens/07-org-users.png` | `/org/users` | `GET/POST /api/org/users`、`PUT/DELETE /api/org/users/{id}`、`POST /api/org/users/{id}/reset-password`、`POST /api/org/users/{id}/status` |
| 8 | 角色管理 | `screens/08-org-roles.png` | `/org/roles` | `GET /api/org/roles`、`POST /api/org/roles/{id}/permissions`、`GET /api/org/permissions` |
| 9 | 部门管理 | `screens/09-org-departments.png` | `/org/departments` | `GET /api/org/departments`、`POST/PUT/DELETE /api/org/departments[/{id}]` |
| 10 | 数据看板 | `screens/10-dashboard.png` | `/dashboard` | `GET /api/dashboard/metrics`、`/rankings/questions`、`/rankings/units`、`/stats/tokens` |
| 11 | FAQ 管理 | `screens/11-faq-review.png` | `/settlement/faqs` | `GET /api/settlement/faqs/recommendations`、`POST /api/settlement/faqs/{id}/review`、`POST /api/settlement/faqs/{id}/offline` |
| 12 | 知识缺口 | `screens/12-knowledge-gaps.png` | `/settlement/gaps` | `GET /api/settlement/knowledge-gaps`、`POST /api/settlement/knowledge-gaps/{id}/create-unit|resolve|ignore` |
| 13 | 403 / 404 | `screens/13-403-404.png` | `/403`、`/404` | 兜底页，无接口 |

## 设计要点

- **统一外壳**：深色侧边栏（232px）+ 顶栏（面包屑、搜索、通知、头像）+ 内容区（28px 内边距）。侧边栏按角色动态渲染：普通用户只显示 AI 对话与个人中心。
- **权限可见性**：菜单项由 `menu:*` 控制；按钮（导入、保存权限、审核、启停用）由动作权限控制；未授权页面跳 403。
- **四维权限**：单元详情页内的权限表单展示全局 / 部门 / 角色 / 个人四类实体，混合勾选、Chip 可移除，保存后提示“立即生效并异步同步至 Milvus”。
- **未授权提示**：AI 对话中只展示“2 个相关知识单元因权限限制未展示”，不显示标题、编号或正文，与需求文档的 `PERMISSION_NOTICE_LEVEL=count` 一致。
- **FAQ 缓存**：审核页展示“FAQ ACL · 继承关联单元（取交集）”，并提示命中缓存仍会校验当前用户权限。
- **字段对齐**：列表与详情直接使用接口字段语义，如 `unit_code`、`permission_summary`、`unauthorized_count`、`citations[]`、`recommend_count`、`ask_count`、`last_asked_at`、`cache_status`。
- **视觉规范**：正文 Noto Sans SC，数字 Inter；主色 `#2563EB`，成功 `#12B76A`，警告 `#F79009`，危险 `#F04438`，紫色 `#7C5CFC`；卡片圆角 10–12px，弱边框 `#E4E8F0`。

## 使用方式

- 查看全部页面：浏览器打开 `docs/design/frontend-prototype.html`（需联网加载 Tailwind CDN）或 `docs/design/frontend-prototype-css.html`（离线可用）。
- 单页查看：`docs/design/screens/` 下的 PNG。
- 继续编辑：在 pen.dev 或 VS Code 中打开画布文档路径；修改后重新执行 `Export` 覆盖 HTML/PNG。
- 与后端联调时，以接口清单为准；原型中的演示数据仅用于展示字段结构。

## 不在原型范围

- 移动端适配、暗色主题；
- 弹窗类交互（权限选择弹窗、新增用户弹窗）的独立画面；
- 真实图表库渲染（原型用布局绘制柱状图与分布条）；
- 空状态、加载骨架、错误 Toast 的完整状态矩阵。
