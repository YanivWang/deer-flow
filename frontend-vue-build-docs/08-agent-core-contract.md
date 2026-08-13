# 08 · Agent 内核与 DeerFlow 协议契约

> **状态：合同已冻结，M2/M4a 已实现对应内核与数据流。** Nuxt proxy 下的
> create/resume/cancel/gap/heartbeat 已有 M0/M4a gate；M4b 产品消费链仍未完成。
> 当前红绿与下一步见 [10-current-status-and-next.md](10-current-status-and-next.md)。
> 新运行证据若与本文不同，必须先修订合同和测试，不能边写组件边猜协议。
>
> 本文是 `frontend-vue` 的 L1/L3 边界唯一来源。目录结构、里程碑、测试和运行文档不得另造一套接口。

## 目标与非目标

`frontend-vue` 同时承担两个目标：

1. 产出可被其他 agent 项目复用的纯 TypeScript 内核；
2. 用该内核重建 DeerFlow，达到功能、交互和关键视觉状态对标。

L1 解决通用问题：SSE 分帧、连接生命周期、消息归并、可观察状态和错误分类。L1 **不认识** LangGraph endpoint、stream mode、DeerFlow artifact，也**不返回 Pinia 类型**。Pinia、Nuxt runtime config、Gateway endpoint 和业务事件都在 L3。

## 三层定义

| 层                    | 目录                                                           | 职责                                                         | 何时完成             |
| --------------------- | -------------------------------------------------------------- | ------------------------------------------------------------ | -------------------- |
| **L1 · agent-core**   | `frontend-vue/packages/agent-core/`                            | 框架与协议无关的 transport、session、reducer、external store | M2                   |
| **L2 · agent-ui-kit** | `app/core/markdown/`、`app/components/elements/`、通用消息组件 | 通用 UI 行为和扩展点                                         | M4b/M5 抽取，M8 收口 |
| **L3 · deerflow**     | `app/core/agent-deerflow/` 及 DeerFlow 业务目录                | Gateway 协议、Pinia/Nuxt 绑定和业务状态                      | M4a 起               |

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

> **M2 落地：`make consumer-check`（`frontend-vue/scripts/consumer-check.mjs`）。**
> 三步缺一不可：`pnpm pack` 打真包（只有真进 tarball 的文件才存在）→
> 系统临时目录 clean install（往上找不到本仓库的 `node_modules`，没有兜底）→
> 从 **bare specifier** 消费（深路径 import 会绕过 `exports`）。
> 最小 session 要**真跑**而不只是编译：`exports.import` 指错文件时 tsc 一样绿——
> 这条是实测的，把 `exports` 改指一个不存在的文件之后 `make consumer-check` 当场红。
>
> 它**不进 `make verify`**：要联网装 typescript/esbuild，而 verify 必须能离线跑。
> 里程碑收口与改动 `packages/agent-core/package.json` 时必须跑一次。

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

> **M2 落地：`app/core/agent-deerflow/message-adapt.ts`。**
> round-trip 由**构造**保证而不是逐字段枚举：`meta` 收下 wire 对象里除
> `id` / `content` / `tool_calls` / `tool_call_chunks` 之外的全部键，回程原样摊开。
> 逐字段枚举会在后端加字段那天静默丢掉它，而 round-trip 测试用的是今天的 fixture。
>
> round-trip 的范围是 **durable 消息**（checkpoint / `values` 形状），
> 13 个 fixture 的 516 条逐条往返（`tests/unit/agent-deerflow/message-adapt.test.ts`）。
> `messages-tuple` 的流式分片（`AIMessageChunk` + `tool_call_chunks`）是**单向**的：
> 分片并进 `toolCalls.argsChunks`，回程只写规范化后的 `tool_calls`。分片不落库，
> 把它原样写回去等于让 UI 看到一个既有分片又有成品的四不像。
>
> 两处不可逆，都是有意的：wire 没有 `id` 时会被赋一个（没有 id 的消息本来就无法
> 在按 id 归并的存储里存活；516 条**全部**带 id）；工具调用回程一律补
> `type: "tool_call"`（那是这个字段唯一的合法值，属于规范化）。

## SSE 分帧契约

