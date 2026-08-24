import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, provide } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ExportTrigger from "@/components/workspace/ExportTrigger.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";

const mocks = vi.hoisted(() => ({ exportThread: vi.fn() }));
vi.mock("@/core/threads/export", () => ({ exportThread: mocks.exportThread }));

const thread = {
  thread_id: "thread-1",
  created_at: "2026-08-24T00:00:00Z",
  updated_at: "2026-08-24T00:00:00Z",
  metadata: {},
  status: "idle",
  values: { title: "Weather", messages: [] },
  interrupts: {},
} as const;
const messages = [{ id: "ai-1", type: "ai", content: "Sunny" }] as const;

function mountTrigger(messageList = messages) {
  const toast = createWorkspaceToastStore({ durationMs: 60_000 });
  const Host = defineComponent({
    setup() {
      provide(workspaceToastKey, toast);
      return () =>
        h(ExportTrigger, {
          threadId: thread.thread_id,
          thread,
          messages: messageList,
        });
    },
  });
  return { wrapper: mount(Host, { attachTo: document.body }), toast };
}

beforeEach(() => {
  document.body.innerHTML = "";
  mocks.exportThread.mockReset();
  vi.stubGlobal("useNuxtApp", () => ({ $i18n: { t: { value: enUS } } }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("ExportTrigger", () => {
  it("replaces the chat-header share action with React-equivalent exports", async () => {
    const { wrapper, toast } = mountTrigger();
    expect(wrapper.find('[aria-label="Export"]').exists()).toBe(true);
    expect(wrapper.text()).not.toContain("Share");

    await wrapper.get('[aria-label="Export"]').trigger("click");
    await flushPromises();
    document
      .querySelector<HTMLButtonElement>(
        '[data-testid="header-export-markdown"]',
      )!
      .click();
    await flushPromises();

    expect(mocks.exportThread).toHaveBeenCalledWith(
      thread,
      messages,
      "markdown",
    );
    expect(toast.toasts.value.at(-1)).toMatchObject({
      kind: "success",
      message: enUS.common.exportSuccess,
    });
    wrapper.unmount();
    toast.clear();
  });

  it("does not render when there are no messages", () => {
    const { wrapper, toast } = mountTrigger([]);
    expect(wrapper.find("button").exists()).toBe(false);
    wrapper.unmount();
    toast.clear();
  });
});
