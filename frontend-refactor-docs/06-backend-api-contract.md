# 06 · 后端 API 契约与鉴权

## 6.1 鉴权模型

### Cookie 所有权
| Cookie | 属性 | 所有者 | 前端能做什么 |
| --- | --- | --- | --- |
| `access_token` | **HttpOnly** | Gateway | 只能随请求自动携带，JS 读不到 |
| `csrf_token` | 可读 | Gateway | JS 读取并回显到 `X-CSRF-Token` 头 |
| `locale` | 可读 | 前端 | i18n |
| `sidebar_state` | 可读 | 前端 | 侧栏开合（SSR 读取避免闪烁） |

**硬性约束**：密码和 token 绝不进前端存储。登录页的"保持登录"只向 Gateway 提交
`remember_me`，前端侧最多通过
[core/auth/remember-login.ts](../frontend/src/core/auth/remember-login.ts)
持久化**邮箱地址**。

### CSRF：Double Submit Cookie（RFC-001）

两条通道各自注入，共享判定：

| | SDK 通道 | REST 通道 |
| --- | --- | --- |
| 注入点 | `injectCsrfHeader`（`onRequest` 钩子，[api-client.ts](../frontend/src/core/api/api-client.ts)） | [fetcher.ts](../frontend/src/core/api/fetcher.ts) 的 `fetch` 包装 |
| 共享逻辑 | `readCsrfCookie()`、`isStateChangingMethod()`、`STATE_CHANGING_METHODS` | 同 |
| 判定 | `POST` / `PUT` / `DELETE` / `PATCH` 才注入（镜像 Gateway 的 `should_check_csrf`） | 同 |
| 覆盖策略 | 已存在 `X-CSRF-Token` 时不覆盖（显式指定优先） | 同 |

`fetcher.ts` 的 `fetch` 还负责两件事：
1. **强制 `credentials: "include"`** —— 跨源 SSR 路由请求也带上 HttpOnly cookie。
2. **401 自动跳登录**：`window.location.href = buildLoginUrl(pathname)` 然后 throw。

> ⚠️ 用裸 `globalThis.fetch()` 调 Gateway 会**静默丢掉 CSRF 头**，
> 服务端返回 403。所有新的 API 调用必须走 `core/api/fetcher.ts`。
> （`getCsrfHeaders()` 是给必须手工组装 Headers 的遗留点用的，新代码优先用 `fetch` 包装。）

