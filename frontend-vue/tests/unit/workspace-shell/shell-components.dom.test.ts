/* shell component contract: one toaster and keyboard-operable palette. */
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, provide } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CommandPalette from "@/components/workspace/CommandPalette.vue";
import WorkspaceToaster from "@/components/workspace/WorkspaceToaster.vue";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";
import { enUS } from "@/core/i18n/locales/en-US";

const push = vi.fn();

function mountWithToast(component: Parameters<typeof h>[0]) {
  const toast = createWorkspaceToastStore({ durationMs: 60_000 });
  const Host = defineComponent({
    setup() {
      provide(workspaceToastKey, toast);
      return () => h(component);
    },
  });
  const wrapper = mount(Host, {
    attachTo: document.body,
    global: {
      config: { globalProperties: { $i18n: { t: { value: enUS } } } },
    },
  });
  return { wrapper, toast };
}

beforeEach(() => {
  document.body.innerHTML = "";
  push.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal("useRouter", () => ({ push }));
  vi.stubGlobal("useRoute", () => ({
    fullPath: "/workspace/chats",
    path: "/workspace/chats",
  }));
  vi.stubGlobal("useNuxtApp", () => ({ $i18n: { t: { value: enUS } } }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("WorkspaceToaster", () => {
  it("renders live success/error toasts and dismisses one", async () => {
    const { wrapper, toast } = mountWithToast(WorkspaceToaster);
    toast.success("Copied");
    toast.error("Denied");
    await flushPromises();
    expect(document.querySelector('[role="status"]')?.textContent).toContain(
      "Copied",
    );
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      "Denied",
    );
    const dismiss = document.querySelector<HTMLButtonElement>(
      '[aria-label="Dismiss notification"]',
    )!;
    dismiss.click();
    await flushPromises();
    expect(document.body.textContent).not.toContain("Copied");
    wrapper.unmount();
    toast.clear();
  });

  /*
    与 React 用的 sonner 同一个形状：region 常驻、列表按需。常驻的 region 是
    live region 的挂载点——它要是随 toast 一起出现，读屏器根本来不及播报第一条。
  */
  it("keeps the live region mounted and the list only while toasts exist", async () => {
    const { wrapper, toast } = mountWithToast(WorkspaceToaster);
    const region = document.querySelector<HTMLElement>(
      '[aria-label="Notifications alt+T"]',
    )!;
    expect(region.tagName).toBe("SECTION");
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(document.querySelector("ol")).toBeNull();

    toast.success("Copied");
    await flushPromises();
    const list = document.querySelector<HTMLElement>("ol")!;
    expect(list).not.toBeNull();

    // 可访问名里写了 alt+T，热键就必须真的把焦点送进列表。
    document.dispatchEvent(
      new KeyboardEvent("keydown", { altKey: true, code: "KeyT" }),
    );
    await flushPromises();
    expect(document.activeElement).toBe(list);

    wrapper.unmount();
    toast.clear();
  });
});

describe("CommandPalette", () => {
  it("opens with Meta-K, navigates actions, selects new chat, and restores focus", async () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    const { wrapper, toast } = mountWithToast(CommandPalette);
    globalThis.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true }),
    );
    await flushPromises();
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog).not.toBeNull();
    const input = document.querySelector<HTMLInputElement>(
      '[aria-label="Search actions"]',
    )!;
    expect(document.activeElement).toBe(input);

    // 焦点留在搜索框，当前项通过 aria-activedescendant 宣告——这是 combobox
    // 该有的形状，也是它和「一排 button 自己记 index」的区别。首项默认高亮，
    // 所以直接回车就执行第一条命令。
    const items = [
      ...document.querySelectorAll<HTMLElement>('[data-slot="command-item"]'),
    ];
    expect(items.map((item) => item.textContent?.trim())).toEqual([
      expect.stringContaining("New chat"),
      expect.stringContaining("Settings"),
      expect.stringContaining("Keyboard Shortcuts"),
    ]);
    expect(input.getAttribute("aria-activedescendant")).toBe(items[0]!.id);

    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    await flushPromises();
    expect(input.getAttribute("aria-activedescendant")).toBe(items[1]!.id);
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
    );
    await flushPromises();
    expect(input.getAttribute("aria-activedescendant")).toBe(items[0]!.id);

    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    await flushPromises();
    expect(push).toHaveBeenCalledWith("/workspace/chats/new");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    wrapper.unmount();
    toast.clear();
  });

  it("does not fire commands from editable/select/IME or after unmount", async () => {
    const { wrapper, toast } = mountWithToast(CommandPalette);
    const select = document.createElement("select");
    document.body.appendChild(select);
    select.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "n",
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      }),
    );
    globalThis.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "n",
        ctrlKey: true,
        shiftKey: true,
        isComposing: true,
      }),
    );
    expect(push).not.toHaveBeenCalled();
    wrapper.unmount();
    globalThis.dispatchEvent(
      new KeyboardEvent("keydown", { key: "n", ctrlKey: true, shiftKey: true }),
    );
    expect(push).not.toHaveBeenCalled();
    toast.clear();
  });
});
