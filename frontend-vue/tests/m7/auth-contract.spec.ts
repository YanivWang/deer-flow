import { expect, test, type Page, type Request } from "@playwright/test";

const USER = {
  id: "user-1",
  email: "admin@example.com",
  system_role: "admin",
  needs_setup: false,
  oauth_provider: null,
};

async function mockLoginShell(page: Page, setup = { needs_setup: false }) {
  await page.route("**/api/v1/auth/setup-status", (route) =>
    route.fulfill({ json: { registration_enabled: true, ...setup } }),
  );
  await page.route("**/api/v1/auth/providers", (route) =>
    route.fulfill({ json: { providers: [] } }),
  );
}

async function submitCredentials(page: Page) {
  await page.getByLabel("Email", { exact: true }).fill("admin@example.com");
  await page
    .getByLabel("Password", { exact: true })
    .fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Sign In" }).click();
}

test("local login uses the Gateway form contract and stores no secret", async ({
  page,
}) => {
  await mockLoginShell(page);
  let loginRequest: Request | undefined;
  await page.route("**/api/v1/auth/login/local", (route) => {
    loginRequest = route.request();
    return route.fulfill({ json: USER });
  });
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ json: USER }),
  );

  await page.goto("/login?next=https://evil.example/phish");
  await submitCredentials(page);
  await expect(page).toHaveURL(/\/workspace$/);

  expect(loginRequest).toBeDefined();
  expect(loginRequest?.headers()["content-type"]).toContain(
    "application/x-www-form-urlencoded",
  );
  expect(new URLSearchParams(loginRequest?.postData() ?? "")).toEqual(
    new URLSearchParams({
      username: "admin@example.com",
      password: "correct-horse-battery-staple",
      remember_me: "true",
    }),
  );
  const authStorage = await page.evaluate(() =>
    Object.fromEntries(
      Object.entries({ ...localStorage }).filter(([key]) =>
        key.startsWith("deerflow.auth."),
      ),
    ),
  );
  expect(authStorage).toEqual({
    "deerflow.auth.remember_login": "1",
    "deerflow.auth.remembered_email": "admin@example.com",
  });
  expect(JSON.stringify(authStorage)).not.toContain("correct-horse");
  expect(Object.keys(authStorage)).not.toContain("token");
});

test("SSO providers expose the failure hint and preserve safe next/remember parameters", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/setup-status", (route) =>
    route.fulfill({ json: { registration_enabled: true, needs_setup: false } }),
  );
  await page.route("**/api/v1/auth/providers", (route) =>
    route.fulfill({
      json: {
        providers: [
          { id: "company oidc", display_name: "Company SSO", type: "oidc" },
        ],
      },
    }),
  );
  await page.route("**/api/v1/auth/login/local", (route) =>
    route.fulfill({ status: 401, json: { detail: "Invalid credentials" } }),
  );

  await page.goto("/login?next=/workspace/chats/safe%3Fview%3D1");
  await expect(
    page.getByRole("button", { name: "Continue with Company SSO" }),
  ).toBeVisible();
  await submitCredentials(page);
  await expect(page.getByText(/account uses single sign-on/i)).toBeVisible();

  const oauthRequest = page.waitForRequest((request) =>
    request.url().includes("/api/v1/auth/oauth/company%20oidc"),
  );
  await page.getByRole("button", { name: "Continue with Company SSO" }).click();
  const url = new URL((await oauthRequest).url());
  expect(url.searchParams.get("next")).toBe("/workspace/chats/safe?view=1");
  expect(url.searchParams.get("remember_me")).toBe("true");
});

test("registration uses the exact JSON contract", async ({ page }) => {
  await mockLoginShell(page);
  let body: unknown;
  let contentType = "";
  await page.route("**/api/v1/auth/register", (route) => {
    body = route.request().postDataJSON();
    contentType = route.request().headers()["content-type"] ?? "";
    return route.fulfill({ json: USER });
  });
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ json: USER }),
  );

  await page.goto("/login");
  await page.getByRole("button", { name: /Don't have an account/i }).click();
  await page.getByLabel("Email", { exact: true }).fill("admin@example.com");
  await page
    .getByLabel("Password", { exact: true })
    .fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page).toHaveURL(/\/workspace$/);

  expect(contentType).toContain("application/json");
  expect(body).toEqual({
    email: "admin@example.com",
    password: "correct-horse-battery-staple",
    remember_me: true,
  });
});

test("setup initialization uses the exact JSON contract", async ({ page }) => {
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 401, json: { detail: "Unauthorized" } }),
  );
  await page.route("**/api/v1/auth/setup-status", (route) =>
    route.fulfill({ json: { needs_setup: true } }),
  );
  let body: unknown;
  await page.route("**/api/v1/auth/initialize", (route) => {
    body = route.request().postDataJSON();
    return route.fulfill({ json: USER });
  });

  await page.goto("/setup");
  await page.getByLabel("Email").fill("admin@example.com");
  await page.getByLabel("Password", { exact: true }).fill("new-password-123");
  await page.getByLabel("Confirm Password").fill("new-password-123");
  await page.getByRole("button", { name: "Create Admin Account" }).click();
  await expect(page).toHaveURL(/\/workspace$/);
  expect(body).toEqual({
    email: "admin@example.com",
    password: "new-password-123",
    remember_me: true,
  });
});

test("password setup echoes the CSRF cookie and preserves field names", async ({
  context,
  page,
}) => {
  await context.addCookies([
    {
      name: "csrf_token",
      value: "m7-csrf-token",
      domain: "localhost",
      path: "/",
      sameSite: "Strict",
    },
  ]);
  let setupComplete = false;
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ json: { ...USER, needs_setup: !setupComplete } }),
  );
  let request: Request | undefined;
  await page.route("**/api/v1/auth/change-password", (route) => {
    request = route.request();
    setupComplete = true;
    return route.fulfill({ json: USER });
  });

  await page.goto("/setup");
  await page.getByLabel("Current password").fill("temporary-password");
  await page.getByLabel("Password", { exact: true }).fill("new-password-123");
  await page.getByLabel("Confirm Password").fill("new-password-123");
  await page.getByRole("button", { name: "Complete Setup" }).click();
  await expect(page).toHaveURL(/\/workspace$/);
  expect(request?.headers()["x-csrf-token"]).toBe("m7-csrf-token");
  expect(request?.postDataJSON()).toEqual({
    current_password: "temporary-password",
    new_password: "new-password-123",
    new_email: "admin@example.com",
    remember_me: true,
  });
});

test("workspace distinguishes 401 from Gateway unavailability", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 401, json: { detail: "Unauthorized" } }),
  );
  await mockLoginShell(page);
  await page.goto("/workspace/scheduled-tasks");
  await expect(page).toHaveURL(
    /\/login\?redirect=\/workspace\/scheduled-tasks$/,
  );

  await page.unroute("**/api/v1/auth/me");
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 503, json: { detail: "Unavailable" } }),
  );
  await page.goto("/workspace");
  await expect(page).toHaveURL(/\/login\?error=gateway_unavailable$/);
});

test("workspace sends an authenticated setup user to setup and admits a ready user", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ json: { ...USER, needs_setup: true } }),
  );
  await page.goto("/workspace");
  await expect(page).toHaveURL(/\/setup$/);

  await page.unroute("**/api/v1/auth/me");
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ json: USER }),
  );
  await page.goto("/workspace");
  await expect(page).toHaveURL(/\/workspace$/);
});
