/*
  【文件职责】     定义 Alert 的可复用 cva 样式合同。
  【架构位置】     L2
  【主要导出】     alertVariants、AlertVariants
  【依赖关系】     被 Alert.vue 引用
  【边界与注意】   变体需和 React frontend/src/components/ui/alert.tsx 对照。
*/

import { cva, type VariantProps } from "class-variance-authority";

export const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        destructive:
          "text-destructive bg-card [&>svg]:text-current *:data-[slot=alert-description]:text-destructive/90",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export type AlertVariants = VariantProps<typeof alertVariants>;
