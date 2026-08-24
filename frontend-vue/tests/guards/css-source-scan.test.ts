/*
  【文件职责】     守住 `main.css` 不去扫一个不存在的 streamdown dist。
  【架构位置】     门禁测试
  【主要导出】     无
  【依赖关系】     app/assets/css/main.css
  【边界与注意】   这条门禁挡的是一个**静默失效**，不是一个报错。

                   上游 `globals.css` 开头有三行：

                     @source "../../node_modules/streamdown/dist/index.js";
                     @source "../../node_modules/@streamdown/code/dist/*.js";
                     @source "../../node_modules/@streamdown/mermaid/dist/*.js";

                   Tailwind 4 靠它们从 streamdown 的 dist 里扫 class。frontend-vue 按
                   02 §259 的裁决**不装 streamdown**，那三个路径根本不存在——
                   Tailwind 对扫不到的 `@source` 不报错，只是少生成一批 CSS。
                   表现是「样式莫名少一块」，而且是在把 453 行 globals.css 整体搬过来的
                   那一刻才发生（M4b/M8），离改动点很远。

                   所以规则有两条，缺一不可：
                   1. 不许出现指向 streamdown / @streamdown 的 `@source`；
                   2. 代码块、mermaid 这些自写组件用到的 class **必须写在自己的源码里**，
                      靠 Tailwind 扫 `app/**` 得到（`CodeBlock.vue` 文件头有同样的说明）。
                   第 2 条这里只能靠第 1 条间接保证——真正的验收在视觉基线截图。
*/

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const css = readFileSync(
  fileURLToPath(new URL("../../app/assets/css/main.css", import.meta.url)),
  "utf8",
);

describe("main.css 的 @source 扫描面", () => {
  it("没有指向 streamdown / @streamdown 的 @source", () => {
    const offenders = css
      .split("\n")
      .map((line, index) => [index + 1, line.trim()] as const)
      .filter(
        ([, line]) => line.startsWith("@source") && /@?streamdown/.test(line),
      )
      .map(([lineNumber, line]) => `${lineNumber}: ${line}`);
    expect(offenders).toEqual([]);
  });

  it("所有 @source 指向的都是仓库内路径（node_modules 里的东西不该被扫）", () => {
    const offenders = css
      .split("\n")
      .map((line) => line.trim())
      .filter(
        (line) => line.startsWith("@source") && line.includes("node_modules"),
      );
    expect(offenders).toEqual([]);
  });
});
