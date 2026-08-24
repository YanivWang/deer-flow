/*
  【文件职责】     暴露 Select primitive 的全部组成部分。
  【架构位置】     L2
  【主要导出】     Select 及其子组件
  【依赖关系】     被产品组件显式导入
  【边界与注意】   禁止依赖业务模块。
*/

export { default as Select } from "./Select.vue";
export { default as SelectContent } from "./SelectContent.vue";
export { default as SelectItem } from "./SelectItem.vue";
export { default as SelectTrigger } from "./SelectTrigger.vue";
export { default as SelectValue } from "./SelectValue.vue";
