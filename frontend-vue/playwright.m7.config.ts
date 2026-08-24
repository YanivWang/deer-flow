/*
  【文件职责】     精确运行 Vue M7 产品合同；只复用框架无关的共享 spec。
  【对应 frontend/】 frontend/playwright.config.ts
  【架构位置】     测试
  【主要导出】     Playwright M7 config
  【依赖关系】     tests/m7-inventory.json；Vue 自有与共享业务 spec
  【边界与注意】   Vue/React 实现差异必须使用 Vue spec，不能在产品代码加 DOM/时序垫片。
*/

import { readFileSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

const inventory = JSON.parse(
  readFileSync(new URL("./tests/m7-inventory.json", import.meta.url), "utf8"),
) as { specFiles: string[] };
const port = process.env.E2E_M7_PORT ?? "3101";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEB_SERVER === "1";
process.env.PLAYWRIGHT_BASE_URL ??= baseURL;

export default defineConfig({
  testDir: "..",
  testMatch: inventory.specFiles.map((file) => `**/${file}`),
  globalSetup: "./tests/global-setup.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,
  outputDir: "test-results/contracts",
  use: {
    baseURL,
    locale: "en-US",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium-m7", use: { ...devices["Desktop Chrome"] } }],
  webServer: skipWebServer
    ? undefined
    : {
        command: `NUXT_PUBLIC_AUTH_DISABLED=1 NUXT_PUBLIC_M0_TEST_PAGES=0 ./node_modules/.bin/nuxt build && PORT=${port} HOST=127.0.0.1 NUXT_PUBLIC_AUTH_DISABLED=1 ./node_modules/.bin/nuxt preview`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 240_000,
      },
});
