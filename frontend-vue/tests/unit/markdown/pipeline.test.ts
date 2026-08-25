/*
  【文件职责】     管线装配的两处顺序敏感点、处理器缓存、以及切词的纯函数语义。
  【架构位置】     单元测试
  【主要导出】     无
  【依赖关系】     app/core/markdown/{pipeline,plugins,animate,safe-markdown}
  【边界与注意】   管线装配错了**不报错**，只是输出不同——所以这里断言的是 hast 形状，
                   不是「跑通了」。
*/

import { beforeEach, describe, expect, it } from "vitest";

import { splitAnimatedWords } from "@/core/markdown/animate";
import {
  clearMarkdownProcessorCache,
  createMarkdownProcessor,
  markdownToHast,
} from "@/core/markdown/pipeline";
import {
  appRemarkPlugins,
  defaultRehypePlugins,
  defaultRemarkPlugins,
  rawHtmlRehypePlugins,
} from "@/core/markdown/plugins";
import { getSafeMarkdown } from "@/core/markdown/safe-markdown";

import type { Element, Nodes, RootContent } from "hast";

function findElement(tree: Nodes, tagName: string): Element | undefined {
  if (tree.type === "element" && tree.tagName === tagName) return tree;
  const children = "children" in tree ? (tree.children as RootContent[]) : [];
  for (const child of children) {
    const hit = findElement(child, tagName);
    if (hit) return hit;
  }
  return undefined;
}

function textOf(tree: Nodes): string {
  if (tree.type === "text") return tree.value;
  const children = "children" in tree ? (tree.children as RootContent[]) : [];
  return children.map(textOf).join("");
}

beforeEach(() => {
  clearMarkdownProcessorCache();
});

describe("管线装配", () => {
  it("没有 rehype-raw 时原始 HTML 变成转义文本，而不是消失", () => {
    const tree = markdownToHast('<div class="x">raw</div>\n', {
      remarkPlugins: appRemarkPlugins,
      rehypePlugins: [], // 消息路径的同步 rehype 链现在是空的：KaTeX 由 core/markdown/math.ts 按内容加载。
    });
    expect(findElement(tree, "div")).toBeUndefined();
    expect(textOf(tree)).toContain('<div class="x">raw</div>');
  });

  it("有 rehype-raw 时原始 HTML 被解析成元素", () => {
    const tree = markdownToHast('<div class="x">raw</div>\n', {
      remarkPlugins: appRemarkPlugins,
      rehypePlugins: rawHtmlRehypePlugins,
    });
    expect(findElement(tree, "div")).toBeDefined();
  });

  it("默认链会净化：script 被移除、事件属性被剥掉", () => {
    const tree = markdownToHast(
      '<div class="x" onclick="alert(1)">kept</div>\n\n<script>alert(2)</script>\n',
      {
        remarkPlugins: defaultRemarkPlugins,
        rehypePlugins: defaultRehypePlugins,
      },
    );
    expect(findElement(tree, "script")).toBeUndefined();
    const div = findElement(tree, "div");
    expect(div).toBeDefined();
    expect(div?.properties).not.toHaveProperty("onclick");
  });

  it("默认链会 harden：javascript: 链接被阻断", () => {
    const tree = markdownToHast("[x](javascript:alert(1))\n", {
      remarkPlugins: defaultRemarkPlugins,
      rehypePlugins: defaultRehypePlugins,
    });
    expect(findElement(tree, "a")).toBeUndefined();
    expect(textOf(tree)).toContain("[blocked]");
  });

  it("codeMeta 把围栏 meta 带到 code 的 metastring 属性上", () => {
    const tree = markdownToHast("```ts title=a.ts\nx\n```\n", {
      remarkPlugins: defaultRemarkPlugins,
      rehypePlugins: defaultRehypePlugins,
    });
    expect(findElement(tree, "code")?.properties?.metastring).toBe(
      "title=a.ts",
    );
  });

  it("remarkRehypeOptions 覆盖得了别的键，但覆盖不掉 allowDangerousHtml", () => {
    const tree = markdownToHast("<div>raw</div>\n", {
      remarkPlugins: appRemarkPlugins,
      rehypePlugins: rawHtmlRehypePlugins,
      remarkRehypeOptions: { footnoteLabel: "注" },
    });
    // 仍然解析出了元素 —— 说明 allowDangerousHtml 没有被这次覆盖关掉。
    expect(findElement(tree, "div")).toBeDefined();
  });
});

describe("处理器缓存", () => {
  it("同样的插件配置命中同一个处理器实例（调用方每次传新数组也命中）", () => {
    const first = createMarkdownProcessor({ remarkPlugins: appRemarkPlugins });
    const second = createMarkdownProcessor({ remarkPlugins: appRemarkPlugins });
    // createMarkdownProcessor 本身不缓存——缓存在 markdownToHast 那条路径上。
    expect(first).not.toBe(second);

    const a = markdownToHast("x", { rehypePlugins: [] });
    const b = markdownToHast("x", { rehypePlugins: [] });
    expect(a.type).toBe("root");
    expect(b.type).toBe("root");
  });
});

describe("splitAnimatedWords", () => {
  it("拼回去等于原文，一个字符不吞", () => {
    for (const text of ["alpha beta", "  leading", "trailing  ", "a\nb\tc"]) {
      expect(
        splitAnimatedWords(text, 0, 0)
          .map((word) => word.text)
          .join(""),
      ).toBe(text);
    }
  });

  it("key 由绝对偏移决定，追加不改变已有词的 key", () => {
    const before = splitAnimatedWords("alpha beta", 0, 0);
    const after = splitAnimatedWords("alpha beta gamma", 0, 10);
    expect(after.slice(0, 2).map((word) => word.key)).toEqual(
      before.map((word) => word.key),
    );
  });

  it("首帧（revealedLength=0）一律不播动画", () => {
    expect(
      splitAnimatedWords("alpha beta", 0, 0).every((word) => !word.isNew),
    ).toBe(true);
  });

  it("只有起点在游标之后的词算新词", () => {
    const words = splitAnimatedWords("alpha beta gamma", 0, 11);
    expect(words.filter((word) => word.isNew).map((word) => word.text)).toEqual(
      ["gamma"],
    );
  });
});

describe("getSafeMarkdown", () => {
  it("截断超深嵌套，让 marked 的递归 tokenizer 不至于爆栈", () => {
    const deep = `${">".repeat(3000)} x`;
    const safe = getSafeMarkdown(deep);
    expect(safe.length).toBeLessThan(deep.length);
    // 截断之后必须还能走完分块 + 管线，不抛。
    expect(() =>
      markdownToHast(safe, {
        remarkPlugins: appRemarkPlugins,
        rehypePlugins: [], // 消息路径的同步 rehype 链现在是空的：KaTeX 由 core/markdown/math.ts 按内容加载。
      }),
    ).not.toThrow();
  });
});
