/*
  【文件职责】     真实 Gateway 的渲染、多 run 顺序与 artifact 写入合同。
  【架构位置】     E2E 套件配置
  【主要导出】     Playwright config
  【依赖关系】     tests/support/playwright-factory.ts · backend/scripts/run_replay_gateway.py · tests/e2e-real/**
  【边界与注意】   auth 关闭：这些用例验的是运行时行为，不是登录流程。
*/

import {
  defineSuite,
  nuxtPreview,
  replayGateway,
} from "./tests/support/playwright-factory";

const port = process.env.E2E_REAL_PORT ?? "3101";
const gatewayPort = process.env.E2E_REAL_GATEWAY_PORT ?? "8011";

export default defineSuite({
  name: "e2e-real",
  testDir: "./tests/e2e-real",
  port,
  serial: true,
  timeout: 120_000,
  servers: [
    replayGateway({
      port: gatewayPort,
      cors: `http://localhost:${port}`,
      env: {
        DEERFLOW_ENABLE_TEST_SEED: "1",
        DEER_FLOW_AUTH_DISABLED: "1",
      },
    }),
    nuxtPreview({ port, authDisabled: true, gatewayPort }),
  ],
});
