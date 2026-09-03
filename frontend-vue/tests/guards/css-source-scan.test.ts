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
                   表现是「样式莫名少一块」，而且是在把整份 globals.css 搬过来的
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

/*
  级联层次序。

  Tailwind 4 的 `@import "tailwindcss"` 声明 `@layer theme, base, components,
  utilities`，而按 CSS 规范**不属于任何层的作者样式优先级高于所有层**。所以基础层
  一旦裸写在顶层，它就赢过所有工具类——跟具体度无关，也不会有任何报错。

  实测过一次代价（wave 32）：`* { border-color: var(--border) }` 裸写在顶层，
  把全仓 **90 处** `border-<颜色>` 工具类全部盖掉，输入框不是输入框的边框色、
  聚焦不变色、校验失败不变红，而这些在几何面上完全看不见
  （`sampleGeometry` 不取 borderColor）。

  所以这条门禁挡的是**这一类**而不是那一个实例：顶层只允许放变量定义
  （`:root` / `.dark`）与 at-rule，任何能匹配到元素的选择器都必须在层里。
  真正的端到端验收在 `tests/e2e/i18n-theme.spec.ts` 那条计算样式断言。
*/
describe("main.css 的级联层次序", () => {
  it("顶层只放变量定义，能匹配元素的规则都在 @layer 里", () => {
    const offenders: string[] = [];
    let depth = 0;
    let selector = "";
    let line = 1;
    for (let i = 0; i < css.length; i += 1) {
      const character = css[i];
      if (character === "\n") line += 1;
      // 注释整段跳过，里面的花括号不参与计数。
      if (character === "/" && css[i + 1] === "*") {
        const end = css.indexOf("*/", i + 2);
        const skipped = css.slice(i, end + 2);
        line += skipped.split("\n").length - 1;
        i = end + 1;
        continue;
      }
      if (character === "{") {
        if (depth === 0) {
          const head = selector.trim().replaceAll(/\s+/g, " ");
          const allowed =
            head.startsWith("@") || head === ":root" || head === ".dark";
          if (!allowed) offenders.push(`${line}: ${head}`);
        }
        depth += 1;
        selector = "";
        continue;
      }
      if (character === "}") {
        depth -= 1;
        selector = "";
        continue;
      }
      if (depth === 0) selector += character;
    }
    expect(depth, "花括号没有配平，扫描结果不可信").toBe(0);
    expect(
      offenders,
      "这些规则裸写在顶层，会赢过所有 Tailwind 工具类：挪进 @layer base。",
    ).toEqual([]);
  });
});
