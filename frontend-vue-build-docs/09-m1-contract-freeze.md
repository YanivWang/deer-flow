# 09 · M-1 合同冻结

> **历史冻结文档，日期：2026-08-04。** 本文保存 M-1 当时的合同、inventory 和
> “下一步”语境，不是当前进度页。M0–M4a 已在后续里程碑落地；续接任务先读
> [10-current-status-and-next.md](10-current-status-and-next.md)。合同若被实现修改，仍须
> 更新矩阵和测试，但本文中的“当前”“本轮”“允许开始 M0”一律理解为冻结日快照。

## 0. 结论与证据标签

**冻结日结论：M-1 通过，当时允许开始 M0；不代表 production-ready。**

M0 开始前没有必须购买或申请的外部资源。仓库自带 replay Gateway 足以启动骨架与协议测试。真实 OIDC provider、两个生产 DNS/TLS、可信外层代理和可用的 browser sandbox 是 M0 相应 gate/生产发布前提，不是把仓库内可完成工作推到外部的理由。

本文使用四种标签：

- **[源码确认]**：2026-08-04 冻结 checkout 的实现或配置直接规定。
- **[测试覆盖]**：仓库测试已有断言；只有本轮实际执行的命令才写“本轮通过”。
- **[运行探测]**：本轮启动当前 Gateway 得到的去敏 HTTP/SSE 证据。
- **[后续约束]**：冻结日尚无 Vue 实现，M0+ 当时必须实现和验收的合同。

## 1. 部署与长期并存合同

### 1.1 冻结拓扑

| 环境 | React/Next                                             | Vue/Nuxt                                  | Gateway                         | 公共入口与边界                                                                                                                |
| ---- | ------------------------------------------------------ | ----------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 开发 | `localhost:3000`；现有 nginx `localhost:2026` 仍指向它 | `localhost:3100`；E2E preview 固定 `3101` | `localhost:8001`                | Vue 的 HTTP/SSE 由 Nitro server catch-all 同源转发；WS 开发期直连 `ws://localhost:8001` 并精确允许 `http://localhost:3100`/`3101`。`routeRules.proxy` 草案已被 M0 安全实测否决，见 [03](03-project-shape.md) |
| 生产 | 独立 hostname，例如 `react.example.com`                | 独立 hostname，例如 `vue.example.com`     | 一个共享、非公开的 Gateway pool | 每个 hostname 都由 nginx/ingress 提供相同的 `/api/**`、`/api/langgraph/**` 和 browser WS location；浏览器不直接访问 Gateway   |

**生产默认是“两个 hostname、相同路径、同一个 Gateway”，不是不同 pathname，也不是把端口当认证隔离边界。** 两个入口分别拥有 `/`，避免 Next/Nuxt 的 asset、base path、SSR、OIDC 和 Cookie 规则互相耦合；API 保持同源，能长期复用已经验证的 SSE buffering/timeout/body-limit、WS Upgrade、CSRF 和 OIDC 回跳规则。

路径前缀（例如 `/react`、`/vue`）会同时改变静态资源、客户端路由、callback 与测试 baseURL，当前源码没有该能力；生产暴露 `:2026/:2027` 虽可作为本地过渡，但 Cookie 仍按 hostname 而非端口隔离，不能解决 OIDC state 覆盖。因此两者都不是默认生产形态。

### 1.2 公共转发边界

| 浏览器路径                              | 入口行为                                                                    | Gateway 原生路径 |
| --------------------------------------- | --------------------------------------------------------------------------- | ---------------- |
| `/api/langgraph/**`                     | 去掉 `langgraph/`，SSE 不缓冲、请求流式、read timeout ≥ 600s、body ≤ 20 MiB | `/api/**`        |
| `/api/**`                               | 1:1 REST 转发，认证 Cookie/CSRF header 保持                                 | `/api/**`        |
| `/api/threads/:threadId/browser/stream` | WebSocket Upgrade，`Connection/Upgrade` 保持，读写 timeout ≥ 600s           | 同路径           |
| 页面、Nuxt/Next assets                  | 只进入该 hostname 对应的前端                                                | 不进入 Gateway   |

### 1.3 冻结日仓库能力与后续修改

**[源码确认，2026-08-04]** 当时根 `Makefile`/`scripts/serve.sh` 只管理
`8001/3000/2026`；两个 compose 只有一个 `frontend` 服务；两个 nginx 配置只有一个
frontend upstream 和一个 catch-all server。后续已经增加 `dev-vue`/`dev-dual`，但默认
compose/nginx 仍没有交付冻结的双前端生产拓扑；当前边界见 [10](10-current-status-and-next.md)。

