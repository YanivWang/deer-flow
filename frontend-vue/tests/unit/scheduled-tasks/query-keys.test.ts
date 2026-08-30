/*
  【文件职责】     固定 query key 的唯一所有权与前缀失效的覆盖面。
  【架构位置】     cache contract test
  【主要导出】     无；Vitest cases
  【依赖关系】     core/scheduled-tasks/query-keys
  【边界与注意】   list/thread/runs 三种 key 必须互相区分，且都在 `root()` 前缀之下——
                   mutation 之后失效的是整棵子树，凭的就是这层前缀关系。
*/
import { describe, expect, it } from "vitest";

import { scheduledTaskKeys } from "@/core/scheduled-tasks/query-keys";

describe("scheduled-task query keys", () => {
  it("separates the list, the per-thread list, and one task's runs", () => {
    expect(scheduledTaskKeys.list()).toEqual(["scheduled-tasks", "list"]);
    expect(scheduledTaskKeys.thread("thread-1")).toEqual([
      "scheduled-tasks",
      "thread",
      "thread-1",
    ]);
    expect(scheduledTaskKeys.runs("task-1")).toEqual([
      "scheduled-tasks",
      "runs",
      "task-1",
    ]);
  });

  it("has no detail key: the selected task comes from the list", () => {
    expect(scheduledTaskKeys).not.toHaveProperty("detail");
  });

  it("puts every key under the prefix a mutation invalidates", () => {
    const root = scheduledTaskKeys.root();
    for (const key of [
      scheduledTaskKeys.list(),
      scheduledTaskKeys.thread("thread-1"),
      scheduledTaskKeys.runs("task-1"),
    ]) {
      expect(key.slice(0, root.length)).toEqual([...root]);
    }
  });
});
