/*
  【文件职责】     暴露 Card primitive 的全部组成部分。
  【架构位置】     L2
  【主要导出】     Card 及其子组件
  【依赖关系】     被产品组件显式导入
  【边界与注意】   禁止依赖业务模块。
*/

export { default as Card } from "./Card.vue";
export { default as CardAction } from "./CardAction.vue";
export { default as CardContent } from "./CardContent.vue";
export { default as CardDescription } from "./CardDescription.vue";
export { default as CardFooter } from "./CardFooter.vue";
export { default as CardHeader } from "./CardHeader.vue";
export { default as CardTitle } from "./CardTitle.vue";
