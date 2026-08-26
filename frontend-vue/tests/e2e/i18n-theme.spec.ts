/*
  【文件职责】     locale/theme 的真实 Nuxt + Chromium 行为矩阵。
  【架构位置】     Vue-owned M7 Playwright
  【主要导出】     Playwright scenarios
  【依赖关系】     shared mock Gateway · app i18n/theme owners
  【边界与注意】   动态 Gateway/user/file 内容保持原样；公网与真实 IdP 不在本 gate。
*/

import { expect, test, type Page } from "@playwright/test";

import { mockLangGraphAPI } from "./utils/mock-api";
import { enUS } from "../../app/core/i18n/locales/en-US";
import { zhCN } from "../../app/core/i18n/locales/zh-CN";

const THREAD_ID = "00000000-0000-0000-0000-000000001212";
const ARTIFACT_PATH = "/mnt/user-data/outputs/wp12-report.md";

function prepare(page: Page) {
  mockLangGraphAPI(page, {
    threads: [
      {
        thread_id: THREAD_ID,
        title: "dynamic title",
        messages: [
          { type: "human", id: "wp12-human", content: "用户动态内容 X12" },
          {
            type: "ai",
            id: "wp12-ai",
            content: "Backend dynamic content X12",
            tool_calls: [
              {
                id: "wp12-write",
                name: "write_file",
                args: { path: ARTIFACT_PATH, content: "# Heading" },
              },
            ],
          },
        ],
      },
    ],
    features: { agentsApiEnabled: true, browserControlEnabled: true },
  });
}

test("locale switch updates an open dialog, product surfaces, future errors and reload", async ({
  page,
}) => {
  prepare(page);
  await page.goto(`/workspace/chats/${THREAD_ID}?settings=appearance`);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(enUS.settings.appearance.themeTitle);
  await dialog.locator("select").selectOption("zh-CN");

  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(dialog).toContainText(zhCN.settings.appearance.themeTitle);
  await expect(dialog).toContainText(zhCN.settings.appearance.darkDescription);
  expect(
    (await page.context().cookies()).find((cookie) => cookie.name === "locale")
      ?.value,
  ).toBe("zh-CN");

  await dialog.getByRole("button", { name: zhCN.common.close }).click();
  await expect(page.getByPlaceholder(zhCN.inputBox.placeholder)).toBeVisible();
  await expect(page.getByLabel(zhCN.browser.trigger)).toBeVisible();
  await expect(page.getByLabel(zhCN.clipboard.copyToClipboard)).toBeVisible();
  const sidebar = page.locator("#workspace-sidebar");
  await expect(
    sidebar.getByRole("link", { name: zhCN.sidebar.agents }),
  ).toBeVisible();
  await expect(
    sidebar.getByRole("link", { name: zhCN.sidebar.scheduledTasks }),
  ).toBeVisible();
  await expect(page.getByText("用户动态内容 X12")).toBeVisible();
  await expect(page.getByText("Backend dynamic content X12")).toBeVisible();

  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => Promise.reject(new Error("denied")) },
    });
  });
  /*
    这条线程带 write_file 产物，面板自动打开，于是侧栏被收起——React 在
    artifacts context 的 select() 里做的就是这件事。会话列表在收起态下不渲染
    （React 的 WorkspaceSidebar 直接 `{isSidebarOpen && <RecentChatList />}`），
    所以要先把侧栏展开回来。收起态的触发器要悬停头部才出现。
  */
  const sidebarPanel = page.locator("#workspace-sidebar");
  await sidebarPanel.locator('[data-sidebar="header"]').hover();
  await sidebarPanel.locator('[data-sidebar="trigger"]').click();
  const row = page
    .locator('[data-sidebar="menu-item"]')
    .filter({ hasText: "dynamic title" });
  await row.getByRole("button", { name: zhCN.common.more }).click();
  await page.getByTestId("thread-share").click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: zhCN.clipboard.failedToCopyToClipboard }),
  ).toBeVisible();

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByPlaceholder(zhCN.inputBox.placeholder)).toBeVisible();
});

