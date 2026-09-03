/*
  【文件职责】     真实 Gateway 的 run 协议状态机与认证 cookie 合同。
  【架构位置】     E2E 套件配置
  【主要导出】     Playwright config
  【依赖关系】     tests/support/playwright-factory.ts · tests/support/run_m0_gateway.py（8011）· tests/e2e-protocol/**
  【边界与注意】   queue-maxsize 128 是被测量出来的：它要落在实时爆发量与场景事件总数之间，
                   create 流不许 gap 而从首个游标 resume 必须 gap。改动前先读
                   run-protocol.spec.ts 报的是哪一侧越界，不要猜。

                   实测三档（M2 把 checkpoints / tasks 加进 stream_mode、事件数从 74
                   涨到 226 之后重测的）：**32 会让 create 流自己被 gap**；**128 通过**；
                   再把 debug 也加进 stream_mode 会到 378 个事件，那时 **384 又大到
                   不再逐出首个游标**，gap 那一侧反而测不成。这三个数原先写在
                   playwright.m0-real-backend.config.ts 的 webServer 注释里，
                   1209651f 把那份 config 拆成本文件时没带过来，而
                   tests/fixtures/streams/README.md 一直指着那个已经不存在的文件名。
*/

import {
  defineSuite,
  m0Gateway,
  nuxtPreview,
} from "./tests/support/playwright-factory";

const port = process.env.E2E_PROTOCOL_PORT ?? "3101";
const gatewayPort = "8011";

export default defineSuite({
  name: "e2e-protocol",
  testDir: "./tests/e2e-protocol",
  port,
  serial: true,
  timeout: 90_000,
  servers: [
    m0Gateway({
      port: gatewayPort,
      cors: `http://localhost:${port}`,
      args: ["--queue-maxsize", "128"],
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
