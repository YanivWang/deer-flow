/*
  【文件职责】     产品合同：全部走 page.route() mock Gateway，不需要真实后端。
  【架构位置】     E2E 套件配置
  【主要导出】     Playwright config
  【依赖关系】     tests/support/playwright-factory.ts · tests/e2e/**
  【边界与注意】   本仓的默认 e2e 门禁。新增产品行为的浏览器证据默认放这里；
                   只有确实需要真实 Gateway 的才另开套件。
*/

import { defineSuite, nuxtPreview } from "./tests/support/playwright-factory";

const port = process.env.E2E_PORT ?? "3101";

export default defineSuite({
  name: "e2e",
  testDir: "./tests/e2e",
  port,
  globalSetup: "./tests/global-setup.ts",
  servers: [nuxtPreview({ port, authDisabled: true, m0TestPages: false })],
});
