/*
  【文件职责】     代理关闭流式转发（DEER_FLOW_PROXY_STREAMING=0）时的行为合同。
  【架构位置】     E2E 套件配置
  【主要导出】     Playwright config
  【依赖关系】     tests/support/playwright-factory.ts · tests/support/proxy-probe.mjs（8012）· tests/e2e-proxy-options/**
  【边界与注意】   独立成套的唯一原因就是这个构建期开关：它必须与默认流式代理分开验证。
*/

import { defineSuite, nuxtPreview } from "./tests/support/playwright-factory";

const port = process.env.E2E_PROXY_OPTIONS_PORT ?? "3102";
const probePort = "8012";

export default defineSuite({
  name: "e2e-proxy-options",
  testDir: "./tests/e2e-proxy-options",
  port,
  serial: true,
  servers: [
    {
      command: "node tests/support/proxy-probe.mjs",
      url: `http://127.0.0.1:${probePort}/health`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    nuxtPreview({
      port,
      authDisabled: true,
      gatewayPort: probePort,
      publicEnv: { DEER_FLOW_PROXY_STREAMING: "0" },
    }),
  ],
});