| 文件/范围                                                                          | 原因                                                                                                | 里程碑                  | 验收                                                              |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------- |
| `frontend-vue/` package、Makefile、Dockerfile、health                              | 建立 Nuxt dev/preview/最小生产产物                                                                  | M0                      | G0-0/G0-1/G0-9                                                    |
| `scripts/pnpm.py` + `backend/tests/test_pnpm_script.py`                            | runner 当前 cwd 固定 `frontend/`；需白名单 `--dir frontend-vue` 且保持旧调用兼容                    | M0 第一项               | Python 单测 + clean install                                       |
| 根 `Makefile`、`scripts/serve.sh`                                                  | 新增明确的 `dev-vue`/`dev-dual` 和 3100 生命周期；现有 `make dev` 保持 React 默认，避免破坏现有用户 | M0                      | shell/Make target smoke，停止后端口无残留                         |
| `.github/workflows/frontend-vue-verify.yml`                                        | 当前只是目录不存在时跳过的预备 workflow；需用真实 skeleton 证明                                     | M0                      | clean checkout 全命令实际执行                                     |
| 根 README/AGENTS                                                                   | source of truth 必须公布新目录、命令、端口和边界                                                    | M0                      | 文档链接/命令检查                                                 |
| `docker/docker-compose*.yaml`、`docker/nginx/nginx*.conf`（可抽共享 API location） | 加 Nuxt service 与第二 hostname/入口，保持 loopback 默认发布和统一 SSE/WS 行为                      | M7 production readiness | compose config、默认 bind 测试、SSE/WS/body-limit/container smoke |
| deploy/health 脚本、container workflow                                             | 构建、健康、SIGTERM、回滚和最小镜像                                                                 | M7                      | G0-9 的长期版 + container CI                                      |
| 锁文件/`frontend-vue/pnpm-workspace.yaml`                                          | 两前端独立依赖；Vue 内 agent-core 使用 workspace                                                    | M0                      | frozen install、重复 Playwright 检查                              |

**M-1 当时不改**：React 业务源码、Gateway 业务实现、根现有 compose/nginx/serve 脚本。
后续里程碑按正确所有权修改测试：框架无关 spec 可共享，框架特定 spec 分属 React/Vue；
共享观察时序缺陷必须同时跑两侧回归，不能用 Vue 产品兼容层回避。

## 2. Gateway HTTP/SSE 运行协议

以下“公共路径”是浏览器所见 `/api/langgraph` 前缀；括号内是 nginx/Nitro 重写后的 Gateway 原生路径。

### 2.1 路由矩阵

| 动作                  | method 与公共路径                                                           | 请求/headers                                                         | 成功                                                                          | 主要失败                                                            |
| --------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 创建后台 run          | `POST /api/langgraph/threads/{thread}/runs`（`/api/threads/{thread}/runs`） | JSON `RunCreateRequest`；`Content-Type`、auth Cookie、`X-CSRF-Token` | `200 RunResponse`，通常先为 `pending`                                         | `404` thread、`409` 并发/lease、`422` 请求校验、`401/403` auth/CSRF |
| 创建并流式消费        | `POST .../threads/{thread}/runs/stream`                                     | 同上；默认 `on_disconnect=cancel`，Vue 显式选择                      | `200 text/event-stream`；`Content-Location: /api/threads/{thread}/runs/{run}` | 同上；响应前断网结果不确定                                          |
| 等待最终结果          | `POST .../threads/{thread}/runs/wait`                                       | 同 create                                                            | `200` 最终 state/status                                                       | `404/409/422`                                                       |
| 检查 run              | `GET .../threads/{thread}/runs/{run}`                                       | auth Cookie                                                          | `200 RunResponse`                                                             | `404` 不存在或 thread 不匹配                                        |
| 恢复/重连             | `GET .../threads/{thread}/runs/{run}/stream`                                | 有 cursor 时 `Last-Event-ID`                                         | `200 SSE`，从 cursor 后继续                                                   | `404`；store/worker 能力不足时 `409`                                |
| join 兼容路径         | `GET .../threads/{thread}/runs/{run}/join`                                  | 同 resume                                                            | `200 SSE`                                                                     | `404/409`                                                           |
| 取消                  | `POST .../threads/{thread}/runs/{run}/cancel?action=interrupt               | rollback&wait=false                                                  | true`                                                                         | auth Cookie + CSRF                                                  | `202` 已接受；`wait=true` 且确认终止时 `204` | `404`、`409` 已终态/不可取得 lease；冲突可带 `Retry-After` |
| 取消后继续 drain      | `POST .../threads/{thread}/runs/{run}/stream?action=interrupt               | rollback&wait=...`                                                   | 可带 `Last-Event-ID`                                                          | 本 worker 可 `200 SSE`；跨 worker可 `202`；确认终止可 `204`         | `404/409`                                    |
| stateless 兼容 create | `POST /api/langgraph/runs/stream`（`/api/runs/stream`）                     | create body；thread id 可从 config 提供或自动生成                    | `200 SSE` + `Content-Location`                                                | 与 create 相同                                                      |

`/api/runs/stream` 是无 thread path 的兼容 create，不是可恢复 run 的“旧版 resume”；Vue 新实现统一用 thread-scoped create。恢复永远针对已经取得 handle 的 run，不能重新调用任何 create 路径。

`RunCreateRequest` `extra="forbid"`。允许的 request stream modes 只有 `values`、`messages-tuple`、`updates`、`debug`、`tasks`、`checkpoints`、`custom`；提交 `messages` 或 `events` 得 `422`。`messages-tuple` 在 worker 中映射到 LangGraph `messages`，因此 wire event 名是 `messages`。

