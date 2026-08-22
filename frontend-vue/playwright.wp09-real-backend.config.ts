/*
  【文件职责】     启动真实 FastAPI/Auth/SQLite/LangGraph/setup_agent/Nuxt/Chromium 与受控 LLM 的 WP-09 gate。
  【对应 frontend/】 无；React Agent e2e 不覆盖真实 Gateway 创建与设置持久化
  【架构位置】     WP-09 real-backend Playwright config
  【主要导出】     Playwright config
  【依赖关系】     run_replay_gateway.py · agent_e2e_fixture.py · tests/wp09-real-backend
  【边界与注意】   Gateway/Auth/DB/HTTP/tool/UI 真实；只有外部模型生成由测试 fixture 控制。
*/
import { defineConfig, devices } from "@playwright/test";

const frontendPort = process.env.E2E_WP09_FRONTEND_PORT ?? "3112";
const gatewayPort = process.env.E2E_WP09_GATEWAY_PORT ?? "8015";
const baseURL = `http://localhost:${frontendPort}`;

export default defineConfig({
  testDir: "tests/wp09-real-backend",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 120_000,
  outputDir: "test-results/wp09-real-backend",
  use: {
    baseURL,
    locale: "en-US",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium-wp09-real", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      command: `uv run python scripts/run_replay_gateway.py --port ${gatewayPort} --cors ${baseURL}`,
      cwd: "../backend",
      url: `http://127.0.0.1:${gatewayPort}/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: { DEERFLOW_ENABLE_AGENT_TEST_MODEL: "1" },
    },
    {
      command: `DEER_FLOW_INTERNAL_GATEWAY_BASE_URL=http://127.0.0.1:${gatewayPort} NUXT_PUBLIC_AUTH_DISABLED=0 ./node_modules/.bin/nuxt build && PORT=${frontendPort} HOST=127.0.0.1 NUXT_PUBLIC_AUTH_DISABLED=0 ./node_modules/.bin/nuxt preview`,
      url: baseURL,
      reuseExistingServer: false,
      timeout: 240_000,
    },
  ],
});
