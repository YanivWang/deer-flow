/*
  【文件职责】     提交回合的请求体构造，以及工具结果探测。
  【架构位置】     L3（纯 TS）
  【主要导出】     hasToolResult · buildThreadSubmitMessages · buildRunContext
  【依赖关系】     ../types/message · ../settings（LocalSettings 的 context 形状）
  【边界与注意】   上游两处 run-context 字面量在此收敛为唯一构造器；模型能力约束 UI，
                   wire context 则严格保持 React 的 explicit effort → mode fallback 语义。
*/

import type { Message } from "../types/message";
import type { FileInMessage } from "../messages/utils";
import {
  normalizeComposerContext,
  type ComposerMode,
  type ComposerReasoningEffort,
} from "../models/capabilities";
import type { Model } from "../models/types";

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
  mode?: ComposerMode | string;
  reasoning_effort?: ComposerReasoningEffort;
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
  model?: Model | null,
): Record<string, unknown> {
  const normalized = model
    ? normalizeComposerContext(context, model)
    : { ...context };
  const mode = normalized.mode;
  const result: Record<string, unknown> = {
    ...extraContext,
    ...normalized,
    thinking_enabled: mode !== "flash",
    is_plan_mode: mode === "pro" || mode === "ultra",
    subagent_enabled: mode === "ultra",
    reasoning_effort:
      normalized.reasoning_effort ??
      (mode === undefined ? undefined : REASONING_EFFORT_BY_MODE[mode]),
    thread_id: threadId,
  };
  return result;
}
