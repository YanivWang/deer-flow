/*
  【文件职责】     在 auth-enabled M7 环境固定 Settings 的 admin/user/401/403 浏览器权限边界。
  【对应 frontend/】 AuthProvider 与 settings pages
  【架构位置】     WP-10 M7 auth Playwright contract
  【主要导出】     Playwright scenarios
  【依赖关系】     real Vue auth/session query · mocked HTTP roles
  【边界与注意】   user role 不得触发 admin-only MCP I/O；401 仍只由共享 fetch boundary 跳登录。
*/

import { expect, test } from "@playwright/test";

import { mockLangGraphAPI } from "../../../frontend/tests/e2e/utils/mock-api";

const skill = {
  name: "review",
  description: "Review",
  category: "public",
  license: null,
  enabled: true,
  editable: false,
};

test("ordinary user reads skills but sends no skill write or MCP request", async ({
  page,
}) => {
  mockLangGraphAPI(page, { skills: [skill] });
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      json: {
        id: "ordinary",
        email: "ordinary@example.com",
        system_role: "user",
        needs_setup: false,
        oauth_provider: null,
      },
    }),
  );
  let skillWrites = 0;
  let mcpRequests = 0;
  await page.route(/\/api\/skills\/review$/, (route) => {
    skillWrites += 1;
    return route.fulfill({
      status: 403,
      json: { detail: "Admin privileges required to manage skills." },
    });
  });
  await page.route(/\/api\/mcp\/config$/, (route) => {
    mcpRequests += 1;
    return route.fulfill({ json: { mcp_servers: {} } });
  });

  await page.goto("/workspace/chats/new?settings=skills");
  await expect(page.getByText("review", { exact: true })).toBeVisible();
  await expect(page.getByTestId("skills-admin-required")).toBeVisible();
  await expect(page.getByRole("switch", { name: "review" })).toBeDisabled();
  await page.getByRole("button", { name: "Tools", exact: true }).click();
  await expect(page.getByTestId("mcp-admin-required")).toBeVisible();
  expect(skillWrites).toBe(0);
  expect(mcpRequests).toBe(0);
});

test("stale admin session maps real 403 to admin-required instead of a generic failure", async ({
  page,
}) => {
  mockLangGraphAPI(page, { skills: [skill] });
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      json: {
        id: "admin",
        email: "admin@example.com",
        system_role: "admin",
        needs_setup: false,
        oauth_provider: null,
      },
    }),
  );
  await page.route(/\/api\/mcp\/config$/, (route) =>
    route.fulfill({
      status: 403,
      json: {
        detail: "Admin privileges required to manage MCP configuration.",
      },
    }),
  );

  await page.goto("/workspace/chats/new?settings=tools");
  await expect(page.getByTestId("mcp-admin-required")).toBeVisible();
  await expect(page.getByText("Failed to load MCP configuration")).toHaveCount(
    0,
  );
});

test("settings mutation 401 uses the shared login boundary", async ({
  page,
}) => {
  mockLangGraphAPI(page, { skills: [skill] });
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      json: {
        id: "admin",
        email: "admin@example.com",
        system_role: "admin",
        needs_setup: false,
        oauth_provider: null,
      },
    }),
  );
  await page.route(/\/api\/skills\/review$/, (route) =>
    route.fulfill({ status: 401, json: { detail: "Unauthorized" } }),
  );

  await page.goto("/workspace/chats/new?settings=skills");
  await page.getByRole("switch", { name: "review" }).click();
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === "/login" &&
      url.searchParams.get("next") === "/workspace/chats/new",
  );
});
