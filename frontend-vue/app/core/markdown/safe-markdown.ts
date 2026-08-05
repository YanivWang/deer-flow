/*
  【文件职责】     渲染前的 markdown 归一化入口：嵌套截断 + LaTeX 定界符归一化。
  【对应 frontend/】 frontend/src/core/streamdown/safe-children.ts（34 行 React）
  【架构位置】     L2 候选 —— 渲染层
  【主要导出】     getSafeMarkdown
  【依赖关系】     ../streamdown/preprocess（COPIED，逐字节与上游一致）
  【边界与注意】   上游那 34 行里有 30 行是 React：`ComponentProps<typeof Streamdown>` 的
                   children 类型、两个 `useMemo` 包装。真正的逻辑只有一行组合。
                   Vue 侧不需要 hook——记忆化归组件的 `computed`，不进 core。

                   ⚠️ `capMarkdownNesting`（内含 `capBlockquoteNesting` / `capListNesting`）
                   **不能省**。marked 的递归 tokenizer 在约 2000 层嵌套上爆栈，
                   而分块用的正是 marked 的 Lexer——爆栈发生在渲染期间，会把整条聊天路由
                   变成错误页（issue #3393）。错误边界能兜住单条消息，兜不住栈溢出前
                   已经消耗掉的调用栈。

                   `preprocess.ts` 落在 `app/core/streamdown/` 而不是本目录：它是 `COPIED`
                   档，路径由 `land-copied` 从上游路径机械映射。移动它要连带改 land-copied
                   映射、eslint 与 .prettierignore 三处路径，且会让 hash 守护失去对标——
                   代价与 M2 对 `stream-mode.ts` 的判断一致（05 §A2 修正 1），所以不动。
*/

import {
  capMarkdownNesting,
  normalizeStreamdownMathMarkdown,
} from "../streamdown/preprocess";

export function getSafeMarkdown(markdown: string): string {
  return normalizeStreamdownMathMarkdown(capMarkdownNesting(markdown));
}
