/*
  【文件职责】     真实 Auth/LangGraph/setup_agent 的自定义 Agent 创建与设置持久化。
  【架构位置】     E2E 套件配置
  【主要导出】     Playwright config
  【依赖关系】     tests/support/playwright-factory.ts · backend/scripts/run_replay_gateway.py · tests/e2e-agents/**
  【边界与注意】   AGENT_TEST_MODEL 让 setup_agent 走确定性模型，而不是真实 provider。
*/

import {
  defineSuite,
  nuxtPreview,
  replayGateway,
} from "./tests/support/playwright-factory";

const port = process.env.E2E_AGENTS_PORT ?? "3112";
const gatewayPort = process.env.E2E_AGENTS_GATEWAY_PORT ?? "8015";

export default defineSuite({
  name: "e2e-agents",
  testDir: "./tests/e2e-agents",
  port,
  serial: true,
  timeout: 120_000,
  servers: [
    replayGateway({
      port: gatewayPort,
      cors: `http://localhost:${port}`,
      env: {
        DEERFLOW_ENABLE_AGENT_TEST_MODEL: "1",
      },
    }),
    nuxtPreview({ port, authDisabled: false, gatewayPort }),
  ],
});
