import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, nextTick, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SidecarPanel from "@/components/workspace/sidecar/SidecarPanel.vue";
import HumanInputCard from "@/components/chat/HumanInputCard.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import type { Message } from "@/core/types/message";

const mocks = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  loadModels: vi.fn(),
}));

vi.mock("@/core/models/api", () => ({ loadModels: mocks.loadModels }));
vi.mock("@/composables/useThreadStream", async () => {
  const { ref: vueRef } = await import("vue");
  return {
    useThreadStream: () => ({
      messages: vueRef([]),
      isStreaming: vueRef(false),
      isUploading: vueRef(false),
      isHistoryLoading: vueRef(false),
      error: vueRef(null),
      sendMessage: mocks.sendMessage,
    }),
  };
});

const MessageListStub = defineComponent({
  name: "MessageList",
  props: {
    threadId: { type: String, default: null },
    threadError: { default: null },
    submitHumanInput: { type: Function, default: undefined },
  },
  template: '<div data-testid="message-list-stub" />',
});

function makeSession() {
  const input = ref("");
  return {
    threadId: ref<string | null>("sidecar-1"),
    input,
    selectedFiles: ref<File[]>([]),
    submissionPending: ref(false),
    deleting: ref(false),
    submissionError: ref<unknown>(null),
    fileError: ref(""),
    errorMessage: ref(""),
    phase: ref("ready"),
    ready: ref(true),
    stream: {
      messages: ref([]),
      isStreaming: ref(false),
      isHistoryLoading: ref(false),
      error: ref<unknown>(new Error("sidecar run failed")),
    },
    submit: vi.fn(async () => true),
    submitHumanInput: vi.fn(async () => true),
    setInput: vi.fn((value: string) => {
      input.value = value;
    }),
    addFiles: vi.fn(),
    removeFile: vi.fn(),
    deleteThread: vi.fn(async () => true),
  };
}

function mountPanel(session = makeSession()) {
  const wrapper = mount(SidecarPanel, {
    props: {
      references: [],
      context: { model_name: "reasoner", mode: "pro" },
      active: true,
      session,
    },
    global: {
      stubs: {
        MessageList: MessageListStub,
        ReferenceAttachment: true,
      },
    },
  });
  return { wrapper, session };
}