```ts
export interface SseEvent {
  event: string;
  data: string;
  id?: string;
}

export type SseFrame =
  { kind: "event"; event: SseEvent } | { kind: "heartbeat"; comment: string };

export interface FrameReaderOptions {
  maxBufferBytes: number;
  signal?: AbortSignal;
}

export function readSseFrames(
  body: ReadableStream<Uint8Array>,
  options: FrameReaderOptions,
): AsyncIterable<SseFrame>;
```

内核不认识 `end` / `error` / `gap` 这些名字（它们是 DeerFlow 的 wire 事件名，
写进 L1 就等于把协议塞进内核），但它必须知道「这一帧意味着流正常结束 / 后端报错 /
出现重放缺口」，否则**意外 EOF 与正常完成永远分不出来**。所以协议知识由适配层通过
一个纯函数传入，这是 L1 唯一的协议知识入口：

```ts
export type StreamSignal =
  | { kind: "data" }
  | { kind: "completed" }
  | { kind: "failed"; error: AgentStreamError }
  | { kind: "gap" };

export type ClassifyEvent = (event: SseEvent) => StreamSignal;
```

`maxBufferBytes` 量的是**还没成帧的残留**，不是吞吐：上限必须在把完整帧排干**之后**
判。收到 chunk 就判的写法会让一个装了 50 个完整帧的 chunk 触发一个小上限，
而缓冲其实一直很小。

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

export type RunOutcome = "completed" | "cancelled" | "failed";

export type CancelResult =
  | { kind: "drain"; response: Response }
  | { kind: "accepted" }
  | { kind: "terminal"; outcome?: RunOutcome; reason?: string };

export interface InspectedRun {
  terminal: boolean;
  /** 终态时必须给出。durable status → outcome 的映射由适配层做，见下方说明。 */
  outcome?: RunOutcome;
  reason?: string;
}

export interface RunProtocol<TStart, THandle> {
  /** 只调用一次；网络错误发生在拿到 handle 之前时默认 fail closed。 */
  create(input: TStart, signal: AbortSignal): Promise<OpenedStream<THandle>>;
  /** 只针对已存在的 run；由协议适配器决定 GET、header 或 query cursor。 */
  resume(
    handle: THandle,
    cursor: string | undefined,
    signal: AbortSignal,
  ): Promise<Response>;
  /** 不得把 200 SSE、202 accepted 和 204 terminal 压成 void。 */
  cancel(
    handle: THandle,
    cursor: string | undefined,
    signal: AbortSignal,
  ): Promise<CancelResult>;
  /** cancel 只返回 accepted 时，用 durable run resource 收敛到终态。 */
  inspect(handle: THandle, signal: AbortSignal): Promise<InspectedRun>;
}

export type RunSessionState<THandle> =
  | { status: "idle" }
  | { status: "creating" }
  | { status: "streaming"; handle: THandle; cursor?: string }
  | {
      status: "reconnecting";
      handle: THandle;
      cursor?: string;
      attempt: number;
    }
  | {
      status: "stopping";
      handle: THandle;
      cursor?: string;
      mode: "draining" | "polling";
    }
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

> **`outcome` 是 M2 补上的，原来的 `{ terminal, reason }` 表达不了硬规则 8。**
> 上一条要求分出 `cancelled` / `completed` / `failed` **三个**去向，而
> `terminal: boolean` 只有两个值。要在原形状下分路，内核就得认识
> `"interrupted"`、`"timeout"` 这类 DeerFlow durable status 字符串——那正是
> §L1 禁入清单第 2、3 条禁止的。所以映射留在适配层
> （`app/core/agent-deerflow/run-protocol.ts` 的 `DEERFLOW_DURABLE_STATUS`），
> 内核只接收映射结果。适配层没给 `outcome` 时内核按 `cancelled` 处理：
> 走到那里说明用户点了 stop 且后端确认了终态，读成 `completed` 会让 UI 显示
> 一条其实被打断的回答已经正常完成。

> **未知 durable status 当作「还没到终态」，不是失败。** 后端加一个枚举值就把
> run 判死，会在加字段那天让所有停止操作报错；有界轮询本身会兜底。

## DeerFlow RunProtocol 的已知映射

