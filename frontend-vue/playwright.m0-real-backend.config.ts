/*
  【文件职责】     运行 Nuxt preview 对仓库 replay Gateway 的 M0 网络合同。
  【对应 frontend/】 frontend/playwright.real-backend.config.ts
  【架构位置】     测试
  【主要导出】     Playwright M0 real-backend config
  【依赖关系】     启动 backend replay Gateway 与 Nuxt preview
  【边界与注意】   不需要外部 LLM；保持 Gateway 认证开启以验证 Cookie/CSRF。
*/

import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3101";

export default defineConfig({
  testDir: "./tests/m0-real-backend",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 90_000,
  outputDir: "test-results/real-backend",
  use: {
    baseURL,
    locale: "en-US",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium-real-backend", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      // queue-maxsize sits between the live burst and the scenario's published
      // event count, so the create stream is never gapped while a resume from
      // the first cursor always is.
      //
      // M2 raised this from 32 to 128 when `checkpoints` and `tasks` joined the
      // recorded stream_mode (08 §402 names both in the raw-trace coverage list).
      // The run went from 74 to 226 events and the live burst outgrew a window of
      // 32 — the run-protocol spec reports exactly which side of the window broke,
      // so re-tune from its message rather than guessing. Measured: 32 gaps the
      // create stream; 128 passes; with `debug` added the run reaches 378 events
      // and 384 stops evicting the first cursor. `debug` is deliberately not
      // recorded — 08 §402 does not ask for it, and it alone doubled the fixture.
      command:
        "../backend/.venv/bin/python tests/support/run_m0_gateway.py --port 8011 --cors http://localhost:3101 --queue-maxsize 128",
      url: "http://127.0.0.1:8011/health",
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command:
        "DEER_FLOW_INTERNAL_GATEWAY_BASE_URL=http://127.0.0.1:8011 NUXT_PUBLIC_AUTH_DISABLED=1 NUXT_PUBLIC_M0_TEST_PAGES=1 ./node_modules/.bin/nuxt build && PORT=3101 HOST=127.0.0.1 NUXT_PUBLIC_AUTH_DISABLED=1 NUXT_PUBLIC_M0_TEST_PAGES=1 ./node_modules/.bin/nuxt preview",
      url: baseURL,
      reuseExistingServer: false,
      timeout: 240_000,
    },
  ],
});
