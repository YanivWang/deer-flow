/*
  【文件职责】     见下方源码；本文件由 frontend/src/core/messages/usage.ts retype 而来。
  【对应 frontend/】 frontend/src/core/messages/usage.ts
  【架构位置】     L3
  【主要导出】     TokenUsage / getUsageMetadata / accumulateUsage / normalizeTokenUsage / hasNonZeroUsage / addUsage 等 8 个
  【依赖关系】     见下方 import；改写清单由 scripts/land-retyped.mjs 声明
  【边界与注意】   RETYPED：内容**不是**上游逐字节等同，因此不参与 COPIED hash 护城河。
                   相对上游的改动只有这些：SDK 类型改指向自写 @/core/types/message（06 §M1 1b 的 17 个）。（@langchain/langgraph-sdk → @/core/types/message）
                   勿手改——`make land-retyped-check` 会红；确需手改就登记进
                   land-retyped.mjs 的 HAND_MAINTAINED 并写明理由。
*/

import type { Message } from "@/core/types/message";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/**
 * Extract usage_metadata from an AI message if present.
 * The field is added by the backend (PR #1218) but not typed in the SDK.
 */
export function getUsageMetadata(message: Message): TokenUsage | null {
  if (message.type !== "ai") {
    return null;
  }
  const usage =
    ((message as Record<string, unknown>).usage_metadata as
      | {
          input_tokens?: number;
          output_tokens?: number;
          total_tokens?: number;
        }
      | undefined) ??
    (message.additional_kwargs?.usage_metadata as
      | {
          input_tokens?: number;
          output_tokens?: number;
          total_tokens?: number;
        }
      | undefined);
  if (!usage) {
    return null;
  }
  return {
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    totalTokens: usage.total_tokens ?? 0,
  };
}

/**
 * Accumulate token usage across AI messages.
 *
 * UI rendering may place the same AI message in more than one group, such as
 * when a message contains both reasoning and final answer content. Token usage
 * is attached to the AI message itself, so a message id should only contribute
 * once to any aggregate.
 */
export function accumulateUsage(messages: Message[]): TokenUsage | null {
  const cumulative: TokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };
  let hasUsage = false;
  const countedMessageIds = new Set<string>();

  for (const message of messages) {
    const usage = getUsageMetadata(message);
    if (!usage) {
      continue;
    }

    if (message.id) {
      if (countedMessageIds.has(message.id)) {
        continue;
      }
      countedMessageIds.add(message.id);
    }

    hasUsage = true;
    cumulative.inputTokens += usage.inputTokens;
    cumulative.outputTokens += usage.outputTokens;
    cumulative.totalTokens += usage.totalTokens;
  }
  return hasUsage ? cumulative : null;
}

/**
 * Validate a raw `{input,output,total}_tokens` object into {@link TokenUsage}.
 *
 * The single shared validator for both sub-agent usage surfaces — the live
 * `task_running` event (`core/tasks/lifecycle.ts`) and the terminal ToolMessage
 * metadata (`core/tasks/subtask-result.ts`). Keeping one function stops the two
 * from drifting (e.g. one accepting an extra token field the other rejects).
 * Every key must be a finite, non-negative number or the whole snapshot is
 * rejected as `undefined`.
 */
export function normalizeTokenUsage(value: unknown): TokenUsage | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const inputTokens = nonNegativeNumber(record.input_tokens);
  const outputTokens = nonNegativeNumber(record.output_tokens);
  const totalTokens = nonNegativeNumber(record.total_tokens);
  if (
    inputTokens === undefined ||
    outputTokens === undefined ||
    totalTokens === undefined
  ) {
    return undefined;
  }
  return { inputTokens, outputTokens, totalTokens };
}

function nonNegativeNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

export function hasNonZeroUsage(
  usage: TokenUsage | null | undefined,
): usage is TokenUsage {
  return (
    usage !== null &&
    usage !== undefined &&
    (usage.inputTokens > 0 || usage.outputTokens > 0 || usage.totalTokens > 0)
  );
}

export function addUsage(base: TokenUsage, delta: TokenUsage): TokenUsage {
  return {
    inputTokens: base.inputTokens + delta.inputTokens,
    outputTokens: base.outputTokens + delta.outputTokens,
    totalTokens: base.totalTokens + delta.totalTokens,
  };
}

export function selectHeaderTokenUsage({
  backendUsage,
  messages,
  pendingMessages = [],
}: {
  backendUsage?: TokenUsage | null;
  messages: Message[];
  pendingMessages?: Message[];
}): TokenUsage | null {
  if (hasNonZeroUsage(backendUsage)) {
    const pendingUsage = accumulateUsage(pendingMessages);
    return pendingUsage ? addUsage(backendUsage, pendingUsage) : backendUsage;
  }
  return accumulateUsage(messages);
}

/**
 * Format a token count for display: 1234 -> "1,234", 12345 -> "12.3K"
 */
export function formatTokenCount(count: number): string {
  if (count < 10_000) {
    return count.toLocaleString();
  }
  return `${(count / 1000).toFixed(1)}K`;
}
