import { expect, test, type Page, type Request } from "@playwright/test";

import { mockLangGraphAPI } from "../e2e/utils/mock-api";

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
  mockLangGraphAPI(page);
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
  await expect(page).toHaveURL(/\/workspace\/chats\/new$/);

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

test("logout and a new login never reuse the previous user's query cache", async ({
  page,
}) => {
  mockLangGraphAPI(page);
  await mockLoginShell(page);
  const nextUser = {
    ...USER,
    id: "user-2",
    email: "user@example.com",
    system_role: "user",
  };
  let currentUser: typeof USER | typeof nextUser | null = USER;
  let currentThread = {
    thread_id: "10000000-0000-0000-0000-000000000001",
    title: "ADMIN PRIVATE THREAD",
  };

  await page.route("**/api/v1/auth/me", (route) =>
    currentUser
      ? route.fulfill({ json: currentUser })
      : route.fulfill({ status: 401, json: { detail: "Unauthorized" } }),
  );
  await page.route("**/api/v1/auth/logout", (route) => {
    currentUser = null;
    return route.fulfill({ status: 200, json: { message: "ok" } });
  });
  await page.route("**/api/v1/auth/login/local", (route) => {
    currentUser = nextUser;
    currentThread = {
      thread_id: "20000000-0000-0000-0000-000000000002",
      title: "USER PRIVATE THREAD",
    };
    return route.fulfill({ status: 200, json: { expires_in: 604_800 } });
  });
  await page.route("**/api/langgraph/threads/search", (route) =>
    route.fulfill({
      json: [
        {
          thread_id: currentThread.thread_id,
          created_at: "2026-08-23T00:00:00Z",
          updated_at: "2026-08-23T00:00:00Z",
          metadata: {},
          status: "idle",
          values: { title: currentThread.title },
        },
      ],
    }),
  );

  await page.goto("/workspace/chats/new?settings=account");
  await expect(page.getByText("ADMIN PRIVATE THREAD")).toBeVisible();
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page.getByRole("button", { name: "Sign Out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Email", { exact: true }).fill("user@example.com");
  await page
    .getByLabel("Password", { exact: true })
    .fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(page).toHaveURL(/\/workspace\/chats\/new$/);
  await expect(page.getByText("USER PRIVATE THREAD")).toBeVisible();
  await expect(page.getByText("ADMIN PRIVATE THREAD")).toHaveCount(0);
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

/*
  已经有 session 的人不该停在登录页上（上游 login/page.tsx:77 的
  `if (isAuthenticated) router.push(redirectPath)`）。这不只是"刚登录完的那一跳"：
  **关掉鉴权部署时 Gateway 直接给出一个用户**，于是访问 /login 会立刻回到工作区，
  而本仓此前停在一张永远用不上的登录表单上（2026-09-02 probe 实测，台账口径差 58 行）。

  `next` 要一起验：跳的必须是校验过的那个目标，不是写死的工作区首页。
*/
test("an existing session leaves the login page for the validated next path", async ({
  page,
}) => {
  mockLangGraphAPI(page);
  await mockLoginShell(page);
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ json: USER }),
  );

  await page.goto("/login?next=/workspace/chats/safe%3Fview%3D1");
  /*
    断言要按 **pathname + search** 拆开比，不能用一条没锚住开头的正则：
    没跳转时 URL 是 `/login?next=/workspace/chats/safe?view=1`，它的**结尾**同样是
    `workspace/chats/safe?view=1`，于是 `toHaveURL(/...safe\?view=1$/)` 在跳与不跳
    两种情况下都成立——这条用例第一版就是这么写的，把跳转整个删掉照样绿。
  */
  await expect
    .poll(() => {
      const url = new URL(page.url());
      return `${url.pathname}${url.search}`;
    })
    .toBe("/workspace/chats/safe?view=1");
});

/*
  服务不可用**不是**登出，也不是登录——那一支必须留在登录页上，否则 Gateway 一抖
  用户就被弹到一个同样打不开的工作区。
*/
test("a gateway outage keeps the user on the login page", async ({ page }) => {
  mockLangGraphAPI(page);
  await mockLoginShell(page);
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 503, json: { detail: "unavailable" } }),
  );

  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "Sign In", exact: true }),
  ).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/login");
});

