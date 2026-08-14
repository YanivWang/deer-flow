/*
  【文件职责】     运行发送、流式、停止与重载顺序的数据流 gate。
  【对应 frontend/】 无；Vue 协议专属
  【架构位置】     测试
  【主要导出】     Playwright M4a config
  【依赖关系】     tests/m4a/**，生产 Nuxt preview
  【边界与注意】   这里不直接跑共享合同的 `chat` / `chat-thread-init-ordering` /
                   `thread-history`，原因有两点：

                   1. 共享 mock（`frontend/tests/e2e/utils/mock-api.ts`）的
                      `/runs/stream` 响应**不带 `Content-Location`**——上游 SDK 从
                      `metadata` 事件里取 run/thread id，不读这个头。而当前 protocol
                      按 `BEHAVIOR_CONTRACTS.md` L12 只认 `Content-Location`
                      且**读不到就 fail closed**。为迁就 mock 去放宽那条，
                      等于用测试替身推翻一条已验证的协议裁决。
                   2. 那三个 spec 的 45 个用例里，绝大多数断言的是 composer、
                      侧栏、草稿、技能补全、虚拟列表，不属于本配置的数据流职责。

                   本 config 跑的是**同一条不变式的等价用例**，mock 写在
                   `tests/m4a/` 自己这边并带上 `Content-Location`。
                   共享合同由完整 Vue 产品 gate 统一运行。
*/

import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3103";

export default defineConfig({
  testDir: "./tests/m4a",
  globalSetup: "./tests/global-setup.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 45_000,
  outputDir: "test-results/m4a",
  use: {
    baseURL,
    locale: "en-US",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium-m4a", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command:
      "NUXT_PUBLIC_AUTH_DISABLED=1 ./node_modules/.bin/nuxt build && PORT=3103 HOST=127.0.0.1 NUXT_PUBLIC_AUTH_DISABLED=1 ./node_modules/.bin/nuxt preview",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
