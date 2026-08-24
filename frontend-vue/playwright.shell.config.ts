/*
  【文件职责】     真实 Auth/线程/事件存储的工作区壳层与 workspace-changes 合同。
  【架构位置】     E2E 套件配置
  【主要导出】     Playwright config
  【依赖关系】     tests/support/playwright-factory.ts · backend/scripts/run_replay_gateway.py · tests/e2e-shell/**
  【边界与注意】   种子 run 只提供一个受控事件；owner 校验、事件读取与过滤仍是生产实现。
*/

import {
  defineSuite,
  nuxtPreview,
  replayGateway,
} from "./tests/support/playwright-factory";

const port = process.env.E2E_SHELL_PORT ?? "3114";
const gatewayPort = process.env.E2E_SHELL_GATEWAY_PORT ?? "8018";

export default defineSuite({
  name: "e2e-shell",
  testDir: "./tests/e2e-shell",
  port,
  serial: true,
  timeout: 120_000,
  servers: [
    replayGateway({
      port: gatewayPort,
      cors: `http://localhost:${port}`,
      env: {
        DEERFLOW_ENABLE_TEST_SEED: "1",
      },
    }),
    nuxtPreview({ port, authDisabled: false, gatewayPort }),
  ],
});
