/*
  【文件职责】     启动真实 FastAPI/Auth/SQLite/Nuxt/Chromium 与受控外部 channel fixture 的 WP-08 gate。
  【对应 frontend/】 无；React channels e2e 仅 browser-route mock
  【架构位置】     WP-08 real-backend Playwright config
  【主要导出】     Playwright config
  【依赖关系】     run_replay_gateway.py · channel_e2e_fixture.py · tests/wp08-real-backend
  【边界与注意】   Gateway/Auth/DB/HTTP/UI 真实；Slack/Telegram 网络 worker 与回调由测试 fixture 控制。
*/
import { defineConfig, devices } from "@playwright/test";

const frontendPort = process.env.E2E_WP08_FRONTEND_PORT ?? "3111";
const gatewayPort = process.env.E2E_WP08_GATEWAY_PORT ?? "8014";
const baseURL = `http://localhost:${frontendPort}`;

export default defineConfig({
  testDir: "tests/wp08-real-backend",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 90_000,
  outputDir: "test-results/wp08-real-backend",
  use: {
    baseURL,
    locale: "en-US",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium-wp08-real", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      command: `uv run python scripts/run_replay_gateway.py --port ${gatewayPort} --cors ${baseURL}`,
      cwd: "../backend",
      url: `http://127.0.0.1:${gatewayPort}/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        DEERFLOW_ENABLE_CHANNEL_TEST_SEED: "1",
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
