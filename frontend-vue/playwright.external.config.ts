/*
  【文件职责】     需要独立 IdP 与浏览器运行时的门禁：WebSocket 与 OIDC 双回调。
  【架构位置】     E2E 套件配置
  【主要导出】     Playwright config
  【依赖关系】     tests/support/playwright-factory.ts · tests/support/run_m0_idp.py（8013）· run_m0_gateway.py --browser · tests/e2e-external/**
  【边界与注意】   IdP 是本仓自带的 run_m0_idp.py，不连任何外部服务，整套是自洽的。
                   单独成套是因为它要求后端装了 browser extra。
*/

import {
  defineSuite,
  m0Gateway,
  nuxtPreview,
} from "./tests/support/playwright-factory";

const port = process.env.E2E_EXTERNAL_PORT ?? "3101";
const gatewayPort = "8011";
const idpPort = "8013";

export default defineSuite({
  name: "e2e-external",
  testDir: "./tests/e2e-external",
  port,
  serial: true,
  timeout: 120_000,
  servers: [
    {
      command: `../backend/.venv/bin/python tests/support/run_m0_idp.py --port ${idpPort}`,
      url: `http://127.0.0.1:${idpPort}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    m0Gateway({
      port: gatewayPort,
      cors: `http://localhost:${port}`,
      args: [
        "--queue-maxsize",
        "32",
        "--browser",
        "--oidc-issuer",
        `http://127.0.0.1:${idpPort}`,
      ],
      pipeOutput: true,
    }),
    nuxtPreview({
      port,
      authDisabled: true,
      m0TestPages: true,
      gatewayPort,
    }),
  ],
});
