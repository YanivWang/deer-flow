import { defineConfig, devices } from "@playwright/test";

const port = process.env.E2E_M7_VISUAL_PORT ?? "3109";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "./tests/m7-visual",
  globalSetup: "./tests/global-setup.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 45_000,
  outputDir: "test-results/m7-visual",
  use: {
    baseURL,
    locale: "en-US",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium-m7-visual", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `NUXT_PUBLIC_AUTH_DISABLED=1 NUXT_PUBLIC_M0_TEST_PAGES=0 ./node_modules/.bin/nuxt build && PORT=${port} HOST=127.0.0.1 NUXT_PUBLIC_AUTH_DISABLED=1 ./node_modules/.bin/nuxt preview`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
