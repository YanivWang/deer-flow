/*
  【文件职责】     wire 消息 ⇄ 内核归一化消息的双向适配（08 §消息契约）。
  【架构位置】     L3
  【主要导出】     WireMessageLike · toAgentMessage · toAgentMessages
                   toWireMessage · toWireMessages · toRenderableMessage
                   mergeToolCallFragments
  【依赖关系】     @deerflow/agent-core · @/core/types/message
  【边界与注意】   08 §111 逐字要求「适配器必须有 round-trip 测试，证明
                   text/image/tool-call 内容不会丢失」。这里的实现策略是
                   **让 round-trip 由构造保证，而不是靠逐字段枚举**：
                   `meta` 收下 wire 对象里除 `id` / `content` / `tool_calls` /
                   `tool_call_chunks` 之外的**全部**键，回程时原样摊开。
                   逐字段枚举的写法在后端加一个字段那天会静默丢掉它，
                   而 round-trip 测试用的是今天的 fixture，抓不到明天加的字段。

                   **round-trip 的范围是 durable 消息（checkpoint / `values` 形状）。**
                   `messages-tuple` 的流式分片（`AIMessageChunk` +
                   `tool_call_chunks`）是**单向**的：分片被并进 `toolCalls`
                   的 `argsChunks`，回程只写规范化后的 `tool_calls`。
                   这不是偷懒——分片本来就不落库，把它原样写回去等于让
                   UI 看到一个既有分片又有成品的四不像。

                   reasoning 的落点是 `additional_kwargs.reasoning_content`
                   （上游 `messages/utils.ts` 就是这么读的）。它被**移出** meta
                   放进 `reasoning`，回程再写回去：留在 meta 里会在流式追加
                   `reasoningChunks` 之后变成一份对不上的旧值。
*/

import type {
  AgentMessage,
  AgentMessageRole,
  AgentToolCall,
} from "@deerflow/agent-core";

import type {
  AgentMessageContent,
  BaseMessage,
  Message,
  ToolCall,
} from "@/core/types/message";

/**
 * 线上真实出现、但不在 `Message` 联合里的形状。
 *
 * `messages-tuple` 帧里的 `type` 是 `"AIMessageChunk"`，golden trace 的 9 个
 * messages 帧里有 6 个是它。把入参写死成 `Message` 会让流式路径每次调用都要
 * 强转一次——强转在调用点，等于每个调用点各自决定怎么读，那正是本文件要收拢的。
 */
export type WireMessageLike = BaseMessage & {
  type: string;
  [key: string]: unknown;
};

/**
 * wire `type` → 内核 role。
 *
 * chunk 后缀是 LangChain 序列化流式分片时用的类名，与非分片同义。
 * **回程不看这张表**：wire 的 `type` 原样留在 `meta` 里，回程直接用它，
 * 所以这张表只需要「够用」，不需要是双射。
 */
const WIRE_TYPE_TO_ROLE: Record<string, AgentMessageRole> = {
  human: "human",
  HumanMessageChunk: "human",
  ai: "assistant",
  AIMessageChunk: "assistant",
  tool: "tool",
  ToolMessageChunk: "tool",
  system: "system",
  SystemMessageChunk: "system",
  // function/remove 在 08 的四个 role 里没有对应物。落到最不显眼的那个：
  // 它们要么是历史遗留（function），要么是删除标记（remove），
  // 当成回答渲染出来比藏起来糟得多。
  function: "tool",
  remove: "system",
};

/** 回程缺省表。只有 `meta.type` 丢了才会用到（内核自己造的消息）。 */
const ROLE_TO_WIRE_TYPE: Record<AgentMessageRole, string> = {
  human: "human",
  assistant: "ai",
  tool: "tool",
  system: "system",
};

const CHUNK_TYPE_TO_MESSAGE_TYPE: Record<string, Message["type"]> = {
  HumanMessageChunk: "human",
  AIMessageChunk: "ai",
  ToolMessageChunk: "tool",
  SystemMessageChunk: "system",
};

/**
 * 未知 `type` 归到 `system`。
 *
 * 归到 `assistant` 会让后端新加的任何内部消息类型直接以回答气泡的形式出现在
 * 用户面前；归到 `system` 最坏是少显示一块内容，而 `meta.type` 还留着原名，
 * 排查时看得见。两种错法里选可逆的那个。
 */
