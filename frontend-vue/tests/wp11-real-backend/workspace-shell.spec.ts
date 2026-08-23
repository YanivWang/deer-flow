/*
  【文件职责】     以真实 Auth/owner check/thread state/event store/Gateway/Nuxt/Chromium 验证 WP-11。
  【对应 frontend/】 React shell e2e 无同等 Vue Query 与真实 workspace-changes 链
  【架构位置】     WP-11 real-backend acceptance
  【主要导出】     Playwright HTTP 与 browser scenarios
  【依赖关系】     run_replay_gateway.py · seed_runs_router.py · Vue workspace shell
  【边界与注意】   workspace event 是隔离 fixture；唯一网络故障注入只用于 unavailable→真实 session 恢复。
*/

import { readFile } from "node:fs/promises";

import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
} from "@playwright/test";

const APP = `http://localhost:${process.env.E2E_WP11_FRONTEND_PORT ?? "3114"}`;
const THREAD_ID = "00000000-0000-0000-0000-000000001114";
const RUN_ID = "run-wp11-real-workspace-changes";
const PASSWORD = "very-strong-password-123";
const ADMIN_EMAIL = "e2e-wp11-admin@example.com";
const TITLE = "WP-11 real shell";
const QUESTION = "Verify the real workspace shell boundary";
const ANSWER = "The production Gateway contract is connected.";

async function csrfHeaders(request: APIRequestContext) {
  const storage = await request.storageState();
  const csrf = storage.cookies.find(({ name }) => name === "csrf_token")?.value;
  expect(csrf).toBeTruthy();
  return { "X-CSRF-Token": csrf ?? "" };
}

function workspaceChangesFixture() {
  const base = {
    root: "workspace",
    binary: false,
    sensitive: false,
    size_before: 10,
    size_after: 20,
    sha256_before: "before",
    sha256_after: "after",
    diff: "",
    diff_truncated: false,
    additions: 1,
    deletions: 1,
    symlink: false,
    symlink_target_before: null,
    symlink_target_after: null,
  };
  return {
    version: 1,
    summary: {
      created: 1,
      modified: 3,
      deleted: 1,
      symlink_created: 1,
      additions: 4,
      deletions: 2,
      truncated: true,
    },
    files: [
      {
        ...base,
        path: "/mnt/user-data/outputs/report.md",
        root: "outputs",
        status: "created",
        size_before: null,
        diff: "--- /dev/null\n+++ report.md\n+real gateway",
        diff_unavailable_reason: null,
      },
      {
        ...base,
        path: "/mnt/user-data/workspace/data.bin",
        status: "modified",
        binary: true,
        diff_unavailable_reason: "binary",
      },
      {
        ...base,
        path: "/mnt/user-data/workspace/large.txt",
        status: "modified",
        diff_unavailable_reason: "large",
      },
      {
        ...base,
        path: "/mnt/user-data/workspace/.env",
        status: "modified",
        sensitive: true,
        diff_unavailable_reason: "sensitive",
      },
      {
        ...base,
        path: "/mnt/user-data/workspace/old.txt",
        status: "deleted",
        size_after: null,
        diff_unavailable_reason: "truncated",
      },
      {
        ...base,
        path: "/mnt/user-data/workspace/latest",
        status: "symlink_created",
        size_before: null,
        symlink: true,
        symlink_target_after: "report.md",
        diff_unavailable_reason: "symlink",
      },
    ],
    limits: {
      max_files: 200,
      max_file_bytes_for_diff: 262_144,
      max_total_diff_bytes: 1_048_576,
    },
  };
}