test("persisted locale hydrates SSR and CSR routes without mismatches", async ({
  page,
}) => {
  prepare(page);
  const runtimeErrors: string[] = [];
  const captureRuntimeErrors = (target: Page) => {
    target.on("console", (message) => {
      if (message.type() === "error" || /hydrat/i.test(message.text())) {
        runtimeErrors.push(`[${message.type()}] ${message.text()}`);
      }
    });
    target.on("pageerror", (error) => runtimeErrors.push(error.message));
  };
  captureRuntimeErrors(page);

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: enUS.marketing.badge }),
  ).toBeVisible();
  const workspaceCta = page.getByRole("link", {
    name: enUS.marketing.enterWorkspace,
  });
  await expect(workspaceCta).toHaveAttribute("href", "/workspace");
  await workspaceCta.click();
  await expect(page).toHaveURL(/\/workspace\/chats\/new$/);
  await expect(page.getByPlaceholder(enUS.inputBox.placeholder)).toBeVisible();
  await page.goto("/");
  expect(runtimeErrors.filter((message) => /hydrat/i.test(message))).toEqual(
    [],
  );
  runtimeErrors.length = 0;

  // A persisted preference exists before the next document request starts.
  // Injecting a cookie into an already-running renderer and immediately
  // reloading races Chromium's cross-process cookie propagation under load;
  // the separate UI-switch scenario above owns same-page mutation + reload.
  const context = page.context();
  await page.close();
  await context.addCookies([
    { name: "locale", value: "zh-CN", url: "http://localhost:3101" },
  ]);
  const localizedPage = await context.newPage();
  prepare(localizedPage);
  captureRuntimeErrors(localizedPage);

  await localizedPage.goto("/");
  await expect(localizedPage.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(
    localizedPage.getByRole("heading", { name: zhCN.marketing.badge }),
  ).toBeVisible();
  expect(runtimeErrors.filter((message) => /hydrat/i.test(message))).toEqual(
    [],
  );
  runtimeErrors.length = 0;

  await localizedPage.goto("/workspace/chats/new");
  await expect(
    localizedPage.getByPlaceholder(zhCN.inputBox.placeholder),
  ).toBeVisible();
  expect(runtimeErrors.filter((message) => /hydrat/i.test(message))).toEqual(
    [],
  );
});

test("invalid locale cookie safely falls back to the supported browser locale", async ({
  page,
}) => {
  await page
    .context()
    .addCookies([
      { name: "locale", value: "xx-invalid", url: "http://localhost:3101" },
    ]);
  prepare(page);
  await page.goto("/workspace/chats/new");
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await expect(page.getByPlaceholder(enUS.inputBox.placeholder)).toBeVisible();
});

test("system theme follows light-dark-light media changes in the running app", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => localStorage.setItem("theme", "system"));
  prepare(page);
  await page.goto("/workspace/chats/new");
  await expect(page.locator("html")).not.toHaveClass(/dark/);

  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("explicit theme ignores media, returning to system resyncs, and reload initializes early", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  prepare(page);
  await page.goto("/workspace/chats/new?settings=appearance");
  const dialog = page.getByRole("dialog", { name: enUS.settings.title });
  await dialog.locator('[data-theme-preference="dark"]').click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.emulateMedia({ colorScheme: "dark" });
  await dialog.locator('[data-theme-preference="system"]').click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe(
    "system",
  );

  await page.evaluate(() => localStorage.setItem("theme", "sepia"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe(
    "system",
  );
});

test("the React-equivalent root route is forced dark without overwriting the saved preference", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("theme", "light"));
  prepare(page);
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe(
    "light",
  );

  await page.goto("/workspace/chats/new");
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe(
    "light",
  );
});
