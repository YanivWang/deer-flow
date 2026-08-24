/*
  【文件职责】     暴露 Tooltip primitive 的全部组成部分。
  【架构位置】     L2
  【主要导出】     Tooltip 及其子组件
  【依赖关系】     被产品组件显式导入
  【边界与注意】   禁止依赖业务模块。
*/

export { default as Tooltip } from "./Tooltip.vue";
export { default as TooltipContent } from "./TooltipContent.vue";
export { default as TooltipProvider } from "./TooltipProvider.vue";
export { default as TooltipTrigger } from "./TooltipTrigger.vue";
