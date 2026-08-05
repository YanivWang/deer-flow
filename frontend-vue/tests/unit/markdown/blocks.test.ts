/*
  【文件职责】     分块器的四条合并规则与 key 语义。
  【对应 frontend/】 无（上游这段在 streamdown 包内部，没有可搬的单测）
  【架构位置】     单元测试
  【主要导出】     无
  【依赖关系】     app/core/markdown/blocks
  【边界与注意】   每条用例对准一类**会被切坏的构造**，不是对准函数的分支覆盖率。
                   切坏的表现都不是报错，而是渲染结果悄悄变形——所以断言的是块边界本身。
*/

import { describe, expect, it } from "vitest";

import { parseMarkdownIntoBlocks, toKeyedBlocks } from "@/core/markdown/blocks";

describe("parseMarkdownIntoBlocks", () => {
  it("按顶层 token 切块", () => {
    const blocks = parseMarkdownIntoBlocks("# title\n\npara\n\n- a\n- b\n");
    expect(blocks.join("")).toBe("# title\n\npara\n\n- a\n- b\n");
    expect(blocks.length).toBeGreaterThan(1);
  });

  it("出现脚注引用就整篇不切（定义与引用必须留在同一块）", () => {
    const markdown = "text[^1]\n\nmore\n\n[^1]: note";
    expect(parseMarkdownIntoBlocks(markdown)).toEqual([markdown]);
  });

  it("只有脚注定义也整篇不切", () => {
    const markdown = "para\n\n[^a]: note";
    expect(parseMarkdownIntoBlocks(markdown)).toEqual([markdown]);
  });

  it("HTML 块标签配平之前不切", () => {
    const markdown = '<div class="x">\n\ninner para\n\n</div>\n\nafter\n';
    const blocks = parseMarkdownIntoBlocks(markdown);
    // `<div>` 开的那一块要一直吃到 `</div>`，否则 raw HTML 结构断成两半。
    expect(blocks[0]).toContain("</div>");
    expect(blocks.at(-1)).toContain("after");
  });

  it("自闭合标签不进栈", () => {
    const blocks = parseMarkdownIntoBlocks('<img src="a" />\n\nafter\n');
    expect(blocks.length).toBeGreaterThan(1);
    expect(blocks.at(-1)).toContain("after");
  });

  it("`$$` 未配平时并入上一块", () => {
    const markdown = "$$\n\\frac{1}{2}\n$$\n\nafter\n";
    const blocks = parseMarkdownIntoBlocks(markdown);
    expect(blocks[0]).toContain("$$");
    // 开闭定界符在同一块里——切开的话 KaTeX 只能拿到半条公式。
    expect((blocks[0]?.match(/\$\$/g) ?? []).length % 2).toBe(0);
  });

  it("围栏代码块里的 `$$` 不触发合并", () => {
    const markdown = "```\n$$ not math\n```\n\nafter\n";
    const blocks = parseMarkdownIntoBlocks(markdown);
    expect(blocks.at(-1)).toContain("after");
  });

  it("任何输入拼回去都等于原文", () => {
    for (const markdown of [
      "# a\n\nb\n",
      "- x\n- y\n\n> q\n",
      "```js\ncode\n```\n\ntail\n",
      "para with $$a$$ inline\n\nnext\n",
    ]) {
      expect(parseMarkdownIntoBlocks(markdown).join("")).toBe(markdown);
    }
  });
});

describe("toKeyedBlocks", () => {
  it("key 只由序号决定——掺内容哈希会让流式最后一块每个 chunk 重挂载", () => {
    const first = toKeyedBlocks(["# a\n", "para"]);
    const second = toKeyedBlocks(["# a\n", "para grew"]);
    expect(first.map((block) => block.key)).toEqual(["0", "1"]);
    expect(second.map((block) => block.key)).toEqual(["0", "1"]);
    expect(second[1]?.content).toBe("para grew");
  });
});