请求 body 字段全集冻结为：`assistant_id`、`input`、`command`、`metadata`、`config`、`context`、`checkpoint_id`、`checkpoint`、`interrupt_before`、`interrupt_after`、`stream_mode`、`stream_subgraphs`、`stream_resumable`、`on_disconnect`、`multitask_strategy`，以及只接受兼容默认值的 `webhook/on_completion/after_seconds/if_not_exists/feedback_keys`。常规聊天至少发送 `input: {messages:[...]}`，可带 `assistant_id` 与 `context`；resume human interrupt 时使用 `command.resume`。`stream_resumable` 只接受 `false/null`，`multitask_strategy` 只接受 `reject/rollback/interrupt`，未知字段或不支持选项为 `422`；无效 model allowlist 为 `400`，当前运行策略无法支持时可为 `501`。Inspect 的 `RunResponse` 至少包含 `run_id/thread_id/status/metadata/kwargs/timestamps/token counts/message_count/stop_reason`，adapter 以 `status + stop_reason` 收敛，不从 UI 请求动作反推终态。

### 2.2 SSE frame 合同

| 帧                                                                 | id                      | data                                                                                  | reducer 行为                          |
| ------------------------------------------------------------------ | ----------------------- | ------------------------------------------------------------------------------------- | ------------------------------------- |
| `metadata`                                                         | 普通发布事件有服务端 id | JSON，含 thread/run metadata                                                          | 控制面；捕获 handle，不进入业务 state |
| `values/messages/updates/custom/tasks/checkpoints/debug`，含 `mode | namespace...`           | 有                                                                                    | JSON                                  | 业务/状态数据，按 L3 显式映射 |
| `error`                                                            | 有                      | `{"message":...,"name":...}`                                                          | 控制面失败；不自动重连                |
| `gap`                                                              | 无                      | 含 `stream_replay_gap`、requested/earliest/latest id、`recovery=reload_durable_state` | 控制面；停止消费并重载 durable state  |
| `end`                                                              | 无                      | JSON `null`                                                                           | 控制面终止；不推进 cursor             |
| heartbeat                                                          | 无；SSE comment         | 精确为 `: heartbeat\n\n`，无 event/data                                               | 只刷新 watchdog，不进入 reducer       |

普通 event id 由 bridge 生成并单调推进；内存 bridge 的格式与 Redis native id 不同，客户端必须把它当 opaque string，只回送服务端发出的 cursor。恢复 cursor 是排他的：从该 id **之后**重放。未知/恶意 cursor 在不同 bridge 的降级行为并不完全相同，Vue 不得自行构造或解析 id。

### 2.3 连接、取消和恢复

- 本地 `AbortController.abort()` 只确认浏览器不再读。只有 Gateway 实际观察到断连且 `on_disconnect=cancel` 时，当前本地 owner 才会尝试取消；`continue` 让后台 run 继续。UI 不得把 abort 直接显示为 `cancelled`。
- create 请求没有 idempotency key。响应头/`Content-Location` 到达前断网可能已创建 run，自动重试 POST 会制造重复执行，因此必须进入“结果不确定/failed”并由用户或后续 thread 查询收敛。
- 已取得 handle 后，网络错误或意外 EOF才能指数退避并 `GET resume`；权限、HTTP 4xx、解析错误、SSE `error` 不自动重试。
- `202 cancel` 只是 accepted，必须有界轮询 inspect；`204` 才表示该请求已观察到终止；`200` 只出现在 cancel-then-drain 的 SSE 变体，不能把三者压成 `void`。
- gap 后先 `GET /api/langgraph/threads/{thread}/state` 重载 durable state，清空 optimistic/临时 chunk/subtask cache；把 cursor 更新为服务端 `latest_available_event_id`。inspect 仍为非终态时才能 join 同一 run，绝不 recreate。

### 2.4 证据边界

**[源码确认]**：`backend/app/gateway/routers/thread_runs.py`、`backend/app/gateway/routers/runs.py`、`backend/app/gateway/run_models.py`、`backend/app/gateway/services.py`、`backend/packages/harness/deerflow/runtime/runs/worker.py`，以及同目录 `schemas.py` 的 durable status 枚举。

**[测试覆盖]**：`test_gateway_services.py`、`test_stream_bridge.py`、`test_run_request_validation.py`、`test_cancel_run_idempotent.py`、`test_runtime_lifecycle_e2e.py`、`test_wait_disconnect_handling.py`、`test_multi_worker_run_ownership.py`、`test_run_worker_delta_resume.py`。

**[运行探测]**：[去敏 Gateway replay 探针](evidence/m-1-replay-gateway-probe.md) 确认 create `200`、`Content-Location`、无 `Location`、wire event、无 id 的 end，以及 GET + `Last-Event-ID` 排他恢复；本次业务 run 终态为 `error`，没有伪报成功。

**[后续约束]**：M0 必须在 Nuxt preview 之后重复响应头/SSE/cancel/gap/heartbeat 探针，补齐 active `202/204` 与浏览器断连；不能用源码测试代替真实代理验证。

## 3. 消息、状态与 Agent Core

### 3.1 数据边界

