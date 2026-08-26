import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";

import ComposerModelSelector from "@/components/chat/ComposerModelSelector.vue";
import type { Model } from "@/core/models/types";

const models: Model[] = [
  {
    id: "minimax-m3",
    name: "minimax-m3",
    model: "MiniMax-M3",
    display_name: "MiniMax CN / MiniMax-M3",
    supports_thinking: true,
    supports_reasoning_effort: true,
  },
  {
    id: "fast",
    name: "fast",
    model: "Fast",
    display_name: "Fast Model",
    supports_thinking: false,
    supports_reasoning_effort: false,
  },
];

afterEach(() => {
  document.body.innerHTML = "";
});

describe("composer model selector", () => {
  /*
    没有选中模型时触发器**仍然**渲染，只是没有名字——与 React 的
    ModelSelectorTrigger 一致。藏掉它会让工具条控件数随后端返回什么而变。
  */
  it("keeps the trigger mounted and unnamed before a model resolves", () => {
    const wrapper = mount(ComposerModelSelector, { props: { models } });
    const button = wrapper.get("button");
    expect(button.attributes("aria-label")).toBeUndefined();
    expect(button.text()).toBe("");
  });

  it("uses the React responsive width contract and keeps truncation on the text only", () => {
    const wrapper = mount(ComposerModelSelector, {
      props: { models, selectedModel: models[0] },
    });

    const button = wrapper.get("button");
    expect(button.classes()).toEqual(
      expect.arrayContaining(["min-w-0", "max-w-40", "px-2.5", "sm:max-w-56"]),
    );
    expect(button.classes()).not.toContain("truncate");
    expect(button.get("span").classes()).toContain("truncate");
  });

  it("owns the shared menu lifecycle and emits the selected model", async () => {
    const wrapper = mount(ComposerModelSelector, {
      attachTo: document.body,
      props: { models, selectedModel: models[0] },
    });
    const trigger = wrapper.get("button");

    // 菜单内容 portal 到 body：开合、方向键、Escape 与焦点归还都归 primitive，
    // 所以断言走 document 而不是 wrapper 子树。
    expect(trigger.attributes("aria-expanded")).toBe("false");
    expect(trigger.attributes("aria-haspopup")).toBe("menu");
    await trigger.trigger("click");
    await flushPromises();
    expect(trigger.attributes("aria-expanded")).toBe("true");

    const items = [
      ...document.querySelectorAll<HTMLElement>(
        '[data-slot="dropdown-menu-radio-item"]',
      ),
    ];
    expect(items.map((item) => item.getAttribute("aria-checked"))).toEqual([
      "true",
      "false",
    ]);
    items.find((item) => item.textContent?.trim() === "Fast Model")!.click();
    await flushPromises();

    expect(wrapper.emitted("select")).toEqual([[models[1]]]);
    expect(trigger.attributes("aria-expanded")).toBe("false");
    wrapper.unmount();
  });
});
