/*
  【文件职责】     markdown 渲染层的公共导出面。
  【架构位置】     L2 —— 通用渲染层
  【主要导出】     见下
  【依赖关系】     本目录各模块
  【边界与注意】   上游的 `index.ts` 还导出 `./components`（React 包装）与 `./safe-children`
                   的 hook。Vue 侧组件不进 core，记忆化归组件的 `computed`，
                   所以这里只导出纯 TS 那一层。

                   `preprocess` 与 `mermaid` 仍在 `../streamdown/`，与消费它们的
                   Markdown 管线分开：它们处理的是 Streamdown 的输入预处理与图表识别，
                   不属于渲染管线本身。
                   从这里重新导出，好让调用方只认一个入口。
*/

export { normalizeMermaidMarkdown } from "../streamdown/mermaid";
export {
  capBlockquoteNesting,
  capListNesting,
  capMarkdownNesting,
  compactDisplayMathBlocks,
  normalizeLatexMathDelimiters,
  normalizeStreamdownMathMarkdown,
  preprocessStreamdownMarkdown,
  stripLeakedSystemTags,
} from "../streamdown/preprocess";

export { splitAnimatedWords, type AnimatedWord } from "./animate";
export {
  parseMarkdownIntoBlocks,
  toKeyedBlocks,
  type KeyedBlock,
} from "./blocks";
export {
  clearMarkdownProcessorCache,
  createMarkdownProcessor,
  markdownToHast,
  type MarkdownPipelineOptions,
} from "./pipeline";
export {
  appRehypePlugins,
  appRemarkPlugins,
  defaultRehypePlugins,
  defaultRemarkPlugins,
  gfmOptions,
  hardenOptions,
  katexOptions,
  mathOptions,
  rawHtmlRehypePlugins,
  rehypeStreamingListItems,
  remarkCodeMeta,
  remarkHtmlToText,
  streamdownSanitizeSchema,
  wordAnimation,
} from "./plugins";
export {
  applyWordAnimation,
  renderHast,
  VUE_JSX_OPTIONS,
  type RenderHastOptions,
  type WordAnimationOptions,
  type WordAnimationResult,
} from "./render";
export { getSafeMarkdown } from "./safe-markdown";
