import { expect, test, type Page } from "@playwright/test";

import {
  mockLangGraphAPI,
  MOCK_THREAD_ID,
  MOCK_THREAD_ID_2,
} from "./utils/mock-api";

const APP = "http://localhost:3107";
const OLDER_PROMPT = "Earlier prompt from history";

async function openWorkspace(
  page: Page,
  path = "/workspace/chats/new",
  afterMock?: () => Promise<void>,
) {
  mockLangGraphAPI(page, {
    threads: [
      {
        thread_id: MOCK_THREAD_ID,
        title: "Keyboard contract",
        messages: [
          { type: "human", id: "older-human", content: OLDER_PROMPT },
          { type: "ai", id: "older-ai", content: "Earlier answer" },
        ],
      },
      {
        thread_id: MOCK_THREAD_ID_2,
        title: "Second keyboard contract",
        messages: [],
      },
    ],
  });
  await afterMock?.();
  await page.goto(path);
  await expect(page.getByPlaceholder(/how can i assist you/i)).toBeVisible({
    timeout: 15_000,
  });
}

test("desktop collapse persists an exact path/max-age cookie and survives reload", async ({
  page,
  context,
}) => {
  await openWorkspace(page);
  const sidebar = page.locator("#workspace-sidebar");
  // 名字恒为 "Toggle Sidebar"（React 的 SidebarTrigger 同样如此），所以定位靠
  // data-sidebar 而不是靠随状态变化的可访问名。
  const collapse = sidebar.locator('[data-sidebar="trigger"]');

  await expect(sidebar).toHaveCSS("width", "256px");
  await collapse.click();
  await expect(sidebar).toHaveCSS("width", "48px");

  const cookie = (await context.cookies()).find(
    (candidate) => candidate.name === "sidebar_state",
  );
  expect(cookie).toMatchObject({ value: "false", path: "/", sameSite: "Lax" });
  expect(cookie?.expires ?? 0).toBeGreaterThan(Date.now() / 1000 + 6 * 86400);
  expect(cookie?.expires ?? Infinity).toBeLessThan(
    Date.now() / 1000 + 8 * 86400,
  );

  await page.reload();
  await expect(sidebar).toHaveCSS("width", "48px");
  await sidebar.locator('[data-sidebar="trigger"]').click();
  await expect(sidebar).toHaveCSS("width", "256px");
  expect(
    (await context.cookies()).find(
      (candidate) => candidate.name === "sidebar_state",
    )?.value,
  ).toBe("true");
});

test("Ctrl+B and Meta+B toggle on the page but never steal editable input", async ({
  page,
}) => {
  await openWorkspace(page);
  const sidebar = page.locator("#workspace-sidebar");
  const textarea = page.getByPlaceholder(/how can i assist you/i);

  await page.locator("body").click({ position: { x: 900, y: 100 } });
  await page.keyboard.press("Control+b");
  await expect(sidebar).toHaveCSS("width", "48px");
  await page.keyboard.press("Meta+b");
  await expect(sidebar).toHaveCSS("width", "256px");

  await textarea.focus();
  await page.keyboard.press("Control+b");
  await expect(sidebar).toHaveCSS("width", "256px");
  await expect(textarea).toBeFocused();
});

test("mobile drawer is modal, traps focus, closes by Escape/backdrop and restores focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openWorkspace(page);
  const trigger = page.getByRole("button", { name: "Toggle sidebar" });
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Workspace navigation" });
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  // 触发器不带 aria-expanded（与 React 的 SidebarTrigger 一致），抽屉开合看抽屉本身：
  // 关着的时候它整棵子树都不在 DOM 里。
  await expect(dialog.locator(":focus")).toHaveCount(1);

  // 循环边界取抽屉里**实际**第一个/最后一个可聚焦元素，而不是写死某个控件名：
  // 顶部的 DeerFlow 字样在两个前端里都是不可聚焦的 div（只有 React 的静态 demo
  // 模式才渲染成链接），写死它会让这条用例断言一个产品里不存在的东西。
  const first = dialog.getByRole("link", { name: "New chat" });
  const last = dialog.getByRole("button", { name: "Settings and more" });
  await expect(first).toBeFocused();

  await last.focus();
  await page.keyboard.press("Tab");
  await expect(first).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(last).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.getByRole("button", { name: "Close sidebar" }).click({
    position: { x: 380, y: 820 },
  });
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("mobile ignores the desktop collapsed cookie and closes after route navigation", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "sidebar_state", value: "false", url: APP },
  ]);
  await page.setViewportSize({ width: 390, height: 844 });
  await openWorkspace(page);
  const trigger = page.getByRole("button", { name: "Toggle sidebar" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Workspace navigation" });
  await expect(dialog.getByText("New chat", { exact: true })).toBeVisible();

  await dialog.getByRole("link", { name: "Scheduled tasks" }).click();
  await expect(page).toHaveURL(/\/workspace\/scheduled-tasks$/);
  // 窄屏关抽屉 = 侧栏整棵子树离开 DOM（React 的移动端 Sheet 同样如此），
  // 而不是留在原地把 role 摘掉。
  await expect(page.locator("#workspace-sidebar")).toHaveCount(0);
});

