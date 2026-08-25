/* WP-11 stale/abort contract for the single Workspace Changes Query owner. */
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { computed, defineComponent, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useWorkspaceChanges } from "@/composables/useWorkspaceChanges";

const fetchChanges = vi.hoisted(() => vi.fn());
vi.mock("@/core/workspace-changes/api", () => ({
  fetchWorkspaceChanges: fetchChanges,
}));

function response(marker: string) {
  return {
    marker,
    available: true,
    version: 1,
    summary: {
      created: 1,
      modified: 0,
      deleted: 0,
      symlink_created: 0,
      additions: 1,
      deletions: 0,
      truncated: false,
    },
    files: [],
    limits: {},
  };
}

beforeEach(() => {
  fetchChanges.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe("useWorkspaceChanges", () => {
  it("aborts the abandoned key and cannot let its late response replace the active thread", async () => {
    const activeThread = ref("thread-old");
    const pending = new Map<
      string,
      {
        signal: AbortSignal;
        resolve: (value: ReturnType<typeof response>) => void;
      }
    >();
    fetchChanges.mockImplementation(
      (input?: { threadId: string; signal: AbortSignal }) =>
        new Promise((resolve) => {
          if (input) {
            pending.set(input.threadId, { signal: input.signal, resolve });
          }
        }),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    const Host = defineComponent({
      setup() {
        const owner = useWorkspaceChanges({
          threadId: activeThread,
          runId: computed(() => `run-${activeThread.value}`),
          includeFiles: true,
          includeDiff: true,
          enabled: true,
        });
        return {
          marker: computed(() => Reflect.get(owner.data.value ?? {}, "marker")),
        };
      },
      template: '<p data-testid="marker">{{ marker }}</p>',
    });
    const wrapper = mount(Host, {
      global: { plugins: [[VueQueryPlugin, { queryClient }]] },
    });
    await flushPromises();
    expect(pending.has("thread-old")).toBe(true);

    activeThread.value = "thread-new";
    await flushPromises();
    expect(pending.get("thread-old")?.signal.aborted).toBe(true);
    expect(pending.has("thread-new")).toBe(true);

    pending.get("thread-new")?.resolve(response("new"));
    await flushPromises();
    expect(wrapper.get('[data-testid="marker"]').text()).toBe("new");

    pending.get("thread-old")?.resolve(response("stale"));
    await flushPromises();
    expect(wrapper.get('[data-testid="marker"]').text()).toBe("new");

    wrapper.unmount();
    queryClient.clear();
  });
});
