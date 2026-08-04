# 08 · Agent 内核契约

> **状态：骨架。接口在 [M2](06-migration-plan.md#m2--l1-packagesagent-core--模板的第一份可交付资产) 完成前不冻结。**
>
> 本文档面向两类读者：一是 `frontend-vue` 的实现者，二是**后续想复用这套 agent 前端架构的其他项目**——它们的后端未必是 LangChain / LangGraph。
>
> **本文档是本次工作的产品定义，不是附录。** `frontend-vue` 的目的就是产出这套可复用分层。

## 为什么要有这一层

`frontend-vue` 有两个目标，且有主次：

1. **产出可被其他项目复用的 agent 前端架构** ← 这是产品
2. 与 `frontend/` 全域 1:1 对标 ← 这是**验证手段**，也是终态

第 2 条服务于第 1 条：能用抽出来的层重建一个成熟的 agent 应用，才证明这些层是完整的。反过来，如果只抽层不重建，边界对不对没人知道。

切法参照 `gamma-project` 已经验证过的 `agentCore` / `deepResearch` 双层结构——注意它的 `agentCore` 只有 226 行，是**从 10,538 行业务代码里提炼出来的，不是预先设计的**。

## 三层定义

| 层 | 目录 | 通用度 | 何时做 |
| --- | --- | --- | --- |
| **L1 · agent-core** | **`frontend-vue/packages/agent-core/`** | 完全通用 | **M2**，独立包 |
| **L2 · agent-ui-kit** | `app/core/markdown/` · `app/components/elements/` · `workspace/messages/` 等 | 大部分通用 | **M4b / M5 逐模块抽，M8 收口** |
| **L3 · deerflow** | `app/core/agent-deerflow/` 及各业务目录 | 不通用 | M5 / M6 |

### L1 为什么是独立包

`packages/agent-core/` 有自己的 `package.json` 与测试。**将来复用时整个目录搬走即可，零改动**——不需要从 `app/core/` 里挑文件。边界由 `tests/architecture.test.ts` 守护，从 M0 起就存在。

⚠️ **它必须通过 workspace 协议被引用，不是相对路径。** 早期版本写「通过相对路径引用，不需要 workspace 协议」，那样它就不是一个真包：

- `packages/agent-core/package.json` 里声明的依赖**不会被安装**（pnpm 只装 `frontend-vue/package.json`）
- `exports` / `types` 字段不生效，消费方被迫写 `~~/packages/agent-core/src/index` 这类深路径
- **「搬走零改动」的承诺随即落空**——复用方拿到的包，其依赖清单从没被验证过

做法：在 `frontend-vue/` 内放一份自己的 `pnpm-workspace.yaml`（仍是零仓库改动，文件在本目录内），`app/` 用 `"@deerflow/agent-core": "workspace:*"` 引用。详见 [03-project-shape.md](03-project-shape.md#packagesagent-core-怎么被解析)。

### L2 的抽取时机：逐模块，不是最后

早期版本写的是「等 1:1 达成、E2E 全绿后再抽」。**这条已推翻。**

理由是本文档自己给出的：全做完 133 个 DeerFlow 形状的组件再回头抽，「可移植」这个目标会在中间几个阶段里被磨掉。改为：

| 时机 | 动作 |
| --- | --- |
| M4b 完成 | 抽第一批 L2 边界（消息分组、run-duration、reasoning 规则、tool call 展示、composer draft、human-input、Markdown 流式），写进本文档 |
| M5 完成 | artifacts 是第一个建在 L2 之上的真实 L3 功能——**用它反向修正 M4b 抽的接口** |
| M8 | 收口成正式契约 + 复用上手文档 |

这样既不是盲目预先设计（gamma 的教训），也不会拖到最后（磨掉的风险）。M5 的 artifacts 同时是**活的扩展示例**：复用方照着它接自己的业务面板。

## 依赖方向

```
components/  ──→  core/agent-deerflow/  ──→  packages/agent-core/
     │                                            ▲
     └────────────────────────────────────────────┘
                    （只读类型，不反向依赖）

agent-core/  ──✗──→  core/agent-deerflow/
agent-core/  ──✗──→  components/
agent-core/  ──✗──→  任何 DeerFlow 业务目录
```

**由 `tests/architecture.test.ts` 自动守护**（抄 `gamma-project` 的做法，它的用例名是"分层纪律与文档契约未被悄悄改掉"）。边界破了 CI 就红。

## L1 内核禁入清单

`packages/agent-core/` 里**不允许出现**：

- ❌ 任何具体 endpoint 路径（`/threads/...`、`/api/...`）
- ❌ LangGraph 的 stream mode 概念（`values` / `messages-tuple` / `checkpoints`…）
- ❌ DeerFlow 业务概念：artifact、skill、subagent、goal、human-input、workspace-change、browser-view、channel、mcp
- ❌ 鉴权 token 的读取（由调用方注入）
- ❌ 任何 Vue 组件或 `.vue` 文件
- ❌ 从 `frontend/` 或 `agent-deerflow/` import 类型
- ❌ 全局单例（store 必须是工厂）

**唯一的显式白名单：`adapters/`。**

`src/` 下不允许出现任何框架依赖；但 `adapters/` 目录是给「用 L1 撑起某个框架的既有接口」准备的，[M2 的探针产物](06-migration-plan.md#m2--l1-packagesagent-core--模板的第一份可交付资产) `use-stream-compat.ts` 就落在这里，它会引入 **React 类型**。

规则：

- `adapters/` 里的框架依赖一律是 **type-only + optional peer**，不能是运行时硬依赖
- `architecture.test.ts` 对 `src/` 与 `adapters/` 用**两套断言**：`src/` 零框架依赖，`adapters/` 允许在白名单内
- 每新增一个 adapter，要在本节登记它依赖了什么

不这么写的话，探针产物一旦留下来，「协议无关内核」就悄悄变成了「带 React 依赖的内核」，而守护测试不会报警。

## 接口契约（草案）

### 消息契约

```ts
export type AgentMessageRole = "human" | "assistant" | "tool" | "system";

export interface AgentToolCall {
  id: string;
  name: string;
  args?: unknown;
  /** 流式期间的参数碎片；finish 时收口成 args */
  argsChunks?: string[];
  argsParseFailed?: boolean;
  result?: unknown;
}

export interface AgentMessage {
  id: string;
  role: AgentMessageRole;
  content: string;
  /** 流式片段，逐词动画依赖它；不要用 content.split() 反推 */
  contentChunks: string[];
  reasoning?: string;
  reasoningChunks?: string[];
  toolCalls?: AgentToolCall[];
  isStreaming: boolean;
  finishReason?: string;
  /**
   * 扩展位：适配层塞协议特有字段（DeerFlow 用它带 additional_kwargs /
   * run_id / agent 名等）。**内核不解释 meta 的内容**，只负责原样保留。
   */
  meta?: Record<string, unknown>;
}
```

`meta` 是内核保持通用的关键——它让适配层带上任意协议特有信息，而内核不需要认识它们。

### SSE 传输

```ts
export interface SseFrame {
  /** SSE `event:` 字段；省略时按规范默认为 "message" */
  event: string;
  /** SSE `data:` 字段，多行按 \n 拼接；只剥一个前导空格，不要 trim */
  data: string;
  /** SSE `id:` 字段——重放游标的载体，不要丢 */
  id?: string;
}

export interface StreamReaderOptions<TEvent> {
  url: string | URL;
  init?: RequestInit;
  /** 适配层提供：SseFrame → 业务事件；返回 undefined 表示跳过 */
  parse: (frame: SseFrame) => TEvent | undefined;
  cursor?: CursorStrategy<TEvent>;
  retry?: { max: number; backoff: (attempt: number) => number };
  /** buffer 上限，防止后端不发分隔空行时无限增长 */
  maxBufferBytes?: number;
  signal?: AbortSignal;
}

/** 惰性 async iterable——调用方用 for await 消费，天然支持背压与 abort */
export function streamEvents<TEvent>(
  options: StreamReaderOptions<TEvent>,
): AsyncIterable<TEvent>;
```

内核负责：分帧（含 **CRLF 归一化**）、`event`/`data`/`id` 三字段解析、重试与**指数退避**、重试总量上限、buffer 上限、abort 静默结束、**抛错而非静默 return**。

内核不负责：URL 构造、鉴权头、业务事件语义。

### 游标策略（协议差异最大的地方）

```ts
export interface CursorStrategy<TEvent> {
  /** 从事件提取游标；返回 undefined 表示该事件不携带游标 */
  extract(event: TEvent): string | undefined;
  /** 把游标写进下次请求（请求头或 query） */
  apply(url: URL, init: RequestInit, cursor: string): void;
  /**
   * 一个游标都没拿到就失败时的策略。
   * "abort"   —— 放弃并上报（推荐：从头重放会制造重复消息）
   * "restart" —— 从头重来（仅当协议保证幂等时）
   */
  onMissing: "abort" | "restart";
}
```

已知的三种实现：

| 项目 | 机制 |
| --- | --- |
| **DeerFlow** | SSE `Last-Event-ID` 请求头 |
| gamma-project | 业务字段 `last_message_index` + `segment_continue` 事件 |
| 无续传能力的后端 | `extract` 恒返回 `undefined` + `onMissing: "abort"` |

### 事件归约

```ts
export interface ReducerSnapshot {
  messageIds: string[];
  messages: Record<string, AgentMessage>;
}

export type ReduceAction =
  | { type: "ignore" }
  | { type: "error"; message: AgentMessage; recovery: AgentErrorRecovery }
  | {
      type: "merge";
      event: unknown;
      messageId: string;
      /** 目标消息不存在时先 append */
      appendMessage?: AgentMessage;
      /** 临时 id → 真实 id 的重写，避免 UI 出现两张重复卡片 */
      rewriteMessage?: { fromId: string; message: AgentMessage };
    };

export type EventReducer<TEvent> = (
  event: TEvent,
  snapshot: ReducerSnapshot,
  ctx: { createId: () => string },
) => ReduceAction;
```

**必须是纯函数**——只读 snapshot，不碰 store。`createId` 可注入（生产传 `nanoid`，测试传固定值）。

内核提供通用的消息归属规则：按 id 查找、按 `toolCall.id` 反查宿主消息（倒序）、临时 id 重写。适配层负责把自己的事件类型映射到这些规则上。

### Store 工厂

```ts
export function createAgentStore<TEvent>(options: {
  /** 作用域键。DeerFlow 传 threadId；单会话项目传常量即可 */
  id: string;
  reducer: EventReducer<TEvent>;
  merge: (message: AgentMessage, event: TEvent) => AgentMessage;
  watchdog?: WatchdogRules;
}): StoreDefinition;
```

**必须是工厂，不能是 `defineStore("agent")` 全局单例。** DeerFlow 有多 thread 并存 + sidecar 子会话，全局单例会造成跨会话状态泄漏；单会话项目用工厂也毫无损失。

### 断流看门狗

```ts
export interface WatchdogRules {
  /** 静默多久算断流 */
  idleMs: number;
  /** 返回 true 表示"这段静默是正常的"，不要重连 */
  shouldPause(input: {
    lastMessage?: Pick<AgentMessage, "role" | "finishReason" | "isStreaming" | "meta">;
    isTerminal: boolean;
  }): boolean;
}
```

设计出处见 `gamma-project` 的 `stream-watchdog.ts`。核心洞察是"没有新消息"有两种含义——**真断流该重连，后端在等用户操作则不该重连**。这个判断必须收敛成一个纯函数，**不能散在各张卡片的 `onMounted` 里调 `cancel()`**（那样每新增一种会等待用户的卡片都得记得加一行，忘了就是莫名其妙重连）。

⚠️ `idleMs` 不要照抄 gamma 的 15 秒。DeerFlow 的 agent 会跑很长的工具调用（sandbox 执行、浏览器操作、子 agent），15 秒静默完全正常。

### 错误分类

```ts
export type AgentErrorKind =
  | "network" | "abort" | "backend_error"
  | "parse_error" | "cursor_exhausted" | "unknown";

export class AgentStreamError extends Error {
  constructor(
    readonly kind: Extract<AgentErrorKind, "cursor_exhausted" | "backend_error">,
    message: string,
  );
}

export interface AgentErrorRecovery {
  kind: AgentErrorKind;
  retryable: boolean;
  userMessage: string;
  /** 由调用方定义的补偿动作，内核不解释 */
  actions: unknown[];
}
```

**后端明确报错不重试直接抛；网络抖动才进重试。** transport 放弃时必须抛 `AgentStreamError` 而不是静默 `return`——生成器静默结束会让上层分不清"读完了"和"彻底失败"，UI 会一直转圈。

## DeerFlow 适配层要提供什么

`app/core/agent-deerflow/` 实现上述接口：

| 文件 | 职责 |
| --- | --- |
| `endpoints.ts` | `/threads/:id/runs/stream`、`join`、`cancel` 的 URL 构造 |
| `cursor-last-event-id.ts` | `CursorStrategy` 实现，用 SSE `Last-Event-ID` 请求头 |
| `event-map.ts` | `values` / `messages-tuple` / `updates` / `custom` → `ReduceAction` |
| `message-adapt.ts` | LangGraph Message ⇄ `AgentMessage`，协议特有字段进 `meta` |
| `stream-mode.ts` | ← **白名单属于适配层**，`values`/`messages-tuple`/… 是 LangGraph 概念，不进内核 |
| `gap-recovery.ts` | DeerFlow 特有的 `gap` 控制帧处理与 rejoin |

## 测试要求

| 位置 | 内容 |
| --- | --- |
| `tests/unit/agent/` | [05-invariants.md](05-invariants.md) 的 **A 组 + L 组**全部；内核的每个纯函数 |
| `tests/architecture.test.ts` | 依赖方向与禁入清单的自动守护 |

移植 `gamma-project` 的 4 个 transport 用例作为起点：SSE 解析、buffer 分帧、游标续拉、**无游标失败时报 `cursor_exhausted`**。

## L2 抽取（1:1 达成后）

> 候选内容：消息分组、run-duration 折叠、reasoning 位置规则、tool call 与 processing 步骤展示、composer draft、human-input 协议、Markdown 流式渲染。
>
> **按 [M4b / M5 / M8 三个时机分批填](#l2-的抽取时机逐模块不是最后)，不要等到最后。** 每次抽取都要保持「能对照原实现」这个前提——所以抽的是边界，不是行为：接口挪位置，实现逐字不动。
