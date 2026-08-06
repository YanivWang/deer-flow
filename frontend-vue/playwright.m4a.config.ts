/*
  【文件职责】     运行 M4a 的数据流 gate（06 §M4a Gate）。
  【对应 frontend/】 无；M4a 专属
  【架构位置】     测试
  【主要导出】     Playwright M4a config
  【依赖关系】     tests/m4a/**，生产 Nuxt preview
  【边界与注意】   ⚠️ **为什么不是直接跑共享合同的那三个 spec**（06 原文点名
                   `chat` / `chat-thread-init-ordering` / `thread-history`）：
                   接线时实测到两条硬阻断，都记在 evidence/m4a-dataflow.md §红项：

                   1. 共享 mock（`frontend/tests/e2e/utils/mock-api.ts`）的
                      `/runs/stream` 响应**不带 `Content-Location`**——上游 SDK 从
                      `metadata` 事件里取 run/thread id，不读这个头。而 05 L12 +
                      08 硬规则 2 要求本仓的 protocol 只认 `Content-Location`
                      且**读不到就 fail closed**。为迁就 mock 去放宽那条，
                      等于用测试替身推翻一条已验证的协议裁决。
                   2. 那三个 spec 的 45 个用例里，绝大多数断言的是 composer、
                      侧栏、草稿、技能补全、虚拟列表——**都是 M4b 的组件**。
                      06 的 gate 描述（「最小可用聊天页」）与它选中的 spec
                      不自洽，这是 06 的一处过度乐观，已回写。

                   本 config 跑的是**同一条不变式的等价用例**，mock 写在
                   `tests/m4a/` 自己这边并带上 `Content-Location`。
                   共享合同仍然是最终判据，它的时间点在 M4b。
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
