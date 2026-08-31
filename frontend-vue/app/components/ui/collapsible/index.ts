/*
  【文件职责】     折叠容器的公共入口。
  【架构位置】     L2
  【主要导出】     Collapsible / CollapsibleTrigger / CollapsibleContent
  【依赖关系】     同目录 SFC
  【边界与注意】   与上游 `ui/collapsible.tsx` 的三个导出一一对应。
*/
export { default as Collapsible } from "./Collapsible.vue";
export { default as CollapsibleContent } from "./CollapsibleContent.vue";
export { default as CollapsibleTrigger } from "./CollapsibleTrigger.vue";
