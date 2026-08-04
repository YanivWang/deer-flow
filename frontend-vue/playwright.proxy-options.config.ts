/*
  【文件职责】     在 production Preview 中关闭代理流选项，提供开启态的反事实对照。
  【对应 frontend/】 frontend/next.config.js
  【架构位置】     测试
  【主要导出】     Playwright proxy-options config
  【依赖关系】     启动 proxy probe 与 DEER_FLOW_PROXY_STREAMING=0 Preview
  【边界与注意】   只验证 flag 影响，不是生产配置；生产默认始终开启。
*/

import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://localhost:3102";

export default defineConfig({
  testDir: "./tests/proxy-options",
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,
  outputDir: "test-results/proxy-options",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "chromium-proxy-options", use: devices["Desktop Chrome"] },
  ],
  webServer: [
    {
      command: "node tests/support/proxy-probe.mjs",
      url: "http://127.0.0.1:8012/health",
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command:
        "DEER_FLOW_INTERNAL_GATEWAY_BASE_URL=http://127.0.0.1:8012 DEER_FLOW_PROXY_STREAMING=0 ./node_modules/.bin/nuxt build && PORT=3102 HOST=127.0.0.1 DEER_FLOW_PROXY_STREAMING=0 ./node_modules/.bin/nuxt preview",
      url: baseURL,
      reuseExistingServer: false,
      timeout: 240_000,
    },
  ],
});