function roleOf(type: string): AgentMessageRole {
  return WIRE_TYPE_TO_ROLE[type] ?? "system";
}

/** 这四个键有内核字段承载，不进 `meta`；其余一律原样留在 `meta`。 */
const KERNEL_OWNED_KEYS = new Set([
  "id",
  "content",
  "tool_calls",
  "tool_call_chunks",
]);

/** LangChain 的流式工具调用分片。`args` 是**字符串片段**，不是对象。 */
interface WireToolCallChunk {
  name?: string | null;
  args?: string | null;
  id?: string | null;
  index?: number | null;
  type?: "tool_call_chunk";
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * 把成品 `tool_calls` 与分片 `tool_call_chunks` 合并成内核的 `toolCalls`。
 *
 * 两者可以同时出现：golden trace 里 `read_file` 那一帧就是——`tool_calls`
 * 已经有解析好的 args，`tool_call_chunks` 里还带着产生它的原文。原文不能丢：
 * 解析失败时它是唯一还原现场的东西（08 §AgentToolCall.argsChunks）。
 *
 * 归并键**先看 id 再看 index，两个都要登记**。单看任何一个都会错：
 *   - 只按 id：OpenAI 的增量分片里只有第一片带 id，后续片只有 `index`，
 *     同一个调用会被拆成好几个；
 *   - 只按 index：golden trace 里的分片 `index` 全是 `null`（LangChain 侧填的），
 *     所有调用会挤进 `index:0` 这一个桶。
 */
export function mergeToolCallFragments(
  toolCalls: readonly ToolCall[] | undefined,
  chunks: readonly WireToolCallChunk[] | undefined,
): AgentToolCall[] | undefined {
  if (toolCalls === undefined && chunks === undefined) return undefined;

  const merged: AgentToolCall[] = [];
  const byId = new Map<string, AgentToolCall>();
  const byIndex = new Map<number, AgentToolCall>();

  const register = (
    entry: AgentToolCall,
    index: number | null | undefined,
  ): void => {
    if (entry.id) byId.set(entry.id, entry);
    if (typeof index === "number") byIndex.set(index, entry);
  };

  for (const call of toolCalls ?? []) {
    const entry: AgentToolCall = {
      id: call.id ?? "",
      name: call.name,
      args: call.args,
    };
    merged.push(entry);
    register(entry, null);
  }

  for (const chunk of chunks ?? []) {
    let entry =
      (chunk.id ? byId.get(chunk.id) : undefined) ??
      (typeof chunk.index === "number" ? byIndex.get(chunk.index) : undefined);
    if (!entry) {
      entry = { id: chunk.id ?? "", name: chunk.name ?? "" };
      merged.push(entry);
    }
    if (chunk.name && !entry.name) entry.name = chunk.name;
    if (chunk.id && !entry.id) entry.id = chunk.id;
    register(entry, chunk.index);
    if (typeof chunk.args === "string" && chunk.args.length > 0) {
      entry.argsChunks = [...(entry.argsChunks ?? []), chunk.args];
    }
  }

  // 只有在**没有**成品 args 时才去解析分片：成品是后端解析过的，
  // 拿我们自己拼的字符串覆盖它没有任何好处，还会在分片截断时把好数据换成坏的。
  for (const call of merged) {
    if (call.args !== undefined || call.argsChunks === undefined) continue;
    try {
      call.args = JSON.parse(call.argsChunks.join("")) as unknown;
    } catch {
      call.argsParseFailed = true;
    }
  }
  return merged;
}

/** 内容原样带走。数组浅拷一层，避免内核归并时改到 wire 对象。 */
function copyContent(content: AgentMessageContent): AgentMessageContent {
  return Array.isArray(content) ? [...content] : content;
}

/**
 * wire → 内核。
 *
 * `fallbackId` 只在 wire 没有 `id` 时用到，而这一步**不可逆**：回程会把它当成
 * 真 id 写出去。可接受的理由是没有 id 的消息本来就无法在按 id 归并的存储里
 * 存活——13 个 checkpoint fixture 的 516 条消息**全部**带 id。
 */
export function toAgentMessage(
  message: Message | WireMessageLike,
  fallbackId?: string,
): AgentMessage {
  const wire = message as unknown as Record<string, unknown>;

  const meta: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(wire)) {
    if (!KERNEL_OWNED_KEYS.has(key)) meta[key] = value;
  }

