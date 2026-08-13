/* M5 real-Gateway contract: durable run handle, SSE tool call and artifact draft. */
import { defineConfig, devices } from "@playwright/test";

const frontendPort = process.env.E2E_FRONTEND_PORT ?? "3101";
const gatewayPort = process.env.E2E_GATEWAY_PORT ?? "8011";
const baseURL = `http://localhost:${frontendPort}`;

export default defineConfig({
  testDir: "tests/m5-real-backend",
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 90_000,
  outputDir: "test-results/m5-real-backend",
  use: {
    baseURL,
    locale: "en-US",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium-m5-real", use: { ...devices["Desktop Chrome"] } },
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
