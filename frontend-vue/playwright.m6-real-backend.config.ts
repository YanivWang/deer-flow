import { defineConfig, devices } from "@playwright/test";

const frontendPort = process.env.E2E_FRONTEND_PORT ?? "3101";
const gatewayPort = process.env.E2E_GATEWAY_PORT ?? "8011";
const baseURL = `http://localhost:${frontendPort}`;
const gatewayURL = `http://localhost:${gatewayPort}`;

export default defineConfig({
  testDir: "tests/m6-real-backend",
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 90_000,
  outputDir: "test-results/m6-real-backend",
  use: {
    baseURL,
    locale: "en-US",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium-m6-real", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      command: `../backend/.venv/bin/python tests/support/run_m0_gateway.py --port ${gatewayPort} --cors ${baseURL} --browser`,
      url: `http://127.0.0.1:${gatewayPort}/health`,
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: `DEER_FLOW_INTERNAL_GATEWAY_BASE_URL=http://127.0.0.1:${gatewayPort} NUXT_PUBLIC_BACKEND_BASE_URL=${gatewayURL} NUXT_PUBLIC_AUTH_DISABLED=1 ./node_modules/.bin/nuxt build && PORT=${frontendPort} HOST=127.0.0.1 NUXT_PUBLIC_BACKEND_BASE_URL=${gatewayURL} NUXT_PUBLIC_AUTH_DISABLED=1 ./node_modules/.bin/nuxt preview`,
      url: baseURL,
      reuseExistingServer: false,
      timeout: 240_000,
    },
  ],
});
