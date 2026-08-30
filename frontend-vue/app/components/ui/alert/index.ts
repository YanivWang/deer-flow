/*
  【文件职责】     暴露 Alert primitive 的全部组成部分。
  【架构位置】     L2
  【主要导出】     Alert 及其子组件、alertVariants
  【依赖关系】     被产品组件显式导入
  【边界与注意】   禁止依赖业务模块。
*/

export { default as Alert } from "./Alert.vue";
export { default as AlertDescription } from "./AlertDescription.vue";
export { default as AlertTitle } from "./AlertTitle.vue";
export { alertVariants } from "./variants";