### 鉴权相关接口（`/api/v1/auth/*`）

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/api/v1/auth/me` | 当前用户（SSR 用，带 `Cookie` 头直连内部 Gateway） |
| GET | `/api/v1/auth/setup-status` | 系统是否需要初始化 |
| GET | `/api/v1/auth/providers` | 可用登录方式（本地 / OAuth 列表） |
| POST | `/api/v1/auth/login/local` | 本地登录（`remember_me`） |
| POST | `/api/v1/auth/register` | 注册 |
| POST | `/api/v1/auth/initialize` | 首次系统初始化 |
| POST | `/api/v1/auth/logout` | 登出 |
| POST | `/api/v1/auth/change-password` | 改密 |
| GET | `/api/v1/auth/oauth/{provider}?next=…&remember_me=…` | OAuth 起跳 |

## 6.2 LangGraph SDK 通道（`/api/langgraph/*`）

Base：`getLangGraphBaseURL()` → 默认 `${origin}/api/langgraph`。
Nginx 重写为 Gateway 原生 `/api/*`。

| SDK 调用 | 用途 |
| --- | --- |
| `runs.stream(threadId, "lead_agent", payload)` | 发起 run 并订阅 SSE（`assistantId` 恒为 `"lead_agent"`） |
| `runs.joinStream(threadId, runId, { lastEventId, streamMode, signal })` | 重连并从 `Last-Event-ID` 续播 |
| `runs.get(threadId, runId)` | 查 run 状态（重连前的终态短路） |
| `runs.cancel(threadId, runId, wait, action, options)` | 取消 run |
| `runs.list(threadId)` | run 列表 |
| `threads.search(query)` | thread 搜索/列表 |
| `threads.get(threadId)` / `threads.getState(threadId)` / `threads.getHistory(threadId)` | thread 与状态 |
| `threads.update(threadId, { metadata })` | 写 metadata（如 `agent_name`、置顶标记） |

**允许的 stream mode**（超出即在 HTTP 前抛错）：
`values`、`messages-tuple`、`updates`、`debug`、`tasks`、`checkpoints`、`custom`。
`messages`、`events` 不支持。`streamResumable` 发请求前剥掉。

## 6.3 REST 通道全表

Base：`getBackendBaseURL()`，默认空串（同源相对路径）。全部经
`fetchWithAuth`（除个别历史遗留点）。

### Thread 级

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/threads` | thread 列表 |
| GET | `/api/threads/{id}` | 单个 thread |
| PATCH | `/api/threads/{id}` | 改 metadata（改名 / 置顶）。**run 活动时返回 409** |
| GET | `/api/threads/{id}/messages/page` | 持久化历史**分页**（保留 thread 全局 `seq`） |
| GET | `/api/threads/{id}/token-usage` | token 用量汇总（403/404 → 返回 `null` 而非抛错） |
| POST | `/api/threads/{id}/compact` | 摘要较早的活动上下文；run 活动时服务端拒绝 |
| POST | `/api/threads/{id}/branches` | 从某个 turn 分支出新 thread |
| GET/PUT/DELETE | `/api/threads/{id}/goal` | `/goal` 命令三态（status / set / clear） |
| POST | `/api/threads/{id}/runs/regenerate/prepare` | 重生成的准备（返回 checkpoint/metadata） |
| POST | `/api/threads/{id}/runs/edit-regenerate/prepare` | 编辑重跑的准备 |
| POST | `/api/threads/{id}/runs/{runId}/feedback` | run 反馈 |
| GET | `/api/threads/{id}/runs/{runId}/events` | run 事件（子任务 step 回填：`?event_types=subagent.step&task_id=…&after_seq=…`） |
| GET | `/api/threads/{id}/suggestions` | 后续建议 |
| GET | `/api/threads/{id}/scheduled-tasks` | 该 thread 的定时任务 |
| GET | `/api/threads/search` | thread 搜索（Mock 侧亦有实现） |

### 产物与上传

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/threads/{id}/artifacts[/{path}]` | 产物列表 / 单文件内容 |
| GET | `/api/threads/{id}/uploads/limits` | 上传限制（大小/类型） |
| GET | `/api/threads/{id}/uploads/list` | 已上传文件 |
| POST | `/api/threads/{id}/uploads` | 上传 |
| DELETE | `/api/threads/{id}/uploads/{fileId}` | 删除 |

### 远程浏览器（可选功能）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/threads/{id}/browser/stream…` | 浏览器画面流 |
| POST | `/api/threads/{id}/browser/navigate` | 导航 |

由 `GET /api/features → browser_control.enabled` 门控。**默认/失败的 feature 发现
都要隐藏浏览器控件**，避免可选后端未安装时露出一个死的 Live socket。

### 全局能力

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/features` | 功能开关发现（`browser_control` 等） |
| GET | `/api/models` | 可用模型 + `tokenUsageEnabled` |
| GET | `/api/skills`、POST `/api/skills/install`、PUT `/api/skills/{name}` | 技能列表 / 安装 / 启停 |
| GET/PUT | `/api/mcp/config` | MCP server 配置与启停 |
| PATCH | `/api/mcp/config` | 🔴 **单个 server 的定向启停**（上游 #4577，2026-07-31 并入）。设置页的 MCP 开关必须走这条，**不能整份 PUT 回写** —— 否则同一份配置里其他非法/不完整的 peer server 条目会被一并校验而连带失败。前端契约：mutation 期间禁用开关，成功 refetch 完成前不解禁；失败时用后端返回的 `detail` 弹 toast；仅在成功后失效 `["mcpConfig"]` |
| GET | `/api/agents`、`/api/agents/{name}`、`/api/agents/check?name=…` | 自定义 agent CRUD 与查重 |
| GET | `/api/suggestions/config` | 建议配置 |
| POST | `/api/input-polish` | 提交前草稿润色 |
| `/api/channels…` | | IM 渠道（连接 / 断开 / 运行时配置） |
| `/api/scheduled-tasks…` | | 定时任务 CRUD / trigger / pause / resume / runs |
| `/api/integrations/lark/{status,install,auth/start,auth/complete,config/start,config/complete}` | | Lark CLI 托管集成 |

### Memory（唯一走前端 BFF 的一组）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| — | `/api/memory`、`/api/memory/[...path]` | **前端 route handler**（[app/api/memory/](../frontend/src/app/api/memory/)）转发到 Gateway |
| GET/DELETE | `/api/memory` | 读取 / 清空 |
| `/api/memory/facts`、`/api/memory/facts/{id}` | | 事实 CRUD |
| `/api/memory/export`、`/api/memory/import` | | 导出 / 导入 |

> Memory 是唯一有自建 route handler 的领域。重构时若要统一走直连 REST，
> 需先确认这层 BFF 没有承担额外职责（如流式/大 payload 处理）。

## 6.4 已知的错误语义约定

| 场景 | 状态码 | 前端行为 |
| --- | --- | --- |
| 未鉴权（REST） | 401 | `fetcher.ts` 自动跳 `/login` |
| token-usage 无权限/不存在 | 403 / 404 | 返回 `null`（不当错误处理） |
| run 已终态、取消 | 409 + `"is not cancellable"` | **静默吞掉**（no-op），清 reconnect key |
| run 活在别的 worker，取消失败 | 409 + `"not active on this worker and cannot be cancelled"` | **必须报错**，不能吞 |
| run 在别的 worker、无法 stream | 409 + `"not active on this worker"` + `"cannot be streamed"` | `isInactiveRunStreamError` → 结束流，不抛 |
| run 活动中改名 / compact | 409 | 对话框保持打开并显示服务端错误 |
| 传了未知 thread id（如字面量 `"new"`） | 422 | 靠 `use-thread-chat.ts` 提前拦住 |
| SSE 重放历史不足 | `gap` 控制帧 | `recoverStreamReplayGaps` 恢复（见 05） |

**技术债**：409 的两个分支目前靠**消息子串匹配**区分
（`isRunConflictError(error, ...needles)`，AND 语义），
真相来源是 `backend/app/gateway/routers/thread_runs.py::_cancel_conflict_detail`。
后端一旦提供结构化 error code，前端应改为按 code 判定。

## 6.5 Mock 后端覆盖面

[app/mock/api/](../frontend/src/app/mock/api/) 提供的假接口（`?mock=true` 时生效）：

```
/mock/api/models
/mock/api/skills
/mock/api/mcp/config
/mock/api/threads/search
/mock/api/threads/{thread_id}/history
/mock/api/threads/{thread_id}/artifacts/[[...artifact_path]]
/mock/api/integrations/lark/{status,install,auth/start,auth/complete,config/start,config/complete}
```

Mock 模式下输入框被禁用（`disabled={isMock || …}`），所以**不需要** mock run 流。
重构时若新增依赖某接口的组件，Mock 模式下要么 mock 该接口，要么优雅降级。

## 6.6 相关的 Nginx 特例路径

Nginx 为部分路径配了独立 location（各带自己的 header/大小/超时设置），
改后端路径时要一并检查 [docker/nginx/nginx.conf](../docker/nginx/nginx.conf)：

- `/api/langgraph/`（重写 + SSE + 20M body + 关闭请求缓冲 + 600s 超时）
- `/api/models`、`/api/memory` 等单独 location
- uploads 相关 location（大体积二进制）
