/*
  【文件职责】     钉住 buttonVariants 裸调时的类冲突解析。
  【架构位置】     L2 单元测试
  【主要导出】     无；Vitest cases
  【依赖关系】     app/components/ui/button/variants.ts
  【边界与注意】   钉的是「冲突的 Tailwind 类只剩一条，且留下的是尺寸档那条」。
                   cva 只拼接不合并，两条都留下时赢家由样式表顺序决定——实测头部那条
                   Scheduled tasks 链接因此拿到 8px 的 column-gap，而上游是 6px。
                   本仓的 Button 没有 as-child，把按钮外观套到 `<NuxtLink>`/`<a>` 上
                   只能裸调 buttonVariants，所以合并必须发生在导出口。
*/

import { describe, expect, it } from "vitest";

// 从 variants.ts 直接进，不走 index：node 环境不编译 .vue。
import { buttonVariants } from "@/components/ui/button/variants";
import { cn } from "@/lib/utils";

function classes(value: string) {
  return value.split(/\s+/).filter(Boolean);
}

describe("buttonVariants", () => {
  it("lets the size tier win over the base for conflicting utilities", () => {
    const sm = classes(buttonVariants({ variant: "outline", size: "sm" }));
    expect(sm).toContain("gap-1.5");
    expect(sm).not.toContain("gap-2");
    expect(sm).toContain("h-8");
    expect(sm).toContain("px-3");
  });

  it("keeps the base gap when the size tier does not override it", () => {
    expect(classes(buttonVariants())).toContain("gap-2");
    expect(classes(buttonVariants({ size: "icon" }))).toContain("gap-2");
  });

  it("emits every utility at most once", () => {
    for (const size of ["default", "sm", "lg", "icon"] as const) {
      const list = classes(buttonVariants({ variant: "outline", size }));
      expect(new Set(list).size, `size=${size}`).toBe(list.length);
    }
  });

  it("still lets a call-site class beat the variant class", () => {
    // 与 Button.vue 同一条路径：cn(buttonVariants(...), props.class)。
    // 内层已经合并过一次，外层这次仍要生效——twMerge 幂等，调用方后来居上。
    const merged = classes(cn(buttonVariants({ size: "sm" }), "gap-4 h-12"));
    expect(merged.filter((item) => item.startsWith("gap-"))).toEqual(["gap-4"]);
    expect(merged.filter((item) => /^h-/.test(item))).toEqual(["h-12"]);
  });
});
