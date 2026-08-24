/*
  【文件职责】     定义 Sheet 四个贴边方向的可复用样式合同。
  【架构位置】     L2
  【主要导出】     sheetVariants、SheetVariants
  【依赖关系】     被 SheetContent.vue 引用
  【边界与注意】   宽高只给默认值，具体尺寸由调用方用 class 覆盖。
*/

import { cva, type VariantProps } from "class-variance-authority";

export const sheetVariants = cva(
  "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-80 flex flex-col gap-4 shadow-2xl transition ease-in-out duration-300 outline-none",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 h-auto border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 h-auto border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
        right:
          "inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
      },
    },
    defaultVariants: { side: "right" },
  },
);

export type SheetVariants = VariantProps<typeof sheetVariants>;
