# 部署说明

## 服务清单

| 服务 | 说明 | 默认端口 |
|---|---|---|
| `postgres` | PostgreSQL 16，系统事实源 | 5432 |
| `redis` | 缓存与 Celery broker（当前仅预留） | 6379 |
| `backend` | FastAPI 后端 | 8000 |
| `mongo`（profile full） | 会话消息（当前未接入） | 27017 |
| `minio`（profile full） | 对象存储（当前未接入） | 9000 / 9001 |
| `etcd`（profile full） | Milvus 元数据 | 2379 |
| `milvus`（profile full） | 向量库（当前未接入） | 19530 / 9091 |

## 启动

```bash
cd deploy
cp .env.example .env
docker compose up -d
```

默认只启动 PostgreSQL、Redis 与后端。首次启动后端会建表并写入示例数据。

完整依赖：

```bash
docker compose --profile full up -d
```

## 校验

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/ready
```

前端联调时，将前端 `VITE_API_BASE_URL` 指向 `http://127.0.0.1:8000`，并在 `CORS_ORIGINS` 中加入前端地址。

## 配置

| 变量 | 默认 | 说明 |
|---|---|---|
| `JWT_SECRET` | demo 值 | 生产必须替换 |
| `CORS_ORIGINS` | 本地前端 | 逗号分隔 |

## 说明

- 镜像版本以 `docker-compose.yml` 为准；Milvus 建议固定经过验证的 2.5.x 版本。
- `full` profile 中的 Mongo/MinIO/etcd/Milvus 目前为后续模块预留，后端代码尚未连接。
- 生产部署时应使用 secrets 管理密钥，并限制 PostgreSQL/Redis 端口仅内网访问。
