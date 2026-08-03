import type { ScheduledTask } from "../../../core/api/scheduled-tasks/client";

export function canDeleteScheduledTask(task: ScheduledTask | null | undefined): task is ScheduledTask {
  return Boolean(task && task.status !== "running");
}
