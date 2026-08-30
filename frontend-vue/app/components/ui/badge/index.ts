/*
  【文件职责】     暴露 Badge 组件与样式变体。
  【架构位置】     L2
  【主要导出】     Badge、badgeVariants
  【依赖关系】     被产品组件显式导入
  【边界与注意】   禁止依赖业务模块。
*/

export { default as Badge } from "./Badge.vue";
export { badgeVariants } from "./variants";