M-1 已由源码、测试和 replay Gateway 固化下表；M0 必须再验证 Nuxt preview 不改变这些行为：

| 动作              | 方法与路径                                                                  | 关键响应/请求                                                          |
| ----------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| create            | `POST /api/langgraph/threads/:threadId/runs/stream`                         | 从 `Content-Location` 提取 thread/run；同时记录实际是否存在 `Location` |
| resume/join       | `GET /api/langgraph/threads/:threadId/runs/:runId/stream`                   | 带 `Last-Event-ID`（有 cursor 时）                                     |
| inspect           | `GET /api/langgraph/threads/:threadId/runs/:runId`                          | 202 cancel 后读取 durable `status`，有界退避直到终态或明确超时         |
| cancel            | `POST /api/langgraph/threads/:threadId/runs/:runId/cancel`                  | 明确 `action`/`wait`；202 进入 durable status poll，204 才是已完成     |
| cancel-then-drain | `POST /api/langgraph/threads/:threadId/runs/:runId/stream?action=interrupt` | 200 SSE 继续读尾帧；跨 worker 可能只回 202，不能假定总有 body          |

Gateway 的 create 响应与运行探针明确提供 `Content-Location`，没有观察到
`Location`；SDK 用前者提取 run metadata，而旧重连 helper 查找后者。这不是可忽略的
命名差异。M0 raw-response 测试后来已经记录 Nuxt proxy 后的两个 header；当前共享
Playwright mock 仍缺 `Content-Location`，必须修 mock，禁止凭 SDK 假设或放宽 fail-closed
协议。见 [10](10-current-status-and-next.md)。

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

> **M2 落地：`app/core/agent-deerflow/reducer.ts`。**
> `values` 的全量语义有一处 M0 录制当场证伪浅合并的证据：第 4 帧 `values` 里，
> 原来 id 为 `X` 的 human 消息变成 `X__user`，而 `X` 被一条 system-reminder
> **顶替**了。浅合并会让旧的 human 永远留在列表里，用户看到自己发的消息出现两次。
> 同一条录制里还有 3 条只出现在 `messages` 帧、从没进过任何 `values` 的
> AI 分片消息——它们必须被 `values` 清掉。
>
> `updates` 的通道 reducer：`messages` 走 LangGraph 的 `add_messages`
> （按 id 归并、`type: "remove"` 删除、新 id 追加），其余通道是 `LastValue`。
> 把 `messages` 当整段替换，任何只写单个通道的节点更新都会清空消息列表。
>
> **一处已知限制：`values` 对已存在的消息是 `upsert`（合并）而不是替换**，
> 所以可选字段（`reasoning` / `toolCalls`）只增不减。要做成真替换就得
> remove+upsert 整段，那会丢掉 `contentChunks` 并在长 thread 上退化成 O(n²)。
> 今天不会分叉，因为 DeerFlow 的 durable checkpoint **保留**
> `additional_kwargs.reasoning_content`（516 条里 203 条带着它）。
> 哪天后端在 checkpoint 里删掉它，这条就会显形。

Gateway durable status 与 UI session 的冻结映射是：`pending → creating`、`running → streaming/reconnecting`、`success → completed`、`interrupted → cancelled`、`error|timeout → failed`。`stopping` 只是客户端瞬态，Gateway 没有 `completed/cancelled/failed/stopping` 这些枚举。

## 框架无关 external store

L1 不返回 `StoreDefinition`，也不 import Pinia：

```ts
export interface AgentExternalStore<TState, TEvent> {
  getSnapshot(): AgentSnapshot<TState>;
  subscribe(listener: () => void): () => void;
  dispatch(event: TEvent): void;
  reset(next: TState): void;
  /** 立刻把挂起的通知发出去。 */
  flushNotifications(): void;
}

export function createAgentExternalStore<TState, TEvent>(options: {
  initialState: TState;
  reducer: EventReducer<TState, TEvent>;
  createId: () => string;
  now: () => number;
  /** 通知调度（05 A1）。默认合并到当前宏任务末尾。 */
  scheduleNotify?: (flush: () => void) => void;
}): AgentExternalStore<TState, TEvent>;
```

