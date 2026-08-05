/*
  【文件职责】     本层自带的元素覆盖表：把 `pre` 交给代码块 / mermaid UI。
  【对应 frontend/】 frontend/src/core/streamdown/components.tsx（那 90 行是 React 包装，不是这张表）
  【架构位置】     L2 候选 —— 渲染层组件
  【主要导出】     richContentComponents
  【依赖关系】     ./MarkdownPre.vue
  【边界与注意】   这里**只有代码块与 mermaid**。上游 streamdown 的默认组件映射有 37 个槽位
                   （标题、表格工具栏、链接安全弹窗、图片放大、上下标……），本层不复刻：
                   02/04 已裁决 UI 层走 shadcn-vue 并逐字复制 cva 串，不从 streamdown 的
                   dist 里搬 Vercel 的产品 UI。那 37 个槽位的归属在组件层（M4b），
                   规格记录在 `tests/fixtures/react-markdown-dom.json` 的 `styledHtml` 里。

                   代码块与 mermaid 是例外，理由是它们**不是样式，是行为**：
                   shiki 高亮、复制/下载、mermaid 解析与流式中间态容错——
                   这些放到组件层等于让 M4b 重做一遍渲染逻辑。
*/

import MarkdownPre from "./MarkdownPre.vue";

/** 传给 `StreamMarkdown` 的 `components`。⚠️ 覆盖组件收到的是 `class` 不是 `className`。 */
export const richContentComponents = {
  pre: MarkdownPre,
} as const;
