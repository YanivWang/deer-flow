import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import ChatComposer from "@/components/chat/ChatComposer.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import {
  buildComposerDraftKey,
  writeComposerDraft,
} from "@/core/threads/composer-draft";
import { findSuggestionTemplatePlaceholder } from "@/core/suggestions/placeholders";

const mocks = vi.hoisted(() => ({
  loadSkills: vi.fn(),
  loadModels: vi.fn(),
  getUploadLimits: vi.fn(),
  uploadFiles: vi.fn(),
  polishInputDraft: vi.fn(),
  fetchWithAuth: vi.fn(),
}));

const NativeURL = URL;
const createObjectURL = vi.fn((file: File) => `blob:${file.name}`);
const revokeObjectURL = vi.fn();

vi.mock("@/core/skills/api", () => ({ loadSkills: mocks.loadSkills }));
vi.mock("@/core/models/api", () => ({ loadModels: mocks.loadModels }));
vi.mock("@/core/uploads/api", () => ({
  getUploadLimits: mocks.getUploadLimits,
  uploadFiles: mocks.uploadFiles,
}));
vi.mock("@/core/input-polish/api", () => ({
  polishInputDraft: mocks.polishInputDraft,
}));
vi.mock("@/core/api/fetcher", () => ({ fetch: mocks.fetchWithAuth }));

function mountComposer(
  submitMessage = vi.fn(async (_text, _files, options) => {
    options.onAccepted();
    return true;
  }),
  props: { isWelcome?: boolean; showWelcomeSuggestions?: boolean } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = mount(ChatComposer, {
    props: {
      threadKey: "thread-1",
      targetThreadId: "thread-1",
      userId: "user-1",
      agentName: null,
      streaming: false,
      uploading: false,
      promptHistory: [],
      context: { model_name: "reasoner", mode: "pro" },
      submitMessage,
      ...props,
    },
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      stubs: {
        ReferenceAttachment: true,
        ConfettiButton: {
          template:
            '<button type="button" data-effect="confetti-button" @click="$emit(\'click\', $event)"><slot /></button>',
        },
        GoalStatus: true,
      },
    },
  });
  return { wrapper, submitMessage };
}

async function selectFile(
  wrapper: ReturnType<typeof mount>["wrapper"],
  file: File,
) {
  const input = wrapper.get("input[type='file']");
  Object.defineProperty(input.element, "files", {
    configurable: true,
    value: [file],
  });
  await input.trigger("change");
}

