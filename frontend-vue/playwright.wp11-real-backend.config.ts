/*
  【文件职责】     启动真实 FastAPI/Auth/thread/event-store/Nuxt/Chromium 的 WP-11 gate。
  【对应 frontend/】 无；React shell e2e 不覆盖 Vue 的完整真实 Gateway 链
  【架构位置】     WP-11 real-backend Playwright config
  【主要导出】     Playwright config
  【依赖关系】     run_replay_gateway.py · seed_runs_router.py · tests/wp11-real-backend
  【边界与注意】   seed 只写隔离 Gateway 自己的 store；Auth/owner check/路由/查询过滤均为生产实现。
*/

import { defineConfig, devices } from "@playwright/test";

const frontendPort = process.env.E2E_WP11_FRONTEND_PORT ?? "3114";
const gatewayPort = process.env.E2E_WP11_GATEWAY_PORT ?? "8018";
const baseURL = `http://localhost:${frontendPort}`;

export default defineConfig({
  testDir: "tests/wp11-real-backend",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 120_000,
  outputDir: "test-results/wp11-real-backend",
  use: {
    baseURL,
    locale: "en-US",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium-wp11-real", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      command: `uv run python scripts/run_replay_gateway.py --port ${gatewayPort} --cors ${baseURL}`,
      cwd: "../backend",
      url: `http://127.0.0.1:${gatewayPort}/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        DEERFLOW_ENABLE_TEST_SEED: "1",
      },
    },
    {
      command: `DEER_FLOW_INTERNAL_GATEWAY_BASE_URL=http://127.0.0.1:${gatewayPort} NUXT_PUBLIC_AUTH_DISABLED=0 ./node_modules/.bin/nuxt build && PORT=${frontendPort} HOST=127.0.0.1 NUXT_PUBLIC_AUTH_DISABLED=0 ./node_modules/.bin/nuxt preview`,
      url: baseURL,
      reuseExistingServer: false,
      timeout: 240_000,
    },
  ],
});
