/*
  【文件职责】     解析 /goal 命令、限制目标长度并读取 Gateway 错误。
  【架构位置】     L3
  【主要导出】     goal command helpers
  【依赖关系】     DeerFlow GoalState
  【边界与注意】   /goal 是产品命令，不进入 L1/L2。
*/

import type { GoalState } from "./types";

export const MAX_GOAL_OBJECTIVE_CHARS = 4000;

export type GoalCommand =
  { kind: "status" } | { kind: "clear" } | { kind: "set"; objective: string };

export function parseGoalCommand(value: string): GoalCommand | null {
  const trimmed = value.trim();
  const match = /^\/goal(?:\s+|$)/i.exec(trimmed);
  if (!match) return null;
  const argument = trimmed.slice(match[0].length).trim();
  if (!argument) return { kind: "status" };
  if (["clear", "reset", "off"].includes(argument.toLowerCase())) {
    return { kind: "clear" };
  }
  return { kind: "set", objective: argument };
}

export function goalContinuation(
  goal: Pick<GoalState, "continuation_count" | "max_continuations">,
) {
  if (!Number.isFinite(goal.continuation_count) || goal.continuation_count <= 0)
    return null;
  return {
    count: goal.continuation_count,
    max: goal.max_continuations,
  };
}

export async function readGoalResponseError(response: Response) {
  const body = (await response.json().catch(() => ({}))) as {
    detail?: unknown;
  };
  return typeof body.detail === "string"
    ? body.detail
    : `HTTP ${response.status}`;
}
