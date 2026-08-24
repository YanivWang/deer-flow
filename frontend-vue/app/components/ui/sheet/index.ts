/*
  【文件职责】     暴露 Sheet primitive 的全部组成部分。
  【架构位置】     L2
  【主要导出】     Sheet 及其子组件、sheetVariants
  【依赖关系】     被产品组件显式导入
  【边界与注意】   禁止依赖业务模块。
*/

export { default as Sheet } from "./Sheet.vue";
export { default as SheetClose } from "./SheetClose.vue";
export { default as SheetContent } from "./SheetContent.vue";
export { default as SheetDescription } from "./SheetDescription.vue";
export { default as SheetFooter } from "./SheetFooter.vue";
export { default as SheetHeader } from "./SheetHeader.vue";
export { default as SheetTitle } from "./SheetTitle.vue";
export { default as SheetTrigger } from "./SheetTrigger.vue";
export { sheetVariants } from "./variants";
