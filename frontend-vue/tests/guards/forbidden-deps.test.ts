/*
  【文件职责】     守住「计划明确点名不装的包」不许出现在 frontend-vue 的依赖里。
  【架构位置】     门禁测试
  【主要导出】     无
  【依赖关系】     package.json
  【边界与注意】   这条门禁是**被现实逼出来的，不是预防性洁癖**：同一个坑连着踩了两次。

                     - `058836aa`（M1 窗口 2）为了让
                       `uploads/prompt-input-files.ts` 能解析，悄悄装了 `ai`，
                       提交说明一个字没提；而 02 §321 写着「决策：内联定义，不装这个包」。
                     - `d682f048`（M1 窗口 3）为了让 `api/api-client.ts` 能落地，
                       装了 `@langchain/langgraph-sdk`，还在 evidence 里写了一整段论证；
                       而 02 §372 写着「不必装进项目」。

                   两次的形状完全一样：**搬运时遇到一个解析不了的 import，
                   装包是最省事的出路，而计划里那条「不装、改成自写类型」的裁决
                   躺在另一个文档里没人翻。** 文档挡不住这个——第二次就是在读了文档
                   （读的是 08，依赖裁决其实在 02）之后发生的。所以要有机器门禁。

                   清单的判据不是「我觉得不该装」，而是 02/04 里逐条写明的裁决，
                   每条都带出处。真要放开某一条，得先改 02 并在 review 里被看见。
*/

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/** 每条都必须能在 02/04 里找到原文。改这张表 = 推翻一条已记录的裁决。 */
const FORBIDDEN: Record<string, string> = {
  "@langchain/langgraph-sdk":
    "02 §106 ❌ 移除 / §372「不必装进项目」；值导入的处置是自写 core/api/client.ts（02 §249，M2）",
  "@langchain/core":
    "02 §107 ❌ 移除；唯一的 type-only 引用（ToolCall）内联进 app/core/types/message.ts",
  ai: "02 §321「决策：内联定义，不装这个包」；FileUIPart 内联进 app/core/types/message.ts",
  // M3 补的三条。同一个形状第三次出现：搬 `core/streamdown/` 时遇到解析不了的
  // `import { code } from "@streamdown/code"`，装包最省事，而「不装」的裁决
  // 躺在 02 §259 的「内容渲染」表里。这次在写代码之前就先把门关上。
  streamdown:
    "02 §259 内容渲染表：streamdown → `hast-util-to-jsx-runtime` + `remend` + `rehype-harden` + 自写流式层（M3 已落地 app/core/markdown/）",
  "@streamdown/code":
    "02 §259 同上；代码块 UI 由 app/components/markdown/CodeBlock.vue 自写",
  "@streamdown/mermaid":
    "02 §259 同上；mermaid UI 由 app/components/markdown/MermaidDiagram.vue 自写",
};

const pkg = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../package.json", import.meta.url)),
    "utf8",
  ),
) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

describe("计划点名不装的包", () => {
  it("不在 dependencies / devDependencies 里", () => {
    const declared = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    };
    const violations = Object.keys(FORBIDDEN)
      .filter((name) => name in declared)
      .map((name) => `${name} —— ${FORBIDDEN[name]}`);
    expect(violations).toEqual([]);
  });
});
