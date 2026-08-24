/*
  【文件职责】     真实 Auth/Gateway/SQLite 的渠道连接生命周期。
  【架构位置】     E2E 套件配置
  【主要导出】     Playwright config
  【依赖关系】     tests/support/playwright-factory.ts · backend/scripts/run_replay_gateway.py · tests/e2e-channels/**
  【边界与注意】   auth 开启：绑定流程本身依赖真实会话与 CSRF。
*/

import {
  defineSuite,
  nuxtPreview,
  replayGateway,
} from "./tests/support/playwright-factory";

const port = process.env.E2E_CHANNELS_PORT ?? "3111";
const gatewayPort = process.env.E2E_CHANNELS_GATEWAY_PORT ?? "8014";

export default defineSuite({
  name: "e2e-channels",
  testDir: "./tests/e2e-channels",
  port,
  serial: true,
  timeout: 120_000,
  servers: [
    replayGateway({
      port: gatewayPort,
      cors: `http://localhost:${port}`,
      env: {
        DEERFLOW_ENABLE_CHANNEL_TEST_SEED: "1",
      },
    }),
    nuxtPreview({ port, authDisabled: false, gatewayPort }),
  ],
});
