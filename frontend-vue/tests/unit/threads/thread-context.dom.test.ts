/*
  【文件职责】     05 M1 / M2 的机器化：provide 必须传响应式载体，inject 必须在 setup。
  【对应 frontend/】 无——这两条是 React→Vue 的语义差异，上游没有对应物
  【架构位置】     L3 测试（dom project）
  【主要导出】     无
  【依赖关系】     app/composables/thread-context.ts
  【边界与注意】   **最后一条用例是这份文件存在的理由。** 它把 M1 的失败形态跑了
                   一遍：照搬 React 的 `provide(key, { open, setOpen })`——编译过、
                   运行不报错、`open` 变化时消费方**一个字都不变**。
                   没有这条用例，M1 就只是文档里的一句话；有了它，写错的人当场红。
*/

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { computed, defineComponent, h, ref } from "vue";

import { defineThreadContext } from "@/composables/thread-context";

const Ctx = defineThreadContext<{ open: ReturnType<typeof ref<boolean>> }>(
  "test-panel",
);

const Child = defineComponent({
  setup() {
    const ctx = Ctx.use();
    return () => h("span", String(ctx.open.value));
  },
});

describe("defineThreadContext", () => {
  it("provide 一个装着 ref 的对象：子组件看得到后续变化", async () => {
    const open = ref(false);
    const Parent = defineComponent({
      setup() {
        Ctx.provide({ open });
        return () => h(Child);
      },
    });
    const wrapper = mount(Parent);
    expect(wrapper.text()).toBe("false");

    open.value = true;
    await wrapper.vm.$nextTick();
    // 正面特征：**变化传播到了**。只断言首帧是 "false" 的话，
    // 传一个普通对象也会绿。
    expect(wrapper.text()).toBe("true");
    wrapper.unmount();
  });

  it("computed 也接受", () => {
    const source = ref(1);
    const Parent = defineComponent({
      setup() {
        Ctx.provide({ open: computed(() => source.value > 0) } as never);
        return () => h(Child);
      },
    });
    const wrapper = mount(Parent);
    expect(wrapper.text()).toBe("true");
    wrapper.unmount();
  });

  it("没有 provider 时 inject 抛出指名道姓的错误，不是 undefined", () => {
    expect(() => mount(Child)).toThrow(/test-panel/);
  });

  it("M1：provide 一个裸值对象当场抛（React 那个写法照搬过来的形状）", () => {
    const Parent = defineComponent({
      setup() {
        // 这正是 `provide(ctx, { open, setOpen })` 搬过来的样子：
        // `open` 是**当时那一刻**的布尔值，之后再也不会变。
        Ctx.provide({ open: false } as never);
        return () => h(Child);
      },
    });
    expect(() => mount(Parent)).toThrow(/05 M1/);
  });
});
