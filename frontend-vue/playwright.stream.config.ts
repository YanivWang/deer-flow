/*
  【文件职责】     真 socket 分帧的流式合同：心跳、Last-Event-ID 续传、gap 恢复。
  【架构位置】     E2E 套件配置
  【主要导出】     Playwright config
  【依赖关系】     tests/support/playwright-factory.ts · tests/support/stream-gateway.mjs（8014）· tests/e2e-stream/**
  【边界与注意】   必须用真实 chunked 响应而不是 route.fulfill：分帧边界、心跳与续传游标
                   在 mock 里不存在。
*/

import { defineSuite, nuxtPreview } from "./tests/support/playwright-factory";

const port = process.env.E2E_STREAM_PORT ?? "3104";
const gatewayPort = "8014";

export default defineSuite({
  name: "e2e-stream",
  testDir: "./tests/e2e-stream",
  port,
  serial: true,
  globalSetup: "./tests/global-setup.ts",
  servers: [
    {
      command: "node tests/support/stream-gateway.mjs",
      url: `http://127.0.0.1:${gatewayPort}/health`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    nuxtPreview({ port, authDisabled: true, gatewayPort }),
  ],
});
