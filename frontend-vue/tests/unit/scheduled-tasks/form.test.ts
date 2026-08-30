/*
  【文件职责】     固定 scheduled-task 草稿、可提交判定与 Gateway payload 合同。
  【架构位置】     纯逻辑测试
  【主要导出】     无；Vitest cases
  【依赖关系】     core/scheduled-tasks/form · recipes · types
  【边界与注意】   Gateway 只支持 once/cron；PATCH 不得出现
                   thread_id/schedule_type/enabled/non_interactive。

                   这一层**不做校验也不抛异常**：能不能提交只由
                   `isScheduledTaskDraftComplete` 回答，其余输入交给 Gateway 的 422。
                   run_at 进 draft 时已经是 UTC ISO（ScheduleInput 转好的），所以这里
                   只搬运，不再做时区换算——DST 的换算合同在 core/scheduled-tasks/cron
                   的用例里。
*/
import { describe, expect, it } from "vitest";

import {
  applyScheduledTaskRecipe,
  buildScheduledTaskCreatePayload,
  buildScheduledTaskUpdatePayload,
  createScheduledTaskDraft,
  draftForScheduledTask,
  isScheduledTaskDraftComplete,
} from "@/core/scheduled-tasks/form";
import { RECIPES } from "@/core/scheduled-tasks/recipes";
import type { ScheduledTask } from "@/core/scheduled-tasks/types";

const CRON_TASK: ScheduledTask = {
  id: "task-1",
  thread_id: "thread-1",
  context_mode: "reuse_thread",
  title: "Daily summary",
  prompt: "Summarize the thread",
  schedule_type: "cron",
  schedule_spec: { cron: "0 9 * * *" },
  timezone: "Asia/Shanghai",
  status: "enabled",
  next_run_at: "2026-07-02T01:00:00+00:00",
  last_run_at: null,
  last_run_id: null,
  last_thread_id: null,
  last_error: null,
  run_count: 0,
  created_at: "2026-07-01T00:00:00+00:00",
  updated_at: "2026-07-01T00:00:00+00:00",
};

function completeDraft() {
  return {
    ...createScheduledTaskDraft(),
    title: "Daily",
    prompt: "Summarize",
  };
}

describe("scheduled-task draft", () => {
  it("leaves the timezone empty for ScheduleInput to fill on mount", () => {
    expect(createScheduledTaskDraft().schedule.timezone).toBe("");
  });

  it("uses the route thread only as an editable default", () => {
    const draft = createScheduledTaskDraft({ routeThreadId: "thread-route" });
    expect(draft.contextMode).toBe("reuse_thread");
    expect(draft.threadId).toBe("thread-route");
    expect(createScheduledTaskDraft().contextMode).toBe("fresh_thread_per_run");
  });

  it("hands the stored run_at to ScheduleInput without converting it", () => {
    const draft = draftForScheduledTask({
      ...CRON_TASK,
      schedule_type: "once",
      schedule_spec: { run_at: "2026-07-02T01:00:00+00:00" },
    });
    expect(draft.schedule.schedule_spec.run_at).toBe(
      "2026-07-02T01:00:00+00:00",
    );
    expect(draft.schedule.schedule_spec.cron).toBeUndefined();
  });
});

describe("isScheduledTaskDraftComplete", () => {
  it("requires a title, a prompt and a schedule", () => {
    expect(isScheduledTaskDraftComplete(completeDraft())).toBe(true);
    expect(
      isScheduledTaskDraftComplete({ ...completeDraft(), title: "" }),
    ).toBe(false);
    expect(
      isScheduledTaskDraftComplete({ ...completeDraft(), prompt: "" }),
    ).toBe(false);
    expect(
      isScheduledTaskDraftComplete({
        ...completeDraft(),
        schedule: {
          schedule_type: "once",
          schedule_spec: {},
          timezone: "UTC",
        },
      }),
    ).toBe(false);
  });

  it("requires a target thread only in reuse mode", () => {
    const reuse = { ...completeDraft(), contextMode: "reuse_thread" } as const;
    expect(isScheduledTaskDraftComplete({ ...reuse, threadId: "" })).toBe(
      false,
    );
    expect(isScheduledTaskDraftComplete({ ...reuse, threadId: "t-1" })).toBe(
      true,
    );
    // fresh 模式下残留的 thread id 不影响判定，也不进 payload。
    expect(
      isScheduledTaskDraftComplete({
        ...completeDraft(),
        threadId: "stale-thread",
      }),
    ).toBe(true);
  });
});

