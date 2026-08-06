/*
  【文件职责】     提交回合的请求体构造，以及工具结果探测。
  【对应 frontend/】 core/threads/hooks.ts
  【架构位置】     L3（纯 TS）
  【主要导出】     hasToolResult · buildThreadSubmitMessages · buildRunContext
  【依赖关系】     ../types/message · ../settings（LocalSettings 的 context 形状）
  【边界与注意】   `buildRunContext` 在上游是**两处逐字重复**的对象字面量
                   （`sendMessage` 与 `submitPreparedReplay` 各一份，含同一串
                   三元嵌套的 reasoning_effort）。合并成一个函数是本文件唯一的
                   结构改动，理由是它决定后端跑哪种模式——两份拷贝迟早会分叉，
                   而分叉的表现是「重跑与首次发送用了不同的推理档位」，
                   在 UI 上看不出来。
*/

import type { Message } from "../types/message";
import type { FileInMessage } from "../messages/utils";

export function hasToolResult(messages: Message[], toolName: string): boolean {
  const matchingToolCallIds = new Set<string>();
  for (const message of messages) {
    if (message.type !== "ai") {
      continue;
    }
    for (const toolCall of message.tool_calls ?? []) {
      if (toolCall.name === toolName && toolCall.id) {
        matchingToolCallIds.add(toolCall.id);
      }
    }
  }

  return messages.some(
    (message) =>
      message.type === "tool" &&
      (message.name === toolName ||
        matchingToolCallIds.has(message.tool_call_id)),
  );
}

export function buildThreadSubmitMessages({
  text,
  additionalKwargs,
  additionalInputMessages = [],
  filesForSubmit = [],
}: {
  text: string;
  additionalKwargs?: Record<string, unknown>;
  additionalInputMessages?: Message[];
  filesForSubmit?: FileInMessage[];
}): Message[] {
  return [
    ...additionalInputMessages,
    {
      type: "human",
      content: [
        {
          type: "text",
          text,
        },
      ],
      additional_kwargs: {
        ...additionalKwargs,
        ...(filesForSubmit.length > 0 ? { files: filesForSubmit } : {}),
      },
    } as Message,
  ];
}

export interface ThreadRunContextInput extends Record<string, unknown> {
  mode?: string;
  reasoning_effort?: "minimal" | "low" | "medium" | "high";
}

const REASONING_EFFORT_BY_MODE: Record<string, "low" | "medium" | "high"> = {
  ultra: "high",
  pro: "medium",
  thinking: "low",
};

export function buildRunContext(
  context: ThreadRunContextInput,
  threadId: string,
  extraContext?: Record<string, unknown>,
): Record<string, unknown> {
  const mode = context.mode;
  return {
    ...extraContext,
    ...context,
    thinking_enabled: mode !== "flash",
    is_plan_mode: mode === "pro" || mode === "ultra",
    subagent_enabled: mode === "ultra",
    reasoning_effort:
      context.reasoning_effort ??
      (mode === undefined ? undefined : REASONING_EFFORT_BY_MODE[mode]),
    thread_id: threadId,
  };
}
