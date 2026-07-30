# 01 · 系统架构总览

## 1.1 服务拓扑

单个 `make dev` / Docker 栈启动四个协作服务：

| 服务 | 端口 | 职责 |
| --- | --- | --- |
| **Nginx** | `2026` | 唯一公开入口。反代前端 + 后端，统一同源 |
| **Gateway API** | `8001` | FastAPI REST 路由 + 内嵌 LangGraph 兼容 Agent 运行时 |
| **Frontend** | `3000` | Next.js 16 Web 界面（本目录的主题） |
| **Provisioner** | `8002` | 可选，仅当 sandbox 配置为 provisioner/K8s 模式时启动 |

```
                    ┌──────────────────────────────────────┐
   浏览器 ──────────▶│         Nginx  :2026                 │
                    │  （唯一入口，同源，SSE 不缓冲）        │
                    └───────┬──────────────────────┬───────┘
                            │                      │
              /api/langgraph/*                     │  其余路径
              /api/*（REST）                        │
                            ▼                      ▼
                 ┌────────────────────┐   ┌──────────────────┐
                 │  Gateway  :8001    │   │ Next.js  :3000   │
                 │  FastAPI + 运行时   │   │ App Router SSR   │
                 └─────────┬──────────┘   └──────────────────┘
                           │
                    lead_agent（LangGraph）
                           ├── Subagents（后台委派执行）
                           ├── Tools / Skills / MCP
                           ├── Memory（持久记忆）
                           └── Sandbox（按 thread 隔离的执行环境）
```

## 1.2 两条请求通道

前端对后端只有两种调用方式，必须区分清楚：

### 通道 A · LangGraph SDK（流式会话）

- 客户端：`@langchain/langgraph-sdk` 的 `Client`，单例，经 `getAPIClient()` 获取
  （[core/api/api-client.ts](../frontend/src/core/api/api-client.ts)）。
- Base URL：`getLangGraphBaseURL()`（[core/config/index.ts](../frontend/src/core/config/index.ts)）
  → 默认 `${origin}/api/langgraph`。
- Nginx 把 `/api/langgraph/*` **重写**为 Gateway 原生的 `/api/*` 后转发。
- 承载：thread CRUD、`runs.stream` / `runs.joinStream`（SSE）、`threads.getState`、
  `threads.search`、`runs.cancel`。

### 通道 B · 直接 REST（`fetchWithAuth`）

- 客户端：[core/api/fetcher.ts](../frontend/src/core/api/fetcher.ts) 导出的 `fetch`
  包装（惯用别名 `fetchWithAuth`）。
- Base URL：`getBackendBaseURL()`，默认返回空串 → 走同源相对路径 `/api/...`。
- 承载：models、skills、mcp、memory、uploads、artifacts、agents、channels、
  integrations、scheduled-tasks、features、suggestions、token-usage、compact、
  branches、goal、feedback 等全部非流式能力。

> **重构注意**：两条通道的 CSRF 注入逻辑必须保持一致。SDK 侧靠 `onRequest` 钩子
> `injectCsrfHeader`，REST 侧靠 `fetcher.ts` 内联逻辑，二者共享
> `readCsrfCookie()` 与 `STATE_CHANGING_METHODS`。任一侧改了判定规则，另一侧必须同步。

## 1.3 代理层的三种配置

`/api/*` 的落地位置由环境变量决定，共三条路径：

| 场景 | 环境变量 | 实际路径 |
| --- | --- | --- |
| **标准（推荐）** | 都不设 | 浏览器 → Nginx:2026 → Gateway:8001 |
| **纯前端 dev** | 都不设，直连 `localhost:3000` | 浏览器 → Next.js rewrites（[next.config.js](../frontend/next.config.js)）→ `DEER_FLOW_INTERNAL_GATEWAY_BASE_URL`（默认 `http://127.0.0.1:8001`） |
| **分离部署** | `NEXT_PUBLIC_BACKEND_BASE_URL` / `NEXT_PUBLIC_LANGGRAPH_BASE_URL` | 浏览器直连 Gateway（需 Gateway 配 CORS 白名单） |

`next.config.js` 的 rewrites 有**顺序约束**：`/api/langgraph` 规则必须排在
`/api/:path*` 兜底规则之前，否则 LangGraph 路由会丢掉公开前缀。

## 1.4 四种运行模式

前端在四种模式下行为不同，重构时每一种都要验证：

| 模式 | 触发条件 | 行为差异 |
| --- | --- | --- |
| **正常** | 默认 | 全功能 |
| **Mock** | URL 带 `?mock=true` | `getAPIClient(true)` 指向 `${origin}/mock/api`，由 [app/mock/api/](../frontend/src/app/mock/api/) 下的 route handler 提供假数据；输入框禁用 |
| **静态站点** | `NEXT_PUBLIC_STATIC_WEBSITE_ONLY=true` | `createStaticClient()` 把 SDK 的 stream/join 桩为空迭代器，thread 数据来自 [core/threads/static-demo.ts](../frontend/src/core/threads/static-demo.ts)；用于官网 demo |
| **免鉴权** | `DEER_FLOW_AUTH_DISABLED=1` | `getServerSideUser()` 直接返回 `AUTH_DISABLED_USER`，跳过 Gateway `/auth/me`；E2E 用 |

这三个开关分散在各处判定（`isMock`、`isStaticWebsiteOnly()`、
`env.NEXT_PUBLIC_STATIC_WEBSITE_ONLY === "true"`），是重构时的一个已知散落点，
详见 [10-refactor-hotspots.md](10-refactor-hotspots.md)。

## 1.5 SSE 相关的基础设施约束

流式会话依赖若干**跨层配合**，改任一层都要同时检查：

- **Nginx**：`proxy_buffering off`、`X-Accel-Buffering: no`、`proxy_read_timeout 600s`、
  `chunked_transfer_encoding on`；`Connection ''`（不做 upgrade）。
- **Nginx `client_max_body_size 20M` + `proxy_request_buffering off`**：长 prompt
  会超过默认 1M 上限；关掉请求缓冲避免落盘到不可写的临时目录（issue #3952）。
- **Next.js dev**：非 localhost 访问需在 `DEER_FLOW_DEV_ALLOWED_ORIGINS` 列出主机名，
  否则 `/_next/*` 返回 403，页面 SSR 出来但永不 hydrate（[src/dev-origins.js](../frontend/src/dev-origins.js)）。
- **X-Forwarded-Proto 透传**：Nginx 位于另一层 TLS 代理之后时，必须保留上游的
  `X-Forwarded-Proto`，否则 Gateway 判定为 HTTP，登录 POST 被 403 拒绝，
  且会话 Cookie 丢掉 `Secure`。

## 1.6 前端不拉取 subgraph 流

后端支持 `stream_subgraphs`（子图帧以 `values|<ns>` 形式保留命名空间），但
**Web 前端不请求 subgraph 流**。子任务进度通过根命名空间的 `task_*` custom 事件传递
（见 [05-streaming-pipeline.md](05-streaming-pipeline.md#54-custom-事件)）。
重构时不要"顺手"打开 subgraph 流——委派 subagent 继承父 checkpoint 命名空间，
把它的 `values` 快照当作根帧发布会整体替换 SDK 客户端的 thread 视图（issue #4399）。