> **通知是合并的，不是同步的（05 A1，M2 补上）。** 同一个宏任务里派发的若干个
> 流事件只产生**一次**通知，默认调度器是 `queueMicrotask`——微任务检查点正好在
> 当前宏任务末尾、渲染之前，所以「合并」与「绝不拖到下一帧」同时成立。
> **不能做成 `setTimeout(fn, N)` 那种尾部防抖**：chunk 持续到达时它会一直往后推，
> 而流式回答恰恰就是 chunk 持续到达。
>
> `getSnapshot()` 始终同步最新——合并的只有通知，不是数据。
> `flushNotifications()` 是给同步读者的出口（卸载前的最后一次落盘、测试断言、
> 需要在同一 tick 里量尺寸的适配器）；没有它，唯一的等待方式是「再 await 一个
> 微任务」，那是在猜调度器的实现。
> `scheduleNotify` 是给宿主换**宏任务边界的定义**用的（Vue 侧可换 `nextTick`），
> 不是给「加一点防抖」用的。

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

| 资产                                 | 验证什么                                                     | 不能证明什么             |
| ------------------------------------ | ------------------------------------------------------------ | ------------------------ |
| 13 个 `thread.json` / 516 条最终消息 | message adapter、最终 state、导出和渲染输入                  | SSE 时序、cursor、重连   |
| raw SSE golden traces                | 分帧、事件顺序、chunk merge、heartbeat、gap、end/error       | 真实代理和网络行为       |
| fake upstream 集成测试               | LF/CRLF、跨 chunk、buffer、断流、POST→GET 方法切换           | Gateway 当前 header 约定 |
| real Gateway smoke                   | Content-Location/Location、Last-Event-ID、cancel、代理、认证 | 全量 UI 回归             |

当前 checkout 的最终 fixture 是 **13 个 `thread.json` / `values.messages` 合计 516 条**；读取顶层 `messages` 会错误得到 0。M-1 的去敏运行证据见 [evidence/m-1-replay-gateway-probe.md](evidence/m-1-replay-gateway-probe.md)。

M2 的长期门禁必须同时包含前 3 类；第 4 类进入专门的 real-backend job。raw trace 至少覆盖富内容、reasoning、tool call 碎片、临时 id 重写、subagent namespace、`updates`/`custom`/`checkpoints`/`tasks`、heartbeat、gap、error/end、断线重连，并断言请求模式 `messages-tuple` 对应 wire event `messages`。

旧实现或 LangGraph SDK 可以作为开发期 oracle，但不能只比较最终 516 条消息就宣布 transport 等价。删除 SDK 的条件是：raw trace 差分、session 状态机测试和 real Gateway smoke 全部通过。

> ⚠️ **「作为 oracle」不等于「装进 `frontend-vue`」。** oracle 是继续跑着的 `frontend/`（见 [07](07-parallel-run.md)）和 M2 那个一次性 worktree 里的兼容探针（[06 §M2](06-migration-plan.md)、本文 §L1 禁入清单），两者都不需要往 `frontend-vue/package.json` 里加依赖。**依赖增删的裁决在 [02 §LangChain 依赖全部去掉](02-stack.md) 与 [04 §移除 LangChain](04-architecture-decisions.md)，不在本文**——02 逐字写了 `@langchain/langgraph-sdk` 与 `@langchain/core`「不必装进项目」，`api/api-client.ts` 的值导入对应的处置是自写 `core/api/client.ts`（~180 行），属于 M2。
>
> 这条警告是补出来的：M1 有一个窗口正是读了上面那句就把 SDK 装了进去，回退过程见 [evidence/m1-retyped-landing.md](evidence/m1-retyped-landing.md#订正装-sdk-是错的)。

## L2 抽取时机

L2 按实现反馈逐步抽取，不预先冻结所有 UI：

| 时机 | 动作                                                                       |
| ---- | -------------------------------------------------------------------------- |
| M4b  | 抽消息分组、reasoning、tool call、composer、human-input、Markdown 流式接口 |
| M5   | 用 artifacts/sidecar 反向验证扩展点                                        |
| M8   | 冻结公共导出、consumer 示例和迁移指南                                      |

每次抽取只移动已经被 React 基线、Vue 实现和共享 E2E 同时证明过的行为，禁止为了“通用”提前发明业务接口。
