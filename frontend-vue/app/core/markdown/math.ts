/*
  【文件职责】     判断一段 Markdown 是否真的含数学，并按需加载 KaTeX 排版插件。
  【架构位置】     L2
  【主要导出】     containsMath · loadKatexRehypePlugin
  【依赖关系】     rehype-katex（**只在此处动态 import**）· plugins.ts 的 katexOptions
  【边界与注意】   katex 本体约 264 KB raw / 63 KB brotli。它曾经被 `plugins.ts` 顶层
                   静态 import，于是**每一次工作区加载**都要下载它，而绝大多数会话
                   一个公式都没有。shiki 与 mermaid 早就是按需加载的，只有它不是；
                   `tests/e2e/route-payload.spec.ts` 现在把这条钉住。

                   检测**必须宁可多报不可漏报**：多报的代价是白下一次 264 KB，
                   漏报的代价是公式永远渲染不出来且没有任何报错。所以先剥掉围栏
                   代码与行内代码（`$PATH` 这类最常见的假阳性），再按 remark-math
                   在 `singleDollarTextMath: true` 下的形状匹配。
*/

import type { Pluggable } from "unified";

import { katexOptions } from "./plugins";

/** 围栏代码块与行内代码里的 `$` 不是数学。 */
function stripCode(source: string): string {
  return source
    .replace(/^[ \t]*(`{3,}|~{3,})[\s\S]*?^[ \t]*\1[ \t]*$/gm, "")
    .replace(/`[^`\n]*`/g, "");
}

/**
 * `$$…$$` 显示公式，或同一行内的 `$…$` 行内公式。
 * 转义过的 `\$` 不算——它就是一个美元符号。
 */
export function containsMath(source: string): boolean {
  if (!source.includes("$")) return false;
  const text = stripCode(source).replace(/\\\$/g, "");
  return /\$\$/.test(text) || /\$[^$\n]+\$/.test(text);
}

let pending: Promise<Pluggable> | null = null;

/** 加载一次就复用：同一个会话里第二条公式不该再等一次网络。 */
export function loadKatexRehypePlugin(): Promise<Pluggable> {
  pending ??= import("rehype-katex").then(
    (module) => [module.default, katexOptions] as Pluggable,
  );
  return pending;
}
