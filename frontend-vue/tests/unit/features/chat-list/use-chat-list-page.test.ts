import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useChatListPage } from "../../../../app/features/chat-list/use-chat-list-page";

describe("useChatListPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("owns case-insensitive title filtering while retaining the entity pagination state", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json([
        thread("alpha", "Alpha research"),
        thread("beta", "Beta notes"),
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const Probe = defineComponent({
      setup() {
        const page = useChatListPage();
        return () =>
          h("div", [
            h("p", { "data-testid": "count" }, String(page.visibleThreads.value.length)),
            h("p", { "data-testid": "title" }, page.visibleThreads.value.map((item) => page.titleOfThread(item)).join(",")),
            h("button", { onClick: () => page.setSearchText("RESEARCH") }, "search"),
          ]);
      },
    });

    const wrapper = mount(Probe, {
      global: {
        plugins: [[VueQueryPlugin, { queryClient: createQueryClient() }]],
      },
    });
    await flushPromises();

    expect(wrapper.get('[data-testid="count"]').text()).toBe("2");
    await wrapper.get("button").trigger("click");
    expect(wrapper.get('[data-testid="count"]').text()).toBe("1");
    expect(wrapper.get('[data-testid="title"]').text()).toBe("Alpha research");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/langgraph/threads/search",
      expect.objectContaining({ body: JSON.stringify({ metadata: {}, limit: 50, offset: 0 }) }),
    );
  });
});

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
}

function thread(threadId: string, title: string) {
  return {
    context: {},
    created_at: "2026-08-03T00:00:00Z",
    metadata: {},
    status: "idle",
    thread_id: threadId,
    updated_at: "2026-08-03T01:02:03Z",
    values: { title },
  };
}
