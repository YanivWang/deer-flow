/*
  【文件职责】     以真实 Auth/FastAPI/SQLite/HTTP/Nuxt/Chromium 验证channel lifecycle。
  【架构位置】     real-backend acceptance
  【主要导出】     Playwright HTTP 与 browser scenarios
  【依赖关系】     run_replay_gateway.py · channel_e2e_fixture.py · ChannelConnections.vue
  【边界与注意】   外部 worker/callback 受控；鉴权、CSRF、router、repository、HTTP、UI 均为真实实现。
*/

import { expect, test, type APIRequestContext } from "@playwright/test";

const APP = process.env.E2E_APP_URL ?? "http://localhost:3111";
const PASSWORD = "very-strong-password-123";

async function initializeAdmin(request: APIRequestContext) {
  const response = await request.post(`${APP}/api/v1/auth/initialize`, {
    data: {
      email: `e2e-wp08-admin-${Date.now()}@example.com`,
      password: PASSWORD,
    },
  });
  expect(response.status(), await response.text()).toBe(201);
}

async function registerUser(request: APIRequestContext) {
  const response = await request.post(`${APP}/api/v1/auth/register`, {
    data: {
      email: `e2e-wp08-user-${Date.now()}@example.com`,
      password: PASSWORD,
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

async function openChannelSettings(page: import("@playwright/test").Page) {
  await page.goto("/workspace/chats/new");
  const sidebar = page.locator("[data-sidebar='sidebar']");
  await expect(sidebar.getByText("Slack")).toBeVisible({ timeout: 15_000 });
  await sidebar.getByRole("button", { name: /Settings and more/ }).click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Channels" }).click();
  return page.getByRole("dialog", { name: "Settings" });
}

test("real Gateway rejects an unauthenticated channel read", async ({
  request,
}) => {
  const response = await request.get(`${APP}/api/channels/providers`);
  expect(response.status()).toBe(401);
  expect(await response.json()).toEqual({
    detail: {
      code: "not_authenticated",
      message: "Authentication required",
    },
  });
});

test("admin completes real scoped multi-account lifecycle through the Vue UI", async ({
  context,
  page,
}) => {
  await initializeAdmin(context.request);
  const headers = await csrfHeaders(context.request);

  const seededAlice = await context.request.post(
    `${APP}/api/test-only/channels/seed-connection`,
    {
      headers,
      data: {
        provider: "slack",
        external_account_id: "U-ALICE",
        external_account_name: "Alice",
        workspace_id: "T-DEERFLOW",
        workspace_name: "DeerFlow E2E",
      },
    },
  );
  expect(seededAlice.status(), await seededAlice.text()).toBe(200);
  const alice = (await seededAlice.json()) as { id: string };

  const seededOtherUser = await context.request.post(
    `${APP}/api/test-only/channels/seed-connection`,
    {
      headers,
      data: {
        provider: "slack",
        external_account_id: "U-OTHER",
        external_account_name: "Other user",
        owner_user_id: "other-user-fixture",
      },
    },
  );
  expect(seededOtherUser.status(), await seededOtherUser.text()).toBe(200);

  const scopedList = await context.request.get(
    `${APP}/api/channels/connections`,
  );
  expect(scopedList.status(), await scopedList.text()).toBe(200);
  expect(
    (
      (await scopedList.json()) as {
        connections: Array<{ external_account_name: string }>;
      }
    ).connections.map(({ external_account_name }) => external_account_name),
  ).toEqual(["Alice"]);

  const settings = await openChannelSettings(page);
  const slackPanel = settings.getByTestId("channel-provider-slack");
  await expect(
    slackPanel.getByTestId(`channel-connection-${alice.id}`),
  ).toContainText("Alice · DeerFlow E2E");

  const runtimeConfigResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/channels/slack/runtime-config",
  );
  await slackPanel.getByRole("button", { name: "Modify" }).click();
  const setupDialog = page.getByRole("dialog", { name: "Modify Slack" });
  await setupDialog.getByLabel("Bot token").fill("xoxb-updated-e2e");
  await setupDialog.getByLabel("App token").fill("xapp-updated-e2e");
  await setupDialog.getByRole("button", { name: "Save changes" }).click();
  expect((await runtimeConfigResponse).status()).toBe(200);
  await expect(setupDialog).toBeHidden();

  const connectResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/channels/slack/connect",
  );
  await slackPanel.getByRole("button", { name: "Add account" }).click();
  const connectResponse = await connectResponsePromise;
  expect(connectResponse.status(), await connectResponse.text()).toBe(200);
  const connect = (await connectResponse.json()) as {
    code: string;
    expires_in: number;
    instruction: string;
    url: string | null;
  };
  expect(connect).toMatchObject({ expires_in: 600, url: null });
  expect(connect.instruction).toContain(`/connect ${connect.code}`);
  /*
    这一条**不能**从 `settings`（`getByRole("dialog", { name: "Settings" })`）往下找。

    点完「Add account」之后「Connect channel」对话框会盖上来，一旦它挂载，设置对话框
    就被正确地标成 `aria-hidden`——于是整棵子树离开可访问性树，任何 `getByRole` 都
    再也匹配不到，报的是「element(s) not found」而不是「不是 disabled」。断言与对话框
    挂载之间是竞态：机器闲时断言先跑（绿），机器忙时对话框先挂载（红）。
    实测过一次：六个 e2e 套件连着跑时红，单独跑三条全绿。

    换成按 DOM 找——`getByTestId` 是属性匹配、`locator("button")` 是选择器、
    `hasText` 是文本内容，三者都不走可访问性树，因此与 `aria-hidden` 无关。
    断言本身不变，仍然是「等待期间这颗按钮是 disabled」。
  */
  /*
    正则**要容忍首尾空白**。这颗按钮是 `<Plug />` 图标 + `{{ connectLabel(view) }}`
    （上游 channels-settings-page.tsx:281 同样带 PlugIcon），Vue 模板在图标与插值
    之间留下一个文本节点，于是 `textContent` 是 **" Add account"**——实测
    `allTextContents()` 返回 `[" Add account","Modify","Remove provider configuration"]`，
    只有带图标的那两颗有前导空格。`hasText` 传 RegExp 时**不做空白归一**，
    `/^Add account$/` 因此一个都匹配不到，报的是「element(s) not found」，
    看起来像「这颗按钮不在」而不是「正则没写对」。

    wave 72 给这颗键补上图标那天起这条就红着，一直没人知道——`e2e-backend`
    自 wave 64 起就不在任何一轮的收工清单里（坑 194：一条长期红着、又不在任何门禁
    清单里的 gate，等于不存在）。wave 79 收工时跑全套才撞出来。
  */
  await expect(
    page
      .getByTestId("channel-provider-slack")
      .locator("button")
      .filter({ hasText: /^\s*Add account\s*$/ }),
  ).toBeDisabled();

  const completed = await context.request.post(
    `${APP}/api/test-only/channels/complete`,
    {
      headers,
      data: {
        provider: "slack",
        code: connect.code,
        external_account_id: "U-BOB",
        external_account_name: "Bob",
        workspace_id: "T-DEERFLOW",
        workspace_name: "DeerFlow E2E",
      },
    },
  );
  expect(completed.status(), await completed.text()).toBe(200);
  const bob = (await completed.json()) as { id: string };

  const connectDialog = page.getByRole("dialog", { name: "Connect channel" });
  await expect(connectDialog.getByTestId("channel-connect-state")).toHaveText(
    "Connected",
    { timeout: 10_000 },
  );
  /*
    对话框里有两颗 Close:footer 那颗与右上角 primitive 的那颗（与 React 每个对话框
    都有的那颗同源）。这里点的一直是 footer 那颗,按 data-slot 锁定。
  */
  await connectDialog
    .locator('[data-slot="button"]')
    .filter({ hasText: /^Close$/ })
    .click();
  await expect(
    slackPanel.getByTestId(`channel-connection-${bob.id}`),
  ).toContainText("Bob · DeerFlow E2E");

  const disconnectResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" &&
      new URL(response.url()).pathname ===
        `/api/channels/connections/${alice.id}`,
  );
  await slackPanel
    .getByRole("button", { name: "Disconnect Alice · DeerFlow E2E" })
    .click();
  expect((await disconnectResponsePromise).status()).toBe(204);
  await expect(
    slackPanel.getByTestId(`channel-connection-${alice.id}`),
  ).toContainText("Disconnected");

  const missing = await context.request.delete(
    `${APP}/api/channels/connections/not-owned-or-missing`,
    { headers },
  );
  expect(missing.status()).toBe(404);
  expect(await missing.json()).toEqual({
    detail: "Channel connection not found",
  });
  const unknown = await context.request.post(
    `${APP}/api/channels/not-a-provider/connect`,
    { headers },
  );
  expect(unknown.status()).toBe(404);
  expect(await unknown.json()).toEqual({ detail: "Unknown channel provider" });

  const telegramCodes: Array<{ code: string; url: string }> = [];
  for (let index = 0; index < 5; index += 1) {
    const response = await context.request.post(
      `${APP}/api/channels/telegram/connect`,
      { headers },
    );
    expect(response.status(), await response.text()).toBe(200);
    telegramCodes.push(
      (await response.json()) as { code: string; url: string },
    );
  }
  expect(telegramCodes[0]?.url).toBe(
    `https://t.me/deerflow_e2e_bot?start=${telegramCodes[0]?.code}`,
  );
  const telegramPanel = settings.getByTestId("channel-provider-telegram");
  await telegramPanel.getByRole("button", { name: "Connect" }).click();
  await expect(settings.getByRole("alert")).toHaveText(
    "Too many pending channel connection codes. Wait for existing codes to expire or use one of them.",
  );

  await slackPanel
    .getByRole("button", {
      name: "Remove provider configuration: Slack",
    })
    .click();
  const removalDialog = page.getByRole("alertdialog", {
    name: "Remove Slack provider configuration?",
  });
  const providerDeleteResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" &&
      new URL(response.url()).pathname === "/api/channels/slack/runtime-config",
  );
  await removalDialog
    .getByRole("button", { name: "Remove provider configuration" })
    .click();
  expect((await providerDeleteResponse).status()).toBe(200);
  await expect(removalDialog).toBeHidden();

  const afterProviderRemoval = await context.request.get(
    `${APP}/api/channels/connections`,
  );
  const currentRows = (
    (await afterProviderRemoval.json()) as {
      connections: Array<{ provider: string; status: string }>;
    }
  ).connections.filter(({ provider }) => provider === "slack");
  expect(currentRows).toHaveLength(2);
  expect(currentRows.every(({ status }) => status === "revoked")).toBe(true);

  const slackUnavailable = await context.request.post(
    `${APP}/api/channels/slack/connect`,
    { headers },
  );
  expect(slackUnavailable.status()).toBe(400);
  expect(await slackUnavailable.json()).toEqual({
    detail: "Enter the required Slack credentials to connect this channel.",
  });
});

test("real Gateway isolates a second user and rejects provider removal with 403", async ({
  context,
}) => {
  await registerUser(context.request);
  const headers = await csrfHeaders(context.request);
  const seeded = await context.request.post(
    `${APP}/api/test-only/channels/seed-connection`,
    {
      headers,
      data: {
        provider: "telegram",
        external_account_id: "TG-CHARLIE",
        external_account_name: "Charlie",
      },
    },
  );
  expect(seeded.status(), await seeded.text()).toBe(200);

  const list = await context.request.get(`${APP}/api/channels/connections`);
  expect(list.status(), await list.text()).toBe(200);
  expect(
    (
      (await list.json()) as {
        connections: Array<{ external_account_name: string }>;
      }
    ).connections.map(({ external_account_name }) => external_account_name),
  ).toEqual(["Charlie"]);

  const forbidden = await context.request.delete(
    `${APP}/api/channels/telegram/runtime-config`,
    { headers },
  );
  expect(forbidden.status()).toBe(403);
  expect(await forbidden.json()).toEqual({
    detail: "Admin privileges required to manage channel runtime credentials.",
  });
});
