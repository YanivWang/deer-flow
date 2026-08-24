/*
  【文件职责】     暴露 Button 组件与样式变体。
  【架构位置】     L2
  【主要导出】     Button、buttonVariants
  【依赖关系】     被页面显式导入
  【边界与注意】   禁止依赖业务模块。
*/

export { default as Button } from "./Button.vue";
export { buttonVariants } from "./variants";
