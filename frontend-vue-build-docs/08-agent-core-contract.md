# 08 · Agent 内核与 DeerFlow 协议契约

> **状态：M-1 已冻结。** 当前源码、测试和 Gateway replay 运行探针已经确认响应头、续传与终止行为；仍需经 Nuxt proxy 运行验证的 cancel/gap/heartbeat 边界列在 [09](09-m1-contract-freeze.md)。探针若与本文不同，必须先修订合同和测试，不能边写组件边猜协议。
>
> 本文是 `frontend-vue` 的 L1/L3 边界唯一来源。目录结构、里程碑、测试和运行文档不得另造一套接口。

## 目标与非目标

`frontend-vue` 同时承担两个目标：

1. 产出可被其他 agent 项目复用的纯 TypeScript 内核；
2. 用该内核重建 DeerFlow，达到功能、交互和关键视觉状态对标。

L1 解决通用问题：SSE 分帧、连接生命周期、消息归并、可观察状态和错误分类。L1 **不认识** LangGraph endpoint、stream mode、DeerFlow artifact，也**不返回 Pinia 类型**。Pinia、Nuxt runtime config、Gateway endpoint 和业务事件都在 L3。

## 三层定义

| 层 | 目录 | 职责 | 何时完成 |
| --- | --- | --- | --- |
| **L1 · agent-core** | `frontend-vue/packages/agent-core/` | 框架与协议无关的 transport、session、reducer、external store | M2 |
| **L2 · agent-ui-kit** | `app/core/markdown/`、`app/components/elements/`、通用消息组件 | 通用 UI 行为和扩展点 | M4b/M5 抽取，M8 收口 |
| **L3 · deerflow** | `app/core/agent-deerflow/` 及 DeerFlow 业务目录 | Gateway 协议、Pinia/Nuxt 绑定和业务状态 | M4a 起 |

依赖方向：

```text
Vue components ──→ Vue/Pinia adapter ──→ DeerFlow protocol adapter ──→ agent-core

agent-core ──✗──→ Vue / Nuxt / Pinia / LangGraph / DeerFlow 业务目录
```

`tests/architecture.test.ts` 从 M0 起守护上述方向。

## 包与 workspace 契约

`packages/agent-core/` 是一个真正的 workspace 包，必须具备自己的：

- `package.json`；
- `exports`、`types` 和测试入口；
- `src/index.ts` 公共导出面；
- `tests/`；
- 零运行时框架依赖。

`frontend-vue/pnpm-workspace.yaml` 包含 `.` 与 `packages/*`；应用根 `package.json` 必须显式声明：

```json
{
  "dependencies": {
    "@deerflow/agent-core": "workspace:*"
  }
}
```

禁止从应用中深路径 import `packages/agent-core/src/*`。可移植性的验收不是“复制目录后能编译”，而是把包放进一个临时 consumer workspace，执行 clean install、typecheck 和最小 session 测试。

## L1 禁入清单

`packages/agent-core/src/` 不允许出现：

- 具体 endpoint 或 `/api/` 路径；
- `values`、`messages-tuple`、`checkpoints` 等 LangGraph 名称；
- artifact、skill、subagent、goal、browser-view 等 DeerFlow 业务词；
- Vue、Nuxt、React、Pinia 或任何框架运行时依赖；
- cookie、token、runtime config 的读取；
- 全局单例；
- 从 `frontend/` 或 `app/core/agent-deerflow/` 反向 import。

框架适配器不放进 L1 `src/`。M2 的 React 兼容探针只存在于一次性 worktree；若以后决定发布 adapter，必须是独立 package，例如 `packages/agent-core-vue`，不能用一个含糊的 `adapters/` 白名单侵蚀核心边界。

## 消息契约

富内容必须无损保留。不能把 SDK 的数组内容压成字符串。

```ts
export type AgentMessageRole = "human" | "assistant" | "tool" | "system";

export interface AgentContentPart {
  type: string;
  text?: string;
  image_url?: string | { url: string; detail?: string };
  [key: string]: unknown;
}

export type AgentMessageContent = string | AgentContentPart[];

export interface AgentToolCall {
  id: string;
  name: string;
  args?: unknown;
  argsChunks?: string[];
  argsParseFailed?: boolean;
  result?: unknown;
}

export interface AgentMessage {
  id: string;
  role: AgentMessageRole;
  content: AgentMessageContent;
  /** 只记录真实收到的文本 delta；不得从最终 content.split() 反推。 */
  contentChunks: string[];
  reasoning?: string;
  reasoningChunks?: string[];
  toolCalls?: AgentToolCall[];
  isStreaming: boolean;
  finishReason?: string;
  /** 协议字段原样保留，L1 不解释。 */
  meta?: Record<string, unknown>;
}
```

