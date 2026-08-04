/*
  【文件职责】     运行需要外部前提的 M0 Gate（G0-6 WebSocket、G0-7 OIDC）。
  【对应 frontend/】 frontend/playwright.real-backend.config.ts
  【架构位置】     测试
  【主要导出】     Playwright M0 external-gates config
  【依赖关系】     启动开启 browser control 的 replay Gateway 与 Nuxt preview
  【边界与注意】   与 playwright.m0-real-backend.config.ts 分开，因为启用
                   browser_navigate 会改变 lead-agent 工具集和系统提示词，
                   进而打破 run-protocol 使用的 replay fixture hash。
*/

import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3101";

export default defineConfig({
  testDir: "./tests/m0-real-backend",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 90_000,
  outputDir: "test-results/external",
  use: {
    baseURL,
    locale: "en-US",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium-external", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      command:
        "../backend/.venv/bin/python tests/support/run_m0_gateway.py --port 8011 --cors http://localhost:3101 --queue-maxsize 32 --browser",
      url: "http://127.0.0.1:8011/health",
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command:
        "DEER_FLOW_INTERNAL_GATEWAY_BASE_URL=http://127.0.0.1:8011 NUXT_PUBLIC_AUTH_DISABLED=1 NUXT_PUBLIC_M0_TEST_PAGES=1 ./node_modules/.bin/nuxt build && PORT=3101 HOST=127.0.0.1 NUXT_PUBLIC_AUTH_DISABLED=1 NUXT_PUBLIC_M0_TEST_PAGES=1 ./node_modules/.bin/nuxt preview",
      url: baseURL,
      reuseExistingServer: false,
      timeout: 240_000,
    },
  ],
});
