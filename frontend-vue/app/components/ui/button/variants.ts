/*
  【文件职责】     定义 Button 的可复用 cva 样式合同。
  【架构位置】     L2
  【主要导出】     buttonVariants、ButtonVariants
  【依赖关系】     被 Button.vue 与视觉测试引用
  【边界与注意】   变体与尺寸需和 React Button 对照。

                   **导出的 buttonVariants 自己走一遍 cn（tailwind-merge）。**
                   cva 只是拼接，冲突的 Tailwind 类会两条都留在 class 里，赢家由
                   样式表顺序决定而不是拼接顺序——`size: "sm"` 的 `gap-1.5` 就是这样
                   输给 base 的 `gap-2` 的：实测头部那条 Scheduled tasks 链接
                   计算出来的 column-gap 是 8px，上游是 6px，按钮因此宽 2px。

                   上游没有这个坑不是因为 cva 不一样，而是因为它**从不裸调**
                   buttonVariants：唯一的消费者 `Button` 走的是
                   `cn(buttonVariants({ variant, size, className }))`。本仓的 Button
                   没有 as-child，把按钮外观套到 `<NuxtLink>`/`<a>` 上只能裸调，
                   于是这个坑是本仓独有的。把合并放进导出口，裸调也就安全了；
                   Button.vue 里那层 `cn(..., props.class)` 不受影响——twMerge 幂等，
                   调用方的 class 仍然后来居上。
*/

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const rawButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "cursor-pointer bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "cursor-pointer border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "cursor-pointer bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "cursor-pointer hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "cursor-pointer text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export const buttonVariants = ((
  props?: Parameters<typeof rawButtonVariants>[0],
) => cn(rawButtonVariants(props))) as typeof rawButtonVariants;

export type ButtonVariants = VariantProps<typeof rawButtonVariants>;
