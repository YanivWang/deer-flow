/*
  【文件职责】     运行不依赖 M1+ 业务页面的 M0 基础设施合同。
  【对应 frontend/】 无；M0 专属
  【架构位置】     测试
  【主要导出】     Playwright M0 config
  【依赖关系】     启动 proxy probe 与 production Nuxt preview
  【边界与注意】   probe 只证明代理；真实 Gateway 合同由 real-backend config 验证。
*/

import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3101";

export default defineConfig({
  testDir: "./tests/m0",
  globalSetup: "./tests/global-setup.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,
  outputDir: "test-results/m0",
  use: {
    baseURL,
    locale: "en-US",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium-m0", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node tests/support/proxy-probe.mjs",
      url: "http://127.0.0.1:8012/health",
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command:
        "DEER_FLOW_INTERNAL_GATEWAY_BASE_URL=http://127.0.0.1:8012 NUXT_PUBLIC_AUTH_DISABLED=1 NUXT_PUBLIC_M0_TEST_PAGES=1 ./node_modules/.bin/nuxt build && PORT=3101 HOST=127.0.0.1 NUXT_PUBLIC_AUTH_DISABLED=1 NUXT_PUBLIC_M0_TEST_PAGES=1 ./node_modules/.bin/nuxt preview",
      url: baseURL,
      reuseExistingServer: false,
      timeout: 240_000,
    },
  ],
});
