import { defineConfig, devices } from "@playwright/test";

const frontendPort = process.env.E2E_FRONTEND_PORT ?? "3001";
const gatewayPort = process.env.E2E_GATEWAY_PORT ?? "8011";
const frontendUrl = `http://127.0.0.1:${frontendPort}`;
const gatewayUrl = `http://127.0.0.1:${gatewayPort}`;

export default defineConfig({
  testDir: "./tests/e2e-real-backend",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "html",
  timeout: 90_000,
  use: {
    baseURL: frontendUrl,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `uv run python scripts/run_replay_gateway.py --port ${gatewayPort} --cors ${frontendUrl}`,
      cwd: "../backend",
      url: `${gatewayUrl}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        DEERFLOW_ENABLE_TEST_SEED: "1",
        DEER_FLOW_AUTH_DISABLED: "1",
      },
    },
    {
      command: `NUXT_GATEWAY_URL=${gatewayUrl} pnpm build && NITRO_HOST=127.0.0.1 NITRO_PORT=${frontendPort} node .output/server/index.mjs`,
      url: frontendUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
      env: {
        NUXT_GATEWAY_URL: gatewayUrl,
        NITRO_HOST: "127.0.0.1",
        NITRO_PORT: frontendPort,
      },
    },
  ],
});
