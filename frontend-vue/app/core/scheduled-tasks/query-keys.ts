/*
  【文件职责】     Scheduled-task Vue Query key 与 mutation cache 目标的唯一注册表。
  【对应 frontend/】 core/scheduled-tasks/hooks.ts
  【架构位置】     L3 server-state contract
  【主要导出】     scheduledTaskKeys · scheduledTaskMutationTargets
  【依赖关系】     scheduled-tasks/types
  【边界与注意】   runs 只由对应 task key 驱动；fresh task 不伪造 thread key。
*/
import type { ScheduledTask } from "./types";

export const scheduledTaskKeys = {
  root: () => ["scheduled-tasks"] as const,
  list: () => ["scheduled-tasks", "list"] as const,
  thread: (threadId: string) =>
    ["scheduled-tasks", "thread", threadId] as const,
  detail: (taskId: string) => ["scheduled-tasks", "detail", taskId] as const,
  runs: (taskId: string) => ["scheduled-tasks", "runs", taskId] as const,
};

export type ScheduledTaskMutation =
  "create" | "update" | "delete" | "pause" | "resume" | "trigger";

type QueryKey = readonly unknown[];
type MutationTargets = {
  invalidate: QueryKey[];
  remove: QueryKey[];
};

function unique(keys: QueryKey[]): QueryKey[] {
  const seen = new Set<string>();
  return keys.filter((key) => {
    const serialized = JSON.stringify(key);
    if (seen.has(serialized)) return false;
    seen.add(serialized);
    return true;
  });
}

export function scheduledTaskMutationTargets(
  operation: ScheduledTaskMutation,
  task: Pick<ScheduledTask, "id" | "thread_id" | "context_mode">,
): MutationTargets {
  const invalidate: QueryKey[] = [
    scheduledTaskKeys.list(),
    scheduledTaskKeys.detail(task.id),
  ];
  if (task.thread_id) {
    invalidate.push(scheduledTaskKeys.thread(task.thread_id));
  }
  if (operation === "trigger") {
    invalidate.push(scheduledTaskKeys.runs(task.id));
  }
  return {
    invalidate: unique(invalidate),
    remove:
      operation === "delete"
        ? [scheduledTaskKeys.detail(task.id), scheduledTaskKeys.runs(task.id)]
        : [],
  };
}
