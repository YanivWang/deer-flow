/*
  【文件职责】     将纯 TS 与 Nuxt 上下文测试分为两个真实 project。
  【对应 frontend/】 frontend/rstest.config.ts
  【架构位置】     工程底座
  【主要导出】     Vitest workspace 配置
  【依赖关系】     被 make test/verify 消费
  【边界与注意】   node project 不加载 Nuxt；nuxt project 只收集 *.nuxt.test.ts。
*/

import { defineConfig, defineProject } from "vitest/config";
import { defineVitestProject } from "@nuxt/test-utils/config";

export default defineConfig({
  test: {
    projects: [
      defineProject({
        test: {
          name: "node",
          environment: "node",
          include: [
            "tests/**/*.test.ts",
            "packages/agent-core/tests/**/*.test.ts",
          ],
          exclude: ["tests/**/*.nuxt.test.ts"],
        },
      }),
      await defineVitestProject({
        test: {
          name: "nuxt",
          environment: "nuxt",
          include: ["tests/**/*.nuxt.test.ts"],
        },
      }),
    ],
  },
});
