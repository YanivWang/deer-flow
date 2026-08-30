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
  事件库为空时的退路（wave 7）。

  这一支只在 `/messages/page` 的第一页真的是空的时候才走，所以上面那组分页用例
  一次都没有覆盖到它——它此前既没有守卫路由，也没有守卫 run 身份。
*/
describe("useThreadHistory checkpoint fallback", () => {
  function mountHistory(queryClient: QueryClient) {
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
    return { wrapper, history: () => history };
  }

  function emptyPage() {
    return new Response(
      JSON.stringify({ data: [], has_more: false, next_before_seq: null }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  it("falls back to POST /history and keeps the backend's run ids", async () => {
    const calls: { url: string; method: string; body: unknown }[] = [];
    fetchMock.mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push({
          url,
          method: init?.method ?? "GET",
          body: init?.body === undefined ? undefined : String(init.body),
        });
        if (url.includes("/messages/page")) return emptyPage();
        return new Response(
          JSON.stringify([
            {
              values: {
                messages: [
                  {
                    id: "checkpoint-human",
                    type: "human",
                    content: "q",
                    additional_kwargs: { run_id: "run-a" },
                  },
                  {
                    id: "checkpoint-ai",
                    type: "ai",
                    content: "a",
                    run_id: "run-a",
                  },
                ],
              },
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    );

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { wrapper, history } = mountHistory(queryClient);
    await flushPromises();
    await flushPromises();

    const seed = calls.find((call) => !call.url.includes("/messages/page"));
    // 路由本身就是判据：`/state` 不带 run 身份，换过去这条用例必须红。
    expect(seed?.url).toContain("/api/langgraph/threads/thread-1/history");
    expect(seed?.url).not.toContain("/state");
    expect(seed?.method).toBe("POST");
    expect(seed?.body).toBe(JSON.stringify({ limit: 1 }));

    expect(history()?.messages.value.map((message) => message.id)).toEqual([
      "checkpoint-human",
      "checkpoint-ai",
    ]);
    expect(
      history()?.messages.value.map((message) =>
        Reflect.get(message, "run_id"),
      ),
    ).toEqual(["run-a", "run-a"]);

    wrapper.unmount();
    queryClient.clear();
  });

  it("leaves run_id empty when the checkpoint carries none", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).includes("/messages/page")) return emptyPage();
      return new Response(
        JSON.stringify([
          { values: { messages: [{ id: "m", type: "ai", content: "a" }] } },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { wrapper, history } = mountHistory(queryClient);
    await flushPromises();
    await flushPromises();

    // 造出来的 `state-<threadId>` 会让 WorkspaceChangesBadge 发一条注定 404 的
    // 请求；空串让它的 `enabled` 停住，与 React 一致。
    const runIds = history()?.messages.value.map((message) =>
      Reflect.get(message, "run_id"),
    );
    expect(runIds).toEqual([""]);
    expect(String(runIds?.[0])).not.toContain("state-");

    wrapper.unmount();
    queryClient.clear();
  });

  it("keeps the empty page when the checkpoint route fails", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).includes("/messages/page")) return emptyPage();
      return new Response("{}", { status: 404 });
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { wrapper, history } = mountHistory(queryClient);
    await flushPromises();
    await flushPromises();

    expect(history()?.messages.value).toEqual([]);

    wrapper.unmount();
    queryClient.clear();
  });
});
