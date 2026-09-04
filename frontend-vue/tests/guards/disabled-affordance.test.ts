/*
  【文件职责】     手写 <button> 带 :disabled 时，必须有看得见的禁用样式。
  【架构位置】     测试（守卫）
  【主要导出】     无
  【依赖关系】     app/components/**、app/pages/** 的 SFC
  【边界与注意】   **这一条守的是「看得见」，不是「点得动」。**

                   `:disabled` 让浏览器拦住点击，但**不改任何像素**：按钮
                   仍然是原来的颜色、原来的指针。上游几乎所有按钮都走
                   `Button` primitive，它的 base 里带着
                   `disabled:pointer-events-none disabled:opacity-50`；
                   本仓手写了 102 处 `<button>`（上游同口径 12 处），
                   wave 70 实测其中 15 处带 `:disabled` 却一条 `disabled:` 样式都没有
                   ——语音输入、模式与思考档触发器、channels 的四颗、
                   memory 导入、登录与 setup 各一颗，**灰不下去，看起来能点**。

                   走 `<Button>` 的不在这条守卫里：primitive 自己带着那两条。
                   `:class` 动态拼的也放过——静态扫描判不了，它们由各自的单测守。
*/

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

import { describe, expect, it } from "vitest";

function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    // ui/ 是 L2 primitive，它就是提供这些样式的那一层。
    if (name === "ui") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (extname(p) === ".vue") out.push(p);
  }
  return out;
}

const files = [...walk("app/components"), ...walk("app/pages")];

/** 每一颗手写 <button> 的开标签，注释已剥掉。 */
function rawButtons(source: string) {
  return [
    ...source
      .replace(/<!--[\s\S]*?-->/g, "")
      .matchAll(/<button\b[\s\S]{0,1200}?>/g),
  ].map((m) => m[0]);
}

describe("手写 button 的禁用样式", () => {
  const scanned = files.flatMap((file) =>
    rawButtons(readFileSync(file, "utf8")).map((tag) => ({ file, tag })),
  );

  /*
    形状断言：扫不到按钮时下面那条会静默通过（线索 176/195）。
    这个下限远低于实测值，只用来证明「扫到了」。
  */
  it("扫到了足够多的手写 button", () => {
    expect(scanned.length).toBeGreaterThan(60);
  });

  it("带 :disabled 的都有看得见的禁用样式", () => {
    const offenders = scanned
      .filter(({ tag }) => {
        if (!/:disabled=|\sdisabled[\s>]/.test(tag)) return false;
        // `:class` 动态拼的判不了，交给各自的单测。
        if (/:class=/.test(tag)) return false;
        const cls = /\bclass="([^"]*)"/.exec(tag)?.[1] ?? "";
        return !/\bdisabled:/.test(cls);
      })
      .map(
        ({ file, tag }) =>
          `${file}  ${/data-testid="([^"]+)"/.exec(tag)?.[1] ?? "(无 testid)"}`,
      );

    expect(offenders).toEqual([]);
  });
});