  // reasoning 从 additional_kwargs 里**搬出来**（不是复制）。
  let reasoning: string | undefined;
  const additionalKwargs = asRecord(meta.additional_kwargs);
  if (
    additionalKwargs &&
    typeof additionalKwargs.reasoning_content === "string"
  ) {
    reasoning = additionalKwargs.reasoning_content;
    const rest: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(additionalKwargs)) {
      if (key !== "reasoning_content") rest[key] = value;
    }
    meta.additional_kwargs = rest;
  }

  const toolCalls = mergeToolCallFragments(
    wire.tool_calls as ToolCall[] | undefined,
    wire.tool_call_chunks as WireToolCallChunk[] | undefined,
  );

  const id =
    typeof wire.id === "string" && wire.id ? wire.id : (fallbackId ?? "");
  const type = typeof wire.type === "string" ? wire.type : "";

  return {
    id,
    role: roleOf(type),
    content: copyContent(wire.content as AgentMessageContent),
    // durable 消息没有「真实收到的 delta」可记。08 明确禁止拿最终 content
    // split() 出来充数：那样的分片数量与边界都是编的。
    contentChunks: [],
    isStreaming: false,
    ...(reasoning === undefined ? {} : { reasoning }),
    ...(toolCalls === undefined ? {} : { toolCalls }),
    meta,
  };
}

export function toAgentMessages(
  messages: readonly (Message | WireMessageLike)[],
): AgentMessage[] {
  return messages.map((message) => toAgentMessage(message));
}

function toWireToolCall(call: AgentToolCall): ToolCall {
  return {
    name: call.name,
    args: (call.args ?? {}) as Record<string, unknown>,
    ...(call.id ? { id: call.id } : {}),
    // `"tool_call"` 是这个字段唯一的合法值（LangChain 的 ToolCall），
    // 所以补上它是规范化而不是编造。fixture 里 230 个工具调用全都带着它。
    type: "tool_call" as const,
  };
}

/**
 * 内核 → wire。
 *
 * `contentChunks` / `isStreaming` / `reasoningChunks` / `finishReason` 是内核的
 * 记账字段，线上没有对应物，回程丢弃。丢掉它们不影响 round-trip：
 * durable 消息进来时它们本来就是空的。
 */
export function toWireMessage(message: AgentMessage): Message {
  const meta = { ...(message.meta ?? {}) };

  if (message.reasoning !== undefined) {
    meta.additional_kwargs = {
      ...(asRecord(meta.additional_kwargs) ?? {}),
      reasoning_content: message.reasoning,
    };
  }

  const type =
    typeof meta.type === "string" ? meta.type : ROLE_TO_WIRE_TYPE[message.role];

  const wire: Record<string, unknown> = {
    ...meta,
    type,
    content: copyContent(message.content),
  };
  if (message.id) wire.id = message.id;
  if (message.toolCalls !== undefined) {
    wire.tool_calls = message.toolCalls.map(toWireToolCall);
  }
  return wire as unknown as Message;
}

export function toWireMessages(messages: readonly AgentMessage[]): Message[] {
  return messages.map(toWireMessage);
}

/**
 * 把已经由 reducer 累积完成的流式类名收敛成 UI 的消息联合类型。
 *
 * 原始 chunk 类名只属于 wire 输入。让它继续穿过 runner，会迫使每个 Vue 组件
 * 各自维护一份兼容映射；组件也无法再相信 `Message["type"]`。保留其余 metadata，
 * 只在协议 adapter 的唯一出口规范化 `type`。
 */
export function toRenderableMessage(message: Message): Message {
  const type = CHUNK_TYPE_TO_MESSAGE_TYPE[String(message.type)];
  return type === undefined ? message : ({ ...message, type } as Message);
}

// ---------------------------------------------------------------------------
// 流式累积
// ---------------------------------------------------------------------------

/**
 * 把一段内容追加到已有内容上。
 *
 * 两侧都可能是 string 或数组，混用时统一升级成数组：把数组塞回 string 要 join，
 * 而 join 正是 08 §消息契约明令禁止的那种「把富内容压成字符串」。
 */
