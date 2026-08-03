import { mount } from "@vue/test-utils";
import { computed, defineComponent, h, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildSidecarContextPrompt,
  normalizeSidecarMessages,
  sidecarThreadMetadata,
} from "../../../../app/features/chat/sidecar/model";
import { useSidecarSession } from "../../../../app/features/chat/sidecar/use-sidecar-session";

describe("sidecar chat feature", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps sidecar thread metadata and the selected reference contract", () => {
    const references = [{
      label: "Selected assistant text #2",
      messageId: "message-2",
      role: "assistant" as const,
      content: "Quoted answer",
    }];

    expect(sidecarThreadMetadata("parent-1", references)).toEqual({
      deerflow_sidecar: true,
      parent_thread_id: "parent-1",
      sidecar_context_type: "referenced_message",
      sidecar_context_label: "Selected assistant text #2",
      sidecar_context_count: 1,
      referenced_message_id: "message-2",
      referenced_message_ids: ["message-2"],
      referenced_message_role: "assistant",
      referenced_message_roles: ["assistant"],
    });
  });

  it("builds bounded parent context and preserves quoted message ids", () => {
    const prompt = buildSidecarContextPrompt(
      Array.from({ length: 10 }, (_, index) => ({
        content: `message-${index}`,
        id: `id-${index}`,
        role: index % 2 === 0 ? "human" : "ai",
      })),
      [{ label: "Quote", messageId: "id-9", role: "assistant", content: "Quoted answer" }],
    );

    expect(prompt).toContain('message_count="8"');
    expect(prompt).toContain('message_id="id-9"');
    expect(prompt).toContain("Quoted answer");
    expect(prompt).not.toContain('message_id="id-0"');
  });

  it("normalizes persisted sidecar messages without exposing malformed rows", () => {
    expect(normalizeSidecarMessages({
      data: [
        { content: { type: "human", id: "h1", content: "Question" } },
        { content: { role: "ai", content: "Answer" } },
        { content: "malformed" },
      ],
    })).toEqual([
      { role: "human", id: "h1", content: "Question" },
      { role: "ai", id: undefined, content: "Answer" },
      { role: "ai", id: undefined, content: "" },
    ]);
  });

  it("creates a sidecar once, submits hidden context plus visible text, and clears references", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ thread_id: "sidecar-1" }))
      .mockResolvedValueOnce(new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mountSidecarHarness();
    wrapper.vm.session.sidecarDraft.value = "What should change?";
    wrapper.vm.session.sidecarReferences.value = [{
      label: "Selected assistant text #1",
      messageId: "answer-1",
      role: "assistant",
      content: "Quoted answer",
    }];

    await wrapper.vm.session.submitSidecarMessage();

    const createRequest = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(createRequest.metadata).toMatchObject({
      parent_thread_id: "parent-1",
      referenced_message_ids: ["answer-1"],
    });
    const runRequest = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(runRequest.input.messages[0].additional_kwargs).toMatchObject({
      hide_from_ui: true,
      sidecar_context: true,
      parent_thread_id: "parent-1",
    });
    expect(runRequest.input.messages[0].content).toContain("Quoted answer");
    expect(runRequest.input.messages[1]).toMatchObject({
      type: "human",
      content: "What should change?",
      additional_kwargs: {
        sidecar_visible_message: true,
        referenced_message_ids: ["answer-1"],
      },
    });
    expect(runRequest.stream_mode).toEqual(["values", "messages-tuple", "custom"]);
    expect(wrapper.vm.session.sidecarReferences.value).toEqual([]);
    expect(wrapper.vm.session.sidecarThreadId.value).toBe("sidecar-1");
  });

  it("self-heals a deleted restored sidecar before reopening it", async () => {
    const restored = ref({ thread_id: "sidecar-1" });
    const refreshThreads = vi.fn(async () => {
      restored.value = undefined as never;
    });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: [] })));
    const wrapper = mountSidecarHarness(restored, refreshThreads);
    await wrapper.vm.$nextTick();

    await wrapper.vm.session.toggleSidecar();

    expect(refreshThreads).toHaveBeenCalledTimes(1);
    expect(wrapper.vm.session.sidecarThreadId.value).toBeNull();
    expect(wrapper.vm.session.sidecarOpen.value).toBe(false);
  });
});

function mountSidecarHarness(
  restored = ref<{ thread_id: string } | undefined>(undefined),
  refreshThreads: () => Promise<unknown> = async () => undefined,
) {
  return mount(
    defineComponent({
      setup() {
        const threadId = computed(() => "parent-1");
        const session = useSidecarSession({
          parentMessages: computed(() => [
            { content: "Parent answer", id: "answer-1", role: "ai" },
          ]),
          refreshThreads,
          restoredSidecarThread: computed(() => restored.value),
          threadId,
          threadRunContext: computed(() => ({ model_name: "model-a" })),
        });
        return { session };
      },
      render() {
        return h("div");
      },
    }),
  );
}