- `Message.content` 保留 `string | MessageContentPart[]`；parts 中的 text/image/tool/citation 信息不能 stringify 后丢失。
- `values` 是完整 durable state snapshot：归一化后**替换**旧 durable state。Pinia 的 drawer/loading/selection 等 UI state 不得混入 snapshot，也不能因 snapshot 未包含而误删。
- `updates` 是 node-keyed 增量 writes，不是可以浅 merge 到 state 的普通 patch。L3 按 channel reducer 和事件顺序归约；messages 对齐 `add_messages` 的同 id 原位替换、追加、单条删除、`REMOVE_ALL_MESSAGES` 与 tombstone 语义。
- `messages` wire frame 是消息 tuple/chunk 增量，按稳定 id merge；不得把它当完整 thread messages 数组。
- `metadata/error/gap/end/heartbeat` 是 control events；其余已知 stream modes 是 data events。control event 永不进入业务 reducer。

### 3.2 thread、run 与 UI 状态

thread 是长期会话/checkpoint/history/owner 边界；run 是该 thread 上一次 invocation 的生命周期。一个 thread 可有多个历史 run；当前 run 状态不能覆盖 thread id 或污染另一个 thread。

| Gateway durable status | Vue session 语义                        |
| ---------------------- | --------------------------------------- |
| `pending`              | `creating`/等待 lease                   |
| `running`              | `streaming` 或连接断开时 `reconnecting` |
| `success`              | `completed`                             |
| `interrupted`          | `cancelled`                             |
| `error`、`timeout`     | `failed`                                |

`stopping` 仅是用户点击停止后的客户端瞬态，没有同名 backend status。它必须一直等到 cancel SSE/inspect 得到 durable 终态再映射；不能假定所有 stop 都成为 `interrupted`。Backend 没有 `completed/cancelled/failed` 这些枚举，它们是 adapter 的 UI 语义。

### 3.3 分层禁入与实例作用域

- L1 `packages/agent-core` 必须是纯 TypeScript；禁止 import Vue、Nuxt、Pinia、React、LangGraph SDK、DeerFlow UI，禁止 endpoint/cookie/runtimeConfig/window 等宿主知识。
- L3 DeerFlow adapter 负责 endpoint、request/wire 映射、Cookie/CSRF、durable state normalization、gap reload、run status 映射。
- Vue/Pinia adapter 只把 L1 external store 投影为 refs/store，管理 UI state/cache 与 mount/unmount disposal；不能重写 transport reducer。
- 每个 thread id、sidecar session 各建独立 store/runtime/adapter；禁止一个全局活动 thread singleton。并发 thread、切换、卸载都要有隔离测试。

证据：`backend/packages/harness/deerflow/agents/thread_state.py` 与 `backend/tests/test_delta_channel_state.py` 冻结 reducer 语义；现有 React stream manager/API 是兼容 oracle；[08](08-agent-core-contract.md) 冻结 L1/L3 接口和禁入测试。

## 4. WebSocket 合同

全仓业务 WebSocket 只有 browser-view；chat/run 使用 SSE，不能混为一谈。browser control 未启用时，聊天主链没有必需的业务 WebSocket；启用 browser-view 时下表就是硬合同。Next/Nuxt HMR 是开发框架连接，不是业务合同。

| 项目          | 冻结行为                                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 路径          | `GET Upgrade /api/threads/{thread_id}/browser/stream?frame_format=binary[&seed=...]`                                                              |
| 鉴权          | WebSocket 不走 HTTP middleware；Gateway 只读 `access_token` Cookie（auth disabled 时例外），不接受 bearer/query token                             |
| Origin        | 无 Origin 的原生 client 可进；浏览器必须同 host:port（含 forwarded host）或命中精确 `GATEWAY_CORS_ORIGINS`                                        |
| owner/feature | thread 必须有当前 owner，browser feature/session 可用；否则关闭                                                                                   |
| close/error   | `4401` 未认证、`4403` Origin、`4404` 不存在/非 owner/feature disabled、`4429` capacity、`4501` runtime；未知 frame format 先 JSON error 后 `1008` |
| frame         | `binary` 时服务端发 JPEG binary；控制/metadata/tab/navigation/error 为 JSON，客户端输入也是 JSON                                                  |
| 生命周期      | 组件启用时连接，禁用/卸载/thread 变化关闭；现 React 实现最多 6 次指数退避，`800ms * 2^n`，上限 10s，open 后重置                                   |

开发冻结为：HTTP/SSE 仍走 `localhost:3100` 的同源 Nitro handler，browser WS 暂时直连 `ws://localhost:8001`，Gateway 精确配置 `GATEWAY_CORS_ORIGINS=http://localhost:3100,http://localhost:3101`，所有地址统一使用 hostname `localhost` 以共享 host Cookie。M0 G0-6 必须用真实浏览器 Origin+Cookie 握手；若 Nuxt 实现安全的同源 WS proxy，可替换该开发接线，但不能只假设 HTTP handler 或 `routeRules` 支持 Upgrade。

生产冻结为两个 hostname 各自由 nginx/ingress 同源 Upgrade。后续配置必须保留 `proxy_http_version 1.1`、`Upgrade`、`Connection` 与 600s 读写 timeout。

