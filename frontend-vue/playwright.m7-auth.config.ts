import { readFileSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

const inventory = JSON.parse(
  readFileSync(
    new URL("./tests/m7-auth-inventory.json", import.meta.url),
    "utf8",
  ),
) as { specFiles: string[] };
const port = process.env.E2E_M7_AUTH_PORT ?? "3108";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;
process.env.PLAYWRIGHT_BASE_URL ??= baseURL;

export default defineConfig({
  testDir: "..",
  testMatch: inventory.specFiles.map((file) => `**/${file}`),
  globalSetup: "./tests/global-setup.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,
  outputDir: "test-results/m7-auth",
  use: {
    baseURL,
    locale: "en-US",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium-m7-auth", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `NUXT_PUBLIC_AUTH_DISABLED=0 NUXT_PUBLIC_M0_TEST_PAGES=0 ./node_modules/.bin/nuxt build && PORT=${port} HOST=127.0.0.1 NUXT_PUBLIC_AUTH_DISABLED=0 ./node_modules/.bin/nuxt preview`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