describe("scheduled-task payloads", () => {
  it("sends an explicit null thread_id in fresh mode", () => {
    const payload = buildScheduledTaskCreatePayload({
      ...completeDraft(),
      threadId: "stale-thread",
      schedule: {
        schedule_type: "cron",
        schedule_spec: { cron: "0 9 * * *" },
        timezone: "UTC",
      },
    });

    expect(payload).toEqual({
      context_mode: "fresh_thread_per_run",
      thread_id: null,
      title: "Daily",
      prompt: "Summarize",
      schedule_type: "cron",
      schedule_spec: { cron: "0 9 * * *" },
      timezone: "UTC",
    });
    expect(JSON.stringify(payload)).not.toContain("non_interactive");
    expect(JSON.stringify(payload)).not.toContain('"enabled"');
  });

  it("carries the target thread in reuse mode", () => {
    expect(
      buildScheduledTaskCreatePayload({
        ...completeDraft(),
        contextMode: "reuse_thread",
        threadId: "thread-9",
      }),
    ).toMatchObject({ context_mode: "reuse_thread", thread_id: "thread-9" });
  });

  it("carries the UTC ISO run_at through untouched", () => {
    expect(
      buildScheduledTaskCreatePayload({
        ...completeDraft(),
        schedule: {
          schedule_type: "once",
          schedule_spec: { run_at: "2026-07-02T01:00:00+00:00" },
          timezone: "Asia/Shanghai",
        },
      }),
    ).toMatchObject({
      schedule_type: "once",
      schedule_spec: { run_at: "2026-07-02T01:00:00+00:00" },
      timezone: "Asia/Shanghai",
    });
  });

  it("falls back to UTC when ScheduleInput has not reported a timezone", () => {
    expect(buildScheduledTaskCreatePayload(completeDraft()).timezone).toBe(
      "UTC",
    );
  });

  it("builds PATCH from only the four Gateway-owned mutable fields", () => {
    const draft = draftForScheduledTask(CRON_TASK);
    draft.title = "Updated";
    draft.schedule.schedule_spec = { cron: "0 10 * * 1" };

    const payload = buildScheduledTaskUpdatePayload(draft);
    expect(payload).toEqual({
      title: "Updated",
      prompt: "Summarize the thread",
      schedule_spec: { cron: "0 10 * * 1" },
      timezone: "Asia/Shanghai",
    });
    expect(payload).not.toHaveProperty("context_mode");
    expect(payload).not.toHaveProperty("thread_id");
    expect(payload).not.toHaveProperty("schedule_type");
    expect(payload).not.toHaveProperty("enabled");
  });
});

describe("recipes", () => {
  it("applies a recipe as form state and keeps placeholders", () => {
    const draft = createScheduledTaskDraft({ routeThreadId: "thread-route" });
    const recipe = RECIPES.find((candidate) => candidate.id === "issues")!;
    const applied = applyScheduledTaskRecipe(draft, recipe, "Issue triage");

    expect(applied.title).toBe("Issue triage");
    expect(applied.prompt).toContain("{{repo}}");
    expect(applied.contextMode).toBe("fresh_thread_per_run");
    expect(applied.schedule.schedule_spec).toEqual({ cron: "0 9 * * *" });
    // 切回 reuse 时刚才填的线程还在——React 的 applyRecipe 没有清它。
    expect(applied.threadId).toBe("thread-route");
  });

  it("hands the recipe's empty timezone back to ScheduleInput", () => {
    const recipe = RECIPES[0]!;
    const applied = applyScheduledTaskRecipe(
      {
        ...completeDraft(),
        schedule: { ...completeDraft().schedule, timezone: "Asia/Tokyo" },
      },
      recipe,
      "Trending",
    );
    expect(applied.schedule.timezone).toBe("");
  });
});
