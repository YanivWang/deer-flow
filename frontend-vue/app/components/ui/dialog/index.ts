/*
  【文件职责】     暴露 Dialog primitive 的全部组成部分。
  【架构位置】     L2
  【主要导出】     Dialog 及其子组件
  【依赖关系】     被产品组件显式导入
  【边界与注意】   禁止依赖业务模块。
*/

export { default as Dialog } from "./Dialog.vue";
export { default as DialogClose } from "./DialogClose.vue";
export { default as DialogContent } from "./DialogContent.vue";
export { default as DialogDescription } from "./DialogDescription.vue";
export { default as DialogFooter } from "./DialogFooter.vue";
export { default as DialogHeader } from "./DialogHeader.vue";
export { default as DialogOverlay } from "./DialogOverlay.vue";
export { default as DialogTitle } from "./DialogTitle.vue";
export { default as DialogTrigger } from "./DialogTrigger.vue";
