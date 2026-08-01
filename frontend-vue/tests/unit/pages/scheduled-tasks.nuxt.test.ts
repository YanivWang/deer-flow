import { mountSuspended } from "@nuxt/test-utils/runtime";
import { flushPromises } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import ScheduledTasksPage from "../../../app/pages/workspace/scheduled-tasks.vue";
import type { ScheduledTask } from "../../../app/core/api/scheduled-tasks/client";

describe("scheduled tasks page", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders tasks, selects details, and loads runs", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/scheduled-tasks") {
        return Response.json([task("task-a", {
          last_run_id: "run-last",
          last_thread_id: "thread-last",
          lease_expires_at: "2026-08-01T09:05:00Z",
          lease_owner: "scheduler-worker-a",
          run_count: 3,
          status: "running",
          title: "Morning report",
        })]);
      }
      if (url === "/api/scheduled-tasks/task-a/runs") {
        return Response.json([run("run-a", "task-a", {
          error: "skipped: a previous run of this task is still active",
          finished_at: "2026-08-01T09:02:00Z",
          run_id: "agent-run-a",
          status: "skipped",
        })]);
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = await mountSuspended(ScheduledTasksPage, {
      route: "/workspace/scheduled-tasks",
    });
    await flushPromises();

    expect(wrapper.get('[data-testid="vue-scheduled-task-task-a"]').text()).toContain(
      "Morning report",
    );
    expect(wrapper.get('[data-testid="vue-scheduled-task-task-a"]').attributes("aria-current")).toBe(
      "true",
    );
    expect(wrapper.get('[data-testid="vue-scheduled-detail"]').text()).toContain("Morning report");
    expect(wrapper.get('[data-testid="vue-scheduled-detail"]').text()).toContain(
      "scheduler-worker-a",
    );
    expect(wrapper.get('[data-testid="vue-scheduled-detail"]').text()).toContain("skip");
    expect(wrapper.get('[data-testid="vue-scheduled-detail"]').text()).toContain("run-last");
    expect(wrapper.get('[data-testid="vue-scheduled-detail"]').text()).toContain("thread-last");
    expect(wrapper.get('[data-testid="vue-scheduled-runs"]').text()).toContain("计划时间");
    expect(wrapper.get('[data-testid="vue-scheduled-runs"]').text()).toContain("计划触发");
    expect(wrapper.get('[data-testid="vue-scheduled-runs"]').text()).toContain("已跳过");
    expect(wrapper.get('[data-testid="vue-scheduled-runs"]').text()).toContain("agent-run-a");
    expect(wrapper.get('[data-testid="vue-scheduled-runs"]').text()).toContain("skipped");
  });

  it("creates a thread-scoped cron task from the query thread id", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/threads/thread-a/scheduled-tasks") {
        return Response.json([]);
      }
      if (url === "/api/scheduled-tasks" && init?.method === "POST") {
        return Response.json(task("task-created", { thread_id: "thread-a" }));
      }
      return Response.json([]);
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = await mountSuspended(ScheduledTasksPage, {
      route: "/workspace/scheduled-tasks?thread_id=thread-a",
    });
    await flushPromises();

    await wrapper.get('[data-testid="vue-scheduled-title"]').setValue("Morning report");
    await wrapper.get('[data-testid="vue-scheduled-prompt"]').setValue("Summarize today");
    await wrapper.get('[data-testid="vue-scheduled-cron"]').setValue("0 10 * * 1");
    await wrapper.get('[data-testid="vue-scheduled-create-form"]').trigger("submit");
    await flushPromises();

    expect(wrapper.get('[data-testid="vue-scheduled-thread-scope"]').text()).toContain("thread-a");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/scheduled-tasks");
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      context_mode: "reuse_thread",
      thread_id: "thread-a",
      title: "Morning report",
      prompt: "Summarize today",
      schedule_type: "cron",
      schedule_spec: { cron: "0 10 * * 1" },
      timezone: "UTC",
    });
  });

  it("creates a one-time schedule as timezone wall-clock run_at", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/scheduled-tasks" && init?.method === "POST") {
        return Response.json(task("task-once", {
          schedule_spec: { run_at: "2026-08-02T09:30:00" },
          schedule_type: "once",
          timezone: "Asia/Shanghai",
        }));
      }
      return Response.json([]);
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = await mountSuspended(ScheduledTasksPage, {
      route: "/workspace/scheduled-tasks",
    });
    await flushPromises();

    await wrapper.get('[data-testid="vue-scheduled-type-once"]').trigger("click");
    await wrapper.get('[data-testid="vue-scheduled-title"]').setValue("One-time report");
    await wrapper.get('[data-testid="vue-scheduled-prompt"]').setValue("Send the report once");
    await wrapper.get('[data-testid="vue-scheduled-run-at"]').setValue("2026-08-02T09:30");
    await wrapper.get('[data-testid="vue-scheduled-timezone"]').setValue("Asia/Shanghai");
    await flushPromises();

    expect(wrapper.get('[data-testid="vue-scheduled-type-cron"]').attributes("aria-pressed")).toBe(
      "false",
    );
    expect(wrapper.get('[data-testid="vue-scheduled-type-once"]').attributes("aria-pressed")).toBe(
      "true",
    );
    expect(wrapper.get('[data-testid="vue-scheduled-preview"]').text()).toContain(
      "单次 · 2026-08-02 09:30 · Asia/Shanghai",
    );
    expect(wrapper.get('[data-testid="vue-scheduled-timezone-affordance"]').text()).toContain(
      "Gateway 会收到不带偏移量的 2026-08-02T09:30:00",
    );
    expect(wrapper.get('[data-testid="vue-scheduled-timezone-affordance"]').text()).toContain(
      "Asia/Shanghai",
    );

    await wrapper.get('[data-testid="vue-scheduled-create-form"]').trigger("submit");
    await flushPromises();

    expect(wrapper.find('[data-testid="vue-scheduled-cron"]').exists()).toBe(false);
    const createCall = fetchMock.mock.calls.find(
      ([url, init]) => url === "/api/scheduled-tasks" && init?.method === "POST",
    );
    expect(JSON.parse(String(createCall?.[1]?.body))).toEqual({
      context_mode: "fresh_thread_per_run",
      title: "One-time report",
      prompt: "Send the report once",
      schedule_type: "once",
      schedule_spec: { run_at: "2026-08-02T09:30:00" },
      timezone: "Asia/Shanghai",
    });
  });

  it("applies recipes, cron presets, timezone catalog, and create preview", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/scheduled-tasks" && init?.method === "POST") {
        return Response.json(task("task-preset", {
          schedule_spec: { cron: "0 * * * *" },
          timezone: "Asia/Tokyo",
          title: "Weekly planning",
        }));
      }
      return Response.json([]);
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = await mountSuspended(ScheduledTasksPage, {
      route: "/workspace/scheduled-tasks",
    });
    await flushPromises();

    await wrapper.get('[data-testid="vue-scheduled-recipe-weekly-planning"]').trigger("click");
    await wrapper.get('[data-testid="vue-scheduled-cron-preset-hourly"]').trigger("click");
    await wrapper.get('[data-testid="vue-scheduled-timezone"]').setValue("Asia/Tokyo");
    await flushPromises();

    expect((wrapper.get('[data-testid="vue-scheduled-title"]').element as HTMLInputElement).value)
      .toBe("周计划");
    expect((wrapper.get('[data-testid="vue-scheduled-cron"]').element as HTMLInputElement).value)
      .toBe("0 * * * *");
    expect(wrapper.get('[data-testid="vue-scheduled-preview"]').text()).toContain(
      "cron · 每小时第 00 分钟 (0 * * * *) · Asia/Tokyo",
    );

    await wrapper.get('[data-testid="vue-scheduled-create-form"]').trigger("submit");
    await flushPromises();

    const createCall = fetchMock.mock.calls.find(
      ([url, init]) => url === "/api/scheduled-tasks" && init?.method === "POST",
    );
    expect(JSON.parse(String(createCall?.[1]?.body))).toEqual({
      context_mode: "fresh_thread_per_run",
      title: "周计划",
      prompt: "准备一份包含优先级和未决风险的周计划简报。",
      schedule_type: "cron",
      schedule_spec: { cron: "0 * * * *" },
      timezone: "Asia/Tokyo",
    });
  });

  it("builds a monthly cron expression from structured controls", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/scheduled-tasks" && init?.method === "POST") {
        return Response.json(task("task-monthly", {
          schedule_spec: { cron: "30 14 15 * *" },
          timezone: "America/New_York",
          title: "Monthly finance review",
        }));
      }
      return Response.json([]);
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = await mountSuspended(ScheduledTasksPage, {
      route: "/workspace/scheduled-tasks",
    });
    await flushPromises();

    await wrapper.get('[data-testid="vue-scheduled-title"]').setValue("Monthly finance review");
    await wrapper.get('[data-testid="vue-scheduled-prompt"]').setValue("Prepare finance notes");
    await wrapper.get('[data-testid="vue-scheduled-cron-builder-mode"]').setValue("monthly");
    await wrapper.get('[data-testid="vue-scheduled-cron-builder-hour"]').setValue("14");
    await wrapper.get('[data-testid="vue-scheduled-cron-builder-minute"]').setValue("30");
    await wrapper.get('[data-testid="vue-scheduled-cron-builder-month-day"]').setValue("15");
    await wrapper.get('[data-testid="vue-scheduled-timezone"]').setValue("America/New_York");
    await flushPromises();

    expect((wrapper.get('[data-testid="vue-scheduled-cron"]').element as HTMLInputElement).value)
      .toBe("30 14 15 * *");
    expect(wrapper.get('[data-testid="vue-scheduled-preview"]').text()).toContain(
      "分钟 30，小时 14，日期 15，月份 *，星期 *",
    );
    expect(wrapper.get('[data-testid="vue-scheduled-timezone-affordance"]').text()).toContain(
      "Gateway 会按 America/New_York 评估这个 5 字段 Cron",
    );

    await wrapper.get('[data-testid="vue-scheduled-create-form"]').trigger("submit");
    await flushPromises();

    const createCall = fetchMock.mock.calls.find(
      ([url, init]) => url === "/api/scheduled-tasks" && init?.method === "POST",
    );
    expect(JSON.parse(String(createCall?.[1]?.body))).toEqual({
      context_mode: "fresh_thread_per_run",
      title: "Monthly finance review",
      prompt: "Prepare finance notes",
      schedule_type: "cron",
      schedule_spec: { cron: "30 14 15 * *" },
      timezone: "America/New_York",
    });
  });

  it("routes task actions to pause, resume, trigger, and delete endpoints", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/scheduled-tasks" && !init?.method) {
        return Response.json([task("task-a")]);
      }
      if (url === "/api/scheduled-tasks/task-a/runs") {
        return Response.json([]);
      }
      if (url === "/api/scheduled-tasks/task-a/pause") {
        return Response.json(task("task-a", { status: "paused" }));
      }
      if (url === "/api/scheduled-tasks/task-a/resume") {
        return Response.json(task("task-a", { status: "enabled" }));
      }
      if (url === "/api/scheduled-tasks/task-a/trigger") {
        return Response.json({ id: "task-a", triggered: true });
      }
      if (url === "/api/scheduled-tasks/task-a" && init?.method === "DELETE") {
        return Response.json({ id: "task-a", deleted: true });
      }
      return Response.json([]);
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = await mountSuspended(ScheduledTasksPage, {
      route: "/workspace/scheduled-tasks",
    });
    await flushPromises();

    await wrapper.get('[data-testid="vue-scheduled-pause"]').trigger("click");
    await flushPromises();
    await wrapper.get('[data-testid="vue-scheduled-resume"]').trigger("click");
    await flushPromises();
    await wrapper.get('[data-testid="vue-scheduled-trigger"]').trigger("click");
    await flushPromises();
    await wrapper.get('[data-testid="vue-scheduled-delete"]').trigger("click");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/scheduled-tasks/task-a/pause",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/scheduled-tasks/task-a/resume",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/scheduled-tasks/task-a/trigger",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/scheduled-tasks/task-a",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("filters the task list by status and schedule type", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/scheduled-tasks") {
        return Response.json([
          task("task-cron", { status: "paused", title: "Paused cron" }),
          task("task-once", {
            schedule_spec: { run_at: "2026-08-02T01:30:00.000Z" },
            schedule_type: "once",
            title: "Enabled once",
          }),
        ]);
      }
      return Response.json([]);
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = await mountSuspended(ScheduledTasksPage, {
      route: "/workspace/scheduled-tasks",
    });
    await flushPromises();

    await wrapper.get('[data-testid="vue-scheduled-filter-status-paused"]').trigger("click");
    await flushPromises();

    expect(wrapper.get('[data-testid="vue-scheduled-filter-status-paused"]').attributes("aria-pressed")).toBe(
      "true",
    );
    expect(wrapper.find('[data-testid="vue-scheduled-task-task-cron"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="vue-scheduled-task-task-once"]').exists()).toBe(false);

    await wrapper.get('[data-testid="vue-scheduled-filter-status-all"]').trigger("click");
    await wrapper.get('[data-testid="vue-scheduled-filter-type-once"]').trigger("click");
    await flushPromises();

    expect(wrapper.get('[data-testid="vue-scheduled-filter-type-once"]').attributes("aria-pressed")).toBe(
      "true",
    );
    expect(wrapper.find('[data-testid="vue-scheduled-task-task-cron"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="vue-scheduled-task-task-once"]').exists()).toBe(true);
  });

  it("links create validation errors to the required schedule fields", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([])));
    const wrapper = await mountSuspended(ScheduledTasksPage, {
      route: "/workspace/scheduled-tasks",
    });
    await flushPromises();

    await wrapper.get('[data-testid="vue-scheduled-create-form"]').trigger("submit");
    await flushPromises();

    const error = wrapper.get('[data-testid="vue-scheduled-form-error"]');
    expect(error.attributes("id")).toBe("vue-scheduled-form-error-message");
    expect(error.attributes("role")).toBe("alert");
    expect(wrapper.get('[data-testid="vue-scheduled-title"]').attributes("aria-invalid")).toBe(
      "true",
    );
    expect(wrapper.get('[data-testid="vue-scheduled-prompt"]').attributes("aria-describedby")).toBe(
      "vue-scheduled-form-error-message",
    );
  });

  it("edits a selected cron task through the PATCH endpoint", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/scheduled-tasks" && !init?.method) {
        return Response.json([task("task-a", { title: "Morning report" })]);
      }
      if (url === "/api/scheduled-tasks/task-a/runs") {
        return Response.json([]);
      }
      if (url === "/api/scheduled-tasks/task-a" && init?.method === "PATCH") {
        return Response.json(task("task-a", {
          prompt: "Updated prompt",
          schedule_spec: { cron: "0 12 * * *" },
          title: "Updated report",
        }));
      }
      return Response.json([]);
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = await mountSuspended(ScheduledTasksPage, {
      route: "/workspace/scheduled-tasks",
    });
    await flushPromises();

    await wrapper.get('[data-testid="vue-scheduled-edit-toggle"]').trigger("click");
    await wrapper.get('[data-testid="vue-scheduled-edit-title"]').setValue("Updated report");
    await wrapper.get('[data-testid="vue-scheduled-edit-prompt"]').setValue("Updated prompt");
    await wrapper.get('[data-testid="vue-scheduled-edit-cron"]').setValue("0 12 * * *");
    await wrapper.get('[data-testid="vue-scheduled-edit-form"]').trigger("submit");
    await flushPromises();

    const patchCall = fetchMock.mock.calls.find(
      ([url, init]) => url === "/api/scheduled-tasks/task-a" && init?.method === "PATCH",
    );
    expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({
      prompt: "Updated prompt",
      schedule_spec: { cron: "0 12 * * *" },
      timezone: "UTC",
      title: "Updated report",
    });
  });

  it("links edit validation errors to the edit form fields", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/scheduled-tasks") {
        return Response.json([task("task-a", { title: "Morning report" })]);
      }
      return Response.json([]);
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = await mountSuspended(ScheduledTasksPage, {
      route: "/workspace/scheduled-tasks",
    });
    await flushPromises();

    await wrapper.get('[data-testid="vue-scheduled-edit-toggle"]').trigger("click");
    await wrapper.get('[data-testid="vue-scheduled-edit-title"]').setValue("");
    await wrapper.get('[data-testid="vue-scheduled-edit-form"]').trigger("submit");
    await flushPromises();

    const error = wrapper.get('[data-testid="vue-scheduled-edit-error"]');
    expect(error.attributes("id")).toBe("vue-scheduled-edit-error-message");
    expect(error.attributes("role")).toBe("alert");
    expect(wrapper.get('[data-testid="vue-scheduled-edit-title"]').attributes("aria-invalid")).toBe(
      "true",
    );
    expect(
      wrapper.get('[data-testid="vue-scheduled-edit-prompt"]').attributes("aria-describedby"),
    ).toBe("vue-scheduled-edit-error-message");
  });

  it("edits a selected one-time task with timezone wall-clock run_at", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/scheduled-tasks" && !init?.method) {
        return Response.json([task("task-once", {
          schedule_spec: { run_at: "2026-08-02T09:30:00" },
          schedule_type: "once",
          timezone: "Asia/Shanghai",
          title: "One-time report",
        })]);
      }
      if (url === "/api/scheduled-tasks/task-once/runs") {
        return Response.json([]);
      }
      if (url === "/api/scheduled-tasks/task-once" && init?.method === "PATCH") {
        return Response.json(task("task-once", {
          prompt: "Updated once prompt",
          schedule_spec: { run_at: "2026-08-03T10:45:00" },
          schedule_type: "once",
          timezone: "Asia/Tokyo",
          title: "Updated once",
        }));
      }
      return Response.json([]);
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = await mountSuspended(ScheduledTasksPage, {
      route: "/workspace/scheduled-tasks",
    });
    await flushPromises();

    await wrapper.get('[data-testid="vue-scheduled-edit-toggle"]').trigger("click");
    await wrapper.get('[data-testid="vue-scheduled-edit-title"]').setValue("Updated once");
    await wrapper.get('[data-testid="vue-scheduled-edit-prompt"]').setValue("Updated once prompt");
    await wrapper.get('[data-testid="vue-scheduled-edit-run-at"]').setValue("2026-08-03T10:45");
    await wrapper.get('[data-testid="vue-scheduled-edit-timezone"]').setValue("Asia/Tokyo");
    await wrapper.get('[data-testid="vue-scheduled-edit-form"]').trigger("submit");
    await flushPromises();

    const patchCall = fetchMock.mock.calls.find(
      ([url, init]) => url === "/api/scheduled-tasks/task-once" && init?.method === "PATCH",
    );
    expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({
      prompt: "Updated once prompt",
      schedule_spec: { run_at: "2026-08-03T10:45:00" },
      timezone: "Asia/Tokyo",
      title: "Updated once",
    });
  });
});

function task(id: string, overrides: Partial<ScheduledTask> = {}): ScheduledTask {
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
    next_run_at: "2026-08-01T09:00:00Z",
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
    ...overrides,
  };
}

function run(id: string, taskId: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    task_id: taskId,
    thread_id: "thread-a",
    run_id: "run-a",
    scheduled_for: "2026-08-01T09:00:00Z",
    trigger: "scheduled",
    status: "success",
    error: null,
    started_at: "2026-08-01T09:00:00Z",
    finished_at: "2026-08-01T09:01:00Z",
    created_at: "2026-08-01T09:00:00Z",
    ...overrides,
  };
}
