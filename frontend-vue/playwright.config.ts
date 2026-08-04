/*
  【文件职责】     收集并最终运行 React 共享业务合同。
  【对应 frontend/】 frontend/playwright.config.ts
  【架构位置】     测试
  【主要导出】     Playwright config
  【依赖关系】     testDir 指向只读 frontend/tests/e2e
  【边界与注意】   M0 只要求 e2e-list；完整 e2e 保留给业务里程碑。
*/

import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3101";

export default defineConfig({
  testDir: "../frontend/tests/e2e",
  testIgnore: ["**/landing.spec.ts", "**/docs-localized-links.spec.ts"],
  globalSetup: "./tests/global-setup.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "html",
  timeout: 30_000,
  outputDir: "test-results/contracts",
  use: {
    baseURL,
    locale: "en-US",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command:
      "NUXT_PUBLIC_AUTH_DISABLED=1 NUXT_PUBLIC_M0_TEST_PAGES=0 ./node_modules/.bin/nuxt build && PORT=3101 HOST=127.0.0.1 NUXT_PUBLIC_AUTH_DISABLED=1 ./node_modules/.bin/nuxt preview",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
