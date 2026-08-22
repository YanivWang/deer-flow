/*
  【文件职责】     启动真实 FastAPI Gateway、SQLite、Nuxt production preview 与 Chromium 的 WP-07 gate。
  【对应 frontend/】 无；React scheduled-task suite 只有 browser-route mock
  【架构位置】     WP-07 real-backend Playwright config
  【主要导出】     Playwright config
  【依赖关系】     backend/scripts/run_replay_gateway.py · Nuxt preview · tests/wp07-real-backend
  【边界与注意】   API/DB/auth/run lifecycle 真实；模型响应来自签入 replay fixture，不代表真实 provider 证明。
*/
import { defineConfig, devices } from "@playwright/test";

const frontendPort = process.env.E2E_WP07_FRONTEND_PORT ?? "3110";
const gatewayPort = process.env.E2E_WP07_GATEWAY_PORT ?? "8013";
const baseURL = `http://localhost:${frontendPort}`;

export default defineConfig({
  testDir: "tests/wp07-real-backend",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 90_000,
  outputDir: "test-results/wp07-real-backend",
  use: {
    baseURL,
    locale: "en-US",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium-wp07-real", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      command: `uv run python scripts/run_replay_gateway.py --port ${gatewayPort} --cors ${baseURL}`,
      cwd: "../backend",
      url: `http://127.0.0.1:${gatewayPort}/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
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
