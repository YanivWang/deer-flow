/*
  【文件职责】     渲染前的 markdown 归一化入口：嵌套截断 + LaTeX 定界符归一化。
  【架构位置】     L2 —— 通用渲染层
  【主要导出】     getSafeMarkdown
  【依赖关系】     ../streamdown/preprocess
  【边界与注意】   上游那 34 行里有 30 行是 React：`ComponentProps<typeof Streamdown>` 的
                   children 类型、两个 `useMemo` 包装。真正的逻辑只有一行组合。
                   Vue 侧不需要 hook——记忆化归组件的 `computed`，不进 core。

                   ⚠️ `capMarkdownNesting`（内含 `capBlockquoteNesting` / `capListNesting`）
                   **不能省**。marked 的递归 tokenizer 在约 2000 层嵌套上爆栈，
                   而分块用的正是 marked 的 Lexer——爆栈发生在渲染期间，会把整条聊天路由
                   变成错误页（issue #3393）。错误边界能兜住单条消息，兜不住栈溢出前
                   已经消耗掉的调用栈。

                   `preprocess.ts` 落在 `app/core/streamdown/` 而不是本目录：它做的是
                   Streamdown 输入侧的文本规整，不属于 Markdown 渲染管线本身。
*/

import {
  capMarkdownNesting,
  normalizeStreamdownMathMarkdown,
  preprocessStreamdownMarkdown,
} from "../streamdown/preprocess";

export function getSafeMarkdown(markdown: string): string {
  return preprocessStreamdownMarkdown(
    normalizeStreamdownMathMarkdown(capMarkdownNesting(markdown)),
  );
}
