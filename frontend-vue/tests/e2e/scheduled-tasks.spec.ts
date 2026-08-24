/*
  【文件职责】     Vue-owned scheduled-task 产品交互、payload、筛选、分页与错误 E2E。
  【架构位置】     WP-07 Playwright contract
  【主要导出】     Playwright scenarios
  【依赖关系】     shared mock Gateway · Vue scheduled-task page/components
  【边界与注意】   Mock 只验证确定性 UI/HTTP 边界；真实 FastAPI 语义由 wp07-real-backend suite 证明。
*/
import { expect, test, type Page, type Route } from "@playwright/test";

import {
  MOCK_THREAD_ID,
  mockLangGraphAPI,
  type MockAPIOptions,
} from "./utils/mock-api";

type TaskStatus =
  "enabled" | "paused" | "running" | "completed" | "failed" | "cancelled";

function task(
  id: string,
  options: {
    status?: TaskStatus;
    scheduleType?: "once" | "cron";
    threadId?: string | null;
    title?: string;
  } = {},
) {
  const scheduleType = options.scheduleType ?? "cron";
  return {
    id,
    thread_id: options.threadId ?? null,
    context_mode: options.threadId
      ? ("reuse_thread" as const)
      : ("fresh_thread_per_run" as const),
    last_thread_id: null,
    title: options.title ?? `Task ${id}`,
    prompt: `Prompt ${id}`,
    schedule_type: scheduleType,
    schedule_spec:
      scheduleType === "cron"
        ? { cron: "0 9 * * *" }
        : { run_at: "2027-07-01T09:00:00+00:00" },
    timezone: "UTC",
    status: options.status ?? ("enabled" as const),
    next_run_at: "2027-07-01T09:00:00+00:00",
    last_run_at: null,
    last_run_id: null,
    last_error: null,
    run_count: 0,
    created_at: "2026-07-01T00:00:00+00:00",
    updated_at: "2026-07-01T00:00:00+00:00",
  };
}

type MockTask = ReturnType<typeof task>;
type MockRun = {
  id: string;
  task_id: string;
  thread_id: string;
  run_id: string | null;
  scheduled_for: string;
  trigger: "scheduled" | "manual";
  status:
    "queued" | "running" | "success" | "failed" | "skipped" | "interrupted";
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
};

