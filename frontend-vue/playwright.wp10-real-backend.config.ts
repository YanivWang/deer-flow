/*
  【文件职责】     启动真实 FastAPI/Auth/CSRF/DeerMem/Noop/Skills/MCP/Nuxt/Chromium 的 WP-10 gate。
  【对应 frontend/】 无；React settings e2e 不覆盖完整真实 Gateway 持久化链
  【架构位置】     WP-10 real-backend Playwright config
  【主要导出】     Playwright config
  【依赖关系】     run_replay_gateway.py · settings_e2e_fixture.py · tests/wp10-real-backend
  【边界与注意】   只 seed operator-owned 文件并暴露隔离 home marker；两个 Gateway 均使用 production router/manager/Auth/CSRF。
*/

import { resolve } from "node:path";

import { defineConfig, devices } from "@playwright/test";

const frontendPort = process.env.E2E_WP10_FRONTEND_PORT ?? "3113";
const gatewayPort = process.env.E2E_WP10_GATEWAY_PORT ?? "8016";
const unsupportedGatewayPort =
  process.env.E2E_WP10_UNSUPPORTED_GATEWAY_PORT ?? "8017";
const baseURL = `http://localhost:${frontendPort}`;
const settingsHomeMarker = resolve(
  `test-results/wp10-real-backend-${gatewayPort}-home.txt`,
);

export default defineConfig({
  testDir: "tests/wp10-real-backend",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 120_000,
  outputDir: "test-results/wp10-real-backend",
  use: {
    baseURL,
    locale: "en-US",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium-wp10-real", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      command: `uv run python scripts/run_replay_gateway.py --port ${gatewayPort} --cors ${baseURL}`,
      cwd: "../backend",
      url: `http://127.0.0.1:${gatewayPort}/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        DEERFLOW_ENABLE_SETTINGS_TEST_SEED: "1",
        DEERFLOW_SETTINGS_TEST_MEMORY_BACKEND: "deermem",
        DEERFLOW_SETTINGS_TEST_HOME_MARKER: settingsHomeMarker,
      },
    },
    {
      command: `uv run python scripts/run_replay_gateway.py --port ${unsupportedGatewayPort} --cors ${baseURL}`,
      cwd: "../backend",
      url: `http://127.0.0.1:${unsupportedGatewayPort}/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        DEERFLOW_ENABLE_SETTINGS_TEST_SEED: "1",
        DEERFLOW_SETTINGS_TEST_MEMORY_BACKEND: "noop",
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
