/*
  【文件职责】     运行 M0 Button/theme 视觉种子门禁。
  【对应 frontend/】 无；M0 视觉基线
  【架构位置】     测试
  【主要导出】     Playwright visual config
  【依赖关系】     复用 playwright.m0.config.ts 的 production preview
  【边界与注意】   M4-M7 再扩展完整 critical states，不在 M0 伪造业务截图。
*/

import m0Config from "./playwright.m0.config";
import { defineConfig } from "@playwright/test";

export default defineConfig(m0Config, {
  grep: /@visual-seed/,
  outputDir: "test-results/visual",
});