function mockWP07Gateway(
  page: Page,
  options: {
    threads?: MockAPIOptions["threads"];
    scheduledTasks?: MockTask[];
  } = {},
) {
  mockLangGraphAPI(page, { threads: options.threads });
  let tasks = [...(options.scheduledTasks ?? [])];
  const runs: Record<string, MockRun[]> = {};
  const timestamp = "2026-07-01T00:00:00+00:00";

  void page.route("**/api/scheduled-tasks", (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      return route.fulfill({ status: 200, json: tasks });
    }
    if (request.method() === "POST") {
      const payload = request.postDataJSON() as Record<string, unknown>;
      const contextMode =
        payload.context_mode === "reuse_thread"
          ? ("reuse_thread" as const)
          : ("fresh_thread_per_run" as const);
      const created: MockTask = {
        ...task("created"),
        context_mode: contextMode,
        thread_id:
          contextMode === "reuse_thread" &&
          typeof payload.thread_id === "string"
            ? payload.thread_id
            : null,
        title: String(payload.title ?? ""),
        prompt: String(payload.prompt ?? ""),
        schedule_type: payload.schedule_type === "once" ? "once" : "cron",
        schedule_spec:
          typeof payload.schedule_spec === "object" && payload.schedule_spec
            ? (payload.schedule_spec as Record<string, unknown>)
            : {},
        timezone: String(payload.timezone ?? "UTC"),
      };
      tasks = [created, ...tasks];
      runs[created.id] = [];
      return route.fulfill({ status: 200, json: created });
    }
    return route.fallback();
  });

  void page.route("**/api/threads/*/scheduled-tasks", (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const path = new URL(route.request().url()).pathname.split("/");
    const threadId = decodeURIComponent(
      path[path.indexOf("threads") + 1] ?? "",
    );
    return route.fulfill({
      status: 200,
      json: tasks.filter((candidate) => candidate.thread_id === threadId),
    });
  });

  const handleTaskRoute = (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.split("/");
    const action = path.at(-1) ?? "";
    const hasAction = ["pause", "resume", "trigger"].includes(action);
    const taskId = decodeURIComponent(path.at(hasAction ? -2 : -1) ?? "");
    const current = tasks.find((candidate) => candidate.id === taskId);

    if (request.method() === "GET" && !hasAction) {
      return route.fulfill({
        status: current ? 200 : 404,
        json: current ?? { detail: "Scheduled task not found" },
      });
    }
    if (request.method() === "PATCH") {
      const payload = request.postDataJSON() as Record<string, unknown>;
      let updated: MockTask | undefined;
      tasks = tasks.map((candidate) => {
        if (candidate.id !== taskId) return candidate;
        const contextMode =
          payload.context_mode === "reuse_thread" ||
          payload.context_mode === "fresh_thread_per_run"
            ? payload.context_mode
            : candidate.context_mode;
        updated = {
          ...candidate,
          ...(typeof payload.title === "string"
            ? { title: payload.title }
            : {}),
          ...(typeof payload.prompt === "string"
            ? { prompt: payload.prompt }
            : {}),
          ...(typeof payload.schedule_spec === "object" && payload.schedule_spec
            ? {
                schedule_spec: payload.schedule_spec as Record<string, unknown>,
              }
            : {}),
          ...(typeof payload.timezone === "string"
            ? { timezone: payload.timezone }
            : {}),
          context_mode: contextMode,
          thread_id:
            contextMode === "fresh_thread_per_run"
              ? null
              : typeof payload.thread_id === "string"
                ? payload.thread_id
                : candidate.thread_id,
          updated_at: timestamp,
        };
        return updated;
      });
      return route.fulfill({
        status: updated ? 200 : 404,
        json: updated ?? { detail: "Scheduled task not found" },
      });
    }
    if (request.method() === "DELETE") {
      tasks = tasks.filter((candidate) => candidate.id !== taskId);
      Reflect.deleteProperty(runs, taskId);
      return route.fulfill({
        status: 200,
        json: { id: taskId, deleted: true },
      });
    }
    if (request.method() === "POST" && current && hasAction) {
      if (action === "trigger") {
        const runId = `run-${taskId}`;
        runs[taskId] = [
          {
            id: `task-run-${taskId}`,
            task_id: taskId,
            thread_id: current.thread_id ?? `thread-${taskId}`,
            run_id: runId,
            scheduled_for: timestamp,
            trigger: "manual",
            status: "success",
            error: null,
            started_at: timestamp,
            finished_at: timestamp,
            created_at: timestamp,
          },
          ...(runs[taskId] ?? []),
        ];
        tasks = tasks.map((candidate) =>
          candidate.id === taskId
            ? {
                ...candidate,
                last_run_id: runId,
                last_run_at: timestamp,
                run_count: candidate.run_count + 1,
              }
            : candidate,
        );
        return route.fulfill({
          status: 200,
          json: { id: taskId, triggered: true },
        });
      }
      const status = action === "pause" ? "paused" : "enabled";
      const updated = { ...current, status } as MockTask;
      tasks = tasks.map((candidate) =>
        candidate.id === taskId ? updated : candidate,
      );
      return route.fulfill({ status: 200, json: updated });
    }
    return route.fallback();
  };
  void page.route("**/api/scheduled-tasks/*", handleTaskRoute);
  for (const action of ["pause", "resume", "trigger"]) {
    void page.route(`**/api/scheduled-tasks/*/${action}`, handleTaskRoute);
  }

  void page.route("**/api/scheduled-tasks/*/runs?*", (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const url = new URL(route.request().url());
    const taskId = decodeURIComponent(url.pathname.split("/").at(-2) ?? "");
    const limit = Number(url.searchParams.get("limit") ?? "50");
    const offset = Number(url.searchParams.get("offset") ?? "0");
    return route.fulfill({
      status: 200,
      json: (runs[taskId] ?? []).slice(offset, offset + limit),
    });
  });
}

