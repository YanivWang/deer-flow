/*
  【文件职责】     精确运行 M4b 通用 Agent UI 的 11 个共享 React 合同。
  【对应 frontend/】 frontend/playwright.config.ts
  【架构位置】     测试
  【主要导出】     Playwright M4b config
  【依赖关系】     tests/m4b-inventory.json · frontend/tests/e2e
  【边界与注意】   文件清单不靠标题 grep；执行前由 m4b-inventory.mjs 校验 11/66。
*/

import { readFileSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

type Inventory = {
  specFiles: string[];
};

const inventory = JSON.parse(
  readFileSync(new URL("./tests/m4b-inventory.json", import.meta.url), "utf8"),
) as Inventory;
const port = process.env.E2E_M4B_PORT ?? "3102";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;
// The shared global setup reads PLAYWRIGHT_BASE_URL directly. Keep its warm-up
// target identical to this config's web server when callers only set the
// dedicated M4b port.
process.env.PLAYWRIGHT_BASE_URL ??= baseURL;

export default defineConfig({
  testDir: "../frontend/tests/e2e",
  testMatch: inventory.specFiles.map((file) => `**/${file}`),
  globalSetup: "./tests/global-setup.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,
  outputDir: "test-results/m4b",
  use: {
    baseURL,
    locale: "en-US",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium-m4b", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `NUXT_PUBLIC_AUTH_DISABLED=1 NUXT_PUBLIC_M0_TEST_PAGES=0 ./node_modules/.bin/nuxt build && PORT=${port} HOST=127.0.0.1 NUXT_PUBLIC_AUTH_DISABLED=1 ./node_modules/.bin/nuxt preview`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
