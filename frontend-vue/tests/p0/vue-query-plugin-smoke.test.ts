import { QueryClient, useQuery, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { describe, expect, it } from "vitest";

describe("VueQueryPlugin smoke", () => {
  it("re-enables a query when enabled is a reactive ref", async () => {
    const enabled = ref(false);
    let calls = 0;
    const Probe = defineComponent({
      setup() {
        const query = useQuery({
          queryKey: ["p0", "enabled"],
          queryFn: async () => {
            calls += 1;
            return "ready";
          },
          enabled,
        });
        return () => h("span", query.data.value ?? "idle");
      },
    });

    const wrapper = mount(Probe, {
      global: {
        plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]],
      },
    });

    expect(wrapper.text()).toBe("idle");
    expect(calls).toBe(0);

    enabled.value = true;
    await flushPromises();

    expect(calls).toBe(1);
    expect(wrapper.text()).toBe("ready");
  });
});