function appendContent(
  previous: AgentMessageContent | undefined,
  delta: AgentMessageContent,
): AgentMessageContent {
  if (previous === undefined) return copyContent(delta);
  if (typeof previous === "string" && typeof delta === "string") {
    return previous + delta;
  }
  const parts = (content: AgentMessageContent) =>
    Array.isArray(content)
      ? content
      : content
        ? [{ type: "text", text: content }]
        : [];
  return [...parts(previous), ...parts(delta)];
}

/** 只有纯文本 delta 才进 `contentChunks`——它记的是真实收到的文本增量。 */
function deltaText(content: AgentMessageContent): string {
  if (typeof content === "string") return content;
  return content
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("");
}

/**
 * `messages-tuple` 分片 → 累积后的内核消息。
 *
 * **必须在这里累积，不能交给 L1 的 `mergeMessage`。** 后者是
 * `{ ...base, ...patch }`：`content` 会被后到的 delta **整段替换**，
 * 表现是流式文本每来一片就把前面的擦掉。L1 只对 `contentChunks` 做追加语义，
 * 因为「什么算一次追加」是协议知识，内核不该知道。
 *
 * 同理 `toolCalls` 也在这里跨帧归并：golden trace 里 `write_file` 的 args
 * 是分片来的，交给浅合并就只剩最后一片。
 */
export function accumulateStreamedMessage(
  previous: AgentMessage | undefined,
  chunk: Message | WireMessageLike,
  fallbackId?: string,
): AgentMessage {
  const adapted = toAgentMessage(chunk, previous?.id ?? fallbackId);
  const text = deltaText(adapted.content);

  const toolCalls =
    previous?.toolCalls === undefined
      ? adapted.toolCalls
      : mergeAgentToolCalls(previous.toolCalls, adapted.toolCalls ?? []);

  const reasoning =
    adapted.reasoning === undefined
      ? previous?.reasoning
      : (previous?.reasoning ?? "") + adapted.reasoning;

  return {
    ...adapted,
    id: previous?.id ?? adapted.id,
    content: appendContent(previous?.content, adapted.content),
    // L1 的 mergeMessage 对 chunks 是**追加**语义，所以这里只放本帧的增量。
    contentChunks: text ? [text] : [],
    isStreaming: true,
    ...(reasoning === undefined ? {} : { reasoning }),
    ...(adapted.reasoning === undefined
      ? {}
      : { reasoningChunks: [adapted.reasoning] }),
    ...(toolCalls === undefined ? {} : { toolCalls }),
  };
}

/** 跨帧归并工具调用：按 id 对齐，args 分片继续追加。 */
function mergeAgentToolCalls(
  previous: readonly AgentToolCall[],
  next: readonly AgentToolCall[],
): AgentToolCall[] {
  const merged = previous.map((call) => ({ ...call }));
  for (const [index, call] of next.entries()) {
    const at = call.id
      ? merged.findIndex((candidate) => candidate.id === call.id)
      : index < merged.length
        ? index
        : -1;
    if (at === -1) {
      merged.push({ ...call });
      continue;
    }
    const base = merged[at] as AgentToolCall;
    const argsChunks =
      call.argsChunks === undefined
        ? base.argsChunks
        : [...(base.argsChunks ?? []), ...call.argsChunks];
    merged[at] = {
      ...base,
      ...(call.name ? { name: call.name } : {}),
      ...(call.args === undefined ? {} : { args: call.args }),
      ...(argsChunks === undefined ? {} : { argsChunks }),
    };
    // 只要本帧带来了新分片，就重新尝试完整原文。LangChain 可能在首帧同时
    // 给出一个“当前可解析”的 partial tool_calls.args；它不是最终值，后续
    // tool_call_chunks 拼成合法 JSON 后必须取代它。
    const settled = merged[at] as AgentToolCall;
    if (call.argsChunks !== undefined && settled.argsChunks !== undefined) {
      try {
        settled.args = JSON.parse(settled.argsChunks.join("")) as unknown;
        delete settled.argsParseFailed;
      } catch {
        if (settled.args === undefined) settled.argsParseFailed = true;
      }
    }
  }
  return merged;
}
