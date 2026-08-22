/*
  【文件职责】     Scheduled-task 全状态/类型筛选与 selection 恢复纯逻辑。
  【对应 frontend/】 app/workspace/scheduled-tasks/page.tsx
  【架构位置】     L3 view model
  【主要导出】     filterScheduledTasks · resolveScheduledTaskSelection
  【依赖关系】     scheduled-tasks/types
  【边界与注意】   Gateway 六种 task status 全量覆盖；不在组件内复制筛选规则。
*/
import type { ScheduledTask } from "./types";

export type ScheduledTaskStatus = ScheduledTask["status"];
export type ScheduledTaskStatusFilter = "all" | ScheduledTaskStatus;
export type ScheduledTaskScheduleFilter =
  "all" | ScheduledTask["schedule_type"];

export type ScheduledTaskFilters = {
  status: ScheduledTaskStatusFilter;
  scheduleType: ScheduledTaskScheduleFilter;
};

export function filterScheduledTasks(
  tasks: ScheduledTask[],
  filters: ScheduledTaskFilters,
): ScheduledTask[] {
  return tasks.filter(
    (task) =>
      (filters.status === "all" || task.status === filters.status) &&
      (filters.scheduleType === "all" ||
        task.schedule_type === filters.scheduleType),
  );
}

export function resolveScheduledTaskSelection(
  tasks: ScheduledTask[],
  selectedId: string | null,
): string | null {
  if (selectedId && tasks.some((task) => task.id === selectedId)) {
    return selectedId;
  }
  return tasks[0]?.id ?? null;
}
