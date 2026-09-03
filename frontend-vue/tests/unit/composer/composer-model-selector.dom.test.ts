import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent } from "vue";

import ComposerModelSelector from "@/components/chat/ComposerModelSelector.vue";
import { Command, CommandInput } from "@/components/ui/command";
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

    /*
      **照屏幕上的字打也要命中**：列表写的是 `display_name`（"MiniMax CN /
      MiniMax-M3"），筛的却是 `name`（`minimax-m3`）。上游有 command-score 的模糊
      评分兜着，本仓原来是纯子串，"minimax m3" 一条都搜不到（wave 37）。
    */
    search.value = "minimax m3";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    await flushPromises();
    expect(items()).toHaveLength(1);
    expect(items()[0]!.textContent).toContain("MiniMax");

    // 原来那条子串判据是这条的严格子集，一起钉住免得被换掉。
    search.value = "minimax-m";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    await flushPromises();
    expect(items()).toHaveLength(1);

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
    命令面板的可访问性合同，逐条对着 cmdk 抄。三条都是 2026-09-02 在对照 probe 里
    实测出来的差异，不是照着文档补的：上游的搜索框是 combobox [expanded]、列表
    带写死的 aria-label="Suggestions"、活动项带 aria-selected；本仓当时分别是
    裸 textbox、无名 listbox、和恒为 false 的 aria-selected。

    名字这一条**没有**跟着上游退让：cmdk 恒定渲染一个 <label cmdk-label> 并把
    aria-labelledby 指过去，而上游两个调用点都没给 Command 传 label，于是那个
    label 是空的、accname 算出空串、placeholder 兜底被压掉——上游的搜索框根本
    没有可访问名。那是缺陷，已两边同改（model-selector.tsx 的 label prop）。
  */
  it("gives the search box combobox semantics and keeps its accessible name", async () => {
    const { wrapper, trigger } = openSelector({ selectedModel: models[0] });
    await trigger.trigger("click");
    await flushPromises();

    const search = document.querySelector<HTMLInputElement>(
      '[data-slot="command-input"]',
    )!;
    expect(search.getAttribute("role")).toBe("combobox");
    expect(search.getAttribute("aria-expanded")).toBe("true");
    expect(search.getAttribute("aria-autocomplete")).toBe("list");
    /*
      名字来自一个视觉隐藏的真 <label>，不是 aria-label——cmdk 就是这样，而
      两者在可访问性树里不等价：aria-label 不留 text 节点，<label> 留。
    */
    const label = document.querySelector<HTMLLabelElement>(
      '[data-slot="command-label"]',
    )!;
    expect(label.textContent?.trim()).toBe(enUS.inputBox.searchModels);
    expect(label.getAttribute("for")).toBe(search.id);
    expect(search.id).not.toBe("");
    expect(search.getAttribute("aria-label")).toBeNull();
    wrapper.unmount();
  });

  /* 没给 label 就不渲染那个元素，对应上游"没传 label"的那一半。 */
  it("renders no label element when the caller gives no name", async () => {
    const wrapper = mount(
      defineComponent({
        components: { Command, CommandInput },
        template: "<Command><CommandInput /></Command>",
      }),
      { attachTo: document.body },
    );
    await flushPromises();
    expect(document.querySelector('[data-slot="command-label"]')).toBeNull();
    wrapper.unmount();
  });

  it("names the list the way cmdk does", async () => {
    const { wrapper, trigger } = openSelector({ selectedModel: models[0] });
    await trigger.trigger("click");
    await flushPromises();

    expect(
      document
        .querySelector('[data-slot="command-list"]')
        ?.getAttribute("aria-label"),
    ).toBe(enUS.primitives.suggestions);
    wrapper.unmount();
  });

  /*
    活动项就是 aria-selected 的那一项。Reka 的 Listbox 把 aria-selected 当成
    「被选中的值」、高亮只落在 data-highlighted 上，于是所有项恒为 false；cmdk 的
    `value` 就是活动项。combobox + aria-activedescendant 的组合下必须是后者，
    否则读屏器指过去的那一项在树里根本不是选中态。

    断言两半都要有（坑 57）：换一项高亮之后，**旧的那一项要掉回 false**。
  */
  it("marks the highlighted option as the selected one", async () => {
    const { wrapper, trigger } = openSelector({ selectedModel: models[0] });
    await trigger.trigger("click");
    await flushPromises();

    const selected = () =>
      items().map((item) => item.getAttribute("aria-selected"));
    expect(selected()).toEqual(["true", "false"]);

    items()[1]!.dispatchEvent(new MouseEvent("pointermove", { bubbles: true }));
    await flushPromises();
    expect(selected()).toEqual(["false", "true"]);
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
