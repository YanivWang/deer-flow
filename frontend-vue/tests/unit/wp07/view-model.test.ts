/*
  【文件职责】     固定 WP-07 全状态筛选、类型筛选与确定性 selection 恢复。
  【对应 frontend/】 app/workspace/scheduled-tasks/page.tsx filters
  【架构位置】     WP-07 view-model test
  【主要导出】     无；Vitest cases
  【依赖关系】     core/scheduled-tasks/view-model
  【边界与注意】   task status 六种全部覆盖；筛选隐藏当前项时选择首个可见项。
*/
import { describe, expect, it } from "vitest";

import {
  filterScheduledTasks,
  resolveScheduledTaskSelection,
  type ScheduledTaskStatus,
} from "@/core/scheduled-tasks/view-model";
import type { ScheduledTask } from "@/core/scheduled-tasks/types";

const STATUSES: ScheduledTaskStatus[] = [
  "enabled",
  "paused",
  "running",
  "completed",
  "failed",
  "cancelled",
];
const TASKS = STATUSES.map(
  (status, index) =>
    ({
      id: `task-${status}`,
      status,
      schedule_type: index % 2 === 0 ? "cron" : "once",
    }) as ScheduledTask,
);

describe("scheduled-task view model", () => {
  it.each(STATUSES)("filters status %s", (status) => {
    expect(
      filterScheduledTasks(TASKS, { status, scheduleType: "all" }).map(
        (task) => task.status,
      ),
    ).toEqual([status]);
  });

  it("filters once/cron and all", () => {
    expect(
      filterScheduledTasks(TASKS, {
        status: "all",
        scheduleType: "cron",
      }),
    ).toHaveLength(3);
    expect(
      filterScheduledTasks(TASKS, {
        status: "all",
        scheduleType: "once",
      }),
    ).toHaveLength(3);
    expect(
      filterScheduledTasks(TASKS, {
        status: "all",
        scheduleType: "all",
      }),
    ).toHaveLength(6);
  });

  it("keeps a visible selection and falls back when filters hide/delete it", () => {
    expect(resolveScheduledTaskSelection(TASKS, "task-running")).toBe(
      "task-running",
    );
    expect(resolveScheduledTaskSelection(TASKS, "task-missing")).toBe(
      "task-enabled",
    );
    expect(resolveScheduledTaskSelection([], "task-running")).toBeNull();
  });
});
