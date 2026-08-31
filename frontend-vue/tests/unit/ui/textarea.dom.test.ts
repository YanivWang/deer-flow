/*
  【文件职责】     钉住 Textarea primitive 的 data-slot 合同、样式基线与 v-model 往返。
  【架构位置】     L2 单元测试
  【主要导出】     无；Vitest cases
  【依赖关系】     app/components/ui/textarea
  【边界与注意】   v-model 那一条不是走形式，它钉的是坑 72：Vue 的 `renderComponentRoot`
                   在合并 `$attrs` 之前跑 `filterModelListeners`，凡是 `onUpdate:<key>`
                   且组件**声明了同名 prop**，就从 fallthrough 里剔掉——不报警告、
                   不报错，只是永远收不到事件。`Textarea.vue` 声明了 `modelValue`，
                   所以它必须自己 `defineEmits` 并显式 emit；漏掉就是静默失效。

                   `aria-invalid` 的那条 class 也要在：上游把错误态的边框与焦点环
                   完全挂在 `aria-invalid:` 变体上，class 少一半时属性还在、颜色没了。
*/

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import { Textarea } from "@/components/ui/textarea";

describe("Textarea primitive", () => {
  it("keeps the data-slot contract and the upstream style baseline", () => {
    const wrapper = mount(Textarea, { props: { modelValue: "hello" } });
    const element = wrapper.get("textarea");

    expect(element.attributes("data-slot")).toBe("textarea");
    expect((element.element as HTMLTextAreaElement).value).toBe("hello");

    const className = element.attributes("class") ?? "";
    for (const token of [
      "field-sizing-content",
      "min-h-16",
      "w-full",
      "rounded-md",
      "border-input",
      "shadow-xs",
      "aria-invalid:border-destructive",
      "focus-visible:ring-[3px]",
      "disabled:cursor-not-allowed",
      "md:text-sm",
    ]) {
      expect(className).toContain(token);
    }
  });

  it("merges the caller class instead of dropping the baseline", () => {
    const wrapper = mount(Textarea, {
      props: { class: "min-h-20 resize-y text-sm" },
    });
    const className = wrapper.get("textarea").attributes("class") ?? "";

    // twMerge：调用方的 min-h-20 覆盖基线的 min-h-16，其余基线保留。
    expect(className).toContain("min-h-20");
    expect(className).not.toContain("min-h-16");
    expect(className).toContain("resize-y");
    expect(className).toContain("field-sizing-content");
  });

  it("emits update:modelValue so v-model round-trips through the wrapper", async () => {
    const wrapper = mount(Textarea, { props: { modelValue: "" } });
    const element = wrapper.get("textarea");

    (element.element as HTMLTextAreaElement).value = "typed";
    await element.trigger("input");

    expect(wrapper.emitted("update:modelValue")).toEqual([["typed"]]);
  });
});
