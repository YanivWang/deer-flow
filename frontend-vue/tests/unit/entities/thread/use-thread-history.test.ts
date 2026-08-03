import { QueryClient, useQueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useThreadHistory } from "../../../../app/entities/thread/use-thread-history";

import type { RunMessage, ThreadMessagesPageResponse } from "../../../../app/core/api/thread/types";

describe("useThreadHistory", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retains already loaded rows while a refreshed first page is still incomplete", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          data: [],
          has_more: false,
          next_before_seq: null,
        }),
      ),
    );

    const Probe = defineComponent({
      setup() {
        const queryClient = useQueryClient();
        const history = useThreadHistory("thread-1");
        function setPages(pages: ThreadMessagesPageResponse[]) {
          queryClient.setQueryData(["thread-messages", "thread-1"], {
            pages,
            pageParams: pages.map(() => undefined),
          });
        }
        return { history, setPages };
      },
      render() {
        return h(
          "ol",
          { "data-testid": "rows" },
          this.history.rows.value.map((row) => h("li", { key: row.seq }, String(row.seq))),
        );
      },
    });

    const wrapper = mount(Probe, {
      global: {
        plugins: [[VueQueryPlugin, { queryClient: createQueryClient() }]],
      },
    });
    await flushPromises();

    wrapper.vm.setPages([
      {
        data: [runMessage(1, "run-1", "h-1"), runMessage(2, "run-1", "a-1")],
        has_more: false,
        next_before_seq: null,
      },
    ]);
    await flushPromises();
    expect(wrapper.get('[data-testid="rows"]').text()).toBe("12");

    wrapper.vm.setPages([
      {
        data: [runMessage(3, "run-2", "a-2")],
        has_more: true,
        next_before_seq: 3,
      },
    ]);
    await flushPromises();
    expect(wrapper.get('[data-testid="rows"]').text()).toBe("123");
  });

  it("does not retain rows after the route thread id changes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          data: [],
          has_more: false,
          next_before_seq: null,
        }),
      ),
    );

    const Probe = defineComponent({
      setup() {
        const queryClient = useQueryClient();
        const activeThreadId = ref("thread-a");
        const history = useThreadHistory(activeThreadId);
        function setActiveThreadId(threadId: string) {
          activeThreadId.value = threadId;
        }
        function setPages(threadId: string, pages: ThreadMessagesPageResponse[]) {
          queryClient.setQueryData(["thread-messages", threadId], {
            pages,
            pageParams: pages.map(() => undefined),
          });
        }
        return { history, setActiveThreadId, setPages };
      },
      render() {
        return h(
          "ol",
          { "data-testid": "rows" },
          this.history.rows.value.map((row) => h("li", { key: row.seq }, row.content.content)),
        );
      },
    });

    const wrapper = mount(Probe, {
      global: {
        plugins: [[VueQueryPlugin, { queryClient: createQueryClient() }]],
      },
    });
    await flushPromises();

    wrapper.vm.setPages("thread-a", [
      {
        data: [runMessage(1, "run-a", "a-history")],
        has_more: false,
        next_before_seq: null,
      },
    ]);
    await flushPromises();
    expect(wrapper.get('[data-testid="rows"]').text()).toBe("a-history");

    wrapper.vm.setActiveThreadId("thread-b");
    await flushPromises();
    expect(wrapper.get('[data-testid="rows"]').text()).toBe("");

    wrapper.vm.setPages("thread-b", [
      {
        data: [runMessage(1, "run-b", "b-history")],
        has_more: false,
        next_before_seq: null,
      },
    ]);
    await flushPromises();
    expect(wrapper.get('[data-testid="rows"]').text()).toBe("b-history");
  });
});

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function runMessage(seq: number, runId: string, id: string): RunMessage {
  return {
    run_id: runId,
    seq,
    content: { id, type: id.startsWith("h") ? "human" : "ai", content: id },
    metadata: {},
    created_at: "2026-07-31T00:00:00Z",
  };
}
