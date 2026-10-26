# Skill 包清单与来源

| 项目 | 内容 |
|---|---|
| 安装日期 | 2026-10-24 |
| 安装路径 | `C:\AIcoding\RAG\.claude\skills\` |
| 许可证目录 | `.claude/skills/_licenses/` |
| 审查结论 | 未发现凭据读取、破坏性命令、数据外发或可执行脚本；仅复制 Markdown 文本 |
| 来源仓库 | `Mindrally/skills`（Apache-2.0，commit `7682ca77710e0971eab4e0ae5dddfa281aea0ba5`）<br>`yonatangross/orchestkit`（MIT，commit `b0fb57387a6f532c94a6622677a6f60340e95629`） |

## 已安装

| Skill | 来源 | 原路径 | 许可证 | 文件数 | 用途 | 备注 |
|---|---|---|---|---|---|---|
| `fastapi-python` | Mindrally/skills | `fastapi-python/` | Apache-2.0 | 1 | FastAPI 异步 API、依赖注入、路由与错误处理 | 规范类，无脚本 |
| `python-uv` | Mindrally/skills | `python-uv/` | Apache-2.0 | 1 | uv 依赖管理与锁文件 | 与现有 Python 3.12 + uv 一致 |
| `postgresql-best-practices` | Mindrally/skills | `postgresql-best-practices/` | Apache-2.0 | 1 | 表设计、索引、查询优化 | 以需求文档的 schema 为准 |
| `security-best-practices` | Mindrally/skills | `security-best-practices/` | Apache-2.0 | 1 | 输入校验、认证、密钥、上传安全 | 与 JWT/上传安全要求配合 |
| `jwt-security` | Mindrally/skills | `jwt-security/` | Apache-2.0 | 1 | JWT 签发/校验/吊销/刷新 | 与 `users.token_version` 设计配合 |
| `python-testing` | Mindrally/skills | `python-testing/` | Apache-2.0 | 1 | pytest / TDD | 用于单测与权限真值表 |
| `playwright` | Mindrally/skills | `playwright/` | Apache-2.0 | 1 | 前端 E2E | 用于 12 页主链路 |
| `docker` | Mindrally/skills | `docker/` | Apache-2.0 | 1 | Dockerfile / Compose | 用于交付编排 |
| `vue-typescript` | Mindrally/skills | `vue-typescript/` | Apache-2.0 | 1 | Vue 3 + TS + Vite + Pinia + Element Plus | 文中提到 Tailwind，本项目不引入；以 Element Plus 与需求文档为准 |
| `rag-retrieval` | yonatangross/orchestkit | `plugins/ork/skills/rag-retrieval/` | MIT | 31 | 混合检索、RRF、HyDE、rerank、评测、pgvector | 参考型：`user-invocable: false`、`disable-model-invocation: true`；pgvector 规则仅参考，本项目用 Milvus；含 30 个 `rules/` 文件 |

## 未安装项与原因

| 候选 | 原因 |
|---|---|
| `bare-eval`（orchestkit） | 实际是 Claude Code skill 评测工具，不是 RAG 召回/答案质量评测；`SKILL.md` 引用的 `tests/evals/scripts/*` 未随 skill 目录提供，安装会得到不完整技能，故不安装。 |
| `ThamJiaHe/claude-code-handbook` 66 skills | main 分支 `skills/` 下只有 `examples`，未找到实际 `SKILL.md` 目录，无法按计划下载；仅作参考。 |
| `jezweb/claude-skills`（MIT） | 作为备选未使用；当前 Mindrally + orchestkit 已覆盖框架所需。 |
| `anthropics/skills`（官方） | 仓库未检测到 SPDX 许可证（license 为 None），未复制，避免许可证不明。 |

## 许可证合规

- `_licenses/Mindrally-skills-LICENSE`：Apache-2.0 原文。
- `_licenses/orchestkit-LICENSE`：MIT 原文。
- 未修改 skill 内容；目录名、`SKILL.md`、`rules/` 保持原样。
- 若后续修改某个 skill，需在该 skill 目录或本文件中记录修改说明，并保留原版权与许可声明。

## 安全审查记录

- 已安装 skill 中**没有非 Markdown 可执行文件**（无 `.sh`、`.mjs`、`.py`、hooks、plugins）。
- 未发现：`rm -rf`、`sudo`、`chmod +x`、`~/.ssh`、密钥读取、数据外发、`ignore previous instructions` 等指令。
- `rag-retrieval` 的规则中有图片 base64 编码示例，属于 RAG 多模态说明，不是可执行脚本。
- 未执行下载包中的任何代码；仅通过 GitHub raw 下载文本并复制。
- `rag-retrieval` 的 frontmatter 禁用了自动/手动调用，当前作为参考文档使用；如需自动触发，可删除 `user-invocable: false` 与 `disable-model-invocation: true` 两行（修改需记录）。

## 使用方式

- Claude Code 会自动发现项目内 `.claude/skills/*/SKILL.md`，按 description 在相关任务中加载。
- `rag-retrieval` 为参考型技能：需要时直接阅读 `.claude/skills/rag-retrieval/SKILL.md` 与 `rules/`。
- 与需求文档冲突时，以 `docs/需求文档.md` 为准（例如：Milvus 而非 pgvector；Element Plus 而非 Tailwind；8 个开发模块、12 个前端路由页）。

## 更新方式

1. 固定来源仓库的新 commit SHA。
2. 下载对应 skill 目录（保留 `rules/`、`references/`）。
3. 重新做安全审查与许可证检查。
4. 更新本文件的来源、commit、文件数与审查结论。
