import { expect, test } from "@playwright/test";

import { mockLangGraphAPI } from "./utils/mock-api";

test.describe("Workspace navigation", () => {
  test("shows every enabled workspace entry and the current route", async ({ page }) => {
    mockLangGraphAPI(page);

    await page.goto("/workspace/chats/new");

    const navigation = page.getByTestId("vue-workspace-nav").first();
    await expect(navigation).toBeVisible({ timeout: 15_000 });

    for (const entry of ["new-chat", "chats", "agents", "scheduled", "settings"]) {
      await expect(navigation.getByTestId(`vue-workspace-nav-${entry}`)).toBeVisible();
    }

    await expect(navigation.getByTestId("vue-workspace-nav-new-chat")).toHaveAttribute(
      "href",
      "/workspace/chats/new",
    );
    await expect(navigation.getByTestId("vue-workspace-nav-new-chat")).toHaveClass(
      /workspace-nav-shell__link--active/,
    );
  });

  test("switches routes and active state through real navigation", async ({ page }) => {
    mockLangGraphAPI(page);
    await page.route("**/api/features", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ agents_api: { enabled: true } }),
      }),
    );

    await page.goto("/workspace/chats/new");
    await page.getByTestId("vue-workspace-nav-chats").click();
    await expect(page).toHaveURL(/\/workspace\/chats$/);
    await expect(page.getByTestId("vue-workspace-nav-chats")).toHaveClass(
      /workspace-nav-shell__link--active/,
    );

    await page.goBack();
    await expect(page).toHaveURL(/\/workspace\/chats\/new$/);
    await expect(page.getByTestId("vue-workspace-nav-new-chat")).toHaveClass(
      /workspace-nav-shell__link--active/,
    );

    await page.goForward();
    await expect(page).toHaveURL(/\/workspace\/chats$/);
    await page.reload();
    await expect(page.getByTestId("vue-workspace-nav-chats")).toHaveClass(
      /workspace-nav-shell__link--active/,
    );

    await page.goto("/workspace/settings");
    await expect(page.getByTestId("vue-workspace-nav-settings")).toHaveClass(
      /workspace-nav-shell__link--active/,
    );
  });

  test("keeps Agents visible but non-navigable when the feature is disabled", async ({ page }) => {
    mockLangGraphAPI(page);
    await page.route("**/api/features", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ agents_api: { enabled: false } }),
      }),
    );

    await page.goto("/workspace/chats/new");

    const navigation = page.getByTestId("vue-workspace-nav").first();
    await expect(navigation.getByTestId("vue-workspace-nav-chats")).toBeVisible();
    await expect(navigation.locator("a[href='/workspace/agents']")).toHaveCount(0);

    const agentsButton = navigation.getByTestId("vue-workspace-nav-agents");
    await expect(agentsButton).toHaveAttribute("data-feature-disabled", "true");
    await agentsButton.click();
    await expect(agentsButton).toBeFocused();
  });

  test("opens, closes, and switches the mobile navigation without overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    mockLangGraphAPI(page);

    await page.goto("/workspace/chats/new");

    const viewportWidth = page.viewportSize()?.width ?? 390;
    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentWidth).toBeLessThanOrEqual(viewportWidth);

    const mobileToggle = page.getByTestId("vue-workspace-nav-mobile-toggle");
    await expect(mobileToggle).toBeVisible();
    await mobileToggle.click();

    const sidebar = page.locator(".workspace-sidebar");
    await expect(sidebar).toHaveClass(/workspace-sidebar--mobile-open/);
    await expect(sidebar.getByTestId("vue-workspace-nav-chats")).toBeVisible();
    await page.screenshot({ path: "test-results/workspace-navigation-mobile.png", fullPage: true });

    await sidebar.getByTestId("vue-workspace-nav-chats").click();
    await expect(page).toHaveURL(/\/workspace\/chats$/);
    await expect(page.getByTestId("vue-workspace-nav").first()).not.toHaveClass(
      /workspace-nav-shell__sidebar--mobile-open/,
    );
  });
});
