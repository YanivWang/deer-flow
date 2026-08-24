/*
  【文件职责】     暴露 Switch primitive。
  【架构位置】     L2
  【主要导出】     Switch
  【依赖关系】     被产品组件显式导入
  【边界与注意】   禁止依赖业务模块。
*/

export { default as Switch } from "./Switch.vue";
