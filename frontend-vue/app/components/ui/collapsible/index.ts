/*
  【文件职责】     折叠容器的公共入口。
  【架构位置】     L2
  【主要导出】     Collapsible / CollapsibleContent
  【依赖关系】     同目录 SFC
  【边界与注意】   上游 `ui/collapsible.tsx` 还导出 CollapsibleTrigger，本仓暂不移植：
                   它只被 ChainOfThoughtHeader 用，而那个组件本仓没有调用点。
                   缺的不是能力，是需求——真用到时按上游那 11 行补即可。
*/
export { default as Collapsible } from "./Collapsible.vue";
export { default as CollapsibleContent } from "./CollapsibleContent.vue";
