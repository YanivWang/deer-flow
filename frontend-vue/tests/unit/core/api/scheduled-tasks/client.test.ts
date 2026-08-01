import { describe, expect, it, vi } from "vitest";

import {
  createScheduledTask,
  fetchScheduledTasks,
  pauseScheduledTask,
  triggerScheduledTask,
  updateScheduledTask,
} from "../../../../../app/core/api/scheduled-tasks/client";

describe("scheduled tasks API client", () => {
  it("loads all tasks or thread-scoped tasks from backend routes", async () => {
    const fetchMock = vi.fn(async () => Response.json([]));
    vi.stubGlobal("fetch", fetchMock);

    await fetchScheduledTasks();
    await fetchScheduledTasks({ threadId: "thread/a" });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/scheduled-tasks");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/threads/thread%2Fa/scheduled-tasks");
  });

  it("creates cron tasks with JSON and CSRF headers", async () => {
    document.cookie = "csrf_token=csrf-1";
    const fetchMock = vi.fn(async () => Response.json(task("task-a")));
    vi.stubGlobal("fetch", fetchMock);

    await createScheduledTask({
      context_mode: "reuse_thread",
      thread_id: "thread-a",
      title: "Morning report",
      prompt: "Summarize updates",
      schedule_type: "cron",
      schedule_spec: { cron: "0 9 * * *" },
      timezone: "UTC",
    });

    const init = fetchMock.mock.calls[0]?.[1];
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/scheduled-tasks");
    expect(init).toEqual(
      expect.objectContaining({
        credentials: "include",
        method: "POST",
        body: JSON.stringify({
          context_mode: "reuse_thread",
          thread_id: "thread-a",
          title: "Morning report",
          prompt: "Summarize updates",
          schedule_type: "cron",
          schedule_spec: { cron: "0 9 * * *" },
          timezone: "UTC",
        }),
      }),
    );
    expect(init?.headers).toBeInstanceOf(Headers);
    expect((init?.headers as Headers).get("Content-Type")).toBe("application/json");
    expect((init?.headers as Headers).get("X-CSRF-Token")).toBe("csrf-1");
  });

  it("creates one-time tasks with schedule_spec.run_at", async () => {
    const fetchMock = vi.fn(async () => Response.json(task("task-once", {
      schedule_spec: { run_at: "2026-08-02T01:30:00.000Z" },
      schedule_type: "once",
    })));
    vi.stubGlobal("fetch", fetchMock);

    await createScheduledTask({
      context_mode: "fresh_thread_per_run",
      title: "One-time report",
      prompt: "Send once",
      schedule_type: "once",
      schedule_spec: { run_at: "2026-08-02T01:30:00.000Z" },
      timezone: "UTC",
    });

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      context_mode: "fresh_thread_per_run",
      title: "One-time report",
      prompt: "Send once",
      schedule_type: "once",
      schedule_spec: { run_at: "2026-08-02T01:30:00.000Z" },
      timezone: "UTC",
    });
  });

  it("uses action endpoints for pause and manual trigger", async () => {
    const fetchMock = vi
      .fn<[], Promise<Response>>()
      .mockResolvedValueOnce(Response.json(task("task-a", { status: "paused" })))
      .mockResolvedValueOnce(Response.json({ id: "task-a", triggered: true }));
    vi.stubGlobal("fetch", fetchMock);

    await pauseScheduledTask("task/a");
    await triggerScheduledTask("task/a");

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/scheduled-tasks/task%2Fa/pause");
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ method: "POST" }));
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/scheduled-tasks/task%2Fa/trigger");
  });

  it("patches editable task fields without changing schedule_type", async () => {
    document.cookie = "csrf_token=csrf-2";
    const fetchMock = vi.fn(async () => Response.json(task("task-a", {
      prompt: "Updated prompt",
      schedule_spec: { cron: "0 12 * * *" },
      title: "Updated",
    })));
    vi.stubGlobal("fetch", fetchMock);

    await updateScheduledTask("task/a", {
      prompt: "Updated prompt",
      schedule_spec: { cron: "0 12 * * *" },
      timezone: "UTC",
      title: "Updated",
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/scheduled-tasks/task%2Fa");
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({
          prompt: "Updated prompt",
          schedule_spec: { cron: "0 12 * * *" },
          timezone: "UTC",
          title: "Updated",
        }),
        credentials: "include",
        method: "PATCH",
      }),
    );
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("X-CSRF-Token")).toBe("csrf-2");
  });

  it("surfaces backend error details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ detail: "task already has an active run" }, { status: 409 })),
    );

    await expect(triggerScheduledTask("task-a")).rejects.toThrow("task already has an active run");
  });
});

function task(id: string, overrides: Record<string, unknown> = {}) {
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
