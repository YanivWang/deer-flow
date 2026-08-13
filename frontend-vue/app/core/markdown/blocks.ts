/*
  【文件职责】     把 markdown 切成块，并给每块一个跨 chunk 稳定的 key。
  【对应 frontend/】 无独立文件——上游这段在 `streamdown` 包内部
  【架构位置】     L2 —— 通用渲染层
  【主要导出】     parseMarkdownIntoBlocks · toKeyedBlocks · type KeyedBlock
  【依赖关系】     marked（只用它的 Lexer 做分块，不用它渲染）
  【边界与注意】   分块存在的理由是**流式重渲染的代价**：一条消息在流式期间会被渲染几百次，
                   不分块就等于每个 chunk 把整篇 markdown 重新 parse + diff 一遍。
                   分块之后，只有最后一块在变，前面的块 key 不变、子树不动。

                   四条「不能简化掉」的合并规则，每条都对应一类会被切坏的构造：

                   | 规则                         | 不做会怎样                                       |
                   | ---------------------------- | ------------------------------------------------ |
                   | 出现脚注引用/定义就整篇不切  | 脚注定义与引用被切进不同块，两边互相看不见       |
                   | HTML 块标签配平前不切        | `<div>` 与 `</div>` 分属两块，raw HTML 结构断裂  |
                   | `$$` 计数为奇数时并入上一块  | 显示公式的开闭定界符被切开，KaTeX 拿到半条公式   |
                   | 上一块是围栏代码就不再合并    | 代码块里的 `$$` 不是数学，合并会吃掉后续正文     |

                   **key 的稳定性是 05 M4 的前提**（逐词动画 key 必须稳定）。
                   为什么 key 只能是序号、不能掺内容哈希，见 `toKeyedBlocks` 的注释——
                   那是本窗口实测撞出来的一条，不是设计偏好。
*/

import { Lexer } from "marked";

/** 脚注引用 / 定义：出现任一就整篇不切。 */
const FOOTNOTE_REFERENCE = /\[\^[\w-]{1,200}\](?!:)/;
const FOOTNOTE_DEFINITION = /\[\^[\w-]{1,200}\]:/;

const HTML_OPEN_TAG_NAME = /<(\w+)[\s>]/;
const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

const openTagPatterns = new Map<string, RegExp>();
const closeTagPatterns = new Map<string, RegExp>();

function openTagPattern(tag: string): RegExp {
  const key = tag.toLowerCase();
  const cached = openTagPatterns.get(key);
  if (cached) return cached;
  const pattern = new RegExp(`<${key}(?=[\\s>/])[^>]*>`, "gi");
  openTagPatterns.set(key, pattern);
  return pattern;
}

function closeTagPattern(tag: string): RegExp {
  const key = tag.toLowerCase();
  const cached = closeTagPatterns.get(key);
  if (cached) return cached;
  const pattern = new RegExp(`</${key}(?=[\\s>])[^>]*>`, "gi");
  closeTagPatterns.set(key, pattern);
  return pattern;
}

function countOpenTags(source: string, tag: string): number {
  if (VOID_ELEMENTS.has(tag.toLowerCase())) return 0;
  const matches = source.match(openTagPattern(tag));
  if (!matches) return 0;
  let count = 0;
  for (const match of matches) {
    // 自闭合写法不进栈，否则 `<div/>` 会把后面所有块都吸进来。
    if (!match.trimEnd().endsWith("/>")) count += 1;
  }
  return count;
}

function countCloseTags(source: string, tag: string): number {
  return source.match(closeTagPattern(tag))?.length ?? 0;
}

/** 数 `$$` 的出现次数（成对跳过，避免 `$$$$` 被数成 4）。 */
function countDisplayMathDelimiters(source: string): number {
  let count = 0;
  for (let index = 0; index < source.length - 1; index += 1) {
    if (source[index] === "$" && source[index + 1] === "$") {
      count += 1;
      index += 1;
    }
  }
  return count;
}

/** 把 markdown 切成可独立渲染的块。 */
export function parseMarkdownIntoBlocks(markdown: string): string[] {
  if (FOOTNOTE_REFERENCE.test(markdown) || FOOTNOTE_DEFINITION.test(markdown)) {
    return [markdown];
  }

  const tokens = Lexer.lex(markdown, { gfm: true });
  const blocks: string[] = [];
  /** 尚未配平的 HTML 块标签栈。 */
  const openHtmlTags: string[] = [];
  let previousBlockWasFencedCode = false;

  for (const token of tokens) {
    const raw = token.raw;
    const index = blocks.length;

    if (openHtmlTags.length > 0) {
      blocks[index - 1] += raw;
      const tag = openHtmlTags.at(-1) as string;
      const opened = countOpenTags(raw, tag);
      const closed = countCloseTags(raw, tag);
      for (let i = 0; i < opened; i += 1) openHtmlTags.push(tag);
      for (let i = 0; i < closed; i += 1) {
        if (openHtmlTags.length > 0 && openHtmlTags.at(-1) === tag) {
          openHtmlTags.pop();
        }
      }
      continue;
    }

    if (token.type === "html" && (token as { block?: boolean }).block) {
      const match = raw.match(HTML_OPEN_TAG_NAME);
      if (match) {
        const tag = match[1] as string;
        if (countOpenTags(raw, tag) > countCloseTags(raw, tag)) {
          openHtmlTags.push(tag);
        }
      }
    }

    if (index > 0 && !previousBlockWasFencedCode) {
      const previous = blocks[index - 1] as string;
      if (countDisplayMathDelimiters(previous) % 2 === 1) {
        blocks[index - 1] = previous + raw;
        continue;
      }
    }

    blocks.push(raw);
    if (token.type !== "space") {
      previousBlockWasFencedCode = token.type === "code";
    }
  }

  return blocks;
}

export interface KeyedBlock {
  key: string;
  content: string;
  index: number;
}

/**
 * 给每块配一个 key。
 *
 * **key 就是序号，不掺内容哈希。** 这条是实测撞出来的，值得写下来：
 * 掺哈希的版本（`${index}-${fnv1a(content)}`）看起来更"精确"——同一序号换了内容
 * 就换 key、重新挂载——但流式的最后一块**每个 chunk 都在变**，于是每个 chunk 都会
 * 把它整块卸载重建。后果是 05 M4 当场失守：`tests/unit/markdown/invariants.dom.test.ts`
 * 里「追加后已渲染的词还是同一个 DOM 节点」直接红，因为整棵子树都是新的。
 *
 * 按序号 key 时，内容变化走的是 props 更新，Vue 原地 patch：前面的块不动，
 * 最后一块只补新增的词。「前面某块内容变了也复用旧子树」不是缺陷，正是想要的——
 * 复用即 patch，不是显示旧内容。
 */
export function toKeyedBlocks(blocks: readonly string[]): KeyedBlock[] {
  return blocks.map((content, index) => ({
    key: String(index),
    content,
    index,
  }));
}
