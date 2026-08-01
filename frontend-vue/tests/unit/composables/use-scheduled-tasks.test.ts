import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  scheduleSummary,
  useScheduledTasks,
} from "../../../app/composables/use-scheduled-tasks";
import type { ScheduledTask } from "../../../app/core/api/scheduled-tasks/client";

describe("useScheduledTasks", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("selects the first loaded task and exposes run rows", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/scheduled-tasks") {
        return Response.json([task("task-a"), task("task-b")]);
      }
      if (url === "/api/scheduled-tasks/task-a/runs") {
        return Response.json([run("run-a", "task-a")]);
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mountScheduledHarness();
    await flushPromises();

    expect(wrapper.get('[data-testid="selected"]').text()).toBe("task-a");
    expect(wrapper.get('[data-testid="runs"]').text()).toBe("1");
  });

  it("keeps the selected task after a successful create mutation", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/threads/thread-a/scheduled-tasks") {
        return Response.json([]);
      }
      if (url === "/api/scheduled-tasks" && init?.method === "POST") {
        return Response.json(task("created-task", { thread_id: "thread-a" }));
      }
      return Response.json([]);
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mountScheduledHarness(ref("thread-a"));
    await flushPromises();

    await wrapper.get('[data-testid="create"]').trigger("click");
    await flushPromises();

    expect(wrapper.get('[data-testid="selected"]').text()).toBe("created-task");
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(expect.objectContaining({ method: "POST" }));
  });

  it("formats a compact schedule summary", () => {
    expect(scheduleSummary(task("task-a"))).toBe("cron · 0 9 * * * · 已启用");
  });

  it("refreshes selected runs after manual trigger so completion state is visible", async () => {
    let runsRequestCount = 0;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/scheduled-tasks" && !init?.method) {
        return Response.json([task("task-a", { status: "running" })]);
      }
      if (url === "/api/scheduled-tasks/task-a/runs") {
        runsRequestCount += 1;
        return Response.json([
          run("task-run-a", "task-a", {
            status: runsRequestCount === 1 ? "queued" : "success",
          }),
        ]);
      }
      if (url === "/api/scheduled-tasks/task-a/trigger" && init?.method === "POST") {
        return Response.json({ id: "task-a", triggered: true });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mountScheduledHarness();
    await flushPromises();

    expect(wrapper.get('[data-testid="run-statuses"]').text()).toBe("queued");

    await wrapper.get('[data-testid="trigger"]').trigger("click");
    await flushPromises();
    await flushPromises();

    expect(wrapper.get('[data-testid="run-statuses"]').text()).toBe("success");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/scheduled-tasks/task-a/trigger",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("surfaces overlap-skip active-run conflicts from manual trigger", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/scheduled-tasks" && !init?.method) {
        return Response.json([task("task-a")]);
      }
      if (url === "/api/scheduled-tasks/task-a/runs") {
        return Response.json([run("task-run-a", "task-a", { status: "running" })]);
      }
      if (url === "/api/scheduled-tasks/task-a/trigger" && init?.method === "POST") {
        return Response.json({ detail: "task already has an active run" }, { status: 409 });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mountScheduledHarness();
    await flushPromises();

    await wrapper.get('[data-testid="trigger"]').trigger("click");
    await flushPromises();

    expect(wrapper.get('[data-testid="action-error"]').text()).toBe(
      "task already has an active run",
    );
  });
});

function mountScheduledHarness(threadId = ref<string | null>(null)) {
  const Probe = defineComponent({
    setup() {
      const scheduled = useScheduledTasks(threadId);
      return () =>
        h("div", [
          h("p", { "data-testid": "selected" }, scheduled.selectedTaskId.value ?? "none"),
          h("p", { "data-testid": "runs" }, String(scheduled.runs.value.length)),
          h(
            "p",
            { "data-testid": "run-statuses" },
            scheduled.runs.value.map((run) => run.status).join(",") || "none",
          ),
          h(
            "p",
            { "data-testid": "action-error" },
            scheduled.actionErrorMessage.value ?? "none",
          ),
          h(
            "button",
            {
              "data-testid": "create",
              onClick: () =>
                scheduled.createTask({
                  context_mode: "reuse_thread",
                  thread_id: "thread-a",
                  title: "Created",
                  prompt: "Prompt",
                  schedule_type: "cron",
                  schedule_spec: { cron: "0 9 * * *" },
                  timezone: "UTC",
                }),
            },
            "create",
          ),
          h(
            "button",
            {
              "data-testid": "trigger",
              onClick: () =>
                scheduled.triggerTask(scheduled.selectedTaskId.value ?? "").catch(() => undefined),
            },
            "trigger",
          ),
        ]);
    },
  });

  return mount(Probe, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient: createQueryClient() }]],
    },
  });
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

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