证据：`backend/app/gateway/routers/browser.py`、`frontend/src/components/workspace/browser-view/api.ts`、`frontend/src/components/workspace/browser-view/use-browser-stream.ts`、两个 nginx 配置及 `backend/tests/test_browser_router.py`。

## 5. 认证、Cookie、CSRF 与 OIDC

### 5.1 HTTP 认证合同

| 动作               | 路径/method                                                         | 成功/备注                                                            |
| ------------------ | ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 本地登录           | `POST /api/v1/auth/login/local`，form username/password/remember_me | `200`；bootstrap CSRF exempt，但校验 browser Origin                  |
| 注册               | `POST /api/v1/auth/register` JSON email/password/remember_me        | `201`；关闭注册为 `403`，重复/非法为 `400`                           |
| 会话检查           | `GET /api/v1/auth/me`                                               | `200`；缺失、过期、版本失效或非法 session 为 `401`                   |
| 登出               | `POST /api/v1/auth/logout`                                          | `200`；删除 session/CSRF cookies，不补发 CSRF                        |
| 首次设置           | `GET /api/v1/auth/setup-status`；`POST /api/v1/auth/initialize`     | `200` / `201`；已初始化 `409`                                        |
| 改密码             | `POST /api/v1/auth/change-password`                                 | `200`，增加 token_version 并重发 session/CSRF；需当前 session + CSRF |
| provider 列表/发起 | `GET /api/v1/auth/providers`；`GET /api/v1/auth/oauth/{provider}`   | `200` / `302`                                                        |
| callback           | `GET /api/v1/auth/callback/{provider}`                              | 校验 state/nonce/PKCE 后 `302` 到前端 callback/login                 |

浏览器 fetch 一律 `credentials:"include"`。所有非豁免 POST/PUT/PATCH/DELETE 从可读 `csrf_token` Cookie 取值并发 `X-CSRF-Token`，两者必须完全相等；登录/注册/初始化/登出是 bootstrap 豁免但仍做 exact origin 检查。CSRF 没有单独的“refresh API”：session-creating auth POST 和 OIDC callback 通过 `Set-Cookie` 获取；除 logout 外的 auth POST 会重新生成 Cookie；`GET /me` 只刷新用户状态、不轮换 token。前端不把 CSRF 另存 localStorage/Pinia，而是在**每次**写请求发出前读取最新 `document.cookie`；logout 删除 cookie 并抑制 middleware 补发。

### 5.2 Cookie 冻结值

| Cookie                        | 属性                                                                                                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `access_token`                | HttpOnly、SameSite=Lax、Secure 取决于 proxy-aware HTTPS、默认 path `/`；remember 的持久 max-age 仅在安全 HTTPS、直接 localhost HTTP或显式不安全 opt-in 条件下启用 |
| `deerflow_session_persistent` | HttpOnly、SameSite=Lax，secure/max-age 与 session 一致                                                                                                            |
| `csrf_token`                  | JS 可读、SameSite=Strict，secure/max-age 随 session                                                                                                               |
| `df_oidc_state_{provider}`    | signed、HttpOnly、SameSite=Lax、max-age 300、path 精确 callback；含 state/nonce/PKCE/next/remember                                                                |

Cookie 不按端口隔离。同一 hostname 的 `2026/3100` 会共享 access/CSRF；一端 logout 会使另一端掉线。同 provider 并发 OIDC 会覆盖同名且同 path 的 state cookie，导致其中一次 callback 失败。因此开发只能把它当已知限制并用不同 browser profile 隔离测试，生产必须使用独立 hostnames。

### 5.3 OIDC 双入口与可信代理

- 两个前端都通过各自同源 `/api/v1/auth/*` 发起；每个 IdP provider 注册两个 callback：`https://react.example.com/api/v1/auth/callback/{provider}` 与 `https://vue.example.com/api/v1/auth/callback/{provider}`。
- 默认把 `auth.oidc.frontend_base_url` 和 provider `redirect_uri` 都留空：callback URI 由当前 proxy-aware origin 生成，前端成功/失败回跳使用相对路径，因而回到发起入口。
- 外层 TLS proxy 必须**覆盖/清洗**客户端传入的 `Forwarded`/`X-Forwarded-Host`/`X-Forwarded-Proto`，再传真实 Host/Proto。当前 origin helper 会信任这些 header；`AUTH_TRUSTED_PROXIES` 只约束 X-Real-IP 的 rate-limit 语义，不能替代这一要求。
- 若 IdP 只允许一个 callback，或运维强制单值绝对 `frontend_base_url`/`redirect_uri`，当前仓库无法同时正确服务双入口。要么变更 IdP能力，要么在后续单独设计“受签名 return origin + 服务端 allowlist”的 backend 扩展和安全测试；不能接受客户端任意 return URL。

生产外部前提：两个 DNS/TLS；IdP 两个 callback；强 JWT secret；共享持久化/Redis满足所选运行模式；可信代理清洗；若 browser-view 启用则有可用 browser runtime/capacity。跨源直连并非默认；若临时启用，`GATEWAY_CORS_ORIGINS` 必须列精确 origin，不能用 `*`。