async function fillRequiredCreate(page: Page, title = "Created task") {
  await page.getByTestId("scheduled-task-title").fill(title);
  await page.getByTestId("scheduled-task-prompt").fill("Created prompt");
}

test.describe("Vue scheduled tasks", () => {
  test("route thread is an editable default and the page owns its DOM", async ({
    page,
  }) => {
    mockWP07Gateway(page, {
      threads: [{ thread_id: MOCK_THREAD_ID, title: "Scoped thread" }],
      scheduledTasks: [task("scoped", { threadId: MOCK_THREAD_ID })],
    });

    await page.goto(
      `/workspace/scheduled-tasks?thread_id=${encodeURIComponent(MOCK_THREAD_ID)}`,
    );
    await expect(page.getByTestId("scheduled-task-item-scoped")).toBeVisible();
    await expect(page.getByTestId("scheduled-task-context-mode")).toHaveValue(
      "reuse_thread",
    );
    await expect(page.getByTestId("scheduled-task-thread-id")).toHaveValue(
      MOCK_THREAD_ID,
    );

    await page
      .getByTestId("scheduled-task-context-mode")
      .selectOption("fresh_thread_per_run");
    await expect(page.getByTestId("scheduled-task-thread-id")).toHaveCount(0);
  });

  test("recipe and custom cron submit the exact fresh-thread Gateway payload", async ({
    page,
  }) => {
    mockWP07Gateway(page, { scheduledTasks: [] });
    let payload: Record<string, unknown> | undefined;
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        new URL(request.url()).pathname === "/api/scheduled-tasks"
      ) {
        payload = request.postDataJSON() as Record<string, unknown>;
      }
    });

    await page.goto("/workspace/scheduled-tasks");
    await page.getByTestId("scheduled-task-recipe-issues").click();
    await expect(page.getByTestId("scheduled-task-prompt")).toHaveValue(
      /\{\{repo\}\}/,
    );
    await page.getByTestId("scheduled-task-cron-preset").selectOption("custom");
    await page.getByTestId("scheduled-task-custom-cron").fill("15 8 * * 1");
    await page.getByTestId("scheduled-task-submit").click();

    await expect(page.getByTestId("scheduled-task-feedback")).toContainText(
      "created",
    );
    expect(payload).toMatchObject({
      context_mode: "fresh_thread_per_run",
      title: "GitHub Issue triage",
      schedule_type: "cron",
      schedule_spec: { cron: "15 8 * * 1" },
    });
    expect(payload?.timezone).toEqual(expect.any(String));
    expect(payload).not.toHaveProperty("thread_id");
    expect(payload).not.toHaveProperty("enabled");
    expect(payload).not.toHaveProperty("non_interactive");
  });

  test("one-time wall clock uses the selected DST timezone and explicit UTC", async ({
    page,
  }) => {
    mockWP07Gateway(page, { scheduledTasks: [] });
    let payload: Record<string, unknown> | undefined;
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        new URL(request.url()).pathname === "/api/scheduled-tasks"
      ) {
        payload = request.postDataJSON() as Record<string, unknown>;
      }
    });

    await page.goto("/workspace/scheduled-tasks");
    await fillRequiredCreate(page, "DST once");
    await page.getByRole("button", { name: "One-time" }).click();
    await page.getByTestId("scheduled-task-timezone").fill("America/New_York");
    await page.getByTestId("scheduled-task-run-at").fill("2027-03-14T03:30");
    await page.getByTestId("scheduled-task-submit").click();

    await expect(page.getByTestId("scheduled-task-feedback")).toContainText(
      "created",
    );
    expect(payload).toMatchObject({
      schedule_type: "once",
      schedule_spec: { run_at: "2027-03-14T07:30:00+00:00" },
      timezone: "America/New_York",
    });
  });

  test("edit, pause, resume, trigger, run detail, and confirmed delete complete the lifecycle", async ({
    page,
  }) => {
    mockWP07Gateway(page, {
      scheduledTasks: [task("lifecycle", { title: "Lifecycle task" })],
    });
    await page.goto("/workspace/scheduled-tasks");
    const detail = page.getByTestId("scheduled-task-detail");

    await detail.getByRole("button", { name: "Edit" }).click();
    await expect(
      page
        .getByTestId("scheduled-task-edit-form")
        .getByRole("button", { name: "One-time" }),
    ).toBeDisabled();
    await page.getByTestId("scheduled-task-title").nth(1).fill("Edited task");
    await page
      .getByTestId("scheduled-task-prompt")
      .nth(1)
      .fill("Edited prompt");
    await page.getByTestId("scheduled-task-submit").nth(1).click();
    await expect(detail.getByText("Edited task")).toBeVisible();

    await detail.getByRole("button", { name: "Pause" }).click();
    await expect(detail.getByRole("button", { name: "Resume" })).toBeVisible();
    await detail.getByRole("button", { name: "Resume" }).click();
    await expect(detail.getByRole("button", { name: "Pause" })).toBeVisible();

    await page.getByTestId("scheduled-task-trigger").click();
    const run = page.getByTestId("scheduled-task-run-task-run-lifecycle");
    await expect(run).toContainText("manual");
    await expect(run).toContainText("Success");
    await expect(run).toContainText("Scheduled for");
    await expect(run).toContainText("Thread ID");
    await expect(run).toContainText("Run ID");

    await page.getByTestId("scheduled-task-delete").click();
    await expect(
      page.getByTestId("scheduled-task-delete-dialog"),
    ).toBeVisible();
    await page.getByTestId("scheduled-task-delete-confirm").click();
    await expect(page.getByTestId("scheduled-task-item-lifecycle")).toHaveCount(
      0,
    );
  });

  test("all six statuses and both schedule types filter with deterministic selection", async ({
    page,
  }) => {
    const statuses: TaskStatus[] = [
      "enabled",
      "paused",
      "running",
      "completed",
      "failed",
      "cancelled",
    ];
    mockWP07Gateway(page, {
      scheduledTasks: statuses.map((status, index) =>
        task(status, {
          status,
          title: `${status} task`,
          scheduleType: index % 2 ? "once" : "cron",
        }),
      ),
    });
    await page.goto("/workspace/scheduled-tasks");
    await page.getByTestId("scheduled-task-item-paused").click();
    await page
      .getByTestId("scheduled-task-status-filter")
      .selectOption("enabled");
    await expect(page.getByTestId("scheduled-task-item-enabled")).toBeVisible();
    await expect(page.getByTestId("scheduled-task-detail")).toContainText(
      "enabled task",
    );
    await page.getByTestId("scheduled-task-status-filter").selectOption("all");
    await page.getByTestId("scheduled-task-type-filter").selectOption("once");
    await expect(
      page.getByTestId("scheduled-task-list").locator("button"),
    ).toHaveCount(3);
  });

  test("runs use limit/offset pagination and never stop silently at fifty", async ({
    page,
  }) => {
    mockWP07Gateway(page, { scheduledTasks: [task("paged")] });
    const offsets: number[] = [];
    const runs = Array.from({ length: 55 }, (_, index) => ({
      id: `run-${index}`,
      task_id: "paged",
      thread_id: `thread-${index}`,
      run_id: `gateway-run-${index}`,
      scheduled_for: "2026-07-01T00:00:00+00:00",
      trigger: index % 2 ? "scheduled" : "manual",
      status: index === 0 ? "interrupted" : "success",
      error: index === 0 ? "Interrupted by operator" : null,
      started_at: "2026-07-01T00:00:00+00:00",
      finished_at: "2026-07-01T00:01:00+00:00",
      created_at: "2026-07-01T00:00:00+00:00",
    }));
    await page.route("**/api/scheduled-tasks/paged/runs?*", (route) => {
      const url = new URL(route.request().url());
      const limit = Number(url.searchParams.get("limit"));
      const offset = Number(url.searchParams.get("offset"));
      offsets.push(offset);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(runs.slice(offset, offset + limit)),
      });
    });

    await page.goto("/workspace/scheduled-tasks");
    await expect(
      page.locator('[data-testid^="scheduled-task-run-run-"]'),
    ).toHaveCount(50);
    await page.getByTestId("scheduled-task-load-more-runs").click();
    await expect(
      page.locator('[data-testid^="scheduled-task-run-run-"]'),
    ).toHaveCount(55);
    expect(offsets).toEqual([0, 50]);
    await expect(page.getByTestId("scheduled-task-run-run-0")).toContainText(
      "Interrupted by operator",
    );
  });

  test("running tasks disable conflicting operations", async ({ page }) => {
    mockWP07Gateway(page, {
      scheduledTasks: [task("active", { status: "running" })],
    });
    await page.goto("/workspace/scheduled-tasks");
    const detail = page.getByTestId("scheduled-task-detail");
    for (const name of ["Edit", "Pause", "Trigger now", "Delete"]) {
      await expect(detail.getByRole("button", { name })).toBeDisabled();
    }
    await expect(detail).toContainText("active run finishes");
  });

  test("Gateway validation detail is shown instead of a fake success", async ({
    page,
  }) => {
    mockWP07Gateway(page, { scheduledTasks: [] });
    await page.route("**/api/scheduled-tasks", (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 422,
          contentType: "application/json",
          body: JSON.stringify({
            detail: "Cron expression must have exactly 5 fields",
          }),
        });
      }
      return route.fallback();
    });
    await page.goto("/workspace/scheduled-tasks");
    await fillRequiredCreate(page, "Invalid cron");
    await page.getByTestId("scheduled-task-cron-preset").selectOption("custom");
    await page.getByTestId("scheduled-task-custom-cron").fill("bad cron");
    await page.getByTestId("scheduled-task-submit").click();
    await expect(page.getByTestId("scheduled-task-error")).toContainText(
      "Cron expression must have exactly 5 fields",
    );
    await expect(page.getByTestId("scheduled-task-feedback")).toHaveCount(0);
  });

  test("Gateway action failures preserve detail and follow the shared 401 login contract", async ({
    page,
  }) => {
    mockWP07Gateway(page, { scheduledTasks: [task("failure")] });
    const failures = [
      {
        status: 403,
        detail: "Scheduled task permission denied",
        expected: "Scheduled task permission denied",
      },
      {
        status: 404,
        detail: "Scheduled task not found",
        expected: "Scheduled task not found",
      },
      {
        status: 409,
        detail: "Scheduled task has an active run",
        expected: "Scheduled task has an active run",
      },
      {
        status: 502,
        detail: "Scheduler launch failed upstream",
        expected: "Scheduler launch failed upstream",
      },
      {
        status: 401,
        detail: "Authentication required",
        expected: "Unauthorized",
      },
    ];
    let attempt = 0;
    await page.route("**/api/scheduled-tasks/failure/trigger", (route) => {
      const failure = failures[attempt++];
      if (!failure) {
        throw new Error("unexpected extra trigger request");
      }
      return route.fulfill({
        status: failure.status,
        contentType: "application/json",
        body: JSON.stringify({ detail: failure.detail }),
      });
    });
    await page.goto("/workspace/scheduled-tasks");
    for (const failure of failures.slice(0, -1)) {
      await page.getByTestId("scheduled-task-trigger").click();
      await expect(page.getByTestId("scheduled-task-error")).toContainText(
        failure.expected,
      );
    }
    await page.getByTestId("scheduled-task-trigger").click();
    await expect
      .poll(() => {
        const url = new URL(page.url());
        return {
          pathname: url.pathname,
          query: [...url.searchParams.entries()],
        };
      })
      .toEqual({
        pathname: "/login",
        query: [["next", "/workspace/scheduled-tasks"]],
      });
    expect(attempt).toBe(failures.length);
  });
});
