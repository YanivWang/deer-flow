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

/*
  分页历史**只做分页**（wave 8）。

  wave 7 在这里加过一支「第一页为空就改取 `POST /history`」的退路，因为当时
  runner 没有 checkpoint 种子，那是拿到 checkpoint 消息的唯一路径。wave 8 把种子
  按上游的形状放回 `useThreadStream`（无条件取一次，经归并覆盖在分页行上）之后，
  这条退路既多余又有害：同一条线程会发两次 `/history`，而且退路造出来的行与种子行
  形状不同。上游 `useThreadHistory`（hooks.ts:2623）本来就没有任何退路。

  所以这一组用例守的是**不做什么**：第一页空了就到此为止。
*/
describe("useThreadHistory stays pure pagination", () => {
  function emptyPage() {
    return new Response(
      JSON.stringify({ data: [], has_more: false, next_before_seq: null }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  it("does not fall back to the checkpoint route when the first page is empty", async () => {
    const urls: string[] = [];
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return emptyPage();
    });

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

    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("/messages/page");
    expect(urls.some((url) => url.includes("/history"))).toBe(false);
    expect(history?.messages.value).toEqual([]);
    // 空历史仍然要给出结论，否则 S8 的「线程是否存在」判据永远等不到。
    expect(history?.settled.value).toBe(true);

    wrapper.unmount();
    queryClient.clear();
  });
});