DeerFlow 的 `additional_kwargs`、`response_metadata`、run id、agent 名和未知字段进入 `meta`。适配器必须有 round-trip 测试，证明 text/image/tool-call 内容不会丢失。

## SSE 分帧契约

```ts
export interface SseEvent {
  event: string;
  data: string;
  id?: string;
}

export type SseFrame =
  | { kind: "event"; event: SseEvent }
  | { kind: "heartbeat"; comment: string };

export interface FrameReaderOptions {
  maxBufferBytes: number;
  signal?: AbortSignal;
}

export function readSseFrames(
  body: ReadableStream<Uint8Array>,
  options: FrameReaderOptions,
): AsyncIterable<SseFrame>;
```

L1 负责：

- `LF`/`CRLF` 分隔；
- 多行 `data:` 拼接；
- `event` 默认值；
- `id` 保留；
- UTF-8 跨 chunk；
- 注释 heartbeat；
- EOF 尾帧；
- buffer 上限；
- abort；
- HTTP/解析错误不静默吞掉。

heartbeat 是 session 活动信号，不进入业务 reducer，但必须刷新 `lastActivityAt`。因此 session 输出控制信号，而不是让 `parse()` 返回 `undefined` 后丢失心跳。

## Run session：禁止把创建 POST 当普通重试请求

初始创建和断线续传是不同请求。L1 用协议计划描述它们，而不是接收一个可重复调用的 `url + init`。

```ts
export interface StreamRequest {
  url: string | URL;
  init: RequestInit;
}

export interface OpenedStream<THandle> {
  handle: THandle;
  response: Response;
}

export type CancelResult =
  | { kind: "drain"; response: Response }
  | { kind: "accepted" }
  | { kind: "terminal"; reason?: string };

export interface InspectedRun {
  terminal: boolean;
  reason?: string;
}

export interface RunProtocol<TStart, THandle> {
  /** 只调用一次；网络错误发生在拿到 handle 之前时默认 fail closed。 */
  create(input: TStart, signal: AbortSignal): Promise<OpenedStream<THandle>>;
  /** 只针对已存在的 run；由协议适配器决定 GET、header 或 query cursor。 */
  resume(handle: THandle, cursor: string | undefined, signal: AbortSignal): Promise<Response>;
  /** 不得把 200 SSE、202 accepted 和 204 terminal 压成 void。 */
  cancel(handle: THandle, cursor: string | undefined, signal: AbortSignal): Promise<CancelResult>;
  /** cancel 只返回 accepted 时，用 durable run resource 收敛到终态。 */
  inspect(handle: THandle, signal: AbortSignal): Promise<InspectedRun>;
}

export type RunSessionState<THandle> =
  | { status: "idle" }
  | { status: "creating" }
  | { status: "streaming"; handle: THandle; cursor?: string }
  | { status: "reconnecting"; handle: THandle; cursor?: string; attempt: number }
  | { status: "stopping"; handle: THandle; cursor?: string; mode: "draining" | "polling" }
  | { status: "completed"; handle: THandle }
  | { status: "cancelled"; handle?: THandle; reason?: string }
  | { status: "failed"; handle?: THandle; error: AgentStreamError }
  | { status: "gap"; handle: THandle; recovery: "reload_durable_state" };
```

硬规则：

1. `create()` 不自动重放。响应头到达前断网时，如果后端没有 idempotency key，就失败并让用户决定，不能盲目再 POST。
2. 只有拿到 `THandle` 后才能自动续传。
3. 重连必须调用 `resume()`，不能复用 create URL/method/body。
4. 只有网络错误和意外 EOF 可退避重连；后端 `error`、解析错误、权限错误不重试。
5. heartbeat 刷新 watchdog；业务等待态可暂停 watchdog。
6. `gap` 不从头重放，先 reload durable state，再由 L3 决定是否 join。
7. cancel 与 stream abort 分开：abort 本地读取不等于服务端 run 已取消。
8. UI stop 先进入 `stopping`。`cancel()` 返回 `drain` 时继续归约尾帧直到 `end/error`；返回 `accepted` 时用 `inspect()` 有界轮询 durable run；只有 durable `interrupted` 才进入 `cancelled`，`success` 进入 `completed`，`error/timeout` 进入 `failed`。创建阶段尚无 handle 就断开属于不确定结果，不能伪装成已取消。

## DeerFlow RunProtocol 的已知映射

M-1 已由源码、测试和 replay Gateway 固化下表；M0 必须再验证 Nuxt preview 不改变这些行为：

