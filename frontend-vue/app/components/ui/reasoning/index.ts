/*
  【文件职责】     推理披露 primitive 的公共入口。
  【架构位置】     L2
  【主要导出】     Reasoning / ReasoningTrigger / ReasoningContent
  【依赖关系】     同目录 SFC
  【边界与注意】   与上游 `ai-elements/reasoning.tsx` 的三个导出一一对应。
                   `useReasoning` 对应 ./context 的 injectReasoning，不从这里导出：
                   它只服务同目录的 ReasoningTrigger，没有跨目录读者。
*/
export { default as Reasoning } from "./Reasoning.vue";
export { default as ReasoningContent } from "./ReasoningContent.vue";
export { default as ReasoningTrigger } from "./ReasoningTrigger.vue";
