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

/*
  计数器只在**接近**上限时才出现，不是永远挂在工具条上：上游
  frontend/src/components/workspace/input-box-helpers.ts 里
  `GOAL_OBJECTIVE_COUNTER_VISIBLE_AT = floor(MAX * 0.9)`，理由是"只在用户真的
  可能被拒时出现，而不是给页脚添永久噪音"。阈值跟着上限走，不写死 3600。
*/
export const GOAL_OBJECTIVE_COUNTER_VISIBLE_AT = Math.floor(
  MAX_GOAL_OBJECTIVE_CHARS * 0.9,
);

export type GoalObjectiveCounter = {
  length: number;
  max: number;
  overLimit: boolean;
};

/*
  只对 `/goal <objective>` 这一支计数，而且量的是**解析出来的 objective**，
  不是输入框里的原文——发出去的就是它，计数器和 goalTooLong 的判据必须是同一个
  字符串，否则用户会看见 3999/4000 却被后端拒掉。
*/
export function getGoalObjectiveCounter(
  value: string,
): GoalObjectiveCounter | null {
  const command = parseGoalCommand(value);
  if (command?.kind !== "set") return null;
  const length = command.objective.length;
  if (length < GOAL_OBJECTIVE_COUNTER_VISIBLE_AT) return null;
  return {
    length,
    max: MAX_GOAL_OBJECTIVE_CHARS,
    overLimit: length > MAX_GOAL_OBJECTIVE_CHARS,
  };
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
