/*
  【文件职责】     真实 Playwright Chromium 后端的 Browser 面板合同（握手、REST、二进制帧）。
  【架构位置】     E2E 套件配置
  【主要导出】     Playwright config
  【依赖关系】     tests/support/playwright-factory.ts · tests/support/run_m0_gateway.py --browser · tests/e2e-browser/**
  【边界与注意】   必须与 e2e-protocol 分开：开启 browser 工具会改变系统提示词，
                   而 run-protocol 的 replay 夹具按提示词哈希对齐。
*/

import {
  defineSuite,
  m0Gateway,
  nuxtPreview,
} from "./tests/support/playwright-factory";

const port = process.env.E2E_BROWSER_PORT ?? "3101";
const gatewayPort = process.env.E2E_BROWSER_GATEWAY_PORT ?? "8011";

export default defineSuite({
  name: "e2e-browser",
  testDir: "./tests/e2e-browser",
  port,
  serial: true,
  timeout: 120_000,
  servers: [
    m0Gateway({
      port: gatewayPort,
      cors: `http://localhost:${port}`,
      args: ["--browser"],
    }),
    nuxtPreview({
      port,
      authDisabled: true,
      gatewayPort,
      publicEnv: {
        // 浏览器直连 Gateway 用 localhost 而不是 127.0.0.1：Gateway 的 CORS 与
        // cookie 域都是按 localhost 配的，换成回环 IP 会变成另一个 origin。
        NUXT_PUBLIC_BACKEND_BASE_URL: `http://localhost:${gatewayPort}`,
      },
    }),
  ],
});