| 动作 | 方法与路径 | 关键响应/请求 |
| --- | --- | --- |
| create | `POST /api/langgraph/threads/:threadId/runs/stream` | 从 `Content-Location` 提取 thread/run；同时记录实际是否存在 `Location` |
| resume/join | `GET /api/langgraph/threads/:threadId/runs/:runId/stream` | 带 `Last-Event-ID`（有 cursor 时） |
| inspect | `GET /api/langgraph/threads/:threadId/runs/:runId` | 202 cancel 后读取 durable `status`，有界退避直到终态或明确超时 |
| cancel | `POST /api/langgraph/threads/:threadId/runs/:runId/cancel` | 明确 `action`/`wait`；202 进入 durable status poll，204 才是已完成 |
| cancel-then-drain | `POST /api/langgraph/threads/:threadId/runs/:runId/stream?action=interrupt` | 200 SSE 继续读尾帧；跨 worker 可能只回 202，不能假定总有 body |

当前 Gateway 的 create 响应与本轮运行探针均明确提供 `Content-Location`，没有观察到 `Location`；当前 SDK 用前者提取 run metadata，而重连 helper 查找后者。这不是可忽略的命名差异。M0 的 raw-response 测试必须记录最终经过 Nuxt proxy 后的两个 header，禁止凭 SDK 假设补齐。

## 事件与完整状态归约

L1 不只处理消息。它提供泛型状态容器；L3 决定 `values` 如何映射成完整 DeerFlow thread state。`values` 是全量 snapshot，归一化后替换 durable state；`updates` 是 node/channel 增量写，必须调用通道 reducer，不能与 `values` 共用浅 merge。UI-only Pinia state 始终与 durable state 分离。

```ts
export interface AgentSnapshot<TState> {
  state: TState;
  messageIds: string[];
  messages: Record<string, AgentMessage>;
  session: RunSessionState<unknown>;
  lastActivityAt: number;
}

export type ReduceAction<TState> =
  | { type: "ignore" }
  | { type: "replace-state"; state: TState }
  | { type: "patch-state"; patch: Partial<TState> }
  | { type: "upsert-message"; message: AgentMessage; afterId?: string }
  | { type: "merge-message"; messageId: string; message: AgentMessage }
  | { type: "rewrite-message-id"; fromId: string; message: AgentMessage }
  | { type: "remove-message"; messageId: string }
  | { type: "session"; session: RunSessionState<unknown> }
  | { type: "error"; error: AgentStreamError };

export type EventReducer<TState, TEvent> = (
  event: TEvent,
  snapshot: Readonly<AgentSnapshot<TState>>,
  context: { createId: () => string; now: () => number },
) => readonly ReduceAction<TState>[];
```

reducer 必须是纯函数。多 action 返回值允许一次 `values` 同时更新完整 state、消息顺序和 session 状态；不能把 artifact/todo/goal 更新散落到组件生命周期里。

Gateway durable status 与 UI session 的冻结映射是：`pending → creating`、`running → streaming/reconnecting`、`success → completed`、`interrupted → cancelled`、`error|timeout → failed`。`stopping` 只是客户端瞬态，Gateway 没有 `completed/cancelled/failed/stopping` 这些枚举。

## 框架无关 external store

L1 不返回 `StoreDefinition`，也不 import Pinia：

```ts
export interface AgentExternalStore<TState, TEvent> {
  getSnapshot(): AgentSnapshot<TState>;
  subscribe(listener: () => void): () => void;
  dispatch(event: TEvent): void;
  reset(next: TState): void;
}

export function createAgentExternalStore<TState, TEvent>(options: {
  initialState: TState;
  reducer: EventReducer<TState, TEvent>;
  createId: () => string;
  now: () => number;
}): AgentExternalStore<TState, TEvent>;
```

`app/core/agent-deerflow/vue/create-thread-store.ts` 再把这个 store 包成 Pinia/composable。每个 thread id 和 sidecar session 都创建独立实例；Vue adapter 测试负责证明卸载、切 thread 和并发 sidecar 不串状态。

## DeerFlow 请求模式与 wire event 全集

这两组名字不能混用。当前 Gateway 的请求模式白名单是：

`values`、`messages-tuple`、`updates`、`debug`、`tasks`、`checkpoints`、`custom`。

`messages` 与 `events` **不是可提交的请求模式**，必须在发 HTTP 前拒绝。`messages-tuple` 进入 Gateway 后映射成 LangGraph 的 `messages`，所以线上帧名是 `messages`，不是 `messages-tuple`。

`app/core/agent-deerflow/event-map.ts` 必须显式覆盖当前 wire event：

- `metadata`；
- `values`、`messages`、`updates`、`custom`、`checkpoints`、`tasks`、`debug`，以及这些事件的 `mode|namespace...` 形式；
- `error`、`end`、`gap`；
- heartbeat 注释控制帧。

