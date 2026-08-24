/*
  【文件职责】     产品视觉快照：确定性工作区状态的截图比对。
  【架构位置】     E2E 套件配置
  【主要导出】     Playwright config
  【依赖关系】     tests/support/playwright-factory.ts · tests/e2e-visual/**
  【边界与注意】   与主套件同拓扑但单独成套：截图对齐失败要能独立复跑与更新基线，
                   混在产品合同里会让一次样式改动把整条门禁染红。
*/

import { defineSuite, nuxtPreview } from "./tests/support/playwright-factory";

const port = process.env.E2E_VISUAL_PORT ?? "3109";

export default defineSuite({
  name: "e2e-visual",
  testDir: "./tests/e2e-visual",
  port,
  serial: true,
  globalSetup: "./tests/global-setup.ts",
  servers: [nuxtPreview({ port, authDisabled: true, m0TestPages: false })],
});
