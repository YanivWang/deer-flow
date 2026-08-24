/*
  【文件职责】     逐词动画的纯计算：把文本切成词段，并给每段一个跨 chunk 稳定的 key。
  【架构位置】     L2 —— 通用渲染层
  【主要导出】     splitAnimatedWords · type AnimatedWord
  【依赖关系】     无
  【边界与注意】   ⚠️ **这里不是 rehype 插件，也不许变成 rehype 插件。**
                   05 M4 与 frontend/AGENTS.md 都写死了这条：per-word rehype 插件会在
                   每个 chunk 重建 hast 树，`hast-util-to-jsx-runtime` 按「同名兄弟计数」
                   生成 key（`span-0` `span-1` …），块内结构一变，已经渲染过的词就换 key、
                   重新挂载、重播动画。

                   本层的做法是在**渲染器边界**上做词切分（见 `render.ts` 包住 jsx/jsxs），
                   hast 树一个字节不动，key 由这里给：`w{绝对字符偏移}`。

                   偏移之所以稳定，是因为流式追加是**只增不改**的：
                   已经出现过的词，其起始偏移永远不变；正在生长的最后一个词偏移也不变，
                   只是文本变长——同 key、内容更新，Vue 原地 patch，不重挂载。

                   `revealedLength` 是「上一帧已经渲染到第几个字符」。它决定哪些词是新的：
                   起点在它之后的才播动画。首帧（`revealedLength === 0`）全部不播——
                   一次性把整篇淡入一遍不是流式效果，是闪屏。
*/

export interface AnimatedWord {
  /** 跨 chunk 稳定的 key。 */
  key: string;
  /** 词本身，**含其后紧跟的空白**——不吞字符，拼起来必须等于原文。 */
  text: string;
  /** 在所在文本节点里的起始偏移。 */
  offset: number;
  /** 本帧新出现、需要播入场动画。 */
  isNew: boolean;
}

/**
 * 把一段文本切成带稳定 key 的词段。
 *
 * @param text            文本节点内容
 * @param baseOffset      该文本节点在整块里的起始绝对偏移
 * @param revealedLength  上一帧已渲染的绝对字符数；`0` 表示首帧，一律不播动画
 */
export function splitAnimatedWords(
  text: string,
  baseOffset: number,
  revealedLength: number,
): AnimatedWord[] {
  if (text.length === 0) return [];

  const words: AnimatedWord[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    // 一个词 = 非空白串 + 其后紧跟的空白。空白跟在后面而不是前面，
    // 是为了让「词首偏移」等于该词第一个可见字符的位置，追加时不漂移。
    let end = cursor;
    while (end < text.length && !/\s/.test(text[end] as string)) end += 1;
    // 以空白开头时上一轮什么都没吃，这一轮就把这段空白单独成段——拼回原文不缺字符。
    while (end < text.length && /\s/.test(text[end] as string)) end += 1;

    const offset = baseOffset + cursor;
    words.push({
      key: `w${offset}`,
      text: text.slice(cursor, end),
      offset,
      isNew: revealedLength > 0 && offset >= revealedLength,
    });
    cursor = end;
  }

  return words;
}
