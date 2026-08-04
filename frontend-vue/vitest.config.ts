/*
  【文件职责】     将纯 TS、需要 DOM 全局、需要 Nuxt 上下文的测试分为三个真实 project。
  【对应 frontend/】 frontend/rstest.config.ts
  【架构位置】     工程底座
  【主要导出】     Vitest workspace 配置
  【依赖关系】     被 make test/verify 消费；分桶口径与 baseline/core-test-manifest.json 对账
  【边界与注意】   三个 project 的 include 互斥，靠文件名后缀区分，不靠目录：
                   *.nuxt.test.ts → nuxt，*.dom.test.ts → dom，其余 *.test.ts → node。
                   后缀是 codemod 按 manifest 的 bucket 写上去的，
                   由 scripts/collected-vs-manifest.mjs 校验「收集到的 project」与
                   「manifest 期望的 bucket」一致——三者任意两个漂移就红。
                   加 project 时必须同步 node 的 exclude，否则一个文件会被跑两遍。
                   node/dom 两个 project 不经过 Nuxt，拿不到 Nuxt 注入的路径别名，
                   所以 `@` 要在这里显式补上——迁移过来的 core 测试全都写 `@/core/…`。
*/

import { fileURLToPath } from "node:url";

import { defineConfig, defineProject } from "vitest/config";
import { defineVitestProject } from "@nuxt/test-utils/config";

/** 与 .nuxt/tsconfig.app.json 的 `"@/*": ["../app/*"]` 保持一致。 */
const appDir = fileURLToPath(new URL("app", import.meta.url));

export default defineConfig({
  test: {
    projects: [
      defineProject({
        resolve: { alias: { "@": appDir } },
        test: {
          name: "node",
          environment: "node",
          include: [
            "tests/**/*.test.ts",
            "packages/agent-core/tests/**/*.test.ts",
          ],
          exclude: ["tests/**/*.nuxt.test.ts", "tests/**/*.dom.test.ts"],
        },
      }),
      defineProject({
        resolve: { alias: { "@": appDir } },
        test: {
          // 迁移过来的 core 测试里有一批用 DOM 全局（Response、FormData、
          // localStorage…）但不碰 React，happy-dom 就够，不必上 Nuxt 环境。
          name: "dom",
          environment: "happy-dom",
          include: ["tests/**/*.dom.test.ts"],
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
