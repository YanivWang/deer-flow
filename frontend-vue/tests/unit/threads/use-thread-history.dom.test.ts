import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";

import { useThreadHistory } from "@/composables/useThreadHistory";

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock("@/core/api/fetcher", () => ({ fetch: fetchMock }));

function pageFor(input: RequestInfo | URL) {
  const url = new URL(String(input), "http://localhost");
  const cursor = url.searchParams.get("before_seq");
  const seq = cursor === null ? 101 : Number(cursor) - 1;
  return new Response(
    JSON.stringify({
      data: [
        {
          run_id: `run-${seq}`,
          seq,
          content: {
            id: `message-${seq}`,
            type: "human",
            content: String(seq),
          },
          metadata: { caller: "lead_agent" },
          created_at: "2026-08-21T00:00:00Z",
        },
      ],
      has_more: seq > 1,
      next_before_seq: seq > 1 ? seq : null,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("useThreadHistory on-demand pagination", () => {
  it("requests only the first page of a 101-page history until loadMore", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) =>
      pageFor(input),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    let history: ReturnType<typeof useThreadHistory> | undefined;
    const wrapper = mount(
      defineComponent({
        setup() {
          history = useThreadHistory(ref("thread-1"));
          return () => h("div");
        },
      }),
      { global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
    );

    await flushPromises();
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(history?.hasMore.value).toBe(true);

    await Promise.all([history!.loadMore(), history!.loadMore()]);
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(history?.messages.value.map((message) => message.id)).toEqual([
      "message-100",
      "message-101",
    ]);

    wrapper.unmount();
    queryClient.clear();
  });
});
