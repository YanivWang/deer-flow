import { expect, test, type Page, type Route } from "@playwright/test";

const AUTH_USER = {
  email: "user@example.com",
  id: "user-e2e",
  oauth_provider: null,
  system_role: "admin",
};

test("local login posts Gateway form fields and follows the protected next path", async ({
  baseURL,
  page,
}) => {
  if (!baseURL) {
    throw new Error("Playwright baseURL is required for cookie-backed auth assertions.");
  }
  mockAuthBootstrap(page);

  let submittedForm: URLSearchParams | null = null;
  await page.route("**/api/v1/auth/login/local", async (route) => {
    if (route.request().method() !== "POST") {
      return route.fallback();
    }
    submittedForm = new URLSearchParams(route.request().postData() ?? "");
    await page.context().addCookies([
      { name: "access_token", url: baseURL, value: "login-cookie" },
      { name: "csrf_token", url: baseURL, value: "login-csrf" },
    ]);
    return route.fulfill({
      body: JSON.stringify({ expires_in: 86400, needs_setup: false }),
      contentType: "application/json",
      status: 200,
    });
  });
  await page.route("**/api/v1/auth/me", (route) => fulfillJson(route, AUTH_USER));

  await page.goto("/login?next=/workspace/settings");
  await page.getByTestId("vue-login-email").fill("user@example.com");
  await page.getByTestId("vue-login-password").fill("secret123");
  await page.getByTestId("vue-login-remember").uncheck();
  await page.getByTestId("vue-login-submit").click();

  await expect(page).toHaveURL(/\/workspace\/settings$/);
  expect(submittedForm?.get("username")).toBe("user@example.com");
  expect(submittedForm?.get("password")).toBe("secret123");
  expect(submittedForm?.get("remember_me")).toBe("false");
});

test("local login displays the Gateway auth error detail", async ({ page }) => {
  mockAuthBootstrap(page);
  await page.route("**/api/v1/auth/login/local", (route) =>
    fulfillJson(
      route,
      { detail: { code: "invalid_credentials", message: "Incorrect email or password" } },
      401,
    ),
  );

  await page.goto("/login?next=https://evil.test");
  await page.getByTestId("vue-login-email").fill("user@example.com");
  await page.getByTestId("vue-login-password").fill("wrong-password");
  await page.getByTestId("vue-login-submit").click();

  await expect(page.getByTestId("vue-login-error")).toContainText(
    "Incorrect email or password",
  );
  await expect(page).toHaveURL(/\/login\?next=https:\/\/evil\.test$/);
});

test("account settings changes password with CSRF and logs out through the Gateway", async ({
  baseURL,
  page,
}) => {
  if (!baseURL) {
    throw new Error("Playwright baseURL is required for cookie-backed auth assertions.");
  }
  await page.context().addCookies([
    { name: "access_token", url: baseURL, value: "settings-cookie" },
    { name: "csrf_token", url: baseURL, value: "settings-csrf" },
  ]);
  await page.route("**/api/v1/auth/me", (route) => fulfillJson(route, AUTH_USER));

  let passwordRequest: { csrfToken: string | null; payload: unknown } | null = null;
  await page.route("**/api/v1/auth/change-password", async (route) => {
    if (route.request().method() !== "POST") {
      return route.fallback();
    }
    passwordRequest = {
      csrfToken: route.request().headers()["x-csrf-token"] ?? null,
      payload: route.request().postDataJSON(),
    };
    await page.context().addCookies([
      { name: "csrf_token", url: baseURL, value: "rotated-csrf" },
    ]);
    return fulfillJson(route, { message: "Password changed successfully" });
  });

  let logoutCsrfToken: string | null = null;
  await page.route("**/api/v1/auth/logout", async (route) => {
    if (route.request().method() !== "POST") {
      return route.fallback();
    }
    logoutCsrfToken = route.request().headers()["x-csrf-token"] ?? null;
    await page.context().clearCookies();
    return fulfillJson(route, { message: "Successfully logged out" });
  });

  await page.goto("/workspace/settings");
  await page.getByTestId("vue-settings-nav-account").click();
  await expect(page.getByTestId("vue-settings-account-profile")).toContainText(
    "user@example.com",
  );

  await page.getByTestId("vue-settings-current-password").fill("old-password");
  await page.getByTestId("vue-settings-new-password").fill("new-password");
  await page.getByTestId("vue-settings-confirm-password").fill("new-password");
  await page.getByRole("button", { name: "Update password" }).click();

  await expect(page.getByTestId("vue-settings-account-message")).toContainText(
    "Password changed.",
  );
  expect(passwordRequest?.csrfToken).toBe("settings-csrf");
  expect(passwordRequest?.payload).toEqual({
    current_password: "old-password",
    new_password: "new-password",
  });

  await page.getByTestId("vue-settings-logout").click();
  await expect(page).toHaveURL(/\/workspace$/);
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
  expect(logoutCsrfToken).toBe("rotated-csrf");
});

function mockAuthBootstrap(page: Page) {
  void page.route("**/api/v1/auth/setup-status", (route) =>
    fulfillJson(route, { needs_setup: false, registration_enabled: true }),
  );
  void page.route("**/api/v1/auth/providers", (route) =>
    fulfillJson(route, { providers: [] }),
  );
}

function fulfillJson(route: Route, payload: unknown, status = 200) {
  return route.fulfill({
    body: JSON.stringify(payload),
    contentType: "application/json",
    status,
  });
}
