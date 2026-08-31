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

/*
  面板通过 useModels 取模型目录（与 ChatComposer / AgentChat 同一个 Vue Query
  owner），所以挂载必须带上 provider——否则 useQuery 拿不到 client，整棵树在
  setup 阶段就抛。`retry: false` + mock 掉的 loadModels 保证它不会真的去连 :3000。
*/
function queryPlugins() {
  return [
    [
      VueQueryPlugin,
      {
        queryClient: new QueryClient({
          defaultOptions: { queries: { retry: false } },
        }),
      },
    ] as const,
  ];
}

function mountPanel(session = makeSession(), references: unknown[] = []) {
  const wrapper = mount(SidecarPanel, {
    props: {
      references,
      context: { model_name: "reasoner", mode: "pro" },
      active: true,
      session,
    },
    global: {
      plugins: queryPlugins() as never,
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
    // footer 也是 InputGroupAddon，必须带 role="group"（见 SidecarPanel.vue 那条注释）。
    const footer = surface.get("[data-slot='input-group-footer']");
    expect(footer.attributes("role")).toBe("group");
    /*
      上游 sidecar 的 composer **没有**免责声明——那一段只在主输入框上
      （chat-page.tsx）。本仓原来两处都画，于是 sidecar 面板的可访问性树里多出
      一个 React 没有的 paragraph。这条断言反过来钉住「不许再长回来」。
    */
    expect(
      wrapper.find("[data-testid='sidecar-composer-disclaimer']").exists(),
    ).toBe(false);
    expect(wrapper.text()).not.toContain(enUS.inputBox.disclaimer);
  });

  /*
    可访问名来自 **placeholder**，不是 aria-label。上游的 PromptInputTextarea 只给
    placeholder（prompt-input.tsx:963 那一支没有 aria-label），于是读屏器念的是
    「Ask a deeper follow-up...」——带省略号。本仓原来额外挂了一个
    `sidecar.inputLabel`（"Ask a deeper follow-up"，没有省略号，而且是本仓自造的
    词条，上游词典里根本没有这一项），aria-label 一旦存在就顶掉 placeholder，
    两个应用于是念出两个名字。这条用例保留原来的意图——名字要在面板隐藏再打开
    之后保持不变——只是把被测的载体换成 placeholder。
  */
  it("names the composer by its placeholder, stably across hide and reopen", async () => {
    const { wrapper } = mountPanel();
    const textarea = wrapper.get("textarea[name='message']");
    expect(textarea.attributes("aria-label")).toBeUndefined();
    expect(textarea.attributes("placeholder")).toBe(enUS.sidecar.placeholder);
    await wrapper.setProps({ active: false });
    await wrapper.setProps({ active: true });
    expect(
      wrapper.get("textarea[name='message']").attributes("placeholder"),
    ).toBe(enUS.sidecar.placeholder);
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

  /*
    头部这一簇钉的是 sidecar-panel.tsx:527 的四条合同。对照场景 `sidecar-chat`
    只走得到**草稿态**（还没有 sidecar thread），所以「有 thread 时关闭按钮还在不在」
    这条只能在这里钉——而它恰好是原来那处 v-if/v-else 造成的功能缺失：
    本仓一旦建出 thread，面板上就再也没有关闭按钮了。
  */
  it("always offers close, and only offers delete once a thread exists", async () => {
    const withThread = mountPanel();
    expect(
      withThread.wrapper.find('[data-testid="sidecar-close-button"]').exists(),
    ).toBe(true);
    expect(
      withThread.wrapper.find('[data-testid="sidecar-delete-button"]').exists(),
    ).toBe(true);

    const draftSession = makeSession();
    draftSession.threadId.value = null;
    const draft = mountPanel(draftSession);
    expect(
      draft.wrapper.find('[data-testid="sidecar-close-button"]').exists(),
    ).toBe(true);
    expect(
      draft.wrapper.find('[data-testid="sidecar-delete-button"]').exists(),
    ).toBe(false);
  });

  it("names the close button with common.close, not the side-chat label", () => {
    const { wrapper } = mountPanel();
    const close = wrapper.get('[data-testid="sidecar-close-button"]');
    expect(close.attributes("aria-label")).toBe(enUS.common.close);
    expect(close.attributes("aria-label")).not.toBe(enUS.sidecar.close);
  });

  it("closes an existing side chat but discards a draft that has no thread", async () => {
    const withThread = mountPanel();
    await withThread.wrapper
      .get('[data-testid="sidecar-close-button"]')
      .trigger("click");
    expect(withThread.wrapper.emitted("close")).toHaveLength(1);
    expect(withThread.wrapper.emitted("discard")).toBeUndefined();

    const draftSession = makeSession();
    draftSession.threadId.value = null;
    const draft = mountPanel(draftSession);
    await draft.wrapper
      .get('[data-testid="sidecar-close-button"]')
      .trigger("click");
    expect(draft.wrapper.emitted("discard")).toHaveLength(1);
    expect(draft.wrapper.emitted("close")).toBeUndefined();
  });

  it("titles the header with sidecar.title and subtitles it three ways", async () => {
    const withThread = mountPanel();
    expect(withThread.wrapper.text()).toContain(enUS.sidecar.title);
    // 原来这里画的是 emptyTitle——同一颗面板在两个应用里叫的名字不一样。
    expect(withThread.wrapper.text()).toContain(enUS.sidecar.continuing);

    const draftSession = makeSession();
    draftSession.threadId.value = null;
    const draft = mountPanel(draftSession);
    expect(draft.wrapper.text()).toContain(enUS.sidecar.noContext);
    expect(draft.wrapper.text()).not.toContain(enUS.sidecar.continuing);

    const quoted = mountPanel(makeSession(), [
      { id: 1, context: { content: "a" } },
      { id: 2, context: { content: "b" } },
    ]).wrapper;
    expect(quoted.text()).toContain("2 selected text fragments");
    expect(quoted.text()).not.toContain(enUS.sidecar.continuing);
  });

  it("shows the empty state instead of the message list until a thread exists", () => {
    const withThread = mountPanel();
    expect(withThread.wrapper.findComponent(MessageListStub).exists()).toBe(
      true,
    );
    expect(withThread.wrapper.text()).not.toContain(
      enUS.sidecar.emptyDescription,
    );

    const draftSession = makeSession();
    draftSession.threadId.value = null;
    const draft = mountPanel(draftSession);
    expect(draft.wrapper.findComponent(MessageListStub).exists()).toBe(false);
    expect(draft.wrapper.text()).toContain(enUS.sidecar.emptyTitle);
    expect(draft.wrapper.text()).toContain(enUS.sidecar.emptyDescription);
  });
});
