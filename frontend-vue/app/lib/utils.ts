/*
  【文件职责】     合并条件 class 与 Tailwind class。
  【架构位置】     L2
  【主要导出】     cn
  【依赖关系】     被 UI 基础组件消费
  【边界与注意】   保持无 Vue/Nuxt 依赖。
*/

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