证据：`backend/app/gateway/routers/auth.py`、`backend/app/gateway/auth/session_cookie.py`、`backend/app/gateway/csrf_middleware.py`、`backend/app/gateway/auth/oidc_state.py`、`backend/app/gateway/auth/oidc.py`、`frontend/src/core/api/fetcher.ts` 及 auth/csrf/oidc 测试。

## 6. 测试、证据和 M0 验收

### 6.1 冻结 checkout 的 inventory

| 范围                | 数量                     | 口径                                                                                                     |
| ------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------- |
| React unit          | **126 files**            | `frontend/tests/unit/**/*.{test,spec}.{ts,tsx}`；其中 core 83、其余 43                                   |
| mock Playwright     | **27 files / 130 tests** | 本轮真实执行 `playwright test --list`                                                                    |
| Vue 硬合同          | **25 files / 130 tests** | 最终完整路径 inventory；框架无关 spec 复用，框架特定行为由 Vue spec 拥有 |
| auth                | 1 spec                   | Vue 专属 config/server，spec 原则上复用                                                                  |
| real-backend        | 3 spec                   | Vue 专属 config/server，场景复用并补 Vue proxy assertions                                                |
| record              | 1 spec                   | 证据采集工具，不等于产品 gate                                                                            |
| 最终 thread fixture | 13 files / 516 messages  | `values.messages` 口径，不是顶层 `messages`                                                              |

“收集到”只证明配置和依赖有效，不等于 130 tests 通过。Vue 必须执行精确 25-file
inventory，但不要求 25 个都共享：框架无关行为复用，框架特定行为写 Vue spec。React unit
不能直接在 Vue 上运行：纯 TS/协议语义迁到 agent-core Vitest，组件/hook 测试写 Vue 专属
版本，React 自身继续由既有 CI 守护。

四类证据职责：最终 thread fixture 验最终 adapter/state；raw SSE trace 验时序/cursor/分帧；fake upstream 验断流、chunk、LF/CRLF 和 method 切换；真实 Gateway 验路由/header/auth/proxy/cancel。任何一类都不能替代其余三类。

### 6.2 M0 gate 的准确命令合同

下表命令在 `frontend-vue/` 尚不存在时**预期不可执行**；M0 创建相应 Make target 是 gate 的一部分。React collection 命令已在本轮真实执行。

| Gate                    | 准确命令与范围                                                                                                                                                        | 前置服务                                        | 通过条件                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| G0-0 clean CI           | 根目录：`python3 scripts/pnpm.py install --frozen-lockfile`；`python3 scripts/pnpm.py --dir frontend-vue install --frozen-lockfile`；`cd frontend-vue && make verify` | 无                                              | clean checkout 安装；lint/type/unit/build 全绿；workflow 不再走 skip                                  |
| G0-1 HTTP/SSE proxy     | `cd frontend-vue && make proxy-smoke`                                                                                                                                 | replay Gateway `8011`；Nuxt preview `3101`      | `/api/features`、两类 API rewrite、SSE逐帧且 header保留；20 MiB边界明确                               |
| G0-2 collection         | 当前基线：`cd frontend && python3 ../scripts/pnpm.py exec playwright test --list`；Vue：`cd frontend-vue && make e2e-list`                                            | Vue preview由 Playwright webServer 启动         | React 实时 inventory；Vue 最终精确收集 25 files/130 tests，且输出 exclusions                                |
| G0-3 auth disabled      | `cd frontend-vue && make auth-disabled-smoke`                                                                                                                         | preview `3101`，`NUXT_PUBLIC_AUTH_DISABLED=1`   | `/workspace` 不跳 `/login`；纯决策单测通过                                                            |
| G0-4 visual seed        | `cd frontend-vue && make visual-baseline-smoke`                                                                                                                       | preview                                         | light/dark Button 基准产物与阈值通过                                                                  |
| G0-5 Cookie/CSRF        | `cd frontend-vue && make e2e-auth`                                                                                                                                    | 可写 test DB/Gateway + preview                  | register/login/me/受保护写/CSRF refresh/logout 实际通过                                               |
| G0-6 WS                 | `cd frontend-vue && make ws-smoke`                                                                                                                                    | browser feature Gateway；exact origin allowlist | 真实浏览器 Cookie+Origin upgrade、binary frame、关闭/重连通过                                         |
| G0-7 OIDC               | `cd frontend-vue && make oidc-smoke`                                                                                                                                  | 可控 IdP，两个 callback origin                  | 两入口各自回跳；并发同-host state 风险测试；forwarded header负测                                      |
| G0-8 run protocol       | `cd frontend-vue && make run-protocol-smoke`                                                                                                                          | replay Gateway + preview                        | create仅一次；Content-Location；resume GET+Last-Event-ID；error/end/gap/heartbeat；200/202/204 cancel |
| G0-9 security/container | `cd frontend-vue && make audit && make proxy-security && make container-smoke`                                                                                        | Docker用于最后一项                              | resolved版本锁定；moderate+ policy；路径逃逸失败；非root、health、SIGTERM、最小产物通过               |

