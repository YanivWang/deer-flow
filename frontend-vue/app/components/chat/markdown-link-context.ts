/*
  【文件职责】     定义 MessageList 向 MarkdownLink 提供 thread/mock 上下文的响应式注入合同。
  【对应 frontend/】 React 以闭包 createMarkdownLinkComponent(threadId) 传递同一上下文
  【架构位置】     L3 message UI adapter
  【主要导出】     MARKDOWN_LINK_CONTEXT · MarkdownLinkContext
  【依赖关系】     Vue InjectionKey/Ref
  【边界与注意】   provide 必须持有 computed/ref，不能把当前裸值注入后失去路由响应性。
*/

import type { InjectionKey, Ref } from "vue";

export type MarkdownLinkContext = {
  threadId: Readonly<Ref<string | null | undefined>>;
  isMock: Readonly<Ref<boolean | undefined>>;
};

export const MARKDOWN_LINK_CONTEXT: InjectionKey<MarkdownLinkContext> = Symbol(
  "message-markdown-link-context",
);
