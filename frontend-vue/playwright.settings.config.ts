/*
  【文件职责】     真实 Auth/DeerMem/Noop/Skills/MCP 的设置面合同。
  【架构位置】     E2E 套件配置
  【主要导出】     Playwright config
  【依赖关系】     tests/support/playwright-factory.ts · backend/scripts/run_replay_gateway.py ×2 · tests/e2e-settings/**
  【边界与注意】   唯一起两个 Gateway 的套件：第二个用 memory backend `noop`，
                   用来验证「后端不支持某能力时前端如何降级」，不是备份。
*/

import { resolve } from "node:path";

import {
  defineSuite,
  nuxtPreview,
  replayGateway,
} from "./tests/support/playwright-factory";

const port = process.env.E2E_SETTINGS_PORT ?? "3113";
const gatewayPort = process.env.E2E_SETTINGS_GATEWAY_PORT ?? "8016";
const unsupportedGatewayPort =
  process.env.E2E_SETTINGS_UNSUPPORTED_GATEWAY_PORT ?? "8017";
const homeMarker = resolve(`test-results/e2e-settings-${gatewayPort}-home.txt`);

export default defineSuite({
  name: "e2e-settings",
  testDir: "./tests/e2e-settings",
  port,
  serial: true,
  timeout: 120_000,
  servers: [
    replayGateway({
      port: gatewayPort,
      cors: `http://localhost:${port}`,
      env: {
        DEERFLOW_ENABLE_SETTINGS_TEST_SEED: "1",
        DEERFLOW_SETTINGS_TEST_MEMORY_BACKEND: "deermem",
        DEERFLOW_SETTINGS_TEST_HOME_MARKER: homeMarker,
      },
    }),
    replayGateway({
      port: unsupportedGatewayPort,
      cors: `http://localhost:${port}`,
      env: {
        DEERFLOW_ENABLE_SETTINGS_TEST_SEED: "1",
        DEERFLOW_SETTINGS_TEST_MEMORY_BACKEND: "noop",
      },
    }),
    nuxtPreview({ port, authDisabled: false, gatewayPort }),
  ],
});