describe("composer submission and stale lifecycle", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal("useNuxtApp", () => ({
      $i18n: { t: ref(enUS), locale: ref("en-US") },
    }));
    mocks.loadSkills
      .mockReset()
      .mockResolvedValue([{ name: "enabled", description: "", enabled: true }]);
    mocks.loadModels.mockReset().mockResolvedValue({
      models: [
        {
          id: "reasoner",
          name: "reasoner",
          model: "provider-reasoner",
          display_name: "Reasoner",
          supports_thinking: true,
          supports_reasoning_effort: true,
        },
      ],
      token_usage: { enabled: true },
    });
    mocks.getUploadLimits.mockReset().mockResolvedValue(undefined);
    mocks.uploadFiles.mockReset();
    mocks.polishInputDraft.mockReset();
    mocks.fetchWithAuth.mockReset();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    vi.stubGlobal(
      "URL",
      class extends NativeURL {
        static createObjectURL = createObjectURL;
        static revokeObjectURL = revokeObjectURL;
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the complete React welcome suggestion row in source order", async () => {
    const { wrapper } = mountComposer(undefined, { isWelcome: true });
    await flushPromises();

    const suggestions = wrapper.get("[data-testid='welcome-suggestions']");
    expect(
      suggestions.findAll("button").map((button) => button.text()),
    ).toEqual(["Surprise", "Write", "Research", "Collect", "Learn", "Create"]);
    expect(suggestions.findAll("svg")).toHaveLength(6);
    expect(wrapper.findAll("[data-slot='suggestions-list']")).toHaveLength(1);
  });

  it("fills a welcome suggestion and selects its placeholder without sending", async () => {
    const submitMessage = vi.fn();
    const { wrapper } = mountComposer(submitMessage, { isWelcome: true });
    await flushPromises();

    const suggestions = wrapper.get("[data-testid='welcome-suggestions']");
    const research = suggestions
      .findAll("button")
      .find((button) => button.text() === "Research");
    expect(research).toBeDefined();
    await research!.trigger("click");
    await flushPromises();

    const textarea = wrapper.get("textarea").element as HTMLTextAreaElement;
    const prompt = enUS.inputBox.suggestions[1]!.prompt;
    const placeholder = findSuggestionTemplatePlaceholder(prompt);
    expect(textarea.value).toBe(prompt);
    expect(textarea.selectionStart).toBe(placeholder?.start);
    expect(textarea.selectionEnd).toBe(placeholder?.end);
    expect(submitMessage).not.toHaveBeenCalled();
  });

  it("opens Create and fills the selected creation prompt without sending", async () => {
    const submitMessage = vi.fn();
    const { wrapper } = mountComposer(submitMessage, { isWelcome: true });
    await flushPromises();

    await wrapper
      .get("[data-testid='welcome-create-trigger']")
      .trigger("click");
    await flushPromises();
    const webpage = document.querySelector<HTMLButtonElement>(
      "[data-testid='welcome-create-webpage']",
    );
    expect(webpage).not.toBeNull();
    webpage!.click();
    await flushPromises();

    const textarea = wrapper.get("textarea").element as HTMLTextAreaElement;
    expect(textarea.value).toBe(
      (enUS.inputBox.suggestionsCreate[0] as { prompt: string }).prompt,
    );
    expect(submitMessage).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("keeps text and files on upload failure", async () => {
    mocks.uploadFiles.mockRejectedValue(new Error("Upload rejected"));
    const { wrapper, submitMessage } = mountComposer();
    await flushPromises();
    await wrapper.get("textarea[name='message']").setValue("Review this file");
    await selectFile(wrapper, new File(["hello"], "notes.txt"));
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(submitMessage).not.toHaveBeenCalled();
    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(
      "Review this file",
    );
    expect(wrapper.text()).toContain("notes.txt");
    expect(wrapper.text()).toContain("Upload rejected");
  });

  it("renders an image attachment inside the composer surface with a thumbnail and removable state", async () => {
    const { wrapper } = mountComposer();
    await flushPromises();
    await selectFile(
      wrapper,
      new File(["image"], "cat.png", { type: "image/png" }),
    );
    await flushPromises();

    const surface = wrapper.get("[data-testid='composer-surface']");
    expect(surface.classes()).toContain(
      "has-[[data-slot=input-group-control]:focus-visible]:ring-[3px]",
    );
    expect(
      wrapper.get("[data-testid='composer-bottom-background']").classes(),
    ).toEqual(expect.arrayContaining(["absolute", "-bottom-[17px]", "h-4"]));
    expect(
      wrapper.get("[data-testid='composer-disclaimer']").classes(),
    ).toEqual(
      expect.arrayContaining(["absolute", "top-full", "right-0", "left-0"]),
    );
    expect(wrapper.get("textarea").attributes("data-slot")).toBe(
      "input-group-control",
    );
    expect(surface.get("[data-slot='input-group-body']").exists()).toBe(true);
    expect(surface.get("[data-slot='input-group-footer']").exists()).toBe(true);
    const attachment = surface.get("[data-testid='composer-attachment']");
    expect(attachment.text()).toContain("cat.png");
    expect(attachment.get("img").attributes("src")).toBe("blob:cat.png");
    expect(createObjectURL).toHaveBeenCalledTimes(1);

    await attachment.get("button").trigger("click");
    await flushPromises();
    expect(surface.find("[data-testid='composer-attachment']").exists()).toBe(
      false,
    );
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:cat.png");
  });

  it("reuses an uploaded file after send failure and clears only on run acceptance", async () => {
    mocks.uploadFiles.mockResolvedValue({
      success: true,
      files: [
        {
          filename: "notes.txt",
          size: 5,
          path: "/tmp/notes.txt",
          virtual_path: "/mnt/user-data/uploads/notes.txt",
          artifact_url: "/artifact",
        },
      ],
      message: "ok",
      skipped_files: [],
    });
    const submitMessage = vi
      .fn()
      .mockRejectedValueOnce(new Error("Run rejected"))
      .mockImplementationOnce(async (_text, _files, options) => {
        options.onAccepted();
        return true;
      });
    const { wrapper } = mountComposer(submitMessage);
    await flushPromises();
    await wrapper.get("textarea[name='message']").setValue("Review this file");
    await selectFile(wrapper, new File(["hello"], "notes.txt"));

    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.text()).toContain("notes.txt");
    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(
      "Review this file",
    );

    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(mocks.uploadFiles).toHaveBeenCalledTimes(1);
    expect(submitMessage).toHaveBeenCalledTimes(2);
    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(
      "",
    );
    expect(wrapper.text()).not.toContain("notes.txt");
  });

  it("offers append, replace, and cancel, then sends the selected result", async () => {
    const submitMessage = vi.fn(async (_text, _files, options) => {
      options.onAccepted();
      return true;
    });
    const { wrapper } = mountComposer(submitMessage);
    await flushPromises();
    const textarea = wrapper.get("textarea[name='message']");
    await textarea.setValue("Existing draft");
    (
      wrapper.vm as unknown as { offerFollowup(value: string): void }
    ).offerFollowup("Suggested question");
    await flushPromises();

    expect(wrapper.get("[role='dialog']").text()).toContain(
      "Suggested question",
    );
    await wrapper.get("[role='dialog'] button").trigger("click");
    expect((textarea.element as HTMLTextAreaElement).value).toBe(
      "Existing draft",
    );
    expect(submitMessage).not.toHaveBeenCalled();

    (
      wrapper.vm as unknown as { offerFollowup(value: string): void }
    ).offerFollowup("Suggested question");
    await flushPromises();
    await wrapper.findAll("[role='dialog'] button")[1]!.trigger("click");
    await flushPromises();
    expect(submitMessage).toHaveBeenLastCalledWith(
      "Existing draft\nSuggested question",
      [],
      expect.objectContaining({ onAccepted: expect.any(Function) }),
    );

    await textarea.setValue("Another draft");
    (
      wrapper.vm as unknown as { offerFollowup(value: string): void }
    ).offerFollowup("Replacement");
    await flushPromises();
    await wrapper.findAll("[role='dialog'] button")[2]!.trigger("click");
    await flushPromises();
    expect(submitMessage).toHaveBeenLastCalledWith(
      "Replacement",
      [],
      expect.objectContaining({ onAccepted: expect.any(Function) }),
    );
  });

  it("keeps new-session drafts isolated and rejects a stale accepted callback after route change", async () => {
    mocks.uploadFiles.mockResolvedValue({
      success: true,
      files: [
        {
          filename: "thread-one.txt",
          size: 3,
          path: "/tmp/thread-one.txt",
          virtual_path: "/mnt/user-data/uploads/thread-one.txt",
          artifact_url: "/artifact",
        },
      ],
      message: "ok",
      skipped_files: [],
    });
    let accept!: () => void;
    let resolveSubmit!: (value: boolean) => void;
    const submitMessage = vi.fn(
      (_text, _files, options) =>
        new Promise<boolean>((resolve) => {
          accept = options.onAccepted;
          resolveSubmit = resolve;
        }),
    );
    const { wrapper } = mountComposer(submitMessage);
    await flushPromises();
    const textarea = wrapper.get("textarea[name='message']");
    await textarea.setValue("Thread one draft");
    await selectFile(wrapper, new File(["one"], "thread-one.txt"));
    await wrapper.get("form").trigger("submit");
    expect(submitMessage).toHaveBeenCalledTimes(1);

    await wrapper.setProps({
      threadKey: "thread-2",
      targetThreadId: "thread-2",
    });
    await flushPromises();
    expect((textarea.element as HTMLTextAreaElement).value).toBe("");
    expect(wrapper.text()).not.toContain("thread-one.txt");

    accept();
    resolveSubmit(true);
    await flushPromises();
    await wrapper.setProps({
      threadKey: "thread-1",
      targetThreadId: "thread-1",
    });
    await flushPromises();
    expect((textarea.element as HTMLTextAreaElement).value).toBe(
      "Thread one draft",
    );
    expect(wrapper.text()).toContain("thread-one.txt");
  });

  it("drops duplicate submits while the first request is in flight", async () => {
    let accept!: () => void;
    let resolveSubmit!: (value: boolean) => void;
    const submitMessage = vi.fn(
      (_text, _files, options) =>
        new Promise<boolean>((resolve) => {
          accept = options.onAccepted;
          resolveSubmit = resolve;
        }),
    );
    const { wrapper } = mountComposer(submitMessage);
    await flushPromises();
    await wrapper.get("textarea[name='message']").setValue("Only once");
    await wrapper.get("form").trigger("submit");
    await wrapper.get("form").trigger("submit");
    expect(submitMessage).toHaveBeenCalledTimes(1);
    expect(Object.values(sessionStorage).join("\n")).not.toContain("Only once");

    accept();
    resolveSubmit(true);
    await flushPromises();
    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(
      "",
    );
  });

  it("does not recreate an ordinary draft after storage is explicitly cleared", async () => {
    const { wrapper } = mountComposer();
    await flushPromises();
    await wrapper
      .get("textarea[name='message']")
      .setValue("Discard this draft");
    expect(Object.values(sessionStorage).join("\n")).toContain(
      "Discard this draft",
    );

    sessionStorage.clear();
    globalThis.dispatchEvent(new Event("pagehide"));
    wrapper.unmount();
    expect(sessionStorage.length).toBe(0);
  });

  it("does not let a polish result write into another route", async () => {
    let resolvePolish!: (value: {
      rewritten_text: string;
      changed: boolean;
    }) => void;
    mocks.polishInputDraft.mockImplementation(
      () => new Promise((resolve) => (resolvePolish = resolve)),
    );
    const { wrapper } = mountComposer();
    await flushPromises();
    await wrapper.get("textarea[name='message']").setValue("Old route draft");
    await wrapper.get("[data-testid='polish-input-button']").trigger("click");
    await wrapper.setProps({
      threadKey: "thread-2",
      targetThreadId: "thread-2",
    });
    resolvePolish({ rewritten_text: "Stale rewrite", changed: true });
    await flushPromises();

    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(
      "",
    );
  });

  it("invalidates polish and goal results when polishing is cancelled or the route changes", async () => {
    let resolvePolish!: (value: {
      rewritten_text: string;
      changed: boolean;
    }) => void;
    mocks.polishInputDraft.mockImplementation(
      () => new Promise((resolve) => (resolvePolish = resolve)),
    );
    let resolveGoal!: (value: Response) => void;
    mocks.fetchWithAuth.mockImplementation(
      () => new Promise<Response>((resolve) => (resolveGoal = resolve)),
    );
    const { wrapper } = mountComposer();
    await flushPromises();
    const textarea = wrapper.get("textarea[name='message']");
    await textarea.setValue("Polish me");
    await wrapper.get("[data-testid='polish-input-button']").trigger("click");

    /*
      润色进行中整个输入框是锁住的，提交/停止按钮也一样——React 的 composerLocked
      就包含 polishingInput。所以放弃一次在途润色的唯一入口是那颗取消按钮，
      不是「停止」。
    */
    expect(
      wrapper.get("button[type='submit']").attributes("disabled"),
    ).toBeDefined();
    await wrapper
      .get("[data-testid='cancel-polish-input-button']")
      .trigger("click");
    resolvePolish({ rewritten_text: "Stale polish", changed: true });
    await flushPromises();
    expect((textarea.element as HTMLTextAreaElement).value).toBe("Polish me");

    wrapper.unmount();
    const { wrapper: goalWrapper } = mountComposer();
    await flushPromises();
    await goalWrapper
      .get("textarea[name='message']")
      .setValue("/goal Ship the release");
    await goalWrapper.get("form").trigger("submit");
    await vi.waitFor(() =>
      expect(mocks.fetchWithAuth).toHaveBeenCalledTimes(1),
    );
    await goalWrapper.setProps({
      threadKey: "thread-2",
      targetThreadId: "thread-2",
    });
    resolveGoal(
      new Response(
        JSON.stringify({ goal: { objective: "Ship the release" } }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    await flushPromises();
    expect(goalWrapper.emitted("goalChange")).toBeUndefined();
    expect(
      (goalWrapper.get("textarea").element as HTMLTextAreaElement).value,
    ).toBe("");
  });

  it("degrades a disabled saved skill to editable slash text after catalog load", async () => {
    writeComposerDraft(
      sessionStorage,
      buildComposerDraftKey({
        userId: "user-1",
        agentName: null,
        threadId: "thread-1",
      }),
      { text: "Analyze it", skillName: "disabled-skill" },
    );
    const { wrapper } = mountComposer();
    await flushPromises();
    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(
      "/disabled-skill Analyze it",
    );
  });

  it("waits for the agent default before selecting a catalog fallback model", async () => {
    mocks.loadModels.mockResolvedValue({
      models: [
        {
          id: "flash",
          name: "flash",
          model: "provider-flash",
          display_name: "Flash",
          supports_thinking: false,
          supports_reasoning_effort: false,
        },
        {
          id: "agent-reasoner",
          name: "agent-reasoner",
          model: "provider-reasoner",
          display_name: "Agent Reasoner",
          supports_thinking: true,
          supports_reasoning_effort: true,
        },
      ],
      token_usage: { enabled: true },
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = mount(ChatComposer, {
      props: {
        threadKey: "thread-1",
        targetThreadId: "thread-1",
        userId: "user-1",
        agentName: "researcher",
        defaultModelName: null,
        modelSelectionReady: false,
        streaming: false,
        uploading: false,
        promptHistory: [],
        context: {},
      },
      global: {
        plugins: [[VueQueryPlugin, { queryClient }]],
        stubs: {
          ReferenceAttachment: true,
          ConfettiButton: true,
          GoalStatus: true,
        },
      },
    });
    await flushPromises();
    expect(wrapper.emitted("contextChange")).toBeUndefined();

    await wrapper.setProps({ defaultModelName: "agent-reasoner" });
    await flushPromises();
    expect(wrapper.emitted("contextChange")).toBeUndefined();

    await wrapper.setProps({ modelSelectionReady: true });
    await flushPromises();
    expect(wrapper.emitted("contextChange")?.at(-1)?.[0]).toMatchObject({
      model_name: "agent-reasoner",
      mode: "pro",
    });
  });

  /*
    上游 input-box.tsx:2133 在这个下拉列表上写死了
    `aria-label="Skill suggestions"`（未接入词典）。本仓这里原来完全没有
    aria-label——parity 台账抓不到，因为默认态取样不会打开这个列表
    （wave 17 坑 86）。按 `deerflow-untranslated-primitive-names` 的既定规矩，
    Vue 用 `primitives.skillSuggestions` 照抄同一串英文。
  */
  it("names the slash-skill suggestion listbox to match React's hardcoded label", async () => {
    const { wrapper } = mountComposer();
    await flushPromises();

    await wrapper.get("textarea[name='message']").setValue("/en");
    await flushPromises();

    const listbox = wrapper.get("[role='listbox']");
    expect(listbox.attributes("aria-label")).toBe("Skill suggestions");
  });
});
