/*
  【文件职责】     暴露 DropdownMenu primitive 的全部组成部分。
  【架构位置】     L2
  【主要导出】     DropdownMenu 及其子组件
  【依赖关系】     被产品组件显式导入
  【边界与注意】   禁止依赖业务模块。
*/

export { default as DropdownMenu } from "./DropdownMenu.vue";
export { default as DropdownMenuContent } from "./DropdownMenuContent.vue";
export { default as DropdownMenuItem } from "./DropdownMenuItem.vue";
export { default as DropdownMenuLabel } from "./DropdownMenuLabel.vue";
export { default as DropdownMenuRadioGroup } from "./DropdownMenuRadioGroup.vue";
export { default as DropdownMenuRadioItem } from "./DropdownMenuRadioItem.vue";
export { default as DropdownMenuSeparator } from "./DropdownMenuSeparator.vue";
export { default as DropdownMenuSub } from "./DropdownMenuSub.vue";
export { default as DropdownMenuSubContent } from "./DropdownMenuSubContent.vue";
export { default as DropdownMenuSubTrigger } from "./DropdownMenuSubTrigger.vue";
export { default as DropdownMenuTrigger } from "./DropdownMenuTrigger.vue";

/** Radio group 的值类型；调用方不必为了一个类型再去 import reka-ui。 */
export type { AcceptableValue as DropdownMenuValue } from "reka-ui";