G0-6 与 G0-7 依赖仓库无法自带的外部前提，因此聚合在 `make e2e-external` 而不是
`make e2e-m0` 里，由 workflow 的手动 `external-gates` job 驱动；前提缺失时该 job
显式失败并列出缺什么，不做 skip。其余八道由 `make e2e-m0` 一次性覆盖。

M0 不得以 `e2e-list` 代替执行。M1–M7 每个里程碑运行当时已实现范围的 Vue unit +
Vue-owned inventory；M7 production readiness 还必须跑 auth、real-backend、visual、container、
SSE/WS ingress smoke。

## 7. 视觉基线合同

结构/协议正确性由 unit、正确所有者的 Playwright、raw trace 和 Gateway smoke 验收；
视觉一致性是另一条门禁，不能用 DOM 结构报告或“功能可点”代替。

固定 viewport：桌面 `1440x900`，移动端 `390x844`，`deviceScaleFactor=1`；固定 Chromium、locale `en-US`、时区、light/dark theme、字体和 reduced motion。每个截图使用确定性 mock/thread fixture，关闭网络波动和动画，等待 fonts/stream state marker 后再截。

| 页面/区域                            | 必须冻结的状态                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `/workspace/chats/new`               | 空状态、composer 可用/禁用、上传/技能入口、桌面/移动导航                                                |
| `/workspace/chats/{thread}`          | history loading、流式 reasoning/answer、tool running/result、error、stopping、completed、长列表与移动端 |
| `/workspace/agents` 与 agent thread  | gallery、disabled、agent badge/新会话/历史会话                                                          |
| `/workspace/scheduled-tasks`         | 列表空/加载/详情、启停和最近 run 状态                                                                   |
| artifact/sidecar/browser panels      | 收起/展开、加载、错误、完成；browser frame 使用确定性占位或 mask                                        |
| `/login`、`/setup`、`/auth/callback` | 默认、提交中、字段/服务端错误、redirect loading                                                         |

最少场景：空 workspace/chat、加载 skeleton、流式生成（含 reasoning/chunk）、tool call running/result、错误、`stopping`、`completed`、artifact/sidecar 展开；核心场景覆盖桌面与移动端，登录页和 browser-view 至少各有一张确定性状态。M0 只建立 Button/theme seed；M4–M7 随页面实现补齐。

动态屏蔽仅限时间戳、随机 id、光标、真实视频/browser frame、无法固定的进度；消息正文、tool 状态、按钮、layout 和 error banner 不得 mask。失败必须保存 actual、expected、diff、trace、console/network log 与 Playwright screenshot/video，CI artifact 可下载。基线更新必须人工审查且说明对应需求，不允许自动接受。

## 8. 根级集成总表

| 范围                             | 必须性                                                    | 里程碑/测试                                        | 当前 M-1 是否修改 |
| -------------------------------- | --------------------------------------------------------- | -------------------------------------------------- | ----------------- |
| `scripts/pnpm.py` + Python tests | 必须，双目录 runner                                       | M0/G0-0                                            | 否                |
| 根 Makefile + `scripts/serve.sh` | 必须，显式 dev-vue/dev-dual 生命周期                      | M0/端口 smoke                                      | 否                |
| workflow                         | 必须，clean CI                                            | M0/G0-0                                            | 否；已有预备态    |
| README/AGENTS                    | 必须，source of truth                                     | M0/links/commands                                  | 否                |
| Vue lock/workspace               | 必须，agent-core 真包且隔离 React install                 | M0/frozen install                                  | 否                |
| Dockerfile/compose/nginx/deploy  | production dual profile 必须                              | M0 Dockerfile；M7 ingress/compose/production gates | 否                |
| 根/Backend 测试                  | 仅为被改的 runner/compose/nginx/OIDC 补回归               | M0/M7 对应测试                                     | 否                |
| React 业务代码与 E2E spec        | 业务代码不为 Vue 迁移改；测试只在共享观察缺陷属于正确所有者时改 | React CI + Vue/React 对应回归                    | 否                |
| Gateway 路由实现                 | 当前合同已足够；只有单 callback外部限制迫使安全扩展时才改 | 独立安全设计，不得夹带                             | 否                |

## 9. 可追踪矩阵