test("real Gateway owns auth, thread state, workspace changes, recovery and browser actions", async ({
  context,
  page,
}) => {
  const unauthenticated = await context.request.get(
    `${APP}/api/threads/${THREAD_ID}/runs/${RUN_ID}/workspace-changes`,
  );
  expect(unauthenticated.status(), await unauthenticated.text()).toBe(401);

  const initialized = await context.request.post(
    `${APP}/api/v1/auth/initialize`,
    { data: { email: ADMIN_EMAIL, password: PASSWORD } },
  );
  expect(initialized.status(), await initialized.text()).toBe(201);
  const headers = await csrfHeaders(context.request);

  const created = await context.request.post(`${APP}/api/threads`, {
    headers,
    data: {
      thread_id: THREAD_ID,
      assistant_id: "lead_agent",
      metadata: {},
    },
  });
  expect(created.status(), await created.text()).toBe(200);

  const state = await context.request.post(
    `${APP}/api/threads/${THREAD_ID}/state`,
    {
      headers,
      data: {
        values: {
          title: TITLE,
          messages: [
            {
              type: "human",
              id: "wp11-real-human",
              content: QUESTION,
              additional_kwargs: { run_id: RUN_ID },
            },
            {
              type: "ai",
              id: "wp11-real-ai",
              content: ANSWER,
            },
          ],
        },
      },
    },
  );
  expect(state.status(), await state.text()).toBe(200);

  const seed = await context.request.post(`${APP}/api/test-only/seed-runs`, {
    headers,
    data: {
      thread_id: THREAD_ID,
      runs: [
        {
          run_id: RUN_ID,
          created_at: "2026-08-23T02:00:00+00:00",
          messages: [
            { role: "human", id: "wp11-real-human", content: QUESTION },
            { role: "ai", id: "wp11-real-ai", content: ANSWER },
          ],
          workspace_changes: workspaceChangesFixture(),
        },
      ],
    },
  });
  expect(seed.status(), await seed.text()).toBe(200);

  const summaryResponse = await context.request.get(
    `${APP}/api/threads/${THREAD_ID}/runs/${RUN_ID}/workspace-changes?include_files=false&include_diff=false`,
  );
  expect(summaryResponse.status(), await summaryResponse.text()).toBe(200);
  const summary = await summaryResponse.json();
  expect(summary).toMatchObject({
    available: true,
    summary: { truncated: true, symlink_created: 1 },
    files: [],
  });

  const metadataResponse = await context.request.get(
    `${APP}/api/threads/${THREAD_ID}/runs/${RUN_ID}/workspace-changes?include_files=true&include_diff=false`,
  );
  expect(metadataResponse.status(), await metadataResponse.text()).toBe(200);
  const metadata = await metadataResponse.json();
  expect(metadata.files).toHaveLength(6);
  expect(
    metadata.files.every((file: { diff: string }) => file.diff === ""),
  ).toBe(true);
  expect(metadata.files.map((file: { status: string }) => file.status)).toEqual(
    expect.arrayContaining([
      "created",
      "modified",
      "deleted",
      "symlink_created",
    ]),
  );

  const outsider = await playwrightRequest.newContext({ baseURL: APP });
  try {
    const registered = await outsider.post("/api/v1/auth/register", {
      data: {
        email: `e2e-wp11-outsider-${Date.now()}@example.com`,
        password: PASSWORD,
      },
    });
    expect(registered.status(), await registered.text()).toBe(201);
    const denied = await outsider.get(
      `/api/threads/${THREAD_ID}/runs/${RUN_ID}/workspace-changes`,
    );
    expect(denied.status(), await denied.text()).toBe(404);
  } finally {
    await outsider.dispose();
  }

  let injectAuthFailure = true;
  await page.route("**/api/v1/auth/me", (route) =>
    injectAuthFailure
      ? route.fulfill({ status: 503, json: { detail: "Injected outage" } })
      : route.continue(),
  );
  await page.goto(`/workspace/chats/${THREAD_ID}`);
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: /Gateway is temporarily unavailable/i }),
  ).toBeVisible();
  injectAuthFailure = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: /Gateway connection restored/i }),
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${THREAD_ID}$`));

  await expect(page.getByText(ANSWER, { exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText("Some changes were truncated.")).toBeVisible();
  await page.getByTestId("workspace-changes-open").click();
  for (const text of [
    "Created",
    "Modified",
    "Deleted",
    "Symlink created",
    "Binary file. Diff unavailable.",
    "Large file. Diff omitted.",
    "Sensitive path. Content hidden.",
    "Diff omitted because the change set is too large.",
    "Symlink change. Diff unavailable.",
  ]) {
    await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
  }
  await page.getByRole("button", { name: "Close" }).click();

  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: APP,
  });
  const row = page
    .locator('[data-sidebar="menu-item"]')
    .filter({ hasText: TITLE });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "More" }).click();
  await page.getByTestId("thread-share").click();
  await expect(
    page.getByRole("status").filter({ hasText: "Link copied" }),
  ).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    `https://deer-flow-v2.vercel.app/workspace/chats/${THREAD_ID}`,
  );

  await row.getByRole("button", { name: "More" }).click();
  const stateRequest = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname ===
        `/api/langgraph/threads/${THREAD_ID}/state`,
  );
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("thread-export-markdown").click();
  expect((await stateRequest).status()).toBe(200);
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`${TITLE}.md`);
  const exported = await readFile(await download.path(), "utf8");
  expect(exported).toContain(QUESTION);
  expect(exported).toContain(ANSWER);
});
