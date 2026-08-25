import { expect, test, type Page } from "@playwright/test";

const SETUP_STATUS_URL = "**/api/v1/auth/setup-status";
const SERVICE_UNAVAILABLE_TITLE = "Service temporarily unavailable";

async function mockSetupStatusRecovery(
  page: Page,
  recoveredStatus: {
    needs_setup: boolean;
    registration_enabled?: boolean;
  },
) {
  let requestCount = 0;

  await page.route(SETUP_STATUS_URL, (route) => {
    if (route.request().method() !== "GET") {
      return route.fallback();
    }

    requestCount += 1;
    if (requestCount === 1) {
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Gateway unavailable" }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(recoveredStatus),
    });
  });

  return () => requestCount;
}

test.describe("auth setup-status recovery", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/v1/auth/providers", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ providers: [] }),
      }),
    );
  });

  test("login restores registration after setup-status retry", async ({
    page,
  }) => {
    const getRequestCount = await mockSetupStatusRecovery(page, {
      needs_setup: false,
      registration_enabled: true,
    });

    await page.goto("/login");

    await expect(page.getByText(SERVICE_UNAVAILABLE_TITLE)).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign In" })).toBeEnabled();
    await expect(
      page.getByRole("button", { name: /Don't have an account/i }),
    ).toHaveCount(0);
    expect(getRequestCount()).toBe(1);

    await page.getByRole("button", { name: "Try again" }).click();

    await expect
      .poll(getRequestCount, { message: "setup-status should be retried" })
      .toBe(2);
    await expect(page.getByText(SERVICE_UNAVAILABLE_TITLE)).toBeHidden();
    await expect(
      page.getByRole("button", { name: /Don't have an account/i }),
    ).toBeVisible();
  });

  test("setup restores the administrator form after setup-status retry", async ({
    page,
  }) => {
    const getRequestCount = await mockSetupStatusRecovery(page, {
      needs_setup: true,
    });

    await page.goto("/setup");

    await expect(page.getByText(SERVICE_UNAVAILABLE_TITLE)).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    expect(getRequestCount()).toBe(1);

    await page.getByRole("button", { name: "Try again" }).click();

    await expect
      .poll(getRequestCount, { message: "setup-status should be retried" })
      .toBe(2);
    await expect(page.getByText(SERVICE_UNAVAILABLE_TITLE)).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Create Admin Account" }),
    ).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
  });

  test("the unavailable screen offers Sign In as a button that replaces history", async ({
    page,
  }) => {
    /*
      React 这里是 `<Button onClick={() => router.replace("/login")}>`
      （setup/page.tsx 的 gateway-unavailable 分支）。Vue 一度用 NuxtLink，
      role 就成了 link——读屏播报不同、空格键不触发，而且 push 会把这个不可用页
      留在历史里，用户按后退又撞回来。语义 DOM 对照（make dom-parity）抓到的就是
      这一条，所以断言钉 role 和后退行为，不钉文案。
    */
    await mockSetupStatusRecovery(page, { needs_setup: true });
    await page.goto("/setup");
    await expect(page.getByText(SERVICE_UNAVAILABLE_TITLE)).toBeVisible();

    const signIn = page.getByRole("button", { name: "Sign In" });
    await expect(signIn).toBeVisible();
    // link 会有 href；button 不该有。
    await expect(page.getByRole("link", { name: "Sign In" })).toHaveCount(0);

    await signIn.click();
    await expect(page).toHaveURL(/\/login$/);

    // replace 而不是 push：后退不该回到那个不可用页面。
    await page.goBack();
    await expect(page).not.toHaveURL(/\/setup$/);
  });
});
