import { mount } from "@vue/test-utils";
import { computed, defineComponent, h, ref } from "vue";
import { describe, expect, it } from "vitest";

import type { AgentThreadContext } from "../../../../app/core/api/thread/types";
import { useChatThreadSettings } from "../../../../app/features/chat/thread-settings/use-chat-thread-settings";

describe("useChatThreadSettings", () => {
  it("keeps server context and route agent in the run context", () => {
    const wrapper = mountSettingsHarness(
      ref("thread-a"),
      ref({ model_name: "server-model", thinking_enabled: true }),
      ref("researcher"),
    );

    expect(wrapper.vm.settings.threadRunContext.value).toEqual({
      agent_name: "researcher",
      model_name: "server-model",
      thinking_enabled: true,
    });
  });

  it("owns semantic updates, validation, persistence, and reset", async () => {
    const storage = memoryStorage();
    const threadId = ref("thread-a");
    const wrapper = mountSettingsHarness(threadId, ref(null), ref(null), storage);

    wrapper.vm.settings.updateModelName("  local-model  ");
    wrapper.vm.settings.updateMode("pro");
    wrapper.vm.settings.updateReasoningEffort("high");
    wrapper.vm.settings.updateThinkingEnabled(true);
    wrapper.vm.settings.updateSubagentEnabled(true);
    wrapper.vm.settings.updateMode("unsupported");
    wrapper.vm.settings.updateReasoningEffort("unsupported");
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.settings.threadRunContext.value).toEqual({
      model_name: "local-model",
      thinking_enabled: true,
      subagent_enabled: true,
    });
    expect(storage.getItem("deerflow.thread-model.thread-a")).toBe("local-model");

    wrapper.vm.settings.resetContext();
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.settings.threadRunContext.value).toBeUndefined();
    expect(storage.getItem("deerflow.thread-model.thread-a")).toBeNull();
  });
});

function mountSettingsHarness(
  threadId: ReturnType<typeof ref<string>>,
  serverContext: ReturnType<typeof ref<AgentThreadContext | null>>,
  agentName: ReturnType<typeof ref<string | null>>,
  storage: ReturnType<typeof memoryStorage> = memoryStorage(),
) {
  return mount(
    defineComponent({
      setup() {
        const settings = useChatThreadSettings({
          agentName: computed(() => agentName.value),
          serverContext: computed(() => serverContext.value),
          storage,
          threadId: computed(() => threadId.value),
        });
        return { settings };
      },
      render() {
        return h("div");
      },
    }),
  );
}

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}
