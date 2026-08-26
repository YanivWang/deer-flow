/*
  【文件职责】     在真实浏览器里钉住 UI primitive 层的焦点、键盘与 aria 合同。
  【架构位置】     E2E 产品合同（mock Gateway）
  【主要导出】     Playwright scenarios
  【依赖关系】     tests/e2e/utils/mock-api · app/components/ui/**
  【边界与注意】   这里断言的是**可观察行为**——语义角色、focus order、Escape、aria 状态——
                   而不是 DOM 结构或 class。真实焦点必须在浏览器里验证：happy-dom
                   不做布局，对隐藏元素调 focus() 静默无效，单测看不出来。
                   范式沿用 sidebar-ime-a11y.spec.ts。
*/

import { expect, test, type Page } from "@playwright/test";

import { mockLangGraphAPI, MOCK_THREAD_ID } from "./utils/mock-api";

const SKILL = {
  name: "review",
  description: "Review",
  category: "public",
  license: null,
  enabled: true,
  editable: false,
};

async function openWorkspace(
  page: Page,
  path = "/workspace/chats/new",
  afterMock?: () => Promise<void>,
) {
  mockLangGraphAPI(page, {
    threads: [
      {
        thread_id: MOCK_THREAD_ID,
        title: "Primitive contract",
        messages: [
          { type: "human", id: "h-1", content: "Ask something" },
          { type: "ai", id: "a-1", content: "An answer" },
        ],
      },
    ],
  });
  await afterMock?.();
  await page.goto(path);
  await expect(page.getByPlaceholder(/how can i assist you/i)).toBeVisible({
    timeout: 15_000,
  });
}