test("registration uses the exact JSON contract", async ({ page }) => {
  mockLangGraphAPI(page);
  await mockLoginShell(page);
  let body: unknown;
  let contentType = "";
  /*
    注册**之前** `/auth/me` 必须回 401。登录页现在照上游那样「已经有 session 就跳回
    工作区」（login/page.tsx:77），一上来就把 me 喂成已登录，页面会在点到
    「Create Account」之前就跳走——按钮当场从 DOM 上摘掉。下面那条 setup 用例
    本来就是这么写的（`initialized` 开关）。
  */
  let registered = false;
  await page.route("**/api/v1/auth/register", (route) => {
    body = route.request().postDataJSON();
    contentType = route.request().headers()["content-type"] ?? "";
    registered = true;
    return route.fulfill({ json: USER });
  });
  await page.route("**/api/v1/auth/me", (route) =>
    registered
      ? route.fulfill({ json: USER })
      : route.fulfill({ status: 401, json: { detail: "Unauthorized" } }),
  );

  await page.goto("/login");
  await page.getByRole("button", { name: /Don't have an account/i }).click();
  await page.getByLabel("Email", { exact: true }).fill("admin@example.com");
  await page
    .getByLabel("Password", { exact: true })
    .fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page).toHaveURL(/\/workspace\/chats\/new$/);

  expect(contentType).toContain("application/json");
  expect(body).toEqual({
    email: "admin@example.com",
    password: "correct-horse-battery-staple",
    remember_me: true,
  });
});

test("setup initialization uses the exact JSON contract", async ({ page }) => {
  mockLangGraphAPI(page);
  let initialized = false;
  await page.route("**/api/v1/auth/me", (route) =>
    initialized
      ? route.fulfill({ json: USER })
      : route.fulfill({ status: 401, json: { detail: "Unauthorized" } }),
  );
  await page.route("**/api/v1/auth/setup-status", (route) =>
    route.fulfill({ json: { needs_setup: true } }),
  );
  let body: unknown;
  await page.route("**/api/v1/auth/initialize", (route) => {
    body = route.request().postDataJSON();
    initialized = true;
    return route.fulfill({ json: USER });
  });

  await page.goto("/setup");
  await page.getByLabel("Email").fill("admin@example.com");
  await page.getByLabel("Password", { exact: true }).fill("new-password-123");
  await page.getByLabel("Confirm Password").fill("new-password-123");
  await page.getByRole("button", { name: "Create Admin Account" }).click();
  await expect(page).toHaveURL(/\/workspace\/chats\/new$/);
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
  mockLangGraphAPI(page);
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
  await expect(page).toHaveURL(/\/workspace\/chats\/new$/);
  expect(request?.headers()["x-csrf-token"]).toBe("m7-csrf-token");
  expect(request?.postDataJSON()).toEqual({
    current_password: "temporary-password",
    new_password: "new-password-123",
    new_email: "admin@example.com",
    remember_me: true,
  });
});

test("workspace sends only an explicit 401 to login", async ({ page }) => {
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 401, json: { detail: "Unauthorized" } }),
  );
  await mockLoginShell(page);
  await page.goto("/workspace/scheduled-tasks");
  await expect(page).toHaveURL(
    /\/login\?redirect=\/workspace\/scheduled-tasks$/,
  );
});

test("workspace keeps Gateway unavailability visible and recovers in place", async ({
  page,
}) => {
  mockLangGraphAPI(page);
  let unavailable = true;
  await page.route("**/api/v1/auth/me", (route) =>
    unavailable
      ? route.fulfill({ status: 503, json: { detail: "Unavailable" } })
      : route.fulfill({ json: USER }),
  );
  await page.goto("/workspace");
  await expect(page).toHaveURL(/\/workspace\/chats\/new$/);
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: /Gateway is temporarily unavailable/i }),
  ).toBeVisible();

  unavailable = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: /Gateway is temporarily unavailable/i }),
  ).toBeHidden();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: /Gateway connection restored/i }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/workspace\/chats\/new$/);
});

test("workspace sends an authenticated setup user to setup and admits a ready user", async ({
  page,
}) => {
  mockLangGraphAPI(page);
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
  await expect(page).toHaveURL(/\/workspace\/chats\/new$/);
});

test("OIDC callback validates the session and safe next path", async ({
  page,
}) => {
  mockLangGraphAPI(page);
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ json: USER }),
  );

  await page.goto(
    "/auth/callback?next=%2Fworkspace%2Fchats%2Fnew%3Fview%3Dcompact",
  );
  await expect(page.getByText("Redirecting...", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/workspace\/chats\/new\?view=compact$/);

  await page.goto("/auth/callback?next=https%3A%2F%2Fevil.example%2Fphish");
  await expect(page).toHaveURL(/\/workspace\/chats\/new$/);
});

test("OIDC callback keeps 401 and Gateway failure distinct", async ({
  page,
}) => {
  await mockLoginShell(page);
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 401, json: { detail: "Unauthorized" } }),
  );
  await page.goto("/auth/callback?next=%2Fworkspace%2Fchats%2Fnew");
  await expect(
    page.getByText(/Authentication failed\. Redirecting to login/i),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login\?error=sso_failed$/);

  await page.unroute("**/api/v1/auth/me");
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 503, json: { detail: "Unavailable" } }),
  );
  await page.goto("/auth/callback?next=%2Fworkspace%2Fchats%2Fnew");
  await expect(
    page.getByText(/Gateway is temporarily unavailable/i),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login\?error=gateway_unavailable/);
  const recoveryUrl = new URL(page.url());
  expect(recoveryUrl.searchParams.get("error")).toBe("gateway_unavailable");
  expect(recoveryUrl.searchParams.get("next")).toBe("/workspace/chats/new");
});
