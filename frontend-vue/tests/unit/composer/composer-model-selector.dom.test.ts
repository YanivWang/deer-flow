import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";

import ComposerModelSelector from "@/components/chat/ComposerModelSelector.vue";
import { enUS } from "@/core/i18n/locales/en-US";
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

function openSelector(props: Record<string, unknown>) {
  const wrapper = mount(ComposerModelSelector, {
    attachTo: document.body,
    props: { models, ...props },
  });
  return { wrapper, trigger: wrapper.get("button") };
}

function items() {
  return [
    ...document.querySelectorAll<HTMLElement>('[data-slot="command-item"]'),
  ];
}

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

  /*
    是**对话框**不是下拉菜单：上游 ModelSelector = Dialog，ModelSelectorContent =
    DialogContent + Command。aria-haspopup 是这两种结构最短的判据。
  */
  it("opens a dialog whose command list carries every model and its backend id", async () => {
    const { wrapper, trigger } = openSelector({ selectedModel: models[0] });

    expect(trigger.attributes("aria-haspopup")).toBe("dialog");
    expect(trigger.attributes("aria-expanded")).toBe("false");
    await trigger.trigger("click");
    await flushPromises();
    expect(trigger.attributes("aria-expanded")).toBe("true");

    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(items().map((item) => item.textContent)).toEqual([
      "MiniMax CN / MiniMax-M3MiniMax-M3",
      "Fast ModelFast",
    ]);
    wrapper.unmount();
  });

  /*
    搜索框是这一轮的正题：`inputBox.searchModels` 之所以是死词条，就是因为本仓
    以前是 DropdownMenu，根本没有输入框。
  */
  it("filters the list through the search box and restores it on reopen", async () => {
    const { wrapper, trigger } = openSelector({ selectedModel: models[0] });
    await trigger.trigger("click");
    await flushPromises();

    const search = document.querySelector<HTMLInputElement>(
      '[data-slot="command-input"]',
    )!;
    expect(search.getAttribute("placeholder")).toBe(enUS.inputBox.searchModels);

    search.value = "FAST";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    await flushPromises();
    expect(items()).toHaveLength(1);
    expect(items()[0]!.textContent).toContain("Fast Model");

    // 无匹配时列表就是空的：上游两个调用点都没有渲染 ModelSelectorEmpty。
    search.value = "nothing-matches";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    await flushPromises();
    expect(items()).toHaveLength(0);
    expect(document.querySelector('[data-slot="command-empty"]')).toBeNull();

    // 关掉再开，查询回到空——上游每次开合都重挂 CommandInput。
    await trigger.trigger("click");
    await flushPromises();
    await trigger.trigger("click");
    await flushPromises();
    expect(items()).toHaveLength(2);
    wrapper.unmount();
  });

  it("emits the picked model and closes the dialog", async () => {
    const { wrapper, trigger } = openSelector({ selectedModel: models[0] });
    await trigger.trigger("click");
    await flushPromises();

    items()
      .find((item) => item.textContent?.includes("Fast Model"))!
      .click();
    await flushPromises();

    expect(wrapper.emitted("select")).toEqual([[models[1]]]);
    expect(trigger.attributes("aria-expanded")).toBe("false");
    wrapper.unmount();
  });

  /*
    React 把 composerLocked 交给 ModelSelectorTrigger 的按钮，两个
    handleModelSelect 也各自在 disabled 时 return。两层都要有：键盘从已经打开的
    对话框里仍然够得着列表项。
  */
  it("locks the trigger and refuses selection while disabled", async () => {
    const { wrapper, trigger } = openSelector({ selectedModel: models[0] });
    await trigger.trigger("click");
    await flushPromises();

    /*
      先开着再锁：光断言按钮 disabled 是看不见第二层的——那时列表根本没渲染，
      "没有 emit" 会自动成立（坑 57）。锁在对话框已经开着的时候按下列表项，
      才真的走到 selectModel 的那条早退。
    */
    await wrapper.setProps({ disabled: true });
    await flushPromises();
    expect(trigger.attributes("disabled")).toBeDefined();

    items()
      .find((item) => item.textContent?.includes("Fast Model"))!
      .click();
    await flushPromises();
    expect(wrapper.emitted("select")).toBeUndefined();
    wrapper.unmount();
  });
});
