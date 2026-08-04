/*
  【文件职责】     在真实浏览器中验证 auth-disabled workspace 路由。
  【对应 frontend/】 frontend/playwright.config.ts
  【架构位置】     测试
  【主要导出】     @auth-disabled case
  【依赖关系】     使用 Nuxt preview
  【边界与注意】   不替代真实 Cookie/CSRF gate。
*/

import { expect, test } from "@playwright/test";

test("@auth-disabled opens the workspace shell without redirecting", async ({
  page,
}) => {
  await page.goto("/workspace");
  await expect(page.locator("[data-m0-workspace]")).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/workspace");
});
