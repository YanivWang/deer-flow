/*
  【文件职责】     保留完整共享认证 UI 合同的独立 collection/执行入口。
  【对应 frontend/】 frontend/playwright.auth.config.ts
  【架构位置】     测试
  【主要导出】     Playwright auth config
  【依赖关系】     复用 frontend/tests/e2e-auth
  【边界与注意】   M0 只跑 auth-cookie-smoke；完整 e2e-auth 到 M7 执行通过。
*/

import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_AUTH_BASE_URL ?? "http://localhost:3101";

export default defineConfig({
  testDir: "../frontend/tests/e2e-auth",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "html",
  timeout: 30_000,
  outputDir: "test-results/auth-contract",
  use: {
    baseURL,
    locale: "en-US",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium-auth", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command:
      "NUXT_PUBLIC_AUTH_DISABLED=0 ./node_modules/.bin/nuxt build && PORT=3101 HOST=127.0.0.1 NUXT_PUBLIC_AUTH_DISABLED=0 ./node_modules/.bin/nuxt preview",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