describe("SidecarPanel session adapter", () => {
  beforeEach(() => {
    mocks.sendMessage.mockReset();
    mocks.loadModels.mockReset().mockResolvedValue({ models: [] });
    vi.stubGlobal("useNuxtApp", () => ({
      $i18n: { t: ref(enUS), locale: ref("en-US") },
    }));
  });

  it("passes the sidecar thread, run error, and HIL submitter to MessageList", async () => {
    const { wrapper, session } = mountPanel();
    const messageList = wrapper.findComponent(MessageListStub);

    expect(messageList.props("threadId")).toBe("sidecar-1");
    expect(messageList.props("threadError")).toBe(session.stream.error.value);
    expect(messageList.props("submitHumanInput")).toBe(
      session.submitHumanInput,
    );
  });

  it("uses the session draft, preserves IME composition, and submits once after composition", async () => {
    const { wrapper, session } = mountPanel();
    const textarea = wrapper.get("textarea[name='message']");
    await textarea.setValue("输入中的问题");
    expect(session.input.value).toBe("输入中的问题");

    await textarea.trigger("compositionstart");
    await textarea.trigger("keydown", { key: "Enter", isComposing: true });
    expect(session.submit).not.toHaveBeenCalled();

    await textarea.trigger("compositionend");
    await textarea.trigger("keydown", { key: "Enter" });
    expect(session.submit).toHaveBeenCalledTimes(1);
  });

  it("forwards selected files, exposes removable chips, and reports busy state", async () => {
    const session = makeSession();
    const file = new File(["hello"], "notes.txt");
    session.selectedFiles.value = [file];
    session.submissionPending.value = true;
    const { wrapper } = mountPanel(session);

    expect(wrapper.get("form").attributes("aria-busy")).toBe("true");
    expect(wrapper.get("textarea[name='message']").attributes("disabled")).toBe(
      "",
    );
    expect(wrapper.get("button[type='submit']").attributes("disabled")).toBe(
      "",
    );
    expect(wrapper.text()).toContain("notes.txt");
    await wrapper.get("button[aria-label='Remove notes.txt']").trigger("click");
    expect(session.removeFile).toHaveBeenCalledWith(file);

    const input = wrapper.get("input[type='file']");
    Object.defineProperty(input.element, "files", {
      configurable: true,
      value: [file],
    });
    await input.trigger("change");
    expect(session.addFiles).toHaveBeenCalledWith([file]);

    session.submissionPending.value = false;
    session.stream.isStreaming.value = true;
    await nextTick();
    expect(wrapper.get("form").attributes("aria-busy")).toBe("true");
    expect(wrapper.get("textarea[name='message']").attributes("disabled")).toBe(
      "",
    );
  });

  it("uses the shared composer surface as the single focus-ring owner", () => {
    const { wrapper } = mountPanel();
    const surface = wrapper.get("[data-testid='sidecar-composer-surface']");
    expect(surface.classes()).toContain(
      "has-[[data-slot=input-group-control]:focus-visible]:ring-[3px]",
    );
    expect(
      wrapper.get("textarea[name='message']").attributes("data-slot"),
    ).toBe("input-group-control");
    expect(surface.get("[data-slot='input-group-body']").exists()).toBe(true);
    expect(surface.get("[data-slot='input-group-footer']").exists()).toBe(true);
    expect(
      wrapper.get("[data-testid='sidecar-composer-disclaimer']").classes(),
    ).toEqual(expect.arrayContaining(["absolute", "bottom-0"]));
  });

  it("keeps a stable accessible name while the panel is hidden and reopened", async () => {
    const { wrapper } = mountPanel();
    const textarea = wrapper.get("textarea[name='message']");
    expect(textarea.attributes("aria-label")).toBe("Ask a deeper follow-up");
    await wrapper.setProps({ active: false });
    await wrapper.setProps({ active: true });
    expect(
      wrapper.get("textarea[name='message']").attributes("aria-label"),
    ).toBe("Ask a deeper follow-up");
  });

  it("runs required-form, false-checkbox, retry, thread-error, and refresh HIL through the sidecar session", async () => {
    const request = {
      version: 2,
      kind: "human_input_request",
      source: "ask_clarification",
      request_id: "sidecar-request-1",
      question: "Confirm delivery",
      input_mode: "form",
      fields: [
        { name: "owner", label: "Owner", type: "text", required: true },
        {
          name: "approved",
          label: "Approved",
          type: "checkbox",
          required: false,
        },
      ],
    } as const;
    const requestMessage = {
      id: "sidecar-tool-1",
      type: "tool",
      name: "ask_clarification",
      content: "Waiting for clarification",
      artifact: { human_input: request },
    } as unknown as Message;
    const session = makeSession();
    session.stream.messages.value = [requestMessage];
    session.submitHumanInput
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const wrapper = mount(SidecarPanel, {
      props: {
        references: [],
        context: { model_name: "reasoner", mode: "pro" },
        active: true,
        session,
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
    const card = wrapper.getComponent(HumanInputCard);

    // 走表单 submit，不用 button click：happy-dom 只对真 MouseEvent 跑
    // activation behavior，VTU 的 trigger("click") 派发的是普通 Event（坑 76）。
    await card.get("form").trigger("submit");
    expect(card.get("[role='alert']").text()).toContain("required");
    expect(session.submitHumanInput).not.toHaveBeenCalled();

    const owner = card.get("input[type='text']");
    await owner.setValue("Dana");
    await card.get("form").trigger("submit");
    await flushPromises();
    expect(session.submitHumanInput).toHaveBeenCalledWith(
      expect.objectContaining({ request_id: "sidecar-request-1" }),
      expect.objectContaining({
        value:
          'Owner: Dana; Approved: no [values: {"owner":"Dana","approved":false}]',
      }),
    );
    expect(card.props("pending")).toBe(false);
    expect((owner.element as HTMLInputElement).value).toBe("Dana");

    await card.get("form").trigger("submit");
    await flushPromises();
    expect(card.props("pending")).toBe(true);
    session.stream.error.value = new Error("sidecar run failed again");
    await nextTick();
    expect(card.props("pending")).toBe(false);
    expect((owner.element as HTMLInputElement).value).toBe("Dana");

    await card.get("form").trigger("submit");
    await flushPromises();
    const acceptedResponse = session.submitHumanInput.mock.calls.at(-1)?.[1];
    session.stream.messages.value = [
      requestMessage,
      {
        id: "sidecar-response-1",
        type: "human",
        content: "Hidden response",
        additional_kwargs: {
          hide_from_ui: true,
          human_input_response: acceptedResponse,
        },
      } as Message,
    ];
    await flushPromises();
    expect(wrapper.text()).toContain("Answered:");
    // 答过之后表单仍然挂着（禁用），不是被一行文字替换掉。
    const answeredOwner = wrapper.get("input[type='text']");
    expect(answeredOwner.attributes("disabled")).toBeDefined();
  });
});
