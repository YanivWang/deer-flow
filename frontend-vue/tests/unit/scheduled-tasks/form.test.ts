/*
  【文件职责】     固定scheduled-task 表单、payload、context、recipe 与时区转换合同。
  【架构位置】     纯逻辑测试
  【主要导出】     无；Vitest cases
  【依赖关系】     core/scheduled-tasks/form · recipes · types
  【边界与注意】   Gateway 只支持 once/cron；PATCH 不得出现 schedule_type/enabled/non_interactive。
*/
import { describe, expect, it } from "vitest";

import {
  applyScheduledTaskRecipe,
  buildScheduledTaskCreatePayload,
  buildScheduledTaskUpdatePayload,
  createScheduledTaskDraft,
  draftForScheduledTask,
  zonedLocalToUtcIsoStrict,
} from "@/core/scheduled-tasks/form";
import { RECIPES } from "@/core/scheduled-tasks/recipes";
import type { ScheduledTask } from "@/core/scheduled-tasks/types";

const NOW = new Date("2026-07-01T00:00:00.000Z");

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

describe("scheduled-task form payload", () => {
  it("uses the browser timezone and route thread only as an editable default", () => {
    const draft = createScheduledTaskDraft({
      routeThreadId: "thread-route",
      browserTimezone: "Asia/Shanghai",
    });

    expect(draft.contextMode).toBe("reuse_thread");
    expect(draft.threadId).toBe("thread-route");
    expect(draft.schedule.timezone).toBe("Asia/Shanghai");

    draft.contextMode = "fresh_thread_per_run";
    const payload = buildScheduledTaskCreatePayload(
      {
        ...draft,
        title: "Fresh",
        prompt: "Run fresh",
      },
      { now: NOW },
    );
    expect(payload).not.toHaveProperty("thread_id");
  });

  it("serializes cron create without empty or invented fields", () => {
    const payload = buildScheduledTaskCreatePayload(
      {
        ...createScheduledTaskDraft({ browserTimezone: "UTC" }),
        title: " Daily ",
        prompt: " Summarize ",
        schedule: {
          schedule_type: "cron",
          schedule_spec: { cron: " 0 9 * * * " },
          timezone: "UTC",
        },
      },
      { now: NOW },
    );

    expect(payload).toEqual({
      context_mode: "fresh_thread_per_run",
      title: "Daily",
      prompt: "Summarize",
      schedule_type: "cron",
      schedule_spec: { cron: "0 9 * * *" },
      timezone: "UTC",
    });
    expect(JSON.stringify(payload)).not.toContain("non_interactive");
    expect(JSON.stringify(payload)).not.toContain("enabled");
  });

  it("serializes reuse_thread with a real target", () => {
    const draft = createScheduledTaskDraft({ browserTimezone: "UTC" });
    draft.contextMode = "reuse_thread";
    draft.threadId = "thread-9";
    draft.title = "Reuse";
    draft.prompt = "Continue";

    expect(buildScheduledTaskCreatePayload(draft, { now: NOW })).toMatchObject({
      context_mode: "reuse_thread",
      thread_id: "thread-9",
    });
  });

  it("rejects reuse_thread without a target and fresh mode clears a stale target", () => {
    const draft = createScheduledTaskDraft({ browserTimezone: "UTC" });
    draft.contextMode = "reuse_thread";
    draft.title = "Reuse";
    draft.prompt = "Continue";
    expect(() => buildScheduledTaskCreatePayload(draft, { now: NOW })).toThrow(
      /thread/i,
    );

    draft.contextMode = "fresh_thread_per_run";
    draft.threadId = "stale-thread";
    expect(
      buildScheduledTaskCreatePayload(draft, { now: NOW }),
    ).not.toHaveProperty("thread_id");
  });

  it("serializes a one-time wall clock as an explicit UTC ISO", () => {
    const draft = createScheduledTaskDraft({
      browserTimezone: "Asia/Shanghai",
    });
    draft.title = "Once";
    draft.prompt = "Run once";
    draft.schedule = {
      schedule_type: "once",
      schedule_spec: { run_at: "2026-07-02T09:00" },
      timezone: "Asia/Shanghai",
    };

    expect(buildScheduledTaskCreatePayload(draft, { now: NOW })).toMatchObject({
      schedule_type: "once",
      schedule_spec: { run_at: "2026-07-02T01:00:00+00:00" },
      timezone: "Asia/Shanghai",
    });
  });

  it("rejects past once values, unknown timezones, and nonexistent DST wall times", () => {
    const draft = createScheduledTaskDraft({ browserTimezone: "UTC" });
    draft.title = "Once";
    draft.prompt = "Run once";
    draft.schedule = {
      schedule_type: "once",
      schedule_spec: { run_at: "2026-06-30T23:59" },
      timezone: "UTC",
    };
    expect(() => buildScheduledTaskCreatePayload(draft, { now: NOW })).toThrow(
      /future/i,
    );
    expect(() =>
      zonedLocalToUtcIsoStrict("2026-07-02T09:00", "Mars/Base"),
    ).toThrow(/timezone/i);
    expect(() =>
      zonedLocalToUtcIsoStrict("2026-03-08T02:30", "America/New_York"),
    ).toThrow(/does not exist/i);
  });

  it("handles DST offsets and the deterministic fall-back occurrence", () => {
    expect(
      zonedLocalToUtcIsoStrict("2026-03-08T03:30", "America/New_York"),
    ).toBe("2026-03-08T07:30:00+00:00");
    expect(
      zonedLocalToUtcIsoStrict("2026-11-01T01:30", "America/New_York"),
    ).toBe("2026-11-01T05:30:00+00:00");
  });

  it("builds PATCH from only Gateway-owned mutable fields", () => {
    const draft = draftForScheduledTask(CRON_TASK);
    draft.contextMode = "fresh_thread_per_run";
    draft.threadId = "stale-thread";
    draft.title = "Updated";
    draft.schedule.schedule_spec = { cron: "0 10 * * 1" };

    const payload = buildScheduledTaskUpdatePayload(draft, CRON_TASK, {
      now: NOW,
    });
    expect(payload).toEqual({
      context_mode: "fresh_thread_per_run",
      title: "Updated",
      prompt: "Summarize the thread",
      schedule_spec: { cron: "0 10 * * 1" },
      timezone: "Asia/Shanghai",
    });
    expect(payload).not.toHaveProperty("thread_id");
    expect(payload).not.toHaveProperty("schedule_type");
    expect(payload).not.toHaveProperty("enabled");
  });

  it("never lets edit change the persisted schedule type", () => {
    const draft = draftForScheduledTask(CRON_TASK);
    draft.schedule.schedule_type = "once";
    draft.schedule.schedule_spec = { run_at: "2026-07-03T09:00" };
    expect(() =>
      buildScheduledTaskUpdatePayload(draft, CRON_TASK, { now: NOW }),
    ).toThrow(/schedule type/i);
  });

  it("applies a recipe as form state and keeps placeholders", () => {
    const draft = createScheduledTaskDraft({
      routeThreadId: "thread-route",
      browserTimezone: "Asia/Tokyo",
    });
    const recipe = RECIPES.find((candidate) => candidate.id === "issues")!;
    const applied = applyScheduledTaskRecipe(draft, recipe, "Issue triage");

    expect(applied.title).toBe("Issue triage");
    expect(applied.prompt).toContain("{{repo}}");
    expect(applied.contextMode).toBe("fresh_thread_per_run");
    expect(applied.threadId).toBe("");
    expect(applied.schedule.timezone).toBe("Asia/Tokyo");
    expect(applied.schedule.schedule_spec).toEqual({ cron: "0 9 * * *" });
  });
});
