/*
  【文件职责】     固定query key 与 mutation invalidation 的唯一所有权。
  【架构位置】     cache contract test
  【主要导出】     无；Vitest cases
  【依赖关系】     core/scheduled-tasks/query-keys
  【边界与注意】   task/thread/runs key 必须可区分，trigger 必须包含对应 runs。
*/
import { describe, expect, it } from "vitest";

import {
  scheduledTaskKeys,
  scheduledTaskMutationTargets,
} from "@/core/scheduled-tasks/query-keys";
import type { ScheduledTask } from "@/core/scheduled-tasks/types";

const TASK = {
  id: "task-1",
  thread_id: "thread-1",
  context_mode: "reuse_thread",
} as ScheduledTask;

describe("scheduled-task query keys", () => {
  it("separates list, thread list, detail, and runs pages", () => {
    expect(scheduledTaskKeys.list()).toEqual(["scheduled-tasks", "list"]);
    expect(scheduledTaskKeys.thread("thread-1")).toEqual([
      "scheduled-tasks",
      "thread",
      "thread-1",
    ]);
    expect(scheduledTaskKeys.detail("task-1")).toEqual([
      "scheduled-tasks",
      "detail",
      "task-1",
    ]);
    expect(scheduledTaskKeys.runs("task-1")).toEqual([
      "scheduled-tasks",
      "runs",
      "task-1",
    ]);
  });

  it("targets create/update/delete/pause/resume precisely", () => {
    for (const operation of [
      "create",
      "update",
      "delete",
      "pause",
      "resume",
    ] as const) {
      const targets = scheduledTaskMutationTargets(operation, TASK);
      expect(targets.invalidate).toContainEqual(scheduledTaskKeys.list());
      expect(targets.invalidate).toContainEqual(
        scheduledTaskKeys.thread("thread-1"),
      );
      expect(targets.invalidate).toContainEqual(
        scheduledTaskKeys.detail("task-1"),
      );
      expect(targets.invalidate).not.toContainEqual(
        scheduledTaskKeys.runs("task-1"),
      );
    }
  });

  it("trigger refreshes task, thread list, and corresponding runs", () => {
    const targets = scheduledTaskMutationTargets("trigger", TASK);
    expect(targets.invalidate).toEqual(
      expect.arrayContaining([
        scheduledTaskKeys.list(),
        scheduledTaskKeys.thread("thread-1"),
        scheduledTaskKeys.detail("task-1"),
        scheduledTaskKeys.runs("task-1"),
      ]),
    );
  });

  it("delete removes stale detail and runs caches", () => {
    const targets = scheduledTaskMutationTargets("delete", TASK);
    expect(targets.remove).toEqual([
      scheduledTaskKeys.detail("task-1"),
      scheduledTaskKeys.runs("task-1"),
    ]);
  });

  it("fresh-thread tasks never invent a thread-list target", () => {
    const targets = scheduledTaskMutationTargets("create", {
      ...TASK,
      thread_id: null,
      context_mode: "fresh_thread_per_run",
    });
    expect(targets.invalidate).not.toContainEqual(
      expect.arrayContaining(["scheduled-tasks", "thread"]),
    );
  });
});
