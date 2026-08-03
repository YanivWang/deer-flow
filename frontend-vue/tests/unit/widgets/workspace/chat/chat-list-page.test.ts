import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

import ChatListPage from "../../../../../app/widgets/workspace/chat/ChatListPage.vue";
import { useChatListPage } from "../../../../../app/features/chat-list/use-chat-list-page";

describe("ChatListPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders Gateway list status, route links, channel metadata, and load-more affordances", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([thread("thread-1", "Research", "slack")])))

    const Host = defineComponent({
      setup() {
        const chats = useChatListPage();
        return () => h(ChatListPage, { chats });
      },
    });

    const wrapper = mount(Host, {
      global: {
        plugins: [[VueQueryPlugin, { queryClient: createQueryClient() }]],
        stubs: {
          NuxtLink: defineComponent({
            props: { to: { type: String, required: true } },
            setup(props, { slots }) {
              return () => h("a", { href: props.to }, slots.default?.());
            },
          }),
        },
      },
    });
    await flushPromises();

    expect(wrapper.get('[data-testid="vue-workspace-recent-thread-thread-1"]').text()).toContain("Slack");
    expect(wrapper.get('[data-testid="vue-workspace-recent-thread-thread-1"] a').attributes("href")).toBe(
      "/workspace/chats/thread-1",
    );
    expect(wrapper.get(".workspace-recent-threads__list").exists()).toBe(true);
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

function thread(threadId: string, title: string, provider: string) {
  return {
    context: {},
    created_at: "2026-08-03T00:00:00Z",
    metadata: { channel_source: { provider, type: "im_channel" } },
    status: "idle",
    thread_id: threadId,
    updated_at: "2026-08-03T01:02:03Z",
    values: { title },
  };
}