test("settings dialog traps focus, closes on Escape, and returns focus to its trigger", async ({
  page,
}) => {
  await openWorkspace(page);

  const trigger = page.locator('button[aria-label="Settings and more"]');
  await trigger.click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await menu.getByRole("menuitem", { name: "Settings" }).click();

  const dialog = page.getByRole("dialog", { name: "Settings" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(dialog).toHaveAttribute("data-state", "open");

  // 焦点必须真的落在对话框里的可见元素上，而不是留在背景。
  await expect(dialog.locator(":focus")).toHaveCount(1);

  // Tab 循环不出对话框：从最后一个可聚焦元素继续 Tab 仍然在里面。
  for (let step = 0; step < 12; step += 1) {
    await page.keyboard.press("Tab");
    await expect(dialog.locator(":focus")).toHaveCount(1);
  }

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("settings-and-more menu is a real menu: arrow keys move, Escape restores focus", async ({
  page,
}) => {
  await openWorkspace(page);

  // 菜单打开时整页背景（含触发器）被标记 aria-hidden——这是模态菜单该有的样子，
  // 但也意味着 getByRole 在打开期间找不到触发器，所以这里按属性定位。
  const trigger = page.locator('button[aria-label="Settings and more"]');
  await expect(trigger).toHaveAttribute("aria-haspopup", "menu");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");

  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();

  // 菜单项之间用方向键移动（一排普通 button 做不到这件事）。
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitem", { name: "Settings" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(
    menu.getByRole("menuitem", { name: "DeerFlow's official website" }),
  ).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toBeFocused();
});

test("command palette is a combobox: first result is pre-selected and Escape restores focus", async ({
  page,
}) => {
  await openWorkspace(page);

  const composer = page.getByPlaceholder(/how can i assist you/i);
  await composer.click();
  await page.keyboard.press("Meta+k");

  const search = page.getByRole("textbox", { name: "Search actions" });
  await expect(search).toBeFocused();

  const options = page.getByRole("option");
  await expect(options).toHaveCount(3);
  const first = options.first();
  await expect(search).toHaveAttribute(
    "aria-activedescendant",
    (await first.getAttribute("id"))!,
  );

  // 焦点留在输入框，当前项通过 aria-activedescendant 宣告。
  await page.keyboard.press("ArrowDown");
  await expect(search).toBeFocused();
  await expect(search).toHaveAttribute(
    "aria-activedescendant",
    (await options.nth(1).getAttribute("id"))!,
  );

  await page.keyboard.press("Escape");
  await expect(page.getByRole("option")).toHaveCount(0);
  await expect(composer).toBeFocused();
});

test("thread rename is a labelled modal that keeps a failed write visible", async ({
  page,
}) => {
  await openWorkspace(page, `/workspace/chats/${MOCK_THREAD_ID}`);

  const row = page
    .locator('[data-sidebar="menu-item"]')
    .filter({ hasText: "Primitive contract" })
    .first();
  await row.hover();
  await row.getByRole("button", { name: "More" }).click();
  await page.getByRole("menuitem", { name: "Rename" }).click();

  const dialog = page.getByRole("dialog", { name: "Rename chat" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(dialog.locator(":focus")).toHaveCount(1);

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("skill source is a tablist and the enable control is a switch", async ({
  page,
}) => {
  mockLangGraphAPI(page);
  await page.route(/\/api\/skills$/, (route) =>
    route.fulfill({ json: { skills: [SKILL] } }),
  );
  await page.goto("/workspace/chats/new?settings=skills");
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();

  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveCount(2);
  await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "false");

  // tablist 里方向键换 tab，Tab 键整体进出——这正是它和一排 button 的区别。
  await tabs.nth(0).focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(tabs.nth(1)).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");

  const toggle = page.getByRole("switch", { name: "review" });
  await expect(toggle).toBeVisible();
  await expect(toggle).toBeChecked();
});

test("composer model selector is a menu whose current model is announced", async ({
  page,
}) => {
  await openWorkspace(page, "/workspace/chats/new", async () => {
    // 共享 mock 默认返回空 models，选择器根本不渲染；这条用例需要真的有模型。
    await page.route("**/api/models", (route) =>
      route.fulfill({
        json: {
          models: [
            {
              id: "basic",
              name: "basic",
              model: "Basic",
              display_name: "Basic Model",
              supports_thinking: false,
              supports_reasoning_effort: false,
            },
            {
              id: "reasoning",
              name: "reasoning",
              model: "Reasoning",
              display_name: "Reasoning Model",
              supports_thinking: true,
              supports_reasoning_effort: true,
            },
          ],
          token_usage: { enabled: false },
        },
      }),
    );
  });

  const trigger = page.getByTestId("composer-model-selector");
  await expect(trigger).toBeVisible({ timeout: 15_000 });
  await expect(trigger).toHaveAttribute("aria-haspopup", "menu");
  await trigger.click();

  const options = page.getByRole("menuitemradio");
  await expect(options).toHaveCount(2);
  await expect(options.first()).toHaveAttribute("aria-checked", "true");
  await expect(options.nth(1)).toHaveAttribute("aria-checked", "false");

  await page.keyboard.press("Escape");
  await expect(page.getByRole("menuitemradio")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("assistant actions keep their accessible name and gain a hover tooltip", async ({
  page,
}) => {
  await openWorkspace(page, `/workspace/chats/${MOCK_THREAD_ID}`);

  const copy = page
    .getByTestId("assistant-turn-actions")
    .getByRole("button", { name: /copy/i })
    .first();
  await expect(copy).toBeVisible();

  // tooltip 只是补充：可访问名字仍然来自按钮自己的 aria-label，
  // 否则关掉 tooltip 的读屏器就读不到这个按钮是干什么的。
  const label = await copy.getAttribute("aria-label");
  expect(label?.trim()).toBeTruthy();

  await copy.hover();
  const tooltip = page.locator('[data-slot="tooltip-content"]');
  await expect(tooltip.first()).toBeVisible({ timeout: 5_000 });
  await expect(tooltip.first()).toContainText(label!);
  // 读屏器读到的那份是 Reka 嵌在里面的 visually-hidden role="tooltip"：
  // 视觉层本身不承担语义。它被 1px clip 起来，所以按属性定位而不是按 role。
  await expect(tooltip.locator('[role="tooltip"]').first()).toHaveText(label!);
});
