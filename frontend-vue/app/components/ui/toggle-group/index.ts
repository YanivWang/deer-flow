/*
  【文件职责】     暴露 ToggleGroup primitive 的组成部分。
  【架构位置】     L2
  【主要导出】     ToggleGroup · ToggleGroupItem
  【依赖关系】     被产品组件显式导入
  【边界与注意】   禁止依赖业务模块。
*/

export { default as ToggleGroup } from "./ToggleGroup.vue";
export { default as ToggleGroupItem } from "./ToggleGroupItem.vue";
