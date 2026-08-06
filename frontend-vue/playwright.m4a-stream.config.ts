/*
  【文件职责】     运行 M4a 的**真流** gate（分块到达 / 心跳 / 续传 / gap）。
  【对应 frontend/】 无；M4a 专属
  【架构位置】     测试
  【主要导出】     Playwright config
  【依赖关系】     tests/support/stream-gateway.mjs（8014）+ 生产 Nuxt preview
  【边界与注意】   与 `playwright.m4a.config.ts` 的分工写在
                   `tests/m4a-stream/real-stream.spec.ts` 的文件头。

                   preview 的 `DEER_FLOW_INTERNAL_GATEWAY_BASE_URL` 指向假 Gateway，
                   于是流**真的经过 Nitro 代理**——这一段（`config/routes.ts` 的
                   `sendStream`/`streamRequest`）在 M0 只被 proxy-probe 的合成 SSE
                   验过，没有被真实业务流走过。走一遍是本 config 的附带收益。
*/

import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3104";

export default defineConfig({
  testDir: "./tests/m4a-stream",
  globalSetup: "./tests/global-setup.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 45_000,
  outputDir: "test-results/m4a-stream",
  use: {
    baseURL,
    locale: "en-US",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium-m4a-stream", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      command: "node tests/support/stream-gateway.mjs",
      url: "http://127.0.0.1:8014/health",
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command:
        "DEER_FLOW_INTERNAL_GATEWAY_BASE_URL=http://127.0.0.1:8014 NUXT_PUBLIC_AUTH_DISABLED=1 ./node_modules/.bin/nuxt build && PORT=3104 HOST=127.0.0.1 DEER_FLOW_INTERNAL_GATEWAY_BASE_URL=http://127.0.0.1:8014 NUXT_PUBLIC_AUTH_DISABLED=1 ./node_modules/.bin/nuxt preview",
      url: baseURL,
      reuseExistingServer: false,
      timeout: 300_000,
    },
  ],
});
