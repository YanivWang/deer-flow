/*
  【文件职责】     固定scheduled-task HTTP method/path/query/body/error 合同。
  【架构位置】     API contract test
  【主要导出】     无；Vitest cases
  【依赖关系】     core/scheduled-tasks/api · mocked fetcher
  【边界与注意】   不对 Gateway 增加 interval/enabled/schedule_type PATCH 等字段。
                   runs 是**不带查询串**的一次取数：Gateway 自己的 limit=50 / offset=0
                   默认值决定返回多少，前端不再加分页参数（对照见 useScheduledTasks.ts）。
*/
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetch } from "@/core/api/fetcher";
import {
  createScheduledTask,
  deleteScheduledTask,
  fetchScheduledTaskRuns,
  pauseScheduledTask,
  resumeScheduledTask,
  triggerScheduledTask,
  updateScheduledTask,
} from "@/core/scheduled-tasks/api";

vi.mock("@/core/api/fetcher", () => ({ fetch: vi.fn() }));

const mockedFetch = vi.mocked(fetch);
const TASK = {
  id: "task-1",
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
  run_count: 0,
  created_at: "2026-07-01T00:00:00+00:00",
  updated_at: "2026-07-01T00:00:00+00:00",
};

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe("scheduled-task API", () => {
  beforeEach(() => mockedFetch.mockReset());

  it("fetches runs with an escaped id and no pagination query", async () => {
    const signal = new AbortController().signal;
    mockedFetch.mockResolvedValueOnce(response([]));

    await fetchScheduledTaskRuns("task / one", { signal });

    expect(String(mockedFetch.mock.calls[0]?.[0])).toMatch(
      /\/api\/scheduled-tasks\/task%20%2F%20one\/runs$/,
    );
    expect(mockedFetch.mock.calls[0]?.[1]?.signal).toBe(signal);
  });

  it("uses the exact mutation methods and bodies", async () => {
    mockedFetch.mockResolvedValue(response(TASK));

    await createScheduledTask({
      context_mode: "fresh_thread_per_run",
      title: "Task",
      prompt: "Prompt",
      schedule_type: "cron",
      schedule_spec: { cron: "0 9 * * *" },
      timezone: "UTC",
    });
    await updateScheduledTask("task-1", {
      title: "Updated",
      prompt: "Updated prompt",
      schedule_spec: { cron: "0 10 * * *" },
      timezone: "Asia/Shanghai",
    });
    await pauseScheduledTask("task-1");
    await resumeScheduledTask("task-1");
    await triggerScheduledTask("task-1");
    await deleteScheduledTask("task-1");

    expect(mockedFetch.mock.calls.map((call) => call[1]?.method)).toEqual([
      "POST",
      "PATCH",
      "POST",
      "POST",
      "POST",
      "DELETE",
    ]);
    const patchBody = JSON.parse(
      String(mockedFetch.mock.calls[1]?.[1]?.body),
    ) as Record<string, unknown>;
    expect(patchBody).not.toHaveProperty("schedule_type");
    expect(patchBody).not.toHaveProperty("thread_id");
    expect(patchBody).not.toHaveProperty("enabled");
    expect(patchBody).not.toHaveProperty("non_interactive");
  });

  it.each([401, 403, 404, 409, 422, 502])(
    "preserves Gateway detail and status %s",
    async (status) => {
      mockedFetch.mockResolvedValue(
        response({ detail: `Gateway ${status}` }, status),
      );
      const error = await triggerScheduledTask("task-1").catch(
        (cause: unknown) => cause,
      );
      expect(error).toMatchObject({
        status,
        message: `Gateway ${status}`,
      });
    },
  );
});
