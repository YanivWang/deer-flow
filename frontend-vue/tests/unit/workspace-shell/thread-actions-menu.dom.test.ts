/* thread action menu owns share/export request and visible failure state. */
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, provide } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ThreadActionsMenu from "@/components/workspace/ThreadActionsMenu.vue";
import {
  workspaceToastKey,
  createWorkspaceToastStore,
} from "@/core/workspace-shell/toast";
import { enUS } from "@/core/i18n/locales/en-US";

const mocks = vi.hoisted(() => ({
  clipboard: vi.fn(),
  getState: vi.fn(),
  exportThread: vi.fn(),
}));
vi.mock("@/core/clipboard", () => ({ writeTextToClipboard: mocks.clipboard }));
vi.mock("@/core/api/api-client", () => ({
  getAPIClient: () => ({ threads: { getState: mocks.getState } }),
}));
vi.mock("@/core/threads/export", () => ({ exportThread: mocks.exportThread }));

const thread = {
  thread_id: "t-1",
  created_at: "2026-08-23T00:00:00Z",
  updated_at: "2026-08-23T00:00:00Z",
  metadata: {},
  status: "idle",
  values: { title: "WP 11", messages: [] },
  interrupts: {},
} as const;

function mountMenu() {
  const toast = createWorkspaceToastStore({ durationMs: 60_000 });
  const Host = defineComponent({
    setup() {
      provide(workspaceToastKey, toast);
      return () => h(ThreadActionsMenu, { thread, pinned: false });
    },
  });
  const wrapper = mount(Host, { attachTo: document.body });
  return { wrapper, toast };
}

async function openMenu(wrapper: ReturnType<typeof mount>) {
  await wrapper.get('[aria-label="More"]').trigger("click");
  await flushPromises();
}

/*
  两个导出格式住在「导出」子菜单里（React 的 DropdownMenuSub），不展开就不在 DOM 里。
  这一步不是测试的仪式：它就是这个菜单和一排平级动作的区别。
*/
async function openExportSubmenu() {
  const trigger = document.querySelector<HTMLElement>(
    '[data-slot="dropdown-menu-sub-trigger"]',
  );
  if (!trigger) throw new Error("export submenu trigger not rendered");
  trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await flushPromises();
}

beforeEach(() => {
  document.body.innerHTML = "";
  mocks.clipboard.mockReset().mockResolvedValue(true);
  mocks.getState.mockReset().mockResolvedValue({
    values: { messages: [{ id: "m-1", type: "human", content: "hello" }] },
  });
  mocks.exportThread.mockReset();
  vi.stubGlobal("useNuxtApp", () => ({ $i18n: { t: { value: enUS } } }));
  vi.stubGlobal("location", new URL("https://deer.example/workspace/chats"));
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("ThreadActionsMenu", () => {
  it("shares the stable URL and surfaces clipboard rejection", async () => {
    const { wrapper, toast } = mountMenu();
    await openMenu(wrapper);
    document
      .querySelector<HTMLButtonElement>('[data-testid="thread-share"]')!
      .click();
    await flushPromises();
    expect(mocks.clipboard).toHaveBeenCalledWith(
      "https://deer.example/workspace/chats/t-1",
    );
    expect(toast.toasts.value.at(-1)).toMatchObject({
      kind: "success",
      message: "Link copied to clipboard",
    });

    mocks.clipboard.mockResolvedValueOnce(false);
    await openMenu(wrapper);
    document
      .querySelector<HTMLButtonElement>('[data-testid="thread-share"]')!
      .click();
    await flushPromises();
    expect(toast.toasts.value.at(-1)).toMatchObject({ kind: "error" });
    wrapper.unmount();
    toast.clear();
  });

  it("loads real thread state before export and surfaces request/download failures", async () => {
    const { wrapper, toast } = mountMenu();
    await openMenu(wrapper);
    await openExportSubmenu();
    document
      .querySelector<HTMLButtonElement>(
        '[data-testid="thread-export-markdown"]',
      )!
      .click();
    await flushPromises();
    expect(mocks.getState).toHaveBeenCalledWith("t-1");
    expect(mocks.exportThread).toHaveBeenCalledWith(
      thread,
      [expect.objectContaining({ id: "m-1" })],
      "markdown",
    );

    mocks.exportThread.mockImplementationOnce(() => {
      throw new Error("download blocked");
    });
    await openMenu(wrapper);
    await openExportSubmenu();
    document
      .querySelector<HTMLButtonElement>('[data-testid="thread-export-json"]')!
      .click();
    await flushPromises();
    /*
      失败恒念 `common.exportFailed`，不透传底层错误原文——React 的 catch 是裸的
      `toast.error(t.common.exportFailed)`。原文更好查问题，但那样两个应用在同一个
      失败上念的不是一句话。
    */
    expect(toast.toasts.value.at(-1)).toMatchObject({
      kind: "error",
      message: enUS.common.exportFailed,
    });
    wrapper.unmount();
    toast.clear();
  });
});
