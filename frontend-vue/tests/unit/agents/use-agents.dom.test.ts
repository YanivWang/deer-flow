/*
  【文件职责】     固定Agent Vue Query 的 feature gate、single owner 与 mutation cache sync。
  【架构位置】     Vue composable DOM test
  【主要导出】     无；Vitest cases
  【依赖关系】     useAgents · QueryClient · mocked Agent API
  【边界与注意】   disabled 不请求；query retry=false；更新/删除通过同一 query identity 回写并失效。
*/

import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAgents } from "@/composables/useAgents";
import { agentKeys } from "@/core/agents/query-keys";
import type { Agent } from "@/core/agents/types";

const api = vi.hoisted(() => ({
  list: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/core/agents/api", () => ({
  listAgents: api.list,
  updateAgent: api.update,
  deleteAgent: api.remove,
}));

const original: Agent = {
  name: "reviewer",
  description: "Reviews code",
  model: null,
  tool_groups: null,
  skills: null,
};

function harness(initialEnabled = false) {
  const enabled = ref(initialEnabled);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  let owner!: ReturnType<typeof useAgents>;
  const Host = defineComponent({
    setup() {
      owner = useAgents({ enabled });
      return () =>
        h(
          "div",
          owner.agents.value.map((agent) => agent.name),
        );
    },
  });
  const wrapper = mount(Host, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  });
  return { enabled, owner, queryClient, wrapper };
}

afterEach(() => vi.clearAllMocks());

describe("useAgents", () => {
  it("does not request before the feature is ready and performs one list when enabled", async () => {
    api.list.mockResolvedValue([original]);
    const { enabled, wrapper } = harness();
    await flushPromises();
    expect(api.list).not.toHaveBeenCalled();

    enabled.value = true;
    await flushPromises();
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain("reviewer");
    wrapper.unmount();
  });

  it("syncs update and delete through the shared list/detail query keys", async () => {
    const updated = { ...original, model: "reasoning" };
    api.list.mockResolvedValue([original]);
    api.update.mockResolvedValue(updated);
    api.remove.mockResolvedValue(undefined);
    const { owner, queryClient, wrapper } = harness(true);
    await flushPromises();

    await owner.update.mutateAsync({
      agent: original,
      request: { model: "reasoning" },
    });
    expect(queryClient.getQueryData(agentKeys.detail("reviewer"))).toEqual(
      updated,
    );

    api.list.mockResolvedValue([]);
    await owner.remove.mutateAsync(updated);
    expect(
      queryClient.getQueryData(agentKeys.detail("reviewer")),
    ).toBeUndefined();
    expect(queryClient.getQueryData(agentKeys.list())).toEqual([]);
    wrapper.unmount();
  });
});
