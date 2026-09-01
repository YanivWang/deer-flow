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
  await expect(
    panel.getByPlaceholder("Enter a URL and press Enter"),
  ).toHaveValue(initial.url);
  /*
    页面标题唯一的出口是 `<img alt>`，而且上游取的是**静态帧**的标题
    （`alt={frame?.title ?? "Browser view"}`，frame 来自 BrowserViewProvider）。
    上面那次 REST 导航是用 `context.request` 在页面之外发的，没有任何一条
    tool 消息把 browser_view 帧带进线程，所以这一屏两个应用都没有静态帧——
    alt 落到上游那句兜底。**头部那一格画的是写死的面板标签，不是页面标题。**
    真实标题在下面客户端自己发起 REST 导航之后才有出口。
  */
  await expect(panel.getByRole("img")).toHaveAttribute("alt", "Browser view");
  await expect(panel.getByRole("img")).toHaveAttribute("src", /^blob:/, {
    timeout: 30_000,
  });

  await panel.getByTitle("Stop live control").click();
  // 上游两态：文案恒为 Live，静态态靠 variant / title 区分。
  await expect(panel.getByTestId("browser-mode")).toHaveAttribute(
    "data-variant",
    "ghost",
  );
  await expect(panel.getByTitle("Take live control")).toBeVisible();
  const restResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/threads/${threadId}/browser/navigate`) &&
      response.request().method() === "POST",
  );
  await panel
    .getByPlaceholder("Enter a URL and press Enter")
    .fill("http://localhost:3101/");
  await panel.getByPlaceholder("Enter a URL and press Enter").press("Enter");
  const authoritative = await restResponse;
  expect(authoritative.status(), await authoritative.text()).toBe(200);
  expect(authoritative.request().postDataJSON()).toEqual({
    url: "http://localhost:3101/",
  });
  await expect(
    panel.getByPlaceholder("Enter a URL and press Enter"),
  ).toHaveValue("http://localhost:3101/");
  // 客户端这次 REST 导航把帧写进本地静态帧，alt 于是变成真实页面标题。
  const restFrame = (await authoritative.json()) as { title: string };
  if (restFrame.title) {
    await expect(panel.getByRole("img")).toHaveAttribute(
      "alt",
      restFrame.title,
    );
  }
  await expect(panel.getByRole("alert")).toHaveCount(0);
});
