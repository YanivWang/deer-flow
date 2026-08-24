import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSuggestionsConfig } from "@/composables/useSuggestionsConfig";

const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("@/core/suggestions/api", () => ({
  loadSuggestionsConfig: mocks.load,
}));

beforeEach(() => {
  mocks.load.mockReset().mockResolvedValue({
    enabled: true,
    max_suggestions: 3,
  });
});

describe("useSuggestionsConfig", () => {
  it("gives the shared server config one Vue Query owner", async () => {
    const Probe = defineComponent({
      setup() {
        const query = useSuggestionsConfig();
        return () => h("div", query.data.value?.max_suggestions ?? "loading");
      },
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = mount(Probe, {
      global: { plugins: [[VueQueryPlugin, { queryClient }]] },
    });
    await flushPromises();
    expect(wrapper.text()).toBe("3");
    expect(mocks.load).toHaveBeenCalledTimes(1);

    wrapper.unmount();
    queryClient.clear();
  });
});
