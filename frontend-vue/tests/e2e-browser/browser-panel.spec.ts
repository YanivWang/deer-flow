/*
  【文件职责】     用真实 FastAPI Gateway、真实 browser runtime 验证 Vue browser REST/WS 主路径。
  【架构位置】     测试
  【主要导出】     M6 real-Gateway browser panel scenario
  【依赖关系】     run_m0_gateway.py --browser · local Playwright Chromium · Vue production build
  【边界与注意】   Gateway/runtime 为真实本地进程；模型侧是 replay harness，不能称生产环境或真实模型证明。
*/

import { expect, test } from "@playwright/test";

test("real Gateway converges REST navigation and binary live state in the Vue panel", async ({
  context,
  page,
}) => {
  const email = `e2e-m6-browser-${Date.now()}@example.com`;
  const registration = await context.request.post("/api/v1/auth/register", {
    data: { email, password: "very-strong-password-123" },
  });
  expect(registration.status(), await registration.text()).toBe(201);
  const csrf = (await context.cookies()).find(
    ({ name }) => name === "csrf_token",
  )?.value;
  expect(csrf).toBeTruthy();

  const threadId = crypto.randomUUID();
  const created = await context.request.post("/api/threads", {
    headers: { "X-CSRF-Token": csrf ?? "" },
    data: { thread_id: threadId, metadata: {} },
  });
  expect(created.status(), await created.text()).toBe(200);

  const navigate = await context.request.post(
    `/api/threads/${threadId}/browser/navigate`,
    {
      headers: { "X-CSRF-Token": csrf ?? "" },
      data: { url: "http://localhost:3101/" },
      timeout: 60_000,
    },
  );
  expect(navigate.status(), await navigate.text()).toBe(200);
  const initial = (await navigate.json()) as {
    screenshot: string | null;
    url: string;
    title: string;
  };
  expect(initial.screenshot).toBeTruthy();
  expect(initial.url).toBe("http://localhost:3101/");

  await page.goto(`/workspace/chats/${threadId}`);
  await page.getByRole("button", { name: "Open browser panel" }).click();

  const panel = page.getByTestId("browser-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId("browser-mode")).toHaveText("Live", {
    timeout: 30_000,
  });
  await expect(panel.getByLabel("Browser URL")).toHaveValue(initial.url);
  if (initial.title) {
    await expect(panel.getByTestId("browser-title")).toHaveText(initial.title);
  }
  await expect(panel.getByRole("img")).toHaveAttribute("src", /^blob:/, {
    timeout: 30_000,
  });

  await panel.getByLabel("Switch to static browser").click();
  await expect(panel.getByTestId("browser-mode")).toHaveText("Static");
  const restResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/threads/${threadId}/browser/navigate`) &&
      response.request().method() === "POST",
  );
  await panel.getByLabel("Browser URL").fill("http://localhost:3101/");
  await panel.getByLabel("Browser URL").press("Enter");
  const authoritative = await restResponse;
  expect(authoritative.status(), await authoritative.text()).toBe(200);
  expect(authoritative.request().postDataJSON()).toEqual({
    url: "http://localhost:3101/",
  });
  await expect(panel.getByLabel("Browser URL")).toHaveValue(
    "http://localhost:3101/",
  );
  await expect(panel.getByRole("alert")).toHaveCount(0);
});
