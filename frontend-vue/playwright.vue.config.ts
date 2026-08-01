import { defineConfig, devices } from "@playwright/test";

const webServerHost = process.env.PLAYWRIGHT_WEB_SERVER_HOST ?? "127.0.0.1";
const webServerPort = process.env.PLAYWRIGHT_WEB_SERVER_PORT ?? "3001";
const webServerUrl = `http://${webServerHost}:${webServerPort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? webServerUrl,
    ...devices["Desktop Chrome"],
  },
  webServer:
    process.env.PLAYWRIGHT_SKIP_WEB_SERVER === "1"
      ? undefined
      : {
          command: "node scripts/e2e-nuxt-dev-server.mjs",
          url: webServerUrl,
          reuseExistingServer: true,
          timeout: 120_000,
        },
});
