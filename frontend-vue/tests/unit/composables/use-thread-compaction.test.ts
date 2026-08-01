import { mount } from "@vue/test-utils";
import { computed, defineComponent, h, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  COMPACT_BUSY_MESSAGE,
  COMPACT_SKIPPED_MESSAGE,
  COMPACT_SUCCESS_MESSAGE,
  useThreadCompaction,
} from "../../../app/composables/use-thread-compaction";

describe("useThreadCompaction", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("skips empty threads without calling the compact endpoint", async () => {
    const fetchMock = vi.fn(async () => Response.json(compactResponse({ compacted: true })));
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mountCompactionHarness({ canCompact: ref(false) });

    await expect(wrapper.vm.compaction.compactThread()).resolves.toBeNull();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(wrapper.vm.compaction.compactNoticeMessage.value).toBe(COMPACT_SKIPPED_MESSAGE);
  });

  it("blocks compaction while the thread is busy", async () => {
    const fetchMock = vi.fn(async () => Response.json(compactResponse({ compacted: true })));
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mountCompactionHarness({ isBusy: ref(true) });

    await expect(wrapper.vm.compaction.compactThread()).resolves.toBeNull();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(wrapper.vm.compaction.compactErrorMessage.value).toBe(COMPACT_BUSY_MESSAGE);
  });

  it("posts compact context and reports the result", async () => {
    const fetchMock = vi.fn(async () => Response.json(compactResponse({ compacted: true })));
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mountCompactionHarness({
      agentName: ref("researcher"),
      modelName: ref("model-a"),
    });

    await expect(wrapper.vm.compaction.compactThread()).resolves.toEqual(
      compactResponse({ compacted: true }),
    );

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/threads/thread-a/compact");
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({
          force: true,
          agent_name: "researcher",
          model_name: "model-a",
        }),
        method: "POST",
      }),
    );
    expect(wrapper.vm.compaction.compactNoticeMessage.value).toBe(COMPACT_SUCCESS_MESSAGE);
  });

  it("surfaces backend compact errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { detail: "Thread has a run in flight. Compact after the run finishes." },
          { status: 409 },
        ),
      ),
    );
    const wrapper = mountCompactionHarness();

    await expect(wrapper.vm.compaction.compactThread()).rejects.toThrow(
      "Thread has a run in flight. Compact after the run finishes.",
    );
    expect(wrapper.vm.compaction.compactErrorMessage.value).toBe(
      "Thread has a run in flight. Compact after the run finishes.",
    );
  });
});

function mountCompactionHarness({
  agentName = ref<string | null>(null),
  canCompact = ref(true),
  isBusy = ref(false),
  modelName = ref<string | null>(null),
  threadId = ref("thread-a"),
}: {
  agentName?: ReturnType<typeof ref<string | null>>;
  canCompact?: ReturnType<typeof ref<boolean>>;
  isBusy?: ReturnType<typeof ref<boolean>>;
  modelName?: ReturnType<typeof ref<string | null>>;
  threadId?: ReturnType<typeof ref<string>>;
} = {}) {
  return mount(
    defineComponent({
      setup() {
        const compaction = useThreadCompaction({
          agentName: computed(() => agentName.value),
          canCompact: computed(() => canCompact.value),
          isBusy: computed(() => isBusy.value),
          modelName: computed(() => modelName.value),
          threadId: computed(() => threadId.value),
        });
        return { compaction };
      },
      render() {
        return h("div");
      },
    }),
  );
}

function compactResponse({ compacted }: { compacted: boolean }) {
  return {
    thread_id: "thread-a",
    compacted,
    reason: null,
    removed_message_count: compacted ? 8 : 0,
    preserved_message_count: 4,
    summary_updated: compacted,
    checkpoint_id: compacted ? "checkpoint-1" : null,
    total_tokens: 512,
  };
}
