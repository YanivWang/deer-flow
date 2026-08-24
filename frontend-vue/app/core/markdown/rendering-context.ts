/*
  【文件职责】     在消息 Markdown 渲染树内传递流式动画状态。
  【对应 frontend/】 streamdown 内部 animation context
  【架构位置】     L2 markdown rendering contract
  【主要导出】     markdownStreamingKey
  【依赖关系】     Vue dependency injection
  【边界与注意】   只承载渲染期状态，不持有消息或请求状态；非消息预览默认视为静态内容。
*/
import type { InjectionKey, Ref } from "vue";

export const markdownStreamingKey: InjectionKey<Readonly<Ref<boolean>>> =
  Symbol("markdown-streaming");
