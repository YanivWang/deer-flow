/*
  【文件职责】     以真实 FastAPI Gateway/SQLite/HTTP/Nuxt/Chromium 验证 WP-07 调度合同。
  【对应 frontend/】 无；React scheduled-task E2E 仅 mock API
  【架构位置】     WP-07 real-backend acceptance
  【主要导出】     Playwright HTTP 与 browser scenarios
  【依赖关系】     run_replay_gateway.py · scheduled-task Gateway routers/repos/service · Vue page
  【边界与注意】   Gateway/Auth/DB/run lifecycle 真实；agent model 是签入 replay fixture，非真实外部模型。
*/
import { readFileSync } from "node:fs";

import { expect, test, type APIRequestContext } from "@playwright/test";

const APP = `http://localhost:${process.env.E2E_WP07_FRONTEND_PORT ?? "3110"}`;
const replayFixture = JSON.parse(
  readFileSync(
    new URL(
      "../../../backend/tests/fixtures/replay/write_read_file.ultra.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as { prompt: string };

async function register(request: APIRequestContext, label: string) {
  const response = await request.post(`${APP}/api/v1/auth/register`, {
    data: {
      email: `e2e-wp07-${label}-${Date.now()}@example.com`,
      password: "very-strong-password-123",
    },
  });
  expect(response.status(), await response.text()).toBe(201);
}

async function csrfHeaders(request: APIRequestContext) {
  const storage = await request.storageState();
  const csrf = storage.cookies.find(({ name }) => name === "csrf_token")?.value;
  expect(csrf).toBeTruthy();
  return { "X-CSRF-Token": csrf ?? "" };
}

test("real Gateway owns create/read/update/context/pause/resume/validation/delete", async ({
  context,
}) => {
  await register(context.request, "http");
  const headers = await csrfHeaders(context.request);
  const threadId = crypto.randomUUID();
  const thread = await context.request.post(`${APP}/api/threads`, {
    headers,
    data: { thread_id: threadId, metadata: {} },
  });
  expect(thread.status(), await thread.text()).toBe(200);

  const createdResponse = await context.request.post(
    `${APP}/api/scheduled-tasks`,
    {
      headers,
      data: {
        context_mode: "fresh_thread_per_run",
        title: "Real HTTP task",
        prompt: "Summarize through the real Gateway",
        schedule_type: "cron",
        schedule_spec: { cron: "0 9 * * *" },
        timezone: "UTC",
      },
    },
  );
  expect(createdResponse.status(), await createdResponse.text()).toBe(200);
  const created = (await createdResponse.json()) as {
    id: string;
    thread_id: string | null;
    status: string;
    schedule_type: string;
  };
  expect(created).toMatchObject({
    thread_id: null,
    status: "enabled",
    schedule_type: "cron",
  });

  const [listed, detail, runs] = await Promise.all([
    context.request.get(`${APP}/api/scheduled-tasks`),
    context.request.get(`${APP}/api/scheduled-tasks/${created.id}`),
    context.request.get(
      `${APP}/api/scheduled-tasks/${created.id}/runs?limit=1&offset=0`,
    ),
  ]);
  expect(listed.status(), await listed.text()).toBe(200);
  expect(detail.status(), await detail.text()).toBe(200);
  expect(runs.status(), await runs.text()).toBe(200);
  expect(await runs.json()).toEqual([]);

  const reuse = await context.request.patch(
    `${APP}/api/scheduled-tasks/${created.id}`,
    {
      headers,
      data: { context_mode: "reuse_thread", thread_id: threadId },
    },
  );
  expect(reuse.status(), await reuse.text()).toBe(200);
  expect(await reuse.json()).toMatchObject({
    context_mode: "reuse_thread",
    thread_id: threadId,
  });
  const fresh = await context.request.patch(
    `${APP}/api/scheduled-tasks/${created.id}`,
    {
      headers,
      data: { context_mode: "fresh_thread_per_run" },
    },
  );
  expect(fresh.status(), await fresh.text()).toBe(200);
  expect(await fresh.json()).toMatchObject({
    context_mode: "fresh_thread_per_run",
    thread_id: null,
  });

  const paused = await context.request.post(
    `${APP}/api/scheduled-tasks/${created.id}/pause`,
    { headers },
  );
  expect(paused.status(), await paused.text()).toBe(200);
  expect(await paused.json()).toMatchObject({ status: "paused" });
  const resumed = await context.request.post(
    `${APP}/api/scheduled-tasks/${created.id}/resume`,
    { headers },
  );
  expect(resumed.status(), await resumed.text()).toBe(200);
  expect(await resumed.json()).toMatchObject({ status: "enabled" });

  const invalidCron = await context.request.post(`${APP}/api/scheduled-tasks`, {
    headers,
    data: {
      context_mode: "fresh_thread_per_run",
      title: "Bad cron",
      prompt: "Bad cron",
      schedule_type: "cron",
      schedule_spec: { cron: "bad cron" },
      timezone: "UTC",
    },
  });
  expect(invalidCron.status()).toBe(422);
  expect(await invalidCron.json()).toMatchObject({
    detail: expect.stringMatching(/5 fields/i),
  });
  const invalidTimezone = await context.request.post(
    `${APP}/api/scheduled-tasks`,
    {
      headers,
      data: {
        context_mode: "fresh_thread_per_run",
        title: "Bad timezone",
        prompt: "Bad timezone",
        schedule_type: "cron",
        schedule_spec: { cron: "0 9 * * *" },
        timezone: "Mars/Base",
      },
    },
  );
  expect(invalidTimezone.status()).toBe(422);
  expect(await invalidTimezone.json()).toMatchObject({
    detail: expect.stringMatching(/timezone/i),
  });
  const missingReuse = await context.request.post(
    `${APP}/api/scheduled-tasks`,
    {
      headers,
      data: {
        context_mode: "reuse_thread",
        title: "Missing reuse",
        prompt: "Missing reuse",
        schedule_type: "cron",
        schedule_spec: { cron: "0 9 * * *" },
        timezone: "UTC",
      },
    },
  );
  expect(missingReuse.status()).toBe(422);
  expect(await missingReuse.json()).toMatchObject({
    detail: "reuse_thread requires thread_id",
  });
  const inaccessibleReuse = await context.request.post(
    `${APP}/api/scheduled-tasks`,
    {
      headers,
      data: {
        context_mode: "reuse_thread",
        thread_id: crypto.randomUUID(),
        title: "Unknown reuse",
        prompt: "Unknown reuse",
        schedule_type: "cron",
        schedule_spec: { cron: "0 9 * * *" },
        timezone: "UTC",
      },
    },
  );
  expect(inaccessibleReuse.status()).toBe(404);
  expect(await inaccessibleReuse.json()).toMatchObject({
    detail: "Thread not found",
  });
  const tooSoon = new Date(Date.now() + 20_000).toISOString();
  const invalidOnce = await context.request.post(`${APP}/api/scheduled-tasks`, {
    headers,
    data: {
      context_mode: "fresh_thread_per_run",
      title: "Too soon",
      prompt: "Too soon",
      schedule_type: "once",
      schedule_spec: { run_at: tooSoon },
      timezone: "UTC",
    },
  });
  expect(invalidOnce.status()).toBe(422);
  expect(await invalidOnce.json()).toMatchObject({
    detail: expect.stringMatching(/at least 60 seconds/i),
  });

  const runAt = new Date(Date.now() + 120_000).toISOString();
  const validOnceResponse = await context.request.post(
    `${APP}/api/scheduled-tasks`,
    {
      headers,
      data: {
        context_mode: "fresh_thread_per_run",
        title: "Real once task",
        prompt: "Run once through the real Gateway",
        schedule_type: "once",
        schedule_spec: { run_at: runAt },
        timezone: "Asia/Shanghai",
      },
    },
  );
  expect(validOnceResponse.status(), await validOnceResponse.text()).toBe(200);
  const validOnce = (await validOnceResponse.json()) as {
    id: string;
    schedule_type: string;
    schedule_spec: { run_at: string };
    timezone: string;
  };
  expect(validOnce).toMatchObject({
    schedule_type: "once",
    timezone: "Asia/Shanghai",
  });
  expect(Date.parse(validOnce.schedule_spec.run_at)).toBe(Date.parse(runAt));
  const onceDeleted = await context.request.delete(
    `${APP}/api/scheduled-tasks/${validOnce.id}`,
    { headers },
  );
  expect(onceDeleted.status(), await onceDeleted.text()).toBe(200);

  const deleted = await context.request.delete(
    `${APP}/api/scheduled-tasks/${created.id}`,
    { headers },
  );
  expect(deleted.status(), await deleted.text()).toBe(200);
  expect(await deleted.json()).toEqual({ id: created.id, deleted: true });
});

test("Nuxt UI shows real Gateway validation and a real manual-run lifecycle", async ({
  context,
  page,
}) => {
  await register(context.request, "browser");
  await page.goto("/workspace/scheduled-tasks");

  await page.getByTestId("scheduled-task-title").fill("Real browser task");
  await page.getByTestId("scheduled-task-prompt").fill(replayFixture.prompt);
  await page.getByTestId("scheduled-task-cron-preset").selectOption("custom");
  await page.getByTestId("scheduled-task-custom-cron").fill("bad cron");
  const invalidResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/scheduled-tasks",
  );
  await page.getByTestId("scheduled-task-submit").click();
  expect((await invalidResponse).status()).toBe(422);
  await expect(page.getByTestId("scheduled-task-error")).toContainText(
    "5 fields",
  );

  await page.getByTestId("scheduled-task-custom-cron").fill("0 9 * * *");
  await page.getByTestId("scheduled-task-timezone").fill("Mars/Base");
  const timezoneResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/scheduled-tasks",
  );
  await page.getByTestId("scheduled-task-submit").click();
  expect((await timezoneResponse).status()).toBe(422);
  await expect(page.getByTestId("scheduled-task-error")).toContainText(
    "timezone",
  );

  await page.getByTestId("scheduled-task-timezone").fill("UTC");
  const createResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/scheduled-tasks",
  );
  await page.getByTestId("scheduled-task-submit").click();
  const createdResponse = await createResponse;
  expect(createdResponse.status(), await createdResponse.text()).toBe(200);
  const created = (await createdResponse.json()) as { id: string };
  await expect(
    page.getByTestId(`scheduled-task-item-${created.id}`),
  ).toBeVisible();

  const detail = page.getByTestId("scheduled-task-detail");
  await detail.getByRole("button", { name: "Edit" }).click();
  await page
    .getByTestId("scheduled-task-edit-form")
    .getByTestId("scheduled-task-title")
    .fill("Real browser task edited");
  await page
    .getByTestId("scheduled-task-edit-form")
    .getByTestId("scheduled-task-submit")
    .click();
  await expect(detail).toContainText("Real browser task edited");

  await detail.getByRole("button", { name: "Pause" }).click();
  await expect(detail.getByRole("button", { name: "Resume" })).toBeVisible();
  await detail.getByRole("button", { name: "Resume" }).click();
  await expect(detail.getByRole("button", { name: "Pause" })).toBeVisible();

  const triggerResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes(`/api/scheduled-tasks/${created.id}/trigger`),
  );
  await page.getByTestId("scheduled-task-trigger").click();
  expect((await triggerResponse).status()).toBe(200);
  await expect(page.getByTestId("scheduled-task-feedback")).toContainText(
    "triggered",
  );
  const run = page
    .locator('[data-testid^="scheduled-task-run-task-run-"]')
    .first();
  await expect(run).toContainText("manual", { timeout: 30_000 });
  await expect(run).toContainText("Run ID");
  await expect(run).toContainText("Failed", { timeout: 60_000 });
  await expect(run).toContainText("Artifact delivery incomplete");

  const realRuns = await context.request.get(
    `${APP}/api/scheduled-tasks/${created.id}/runs?limit=1&offset=0`,
  );
  expect(realRuns.status(), await realRuns.text()).toBe(200);
  const runPage = (await realRuns.json()) as Array<{
    trigger: string;
    status: string;
    thread_id: string;
    run_id: string | null;
    scheduled_for: string;
    started_at: string | null;
    finished_at: string | null;
    created_at: string;
    error: string | null;
  }>;
  expect(runPage).toHaveLength(1);
  expect(runPage[0]).toMatchObject({
    trigger: "manual",
    status: "failed",
    error: expect.stringMatching(/Artifact delivery incomplete/),
  });
  expect(runPage[0]?.thread_id).toBeTruthy();
  expect(runPage[0]?.run_id).toBeTruthy();
  expect(runPage[0]?.scheduled_for).toBeTruthy();
  expect(runPage[0]?.started_at).toBeTruthy();
  expect(runPage[0]?.finished_at).toBeTruthy();
  expect(runPage[0]?.created_at).toBeTruthy();

  await page.getByTestId("scheduled-task-delete").click();
  const deleteResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" &&
      response.url().includes(`/api/scheduled-tasks/${created.id}`),
  );
  await page.getByTestId("scheduled-task-delete-confirm").click();
  expect((await deleteResponse).status()).toBe(200);
  await expect(
    page.getByTestId(`scheduled-task-item-${created.id}`),
  ).toHaveCount(0);
});
