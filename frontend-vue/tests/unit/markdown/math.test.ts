/*
  【文件职责】     固定「这段内容需不需要 KaTeX」的判据。
  【架构位置】     测试
  【主要导出】     无；Vitest cases
  【依赖关系】     app/core/markdown/math.ts
  【边界与注意】   这条判据的两类错误代价完全不对称：多报只是白下载一次 264 KB，
                   漏报是公式永远渲染不出来且没有任何报错。所以下面既钉住「该报的
                   都报」，也钉住少数几类**明确**不该报的（代码里的 `$PATH`、转义的
                   `\$`）——不追求把所有假阳性都消灭。
*/

import { describe, expect, it } from "vitest";

import { containsMath } from "@/core/markdown/math";

describe("containsMath", () => {
  it.each([
    ["行内公式", "面积是 $a^2+b^2=c^2$ 对吧"],
    ["显示公式", "推导：\n\n$$\\int_0^1 x\\,dx$$\n"],
    ["多行显示公式", "$$\n\\frac{1}{2}\n$$\n"],
    ["正文中间的显示公式", "before $$x$$ after"],
    ["一段里有多个行内公式", "$a$ 和 $b$"],
  ])("认出%s", (_name, source) => {
    expect(containsMath(source)).toBe(true);
  });

  it.each([
    ["没有美元符号", "普通一句话，没有任何公式。"],
    ["单独一个美元符号", "价格是 $5"],
    ["转义的美元符号", "写作 \\$5 与 \\$10"],
    ["围栏代码里的 shell 变量", "```sh\necho $PATH $HOME\n```\n"],
    ["波浪线围栏代码", "~~~sh\ncd $HOME && echo $USER\n~~~\n"],
    ["行内代码里的变量", "用 `$PATH` 和 `$HOME`"],
  ])("不因%s误报", (_name, source) => {
    expect(containsMath(source)).toBe(false);
  });

  it("代码块之外的公式仍然算数", () => {
    expect(containsMath("```sh\necho $PATH\n```\n\n再看 $E=mc^2$\n")).toBe(
      true,
    );
  });
});
