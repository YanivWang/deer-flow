import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  dedupeThreadPages,
  getThreadListNextPageParam,
  useThreadList,
} from "../../../app/composables/use-thread-list";
import {
  sortPinnedThreads,
  THREAD_PINNED_METADATA_KEY,
} from "../../../app/core/api/thread/utils";

import type { AgentThread } from "../../../app/core/api/thread/types";

describe("useThreadList", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("computes the next page offset from loaded thread pages", () => {
    expect(getThreadListNextPageParam([thread("a"), thread("b")], [], 3)).toBeUndefined();
    expect(
      getThreadListNextPageParam(
        [thread("c"), thread("d")],
        [[thread("a"), thread("b")], [thread("c"), thread("d")]],
        2,
      ),
    ).toBe(4);
  });

  it("deduplicates paged thread results while preserving the first occurrence", () => {
    expect(dedupeThreadPages([[thread("a"), thread("b")], [thread("a"), thread("c")]]).map(
      (item) => item.thread_id,
    )).toEqual(["a", "b", "c"]);
  });

  it("keeps duplicate paged threads anchored to their first occurrence before pinned sorting", () => {
    const threads = sortPinnedThreads(
      dedupeThreadPages([
        [thread("a", "Alpha"), thread("b", "Beta", true), thread("c", "Gamma")],
        [thread("a", "Alpha duplicate", true), thread("d", "Delta", true)],
      ]),
    );

    expect(threads.map((item) => [item.thread_id, item.values.title, item.metadata])).toEqual([
      ["b", "Beta", { [THREAD_PINNED_METADATA_KEY]: true }],
      ["d", "Delta", { [THREAD_PINNED_METADATA_KEY]: true }],
      ["a", "Alpha", {}],
      ["c", "Gamma", {}],
    ]);
  });

  it("updates infinite thread cache after pin and delete mutations", async () => {
    let pinned = false;
    let deleted = false;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/langgraph/threads/search") {
        return Response.json([
          thread("a", "Alpha"),
          ...(deleted ? [] : [thread("b", "Beta", pinned)]),
        ]);
      }
      if (url === "/api/langgraph/threads/b" && init?.method === "PATCH") {
        pinned = true;
        return Response.json({
          ...thread("b", "Beta", true),
          metadata: { [THREAD_PINNED_METADATA_KEY]: true },
        });
      }
      if (url === "/api/langgraph/threads/b" && init?.method === "DELETE") {
        deleted = true;
        return new Response(null, { status: 204 });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const Probe = defineComponent({
      setup() {
        const list = useThreadList();
        return () =>
          h("div", [
            h(
              "ol",
              { "data-testid": "threads" },
              list.threads.value.map((item) =>
                h("li", { key: item.thread_id }, `${item.thread_id}:${list.isThreadPinned(item)}`),
              ),
            ),
            h(
              "button",
              {
                "data-testid": "pin-b",
                onClick: () => list.pinThread({ pinned: true, threadId: "b" }),
              },
              "pin",
            ),
            h(
              "button",
              {
                "data-testid": "delete-b",
                onClick: () => list.deleteThread({ threadId: "b" }),
              },
              "delete",
            ),
          ]);
      },
    });

    const wrapper = mount(Probe, {
      global: {
        plugins: [[VueQueryPlugin, { queryClient: createQueryClient() }]],
      },
    });
    await flushPromises();

    expect(wrapper.get('[data-testid="threads"]').text()).toBe("a:falseb:false");

    await wrapper.get('[data-testid="pin-b"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="threads"]').text()).toBe("b:truea:false");

    await wrapper.get('[data-testid="delete-b"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="threads"]').text()).toBe("a:false");
  });

  it("creates a Gateway thread and prepends it into the sidebar cache", async () => {
    let created = false;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/langgraph/threads/search") {
        return Response.json([
          ...(created ? [{ ...thread("fresh", "Untitled"), metadata: { agent_name: "researcher" } }] : []),
          thread("a", "Alpha"),
        ]);
      }
      if (url === "/api/langgraph/threads" && init?.method === "POST") {
        created = true;
        return Response.json({
          ...thread("fresh", "Untitled"),
          metadata: { agent_name: "researcher" },
        });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const Probe = defineComponent({
      setup() {
        const list = useThreadList();
        return () =>
          h("div", [
            h(
              "ol",
              { "data-testid": "threads" },
              list.threads.value.map((item) =>
                h("li", { key: item.thread_id }, `${item.thread_id}:${item.metadata?.agent_name ?? ""}`),
              ),
            ),
            h(
              "button",
              {
                "data-testid": "create-thread",
                onClick: () =>
                  list.createThread({ agentName: "researcher", threadId: "fresh" }),
              },
              "create",
            ),
          ]);
      },
    });

    const wrapper = mount(Probe, {
      global: {
        plugins: [[VueQueryPlugin, { queryClient: createQueryClient() }]],
      },
    });
    await flushPromises();

    await wrapper.get('[data-testid="create-thread"]').trigger("click");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/langgraph/threads",
      expect.objectContaining({
        body: JSON.stringify({
          thread_id: "fresh",
          metadata: { agent_name: "researcher" },
        }),
        method: "POST",
      }),
    );
    expect(wrapper.get('[data-testid="threads"]').text()).toBe("fresh:researchera:");
  });

  it("loads older chat pages with the next offset and merges them into the sidebar list", async () => {
    const firstPage = Array.from({ length: 50 }, (_, index) =>
      thread(`thread-${index}`, `Thread ${index}`),
    );
    const secondPage = [thread("thread-50", "Thread 50")];
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { offset?: number };
      return Response.json(body.offset === 50 ? secondPage : firstPage);
    });
    vi.stubGlobal("fetch", fetchMock);

    const Probe = defineComponent({
      setup() {
        const list = useThreadList();
        return () =>
          h("div", [
            h("p", { "data-testid": "count" }, String(list.threads.value.length)),
            h("p", { "data-testid": "has-more" }, String(list.hasMoreThreads.value)),
            h(
              "ol",
              { "data-testid": "threads" },
              list.threads.value.map((item) => h("li", { key: item.thread_id }, item.thread_id)),
            ),
            h(
              "button",
              {
                "data-testid": "load-more",
                onClick: () => list.loadMoreThreads(),
              },
              "load more",
            ),
          ]);
      },
    });

    const wrapper = mount(Probe, {
      global: {
        plugins: [[VueQueryPlugin, { queryClient: createQueryClient() }]],
      },
    });
    await flushPromises();

    expect(wrapper.get('[data-testid="count"]').text()).toBe("50");
    expect(wrapper.get('[data-testid="has-more"]').text()).toBe("true");

    await wrapper.get('[data-testid="load-more"]').trigger("click");
    await flushPromises();

    expect(wrapper.get('[data-testid="count"]').text()).toBe("51");
    expect(wrapper.get('[data-testid="threads"]').text()).toContain("thread-50");
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/langgraph/threads/search",
      expect.objectContaining({
        body: JSON.stringify({ metadata: {}, limit: 50, offset: 50 }),
      }),
    );
  });

  it("keeps thread caches unchanged when rename fails with a backend detail", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/langgraph/threads/search") {
        return Response.json([thread("a", "Alpha")]);
      }
      if (url === "/api/langgraph/threads/a/state" && init?.method === "POST") {
        return Response.json({ detail: "Thread has an active run." }, { status: 409 });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const Probe = defineComponent({
      setup() {
        const list = useThreadList();
        const renameError = ref("");
        return () =>
          h("div", [
            h(
              "ol",
              { "data-testid": "threads" },
              list.threads.value.map((item) => h("li", { key: item.thread_id }, item.values.title)),
            ),
            h("p", { "data-testid": "rename-error" }, renameError.value),
            h(
              "button",
              {
                "data-testid": "rename-a",
                onClick: async () => {
                  try {
                    await list.renameThread({ threadId: "a", title: "Blocked" });
                  } catch (error) {
                    renameError.value =
                      error instanceof Error ? error.message : "Failed to rename thread.";
                  }
                },
              },
              "rename",
            ),
          ]);
      },
    });

    const wrapper = mount(Probe, {
      global: {
        plugins: [[VueQueryPlugin, { queryClient: createQueryClient() }]],
      },
    });
    await flushPromises();

    expect(wrapper.get('[data-testid="threads"]').text()).toBe("Alpha");

    await wrapper.get('[data-testid="rename-a"]').trigger("click");
    await flushPromises();

    expect(wrapper.get('[data-testid="rename-error"]').text()).toBe("Thread has an active run.");
    expect(wrapper.get('[data-testid="threads"]').text()).toBe("Alpha");
  });

  it("exposes mutation error messages for failed pin and delete actions", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/langgraph/threads/search") {
        return Response.json([thread("a", "Alpha")]);
      }
      if (url === "/api/langgraph/threads/a" && init?.method === "PATCH") {
        return Response.json({ detail: "Pin failed." }, { status: 409 });
      }
      if (url === "/api/langgraph/threads/a" && init?.method === "DELETE") {
        return Response.json({ detail: "Delete failed." }, { status: 409 });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const Probe = defineComponent({
      setup() {
        const list = useThreadList();
        return () =>
          h("div", [
            h("p", { "data-testid": "pin-error" }, list.pinThreadErrorMessage.value ?? ""),
            h("p", { "data-testid": "delete-error" }, list.deleteThreadErrorMessage.value ?? ""),
            h(
              "button",
              {
                "data-testid": "pin-a",
                onClick: async () => {
                  try {
                    await list.pinThread({ pinned: true, threadId: "a" });
                  } catch {
                    // Keep the component mounted so the exposed mutation state can be asserted.
                  }
                },
              },
              "pin",
            ),
            h(
              "button",
              {
                "data-testid": "delete-a",
                onClick: async () => {
                  try {
                    await list.deleteThread({ threadId: "a" });
                  } catch {
                    // Keep the component mounted so the exposed mutation state can be asserted.
                  }
                },
              },
              "delete",
            ),
          ]);
      },
    });

    const wrapper = mount(Probe, {
      global: {
        plugins: [[VueQueryPlugin, { queryClient: createQueryClient() }]],
      },
    });
    await flushPromises();

    await wrapper.get('[data-testid="pin-a"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="pin-error"]').text()).toBe("Pin failed.");

    await wrapper.get('[data-testid="delete-a"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="delete-error"]').text()).toBe("Delete failed.");
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

function thread(id: string, title = id, pinned = false): AgentThread {
  return {
    thread_id: id,
    status: "idle",
    created_at: "2026-07-31T00:00:00Z",
    updated_at: "2026-07-31T00:00:00Z",
    metadata: pinned ? { [THREAD_PINNED_METADATA_KEY]: true } : {},
    values: { title },
  };
}
