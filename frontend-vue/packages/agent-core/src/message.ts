/*
  【文件职责】     内核归一化后的消息形状（08 §消息契约逐字实现）。
  【对应 frontend/】 无；上游直接用 SDK 的 wire 类型当内存模型
  【架构位置】     L1
  【主要导出】     AgentMessageRole · AgentContentPart · AgentMessageContent
                   AgentToolCall · AgentMessage · createAgentMessage
  【依赖关系】     无
  【边界与注意】   这不是 wire 类型。`app/core/types/message.ts` 是「线上长什么样」，
                   本文件是「内核里存成什么样」，两者由 L3 的 message-adapt 相互转换。
                   合并成一个会让内核认识 `additional_kwargs` 这类协议字段——
                   它们的落点是 `meta`，内核不解释。

                   `contentChunks` 只记真实收到的 delta。08 明确禁止从最终 content
                   反推：`split()` 出来的分片数量与边界都是编的，拿它做流式渲染
                   的回归基线，等于用被测对象生成期望值。
*/

export type AgentMessageRole = "human" | "assistant" | "tool" | "system";

/**
 * 开放形状，不是闭合联合。
 *
 * SDK 的 `MessageContentComplex` 是 `text | image_url` 两支闭合联合，但上游自己
 * 就在防御它表达不了的东西：`messages/utils.ts` 对数组元素写了
 * `typeof content === "string"` 分支（Gemini 的 bare-string 续传），又用
 * `"thinking" in part` 取 reasoning。两者都不在那个闭合联合里。
 */
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
  /** 流式期间到达的 args 片段原文；解析失败时它是唯一还原现场的东西。 */
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

/**
 * 建一条空消息。
 *
 * 存在的理由是 `contentChunks` 必须是数组而不是 `undefined`：归并路径会往里
 * `push`，少一个初始化就在第一个 delta 上炸，而那条路径只有真流式才会走到。
 */
export function createAgentMessage(
  id: string,
  role: AgentMessageRole,
  overrides: Partial<Omit<AgentMessage, "id" | "role">> = {},
): AgentMessage {
  return {
    id,
    role,
    content: "",
    contentChunks: [],
    isStreaming: false,
    ...overrides,
  };
}
