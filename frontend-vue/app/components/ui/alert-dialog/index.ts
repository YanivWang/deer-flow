/*
  【文件职责】     暴露 AlertDialog primitive 的全部组成部分。
  【架构位置】     L2
  【主要导出】     AlertDialog 及其子组件
  【依赖关系】     被产品组件显式导入
  【边界与注意】   禁止依赖业务模块。
*/

export { default as AlertDialog } from "./AlertDialog.vue";
export { default as AlertDialogAction } from "./AlertDialogAction.vue";
export { default as AlertDialogCancel } from "./AlertDialogCancel.vue";
export { default as AlertDialogContent } from "./AlertDialogContent.vue";
export { default as AlertDialogDescription } from "./AlertDialogDescription.vue";
export { default as AlertDialogFooter } from "./AlertDialogFooter.vue";
export { default as AlertDialogHeader } from "./AlertDialogHeader.vue";
export { default as AlertDialogTitle } from "./AlertDialogTitle.vue";
export { default as AlertDialogTrigger } from "./AlertDialogTrigger.vue";
