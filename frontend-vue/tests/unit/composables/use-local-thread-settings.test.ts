import { mount } from "@vue/test-utils";
import { computed, defineComponent, h, ref } from "vue";
import { describe, expect, it } from "vitest";

import { useLocalThreadSettings } from "../../../app/composables/use-local-thread-settings";
import type { AgentThreadContext } from "../../../app/core/api/thread/types";
import { LOCAL_SETTINGS_KEY, threadModelStorageKey } from "../../../app/core/settings/local";

describe("useLocalThreadSettings", () => {
  it("merges server context, global local settings, and thread model override", async () => {
    const storage = memoryStorage();
    storage.setItem(
      LOCAL_SETTINGS_KEY,
      JSON.stringify({ context: { model_name: "global-model", reasoning_effort: "low" } }),
    );
    storage.setItem(threadModelStorageKey("thread-a"), "thread-model");
    const threadId = ref("thread-a");
    const serverContext = ref<AgentThreadContext | null>({
      agent_name: "server-agent",
      model_name: "server-model",
      thinking_enabled: true,
    });
    const wrapper = mountSettingsHarness(threadId, serverContext, storage);

    expect(wrapper.vm.settings.effectiveContext.value).toEqual({
      agent_name: "server-agent",
      model_name: "thread-model",
      thinking_enabled: true,
      reasoning_effort: "low",
    });

    wrapper.vm.settings.updateContext({ model_name: "updated-thread-model", mode: "pro" });
    await wrapper.vm.$nextTick();
    expect(storage.getItem(threadModelStorageKey("thread-a"))).toBe("updated-thread-model");
    expect(wrapper.vm.settings.effectiveContext.value.model_name).toBe("updated-thread-model");
    expect(wrapper.vm.settings.effectiveContext.value.mode).toBe("pro");

    wrapper.vm.settings.updateContext({ model_name: undefined });
    await wrapper.vm.$nextTick();
    expect(storage.getItem(threadModelStorageKey("thread-a"))).toBeNull();
    expect(wrapper.vm.settings.effectiveContext.value.model_name).toBe("server-model");
  });

  it("reloads thread model overrides when thread id changes and can reset local context", async () => {
    const storage = memoryStorage();
    storage.setItem(threadModelStorageKey("thread-b"), "model-b");
    const threadId = ref("thread-a");
    const wrapper = mountSettingsHarness(threadId, ref(null), storage);

    expect(wrapper.vm.settings.effectiveContext.value.model_name).toBeUndefined();

    threadId.value = "thread-b";
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.settings.effectiveContext.value.model_name).toBe("model-b");

    wrapper.vm.settings.resetContext();
    await wrapper.vm.$nextTick();
    expect(storage.getItem(threadModelStorageKey("thread-b"))).toBeNull();
    expect(wrapper.vm.settings.effectiveContext.value).toEqual({});
  });
});

function mountSettingsHarness(
  threadId: ReturnType<typeof ref<string>>,
  serverContext: ReturnType<typeof ref<AgentThreadContext | null>>,
  storage: ReturnType<typeof memoryStorage>,
) {
  return mount(
    defineComponent({
      setup() {
        const settings = useLocalThreadSettings(
          computed(() => threadId.value),
          computed(() => serverContext.value),
          { storage },
        );
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
