import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import HumanInputCard from "@/components/chat/HumanInputCard.vue";
import MessageList from "@/components/chat/MessageList.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import type {
  HumanInputRequest,
  HumanInputResponse,
} from "@/core/messages/human-input";
import type { Message } from "@/core/types/message";

const request: HumanInputRequest = {
  version: 1,
  kind: "human_input_request",
  source: "ask_clarification",
  request_id: "request-1",
  question: "Which audience?",
  input_mode: "free_text",
};
const requestMessage = {
  id: "tool-request-1",
  type: "tool",
  name: "ask_clarification",
  content: "Waiting for clarification",
  artifact: { human_input: request },
} as unknown as Message;
const response: HumanInputResponse = {
  version: 1,
  kind: "human_input_response",
  source: "ask_clarification",
  request_id: "request-1",
  response_kind: "text",
  value: "Executive team",
};
const hiddenResponseMessage = {
  id: "human-response-1",
  type: "human",
  content:
    'For your clarification "Which audience?", my answer is: Executive team',
  additional_kwargs: {
    hide_from_ui: true,
    human_input_response: response,
  },
} as unknown as Message;

function mountHumanInput(
  submitHumanInput: (
    request: HumanInputRequest,
    response: HumanInputResponse,
  ) => boolean | Promise<boolean>,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return mount(MessageList, {
    props: {
      messages: [requestMessage],
      rawMessages: [requestMessage],
      streaming: false,
      loading: false,
      threadId: "thread-1",
      interactive: true,
      submitHumanInput,
    },
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      stubs: {
        StreamMarkdown: { template: "<div />" },
        ReferenceAttachment: true,
        WorkspaceChangesBadge: true,
        SubtaskCard: true,
      },
    },
  });
}

describe("Human Input state machine", () => {
  beforeEach(() => {
    vi.stubGlobal("useNuxtApp", () => ({
      $i18n: { t: ref(enUS), locale: ref("en-US") },
    }));
  });

  it("rolls a failed submit back to editable state and preserves the answer for retry", async () => {
    const submit = vi
      .fn(
        async (_request: HumanInputRequest, _response: HumanInputResponse) =>
          true,
      )
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const wrapper = mountHumanInput(submit);
    const textarea = wrapper.get("textarea");
    await textarea.setValue("Executive team");
    await wrapper.getComponent(HumanInputCard).get("button").trigger("click");
    await flushPromises();

    expect(wrapper.getComponent(HumanInputCard).props("pending")).toBe(false);
    expect((textarea.element as HTMLTextAreaElement).value).toBe(
      "Executive team",
    );

    await wrapper.getComponent(HumanInputCard).get("button").trigger("click");
    await flushPromises();
    expect(wrapper.getComponent(HumanInputCard).props("pending")).toBe(true);
    await wrapper.setProps({
      rawMessages: [requestMessage, hiddenResponseMessage],
    });
    await flushPromises();
    expect(wrapper.text()).toContain("Answered: Executive team");
    expect(wrapper.find("textarea").exists()).toBe(false);
  });

  it("clears pending on a new thread error or thread switch without erasing form state", async () => {
    let resolveSubmit!: (value: boolean) => void;
    const submit = vi.fn(
      () => new Promise<boolean>((resolve) => (resolveSubmit = resolve)),
    );
    const wrapper = mountHumanInput(submit);
    const textarea = wrapper.get("textarea");
    await textarea.setValue("Keep this answer");
    await wrapper.getComponent(HumanInputCard).get("button").trigger("click");
    expect(wrapper.getComponent(HumanInputCard).props("pending")).toBe(true);

    await wrapper.setProps({ threadError: new Error("Run failed") });
    await flushPromises();
    expect(wrapper.getComponent(HumanInputCard).props("pending")).toBe(false);
    expect((textarea.element as HTMLTextAreaElement).value).toBe(
      "Keep this answer",
    );

    await wrapper.getComponent(HumanInputCard).get("button").trigger("click");
    expect(wrapper.getComponent(HumanInputCard).props("pending")).toBe(true);
    await wrapper.setProps({ threadId: "thread-2" });
    await flushPromises();
    expect(wrapper.getComponent(HumanInputCard).props("pending")).toBe(false);

    await wrapper.getComponent(HumanInputCard).get("button").trigger("click");
    await wrapper.setProps({ streaming: true });
    await wrapper.setProps({ streaming: false });
    await flushPromises();
    expect(wrapper.getComponent(HumanInputCard).props("pending")).toBe(false);
    resolveSubmit(false);
  });

  it("recovers answered state from the persisted hidden Gateway response after refresh", async () => {
    const wrapper = mountHumanInput(vi.fn(async () => true));
    await wrapper.setProps({
      rawMessages: [requestMessage, hiddenResponseMessage],
    });
    await flushPromises();

    expect(wrapper.getComponent(HumanInputCard).props("answered")).toEqual(
      response,
    );
    expect(wrapper.text()).toContain("Answered: Executive team");
    expect(wrapper.find("textarea").exists()).toBe(false);
  });
});