`GET /api/langgraph/threads/:threadId/runs/:runId/events` 是持久化事件历史 REST endpoint；路径里的 `events` 不能被误写成 run stream mode 或 SSE event 名。

未知事件不能静默当成功：开发环境记录结构化 warning，生产环境保留 artifact/debug 信息并按明确策略 ignore。事件表必须从真实 raw trace 与当前 SDK manager 双向核对。

## Runtime config 与认证边界

普通 core 文件不得调用 `useRuntimeConfig()`。Nuxt plugin 在应用启动时读取 runtime config，构造纯对象后注入：

```ts
export interface DeerFlowRuntimeOptions {
  langgraphBaseUrl: string;
  backendBaseUrl: string;
  authDisabled: boolean;
}
```

Cookie 由浏览器/Gateway 管理；CSRF token 读取、`credentials` 和 header 注入属于 L3 API client。L1 不读取 cookie。

## 错误与 watchdog

```ts
export type AgentErrorKind =
  | "network"
  | "abort"
  | "http"
  | "backend_error"
  | "parse_error"
  | "missing_handle"
  | "reconnect_exhausted"
  | "replay_gap"
  | "unknown";

export class AgentStreamError extends Error {
  readonly kind: AgentErrorKind;
  readonly retryable: boolean;
  readonly cause?: unknown;
}
```

watchdog 的输入至少包含 `lastActivityAt`、session state、最后消息、是否正在等待 human input。默认 idle 值必须从真实长工具调用数据取基线，不能照抄其他项目的 15 秒。

## 测试资产：四类证据不能混用

| 资产 | 验证什么 | 不能证明什么 |
| --- | --- | --- |
| 13 个 `thread.json` / 516 条最终消息 | message adapter、最终 state、导出和渲染输入 | SSE 时序、cursor、重连 |
| raw SSE golden traces | 分帧、事件顺序、chunk merge、heartbeat、gap、end/error | 真实代理和网络行为 |
| fake upstream 集成测试 | LF/CRLF、跨 chunk、buffer、断流、POST→GET 方法切换 | Gateway 当前 header 约定 |
| real Gateway smoke | Content-Location/Location、Last-Event-ID、cancel、代理、认证 | 全量 UI 回归 |

当前 checkout 的最终 fixture 是 **13 个 `thread.json` / `values.messages` 合计 516 条**；读取顶层 `messages` 会错误得到 0。M-1 的去敏运行证据见 [evidence/m-1-replay-gateway-probe.md](evidence/m-1-replay-gateway-probe.md)。

M2 的长期门禁必须同时包含前 3 类；第 4 类进入专门的 real-backend job。raw trace 至少覆盖富内容、reasoning、tool call 碎片、临时 id 重写、subagent namespace、`updates`/`custom`/`checkpoints`/`tasks`、heartbeat、gap、error/end、断线重连，并断言请求模式 `messages-tuple` 对应 wire event `messages`。

旧实现或 LangGraph SDK 可以作为开发期 oracle，但不能只比较最终 516 条消息就宣布 transport 等价。删除 SDK 的条件是：raw trace 差分、session 状态机测试和 real Gateway smoke 全部通过。

> ⚠️ **「作为 oracle」不等于「装进 `frontend-vue`」。** oracle 是继续跑着的 `frontend/`（见 [07](07-parallel-run.md)）和 M2 那个一次性 worktree 里的兼容探针（[06 §M2](06-migration-plan.md)、本文 §L1 禁入清单），两者都不需要往 `frontend-vue/package.json` 里加依赖。**依赖增删的裁决在 [02 §LangChain 依赖全部去掉](02-stack.md) 与 [04 §移除 LangChain](04-architecture-decisions.md)，不在本文**——02 逐字写了 `@langchain/langgraph-sdk` 与 `@langchain/core`「不必装进项目」，`api/api-client.ts` 的值导入对应的处置是自写 `core/api/client.ts`（~180 行），属于 M2。
>
> 这条警告是补出来的：M1 有一个窗口正是读了上面那句就把 SDK 装了进去，回退过程见 [evidence/m1-retyped-landing.md](evidence/m1-retyped-landing.md#订正装-sdk-是错的)。

## L2 抽取时机

L2 按实现反馈逐步抽取，不预先冻结所有 UI：

| 时机 | 动作 |
| --- | --- |
| M4b | 抽消息分组、reasoning、tool call、composer、human-input、Markdown 流式接口 |
| M5 | 用 artifacts/sidecar 反向验证扩展点 |
| M8 | 冻结公共导出、consumer 示例和迁移指南 |

每次抽取只移动已经被 React 基线、Vue 实现和共享 E2E 同时证明过的行为，禁止为了“通用”提前发明业务接口。