/*
  触发器的名字**不随收起态变化**，也不带 aria-expanded —— 与 React 的 SidebarTrigger
  一致。同名的第二个控件是贴边的 rail，它 tabindex="-1"：两个同名同功能的按钮都进
  Tab 序列，键盘用户会连续听到两次一模一样的「Toggle Sidebar」。
*/
test("keyboard focus has a visible global outline and the rail stays out of tab order", async ({
  page,
}) => {
  await openWorkspace(page);
  const sidebar = page.locator("#workspace-sidebar");
  const collapse = sidebar.locator('[data-sidebar="trigger"]');
  await collapse.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(collapse).toBeFocused();
  await expect(collapse).toHaveCSS("outline-style", "solid");
  await expect(collapse).toHaveAttribute("aria-label", "Toggle Sidebar");
  await expect(collapse).not.toHaveAttribute("aria-expanded", /.*/);

  const rail = sidebar.locator('[data-sidebar="rail"]');
  await expect(rail).toHaveAttribute("aria-label", "Toggle Sidebar");
  await expect(rail).toHaveAttribute("tabindex", "-1");
  await rail.click();
  await expect(sidebar).toHaveCSS("width", "48px");
});

test("context usage stays mounted and never retains another thread's value", async ({
  page,
}) => {
  await openWorkspace(page, `/workspace/chats/${MOCK_THREAD_ID}`, async () => {
    await page.route("**/api/threads/*/token-usage", async (route) => {
      const threadId = new URL(route.request().url()).pathname
        .split("/")
        .at(-2);
      await route.fulfill({
        json:
          threadId === MOCK_THREAD_ID
            ? {
                thread_id: MOCK_THREAD_ID,
                total_input_tokens: 10,
                total_output_tokens: 5,
                total_tokens: 15,
                context_usage: {
                  token_count: 42,
                  max_context_tokens: 100,
                  percentage: 42,
                },
              }
            : {
                // A stale or malformed response must not leak thread 1 into
                // thread 2 while the route changes.
                thread_id: MOCK_THREAD_ID,
                context_usage: { percentage: 42 },
              },
      });
    });
  });

  await expect(
    page.getByRole("status", { name: "Context window 42% full" }),
  ).toBeVisible();
  await page.goto(`/workspace/chats/${MOCK_THREAD_ID_2}`);
  await expect(
    page.locator('[data-context-usage-placeholder="true"]'),
  ).toBeVisible();
  await expect(
    page.getByRole("status", { name: "Context window 42% full" }),
  ).toHaveCount(0);
});

test("composition state and Safari keyCode 229 block Enter until composition ends", async ({
  page,
}) => {
  let runPosts = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/runs/stream"))
      runPosts += 1;
  });
  await openWorkspace(page, `/workspace/chats/${MOCK_THREAD_ID}`);
  const textarea = page.getByPlaceholder(/how can i assist you/i);

  await textarea.fill("中文输入");
  await textarea.dispatchEvent("compositionstart");
  await textarea.press("Enter");
  await expect.poll(() => runPosts).toBe(0);
  await textarea.dispatchEvent("compositionend");

  await textarea.evaluate((element) => {
    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, "keyCode", { value: 229 });
    element.dispatchEvent(event);
  });
  await expect.poll(() => runPosts).toBe(0);

  await textarea.press("Enter");
  await expect.poll(() => runPosts).toBe(1);
});

test("Shift+Enter, skill suggestion arrows, and prompt history keep their keyboard ownership", async ({
  page,
}) => {
  let runPosts = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/runs/stream"))
      runPosts += 1;
  });
  await openWorkspace(page, `/workspace/chats/${MOCK_THREAD_ID}`);
  const textarea = page.getByPlaceholder(/how can i assist you/i);

  await textarea.fill("first line");
  await textarea.press("Shift+Enter");
  await expect(textarea).toHaveValue("first line\n");
  expect(runPosts).toBe(0);

  await textarea.fill("/");
  const options = page.getByRole("option");
  await expect(options.first()).toBeVisible();
  await textarea.press("ArrowDown");
  await textarea.press("ArrowUp");
  await textarea.press("Enter");
  expect(runPosts).toBe(0);

  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await expect(textarea).toBeVisible();
  await textarea.fill("");
  await textarea.press("ArrowUp");
  await expect(textarea).toHaveValue(OLDER_PROMPT);
  await textarea.press("ArrowDown");
  await expect(textarea).toHaveValue("");
});
