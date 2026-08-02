import { expect, test, type Page } from "@playwright/test";

const SETUP_STATUS_URL = "**/api/v1/auth/setup-status";
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

    await expect(page.getByTestId("vue-login-setup-unavailable")).toBeVisible();
    await expect(page.getByTestId("vue-login-submit")).toBeEnabled();
    await expect(
      page.getByRole("button", { name: /Don't have an account/i }),
    ).toHaveCount(0);
    expect(getRequestCount()).toBe(1);

    await page.getByTestId("vue-login-setup-retry").click();

    await expect
      .poll(getRequestCount, { message: "setup-status should be retried" })
      .toBe(2);
    await expect(page.getByTestId("vue-login-setup-unavailable")).toBeHidden();
    await expect(page.getByTestId("vue-login-form")).toBeVisible();
  });

  test("setup restores the administrator form after setup-status retry", async ({
    page,
  }) => {
    const getRequestCount = await mockSetupStatusRecovery(page, {
      needs_setup: true,
    });

    await page.goto("/setup");

    await expect(page.getByText("无法获取 Gateway 初始化状态。")).toBeVisible();
    await expect(page.getByTestId("vue-setup-retry")).toBeVisible();
    expect(getRequestCount()).toBe(1);

    await page.getByTestId("vue-setup-retry").click();

    await expect
      .poll(getRequestCount, { message: "setup-status should be retried" })
      .toBe(2);
    await expect(page.getByText("无法获取 Gateway 初始化状态。")).toBeHidden();
    await expect(page.getByTestId("vue-setup-form")).toBeVisible();
    await expect(page.getByTestId("vue-setup-email")).toBeVisible();
  });
});
