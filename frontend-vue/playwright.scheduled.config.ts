/*
  【文件职责】     真实 Gateway/SQLite 的定时任务 HTTP 与 UI 生命周期。
  【架构位置】     E2E 套件配置
  【主要导出】     Playwright config
  【依赖关系】     tests/support/playwright-factory.ts · backend/scripts/run_replay_gateway.py · tests/e2e-scheduled/**
  【边界与注意】   刻意**不开** TEST_SEED：定时任务要验的是自己创建的数据，不是种子数据。
*/

import {
  defineSuite,
  nuxtPreview,
  replayGateway,
} from "./tests/support/playwright-factory";

const port = process.env.E2E_SCHEDULED_PORT ?? "3110";
const gatewayPort = process.env.E2E_SCHEDULED_GATEWAY_PORT ?? "8013";

export default defineSuite({
  name: "e2e-scheduled",
  testDir: "./tests/e2e-scheduled",
  port,
  serial: true,
  timeout: 120_000,
  servers: [
    replayGateway({
      port: gatewayPort,
      cors: `http://localhost:${port}`,
      env: {
        DEER_FLOW_AUTH_DISABLED: "1",
      },
    }),
    nuxtPreview({ port, authDisabled: true, gatewayPort }),
  ],
});
