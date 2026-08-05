/*
  【文件职责】     见下方源码；本文件由 frontend/src/core/messages/run-duration.ts retype 而来。
  【对应 frontend/】 frontend/src/core/messages/run-duration.ts
  【架构位置】     L3
  【主要导出】     RunDurationDisplay / RunDurationFormatter / getMessageRunId / getRunDurationDisplaysByGroupIndex / formatRunDuration
  【依赖关系】     见下方 import；改写清单由 scripts/land-retyped.mjs 声明
  【边界与注意】   RETYPED：内容**不是**上游逐字节等同，因此不参与 COPIED hash 护城河。
                   相对上游的改动只有这些：SDK 类型改指向自写 @/core/types/message（06 §M1 1b 的 17 个）。（@langchain/langgraph-sdk → @/core/types/message）
                   勿手改——`make land-retyped-check` 会红；确需手改就登记进
                   land-retyped.mjs 的 HAND_MAINTAINED 并写明理由。
*/

import type { Message } from "@/core/types/message";

import type { MessageGroup } from "./utils";

export interface RunDurationDisplay {
  runId: string;
  durationSeconds: number;
}

export interface RunDurationFormatter {
  lessThanSecond: string;
  hours: (value: number) => string;
  minutes: (value: number) => string;
  seconds: (value: number) => string;
  separator: string;
}

type MessageWithRunId = Message & { run_id?: unknown };

export function getMessageRunId(message: Message): string | undefined {
  const runId = (message as MessageWithRunId).run_id;
  return typeof runId === "string" && runId.length > 0 ? runId : undefined;
}

function normalizeDuration(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return Math.floor(value);
}

/**
 * Locate the single UI position that owns each completed run's wall-clock
 * duration. The backend keeps the value on every AI message for compatibility,
 * but the UI treats it as run-scoped metadata and renders it after the last
 * visible group belonging to that run.
 */
export function getRunDurationDisplaysByGroupIndex(
  groups: MessageGroup[],
): RunDurationDisplay[][] {
  const displays = groups.map(() => [] as RunDurationDisplay[]);
  const durationByRunId = new Map<string, number>();
  const lastGroupIndexByRunId = new Map<string, number>();

  groups.forEach((group, groupIndex) => {
    for (const message of group.messages) {
      const runId = getMessageRunId(message);
      if (!runId) {
        continue;
      }

      lastGroupIndexByRunId.set(runId, groupIndex);
      if (message.type !== "ai") {
        continue;
      }

      const duration = normalizeDuration(
        message.additional_kwargs?.turn_duration,
      );
      if (duration !== undefined) {
        durationByRunId.set(runId, duration);
      }
    }
  });

  for (const [runId, durationSeconds] of durationByRunId) {
    const groupIndex = lastGroupIndexByRunId.get(runId);
    if (groupIndex !== undefined) {
      displays[groupIndex]?.push({ runId, durationSeconds });
    }
  }

  return displays;
}

export function formatRunDuration(
  value: number,
  formatter: RunDurationFormatter,
): string | null {
  const duration = normalizeDuration(value);
  if (duration === undefined) {
    return null;
  }
  if (duration === 0) {
    return formatter.lessThanSecond;
  }

  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const seconds = duration % 60;
  const parts: string[] = [];

  if (hours > 0) {
    parts.push(formatter.hours(hours));
  }
  if (minutes > 0) {
    parts.push(formatter.minutes(minutes));
  }
  if (seconds > 0) {
    parts.push(formatter.seconds(seconds));
  }

  return parts.join(formatter.separator);
}
