/*
  【文件职责】     认证 UI 合同：前端以 AUTH_DISABLED=0 构建，走真实登录/设置/恢复态。
  【架构位置】     E2E 套件配置
  【主要导出】     Playwright config
  【依赖关系】     tests/support/playwright-factory.ts · tests/e2e-auth/**
  【边界与注意】   必须与主套件分开：auth 模式是构建期决定的，一个 preview 只能是一种。
*/

import { defineSuite, nuxtPreview } from "./tests/support/playwright-factory";

const port = process.env.E2E_AUTH_PORT ?? "3108";

export default defineSuite({
  name: "e2e-auth",
  testDir: "./tests/e2e-auth",
  port,
  serial: true,
  globalSetup: "./tests/global-setup.ts",
  servers: [nuxtPreview({ port, authDisabled: false, m0TestPages: false })],
});