| 需求/决定                           | 源码证据                                           | 测试/运行证据                                    | 后续 gate/里程碑    |
| ----------------------------------- | -------------------------------------------------- | ------------------------------------------------ | ------------------- |
| 双 host 同源入口，共享 Gateway      | compose/nginx/serve 当前单入口限制；auth/proxy实现 | compose bind/nginx tests                         | M0 dev；M7 prod     |
| `/api/langgraph` rewrite 与 SSE参数 | 两个 nginx配置、Next rewrites、Gateway routers     | Gateway service/lifecycle tests；本轮探针        | G0-1/G0-8/G0-9      |
| create不可重试、resume GET          | run routers/models/services                        | 生命周期/断连测试；本轮排他恢复                  | G0-8                |
| cancel 200/202/204分流              | thread run router/service                          | cancel、multi-worker、wait tests                 | G0-8                |
| values全量、updates按channel增量    | thread_state、worker stream map                    | delta channel/worker resume tests                | M2 adapter tests    |
| content string/parts                | backend message schema + React model               | 13/516 fixture + raw traces                      | M2/M4               |
| thread/run隔离、per-thread store    | run persistence + frontend manager                 | architecture/isolation tests待建                 | M0 architecture；M2 |
| browser WS不是SSE                   | browser router + React hook + nginx location       | browser router tests；本轮 DNS相关单测受环境限制 | G0-6/M7             |
| Cookie/CSRF credentials             | session/csrf middleware + frontend fetcher         | auth/csrf tests                                  | G0-5                |
| 双 OIDC callback、独立 hostname     | OIDC callback/state cookie与proxy origin           | oidc tests；真实双入口待验证                     | G0-7/M7             |
| 126 unit、27/130、硬合同25/120      | 当前 tests tree/config                             | 本轮 `--list` 130/27                             | G0-2；各里程碑      |
| 有界视觉状态                        | React页面/共享fixtures                             | Vue截图尚不存在                                  | G0-4；M4–M7         |
| 根级接入不是孤岛目录                | Makefile/runner/workflow现状                       | runner/workflow测试待激活                        | G0-0/M7             |

## 10. 外部前提、剩余未知与 M0 首项

### M-1 本轮验证记录

| 命令/检查                                                                                                                                                                                                                                                                                                                                                                  | 真实结果                                | 结论边界                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------- |
| `cd backend && ./.venv/bin/python -m pytest -q tests/test_gateway_services.py tests/test_stream_bridge.py tests/test_run_request_validation.py tests/test_cancel_run_idempotent.py tests/test_openapi_operation_ids.py tests/test_browser_router.py tests/test_csrf_middleware.py tests/test_oidc_auth.py -k 'not test_validate_browser_url_rejects_private_and_non_http'` | **269 passed, 7 skipped, 1 deselected** | Gateway/SSE/request/cancel/OpenAPI/WS/auth/CSRF/OIDC 目标测试通过；deselected 项单独说明如下 |
| `cd backend && ./.venv/bin/python -m pytest -q tests/test_runtime_lifecycle_e2e.py tests/test_wait_disconnect_handling.py tests/test_multi_worker_run_ownership.py -k 'cancel or stream or reconnect or last_event or disconnect or content_location or runtime_lifecycle'`                                                                                                | **47 passed, 63 deselected**            | 仅执行表达式选中的生命周期/断连/所有权合同                                                   |
| `cd frontend && python3 ../scripts/pnpm.py exec playwright test --list`                                                                                                                                                                                                                                                                                                    | **130 tests in 27 files**               | 只证明当前 React mock suite 可收集，不是 E2E 通过                                            |
| workflow `yaml.safe_load`                                                                                                                                                                                                                                                                                                                                                  | **15 files parse**                      | 只证明 YAML 语法可解析；`frontend-vue` 不存在，预备 workflow 的实际 job 仍待 G0-0            |
| Markdown relative target + GitHub slugger anchor check                                                                                                                                                                                                                                                                                                                     | **11 files 通过**                       | 覆盖本目录全部 Markdown（含 evidence）                                                       |

未过滤运行时，`backend/tests/test_browser_router.py::test_validate_browser_url_rejects_private_and_non_http` 在当前机器把公开 `github.com` 解析为 private address，导致该依赖公网 DNS 的 URL 安全测试失败；在 sandbox 外重跑仍是同一环境解析结果。它不否定本轮 WebSocket 路由合同，但也没有被伪报为通过。M0/CI 应在正常公共 DNS 环境重跑该测试，或把 DNS resolver 变成可注入 fixture 后做确定性断言。

### 真正外部前提

- G0-7/生产：能配置两个 callback 的可控 IdP；正式 DNS 与 TLS。
- G0-6 browser-view：浏览器 sandbox/runtime 与容量配置；未启用该功能时不能伪报 WS业务已通过。
- 生产：可信 TLS proxy 能清洗 forwarded headers；共享 Gateway persistence/Redis 按目标拓扑可用。
- 外部 LLM/provider 凭据只用于真实模型 smoke；M0 的协议确定性门禁用 replay Gateway，不因缺凭据停摆。

### 冻结日尚未完成的运行验证

截至 2026-08-04，Nuxt 尚未创建，所以 preview proxy、Upgrade、Cookie/OIDC 双入口、
active cancel `202/204`、heartbeat/gap 和生产双 hostname 当时还没有运行结果。前述 M0
项目后来已有证据；生产双 hostname 仍归 M7。当前结果必须查 [10](10-current-status-and-next.md)。

### 冻结日定义的 M0 第一个任务（已执行的历史计划）

先写 `backend/tests/test_pnpm_script.py` 的双目录/路径穿越/兼容性失败用例，再给 `scripts/pnpm.py` 增加白名单 `--dir frontend|frontend-vue`；随后只创建能让 `.github/workflows/frontend-vue-verify.yml` 从 skip 进入真实安装的最小 `frontend-vue/package.json`、workspace、Makefile 和 Nuxt 骨架。该任务只建立工程、route config 和测试入口，**不创建聊天、thread、Pinia业务状态或任何 Vue 业务页面**。
