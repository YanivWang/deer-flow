/*
  【文件职责】     用 Nuxt preview 收集并运行仓库共享的完整 real-backend 合同。
  【对应 frontend/】 frontend/playwright.real-backend.config.ts
  【架构位置】     测试
  【主要导出】     Playwright full real-backend config
  【依赖关系】     启动 backend replay Gateway 与 Nuxt preview；复用 React specs
  【边界与注意】   M0 只保证 collection；业务断言随 M1-M7 逐步通过。
*/

import { defineConfig, devices } from "@playwright/test";

const frontendPort = process.env.E2E_FRONTEND_PORT ?? "3101";
const gatewayPort = process.env.E2E_GATEWAY_PORT ?? "8011";
const baseURL = `http://localhost:${frontendPort}`;

export default defineConfig({
  testDir: "../frontend/tests/e2e-real-backend",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 90_000,
  outputDir: "test-results/full-real-backend",
  use: {
    baseURL,
    locale: "en-US",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `uv run python scripts/run_replay_gateway.py --port ${gatewayPort} --cors ${baseURL}`,
      cwd: "../backend",
      url: `http://127.0.0.1:${gatewayPort}/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        DEERFLOW_ENABLE_TEST_SEED: "1",
        DEER_FLOW_AUTH_DISABLED: "1",
      },
    },
    {
      command: `DEER_FLOW_INTERNAL_GATEWAY_BASE_URL=http://127.0.0.1:${gatewayPort} NUXT_PUBLIC_AUTH_DISABLED=1 ./node_modules/.bin/nuxt build && PORT=${frontendPort} HOST=127.0.0.1 NUXT_PUBLIC_AUTH_DISABLED=1 ./node_modules/.bin/nuxt preview`,
      url: baseURL,
      reuseExistingServer: false,
      timeout: 240_000,
    },
  ],
});
