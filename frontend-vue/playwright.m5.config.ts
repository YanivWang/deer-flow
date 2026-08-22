/*
  【文件职责】     精确运行 M5 artifacts/sidecar/changes 的共享 React 合同。
  【对应 frontend/】 frontend/playwright.config.ts
  【架构位置】     测试
  【主要导出】     Playwright M5 config
  【边界与注意】   inventory 固定 6 files / 29 tests；不包含 M6+ spec。
*/

import { readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const inventory = JSON.parse(
  readFileSync(new URL("./tests/m5-inventory.json", import.meta.url), "utf8"),
) as { specFiles: string[] };
const port = process.env.E2E_M5_PORT ?? "3105";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;
process.env.PLAYWRIGHT_BASE_URL ??= baseURL;

export default defineConfig({
  testDir: "..",
  testMatch: inventory.specFiles.map((file) => `**/${file}`),
  globalSetup: "./tests/global-setup.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,
  outputDir: "test-results/m5",
  use: {
    baseURL,
    locale: "en-US",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium-m5", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `NUXT_PUBLIC_AUTH_DISABLED=1 NUXT_PUBLIC_M0_TEST_PAGES=0 ./node_modules/.bin/nuxt build && PORT=${port} HOST=127.0.0.1 NUXT_PUBLIC_AUTH_DISABLED=1 ./node_modules/.bin/nuxt preview`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
