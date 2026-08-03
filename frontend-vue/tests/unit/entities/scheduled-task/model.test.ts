import { describe, expect, it } from "vitest";

import {
  buildCronFromBuilder,
  cronBuilderFromExpression,
  formatSchedulePreview,
  formatTimezoneAffordance,
  normalizeDatetimeLocalForSchedule,
  scheduleSummary,
} from "../../../../app/entities/scheduled-task/model";
import type { ScheduledTask } from "../../../../app/core/api/scheduled-tasks/client";

describe("scheduled task model", () => {
  it("builds the supported hourly, weekly, and monthly cron shapes", () => {
    expect(buildCronFromBuilder({ dayOfMonth: "1", dayOfWeek: "1", hour: "09", minute: "05", mode: "hourly" }))
      .toBe("5 * * * *");
    expect(buildCronFromBuilder({ dayOfMonth: "1", dayOfWeek: "2", hour: "09", minute: "05", mode: "weekly" }))
      .toBe("5 9 * * 2");
    expect(buildCronFromBuilder({ dayOfMonth: "15", dayOfWeek: "1", hour: "09", minute: "05", mode: "monthly" }))
      .toBe("5 9 15 * *");
  });

  it("seeds structured controls only for supported five-field expressions", () => {
    expect(cronBuilderFromExpression("30 14 15 * *")).toEqual({
      hour: "14",
      minute: "30",
      mode: "monthly",
      monthDay: "15",
      weekday: "1",
    });
    expect(cronBuilderFromExpression("0 9 * * 1-5")?.mode).toBe("weekdays");
    expect(cronBuilderFromExpression("0 9 * * *")?.mode).toBe("daily");
    expect(cronBuilderFromExpression("0 9 * * 1,3")).toBeNull();
  });

  it("normalizes valid datetime-local wall-clock values and rejects rollover dates", () => {
    expect(normalizeDatetimeLocalForSchedule("2026-08-02T09:30")).toBe("2026-08-02T09:30:00");
    expect(normalizeDatetimeLocalForSchedule("2026-02-30T09:30")).toBeNull();
  });

  it("keeps cron and once previews explicit about timezone semantics", () => {
    expect(formatSchedulePreview({ cron: "0 9 * * *", runAtLocal: "", scheduleType: "cron", timezone: "Asia/Shanghai" }))
      .toContain("每天 09:00 (0 9 * * *) · Asia/Shanghai");
    expect(formatTimezoneAffordance({ cron: "", runAtLocal: "2026-08-02T09:30", scheduleType: "once", timezone: "Asia/Shanghai" }))
      .toContain("不带偏移量的 2026-08-02T09:30:00");
  });

  it("summarizes the entity without reaching into transport", () => {
    expect(scheduleSummary(task("task-a"))).toBe("cron · 0 9 * * * · 已启用");
  });
});

function task(id: string): ScheduledTask {
  return {
    id,
    thread_id: null,
    context_mode: "fresh_thread_per_run",
    title: "Task",
    prompt: "Prompt",
    schedule_type: "cron",
    schedule_spec: { cron: "0 9 * * *" },
    timezone: "UTC",
    status: "enabled",
    next_run_at: null,
    last_run_at: null,
    last_run_id: null,
    last_thread_id: null,
    last_error: null,
    lease_expires_at: null,
    lease_owner: null,
    overlap_policy: "skip",
    run_count: 0,
    created_at: "2026-07-31T00:00:00Z",
    updated_at: "2026-07-31T00:00:00Z",
  };
}
