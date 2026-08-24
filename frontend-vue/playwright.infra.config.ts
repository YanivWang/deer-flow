/*
  【文件职责】     同源代理与 __m0 测试页的基础设施合同。
  【架构位置】     E2E 套件配置
  【主要导出】     Playwright config
  【依赖关系】     tests/support/playwright-factory.ts · tests/support/proxy-probe.mjs（8012）· tests/e2e-infra/**
  【边界与注意】   前端指向 proxy-probe 而不是真 Gateway：这里验的是 Nitro 代理自己的行为
                   （转发头、体积限制、SSE 透传），不是业务。
*/

import { defineSuite, nuxtPreview } from "./tests/support/playwright-factory";

const port = process.env.E2E_INFRA_PORT ?? "3101";
const probePort = "8012";

export default defineSuite({
  name: "e2e-infra",
  testDir: "./tests/e2e-infra",
  port,
  serial: true,
  globalSetup: "./tests/global-setup.ts",
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
      m0TestPages: true,
      gatewayPort: probePort,
    }),
  ],
});
