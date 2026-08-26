/*
  【文件职责】     固定ArtifactPanel 的文件策略、完整加载、动作、错误与 stale DOM 合同。
  【架构位置】     测试
  【主要导出】     ArtifactPanel DOM 回归
  【依赖关系】     ArtifactPanel · useArtifactDraft
  【边界与注意】   通过用户可见 DOM 和真实调用参数证明边界，不断言组件内部实现细节。
*/

import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { EditorView } from "@codemirror/view";

import ArtifactPanel from "@/components/workspace/artifacts/ArtifactPanel.vue";
import { useArtifactDraft } from "@/composables/useArtifactDraft";
import { ArtifactActionError } from "@/core/artifacts/actions";
import { ArtifactRequestError } from "@/core/artifacts/api";

/*
  「加载完整文件」是一颗**只有可见文字**的按钮，没有 aria-label——React 的截断提示条
  用的就是 `<Button size="sm" variant="outline">{t.artifactPreview.loadFullFile}</Button>`
  （frontend/src/components/workspace/artifacts/artifact-file-detail.tsx）。
  所以这里按文字找，不按 aria-label 找。
*/
function loadFullButton(wrapper: VueWrapper) {
  const button = wrapper
    .findAll("button")
    .find((candidate) => candidate.text() === "Load full file");
  if (!button) throw new Error("找不到「加载完整文件」按钮");
  return button;
}

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  loadTool: vi.fn(),
  save: vi.fn(),
  probe: vi.fn(),
  copy: vi.fn(),
  install: vi.fn(),
}));

vi.mock("vue-router", () => ({
  onBeforeRouteLeave: vi.fn(),
  onBeforeRouteUpdate: vi.fn(),
}));
vi.mock("@/core/artifacts/loader", () => ({
  loadArtifactContent: mocks.load,
  loadArtifactContentFromToolCall: mocks.loadTool,
}));
vi.mock("@/core/artifacts/api", async (loadOriginal) => {
  const actual = await loadOriginal<typeof import("@/core/artifacts/api")>();
  return { ...actual, updateArtifactContent: mocks.save };
});
vi.mock("@/core/artifacts/actions", async (loadOriginal) => {
  const actual =
    await loadOriginal<typeof import("@/core/artifacts/actions")>();
  return { ...actual, probeArtifactAction: mocks.probe };
});
vi.mock("@/core/clipboard", () => ({ writeTextToClipboard: mocks.copy }));
vi.mock("@/core/skills/api", () => ({ installSkill: mocks.install }));

const SHA = "a".repeat(64);

/*
  编辑器现在是 CodeMirror，`data-testid` 仍在 ArtifactEditor 渲染的宿主上（所以
  「有没有挂编辑器」的断言语义没变），但可编辑的是它内部那个 contenteditable。
  CodeMirror 只在 mount 后动态 import，所以要轮询等它就位，不能假设一次
  flushPromises 就够。
*/
/*
  预热 CodeMirror 的模块图。组件里的 `await import()` 第一次要把 5 个包过一遍
  transform，那一轮不是靠 flushPromises 让路就能推进的——不预热的话，第一个
  用到编辑器的用例会因为「还没加载完」而不是「行为不对」失败。

  ⚠️ **必须逐个预热 `editor.ts` 内部 `Promise.all` 里的那 5 个包，import
  `editor` 模块本身不够。** import 一个模块只会执行它的顶层代码，而这 5 个
  import 写在 `createCodeEditor()` 函数体里，只有真正建编辑器时才触发。
  漏掉它们的版本在本机 5 次 `make verify` 里红了 2 次——`.txt` 用例不需要任何
  语法包，所以当时预热的 `lang-markdown` 对它一点用都没有，而 50 轮
  flushPromises 是否够用取决于机器负载。一条时红时绿的门禁比没有门禁更糟：
  它教人重跑到绿为止。
*/
async function warmCodeEditorModules() {
  await Promise.all([
    import("@/core/code-editor/editor"),
    import("@codemirror/state"),
    import("@codemirror/view"),
    import("@codemirror/language"),
    import("@codemirror/commands"),
    import("@lezer/highlight"),
    import("@codemirror/lang-markdown"),
  ]);
}

async function editorView(wrapper: VueWrapper): Promise<EditorView> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const host = wrapper.find("[data-testid='artifact-editor']");
    const view = host.exists()
      ? EditorView.findFromDOM(host.element as HTMLElement)
      : null;
    if (view) return view;
    await flushPromises();
  }
  throw new Error("artifact editor did not mount");
}

/** 用一次事务替换全文：和用户全选后重打一遍走的是同一条 update 路径。 */
async function typeInEditor(wrapper: VueWrapper, text: string) {
  const view = await editorView(wrapper);
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: text },
  });
  await flushPromises();
}

async function editorText(wrapper: VueWrapper) {
  return (await editorView(wrapper)).state.doc.toString();
}

function loaded(
  content: string,
  options: Partial<Record<string, unknown>> = {},
) {
  return {
    content,
    url: "/api/artifact",
    sha256: SHA,
    truncated: false,
    previewBytes: content.length,
    totalBytes: content.length,
    ...options,
  };
}

function mountPanel(
  path: string,
  options: { isAdmin?: boolean; streaming?: boolean; isMock?: boolean } = {},
) {
  const selected = ref(path);
  let draftOwner!: ReturnType<typeof useArtifactDraft>;
  const Host = defineComponent({
    setup() {
      draftOwner = useArtifactDraft({ confirm: () => true });
      return () =>
        h(ArtifactPanel, {
          threadId: "thread-1",
          selected: selected.value,
          artifacts: [selected.value],
          openedPresentedArtifacts: [],
          messages: [],
          streaming: options.streaming ?? false,
          isMock: options.isMock ?? false,
          isAdmin: options.isAdmin ?? false,
          draftOwner,
          onSelect: (next: string) => {
            selected.value = next;
          },
        });
    },
  });
  const wrapper = mount(Host, {
    global: {
      stubs: { StreamMarkdown: { template: "<div data-testid='markdown' />" } },
    },
  });
  return { wrapper, selected, draftOwner };
}

describe("ArtifactPanel", () => {
  beforeAll(warmCodeEditorModules);
  beforeEach(() => {
    mocks.load.mockReset();
    mocks.loadTool.mockReset();
    mocks.save.mockReset();
    mocks.probe.mockReset().mockResolvedValue(undefined);
    mocks.copy.mockReset().mockResolvedValue(undefined);
    mocks.install.mockReset().mockResolvedValue({
      success: true,
      skill_name: "demo",
      message: "installed",
    });
    vi.stubGlobal("open", vi.fn());
  });
  afterEach(() => vi.restoreAllMocks());

  it.each([
    "report.docx",
    "bundle.zip",
    "blob.bin",
    "mystery.custom",
    "README",
  ])("keeps %s out of the text loader, editor, and PUT path", async (name) => {
    const { wrapper } = mountPanel(`/mnt/user-data/outputs/${name}`);
    await flushPromises();
    expect(mocks.load).not.toHaveBeenCalled();
    expect(wrapper.find("[data-testid='artifact-editor']").exists()).toBe(
      false,
    );
    expect(wrapper.text()).toContain("Download-only file");
    expect(wrapper.find("button[aria-label='Edit']").exists()).toBe(false);
    expect(mocks.save).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("does not mount an editor or HTML iframe until the user loads a complete file", async () => {
    const complete = "<html><body>complete</body></html>";
    mocks.load
      .mockResolvedValueOnce(
        loaded(complete, {
          sha256: undefined,
          truncated: true,
          previewBytes: 32,
          totalBytes: 2_000_000,
        }),
      )
      .mockResolvedValueOnce(loaded(complete));
    const { wrapper } = mountPanel("/mnt/user-data/outputs/page.html");
    await flushPromises();

    expect(wrapper.find("iframe[title='Artifact preview']").exists()).toBe(
      false,
    );
    expect(wrapper.find("[data-testid='artifact-editor']").exists()).toBe(
      false,
    );
    await loadFullButton(wrapper).trigger("click");
    await flushPromises();
    expect(mocks.load).toHaveBeenLastCalledWith(
      expect.objectContaining({ full: true }),
    );
    expect(wrapper.find("iframe[title='Artifact preview']").exists()).toBe(
      true,
    );
    wrapper.unmount();
  });

  it("keeps incomplete full HTML out of srcdoc and ignores stale path loads", async () => {
    let resolveFirst!: (value: ReturnType<typeof loaded>) => void;
    mocks.load
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
      )
      .mockResolvedValueOnce(loaded("new file"));
    const { wrapper, selected } = mountPanel("/mnt/user-data/outputs/old.html");
    selected.value = "/mnt/user-data/outputs/new.txt";
    await flushPromises();
    resolveFirst(loaded("<html><body>stale"));
    await flushPromises();

    expect(wrapper.text()).toContain("new file");
    expect(wrapper.text()).not.toContain("stale");
    expect(wrapper.find("iframe[title='Artifact preview']").exists()).toBe(
      false,
    );
    wrapper.unmount();
  });

  it("clears an aborted formal loading state when the selected path becomes a write-file draft", async () => {
    let resolveFormal!: (value: ReturnType<typeof loaded>) => void;
    mocks.load.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFormal = resolve;
      }),
    );
    mocks.loadTool.mockReturnValue("stream draft");
    const { wrapper, selected } = mountPanel(
      "/mnt/user-data/outputs/formal.txt",
    );
    selected.value =
      "write-file:/mnt/user-data/outputs/formal.txt?tool_call_id=call-1";
    await flushPromises();
    expect(wrapper.text()).toContain("stream draft");
    expect(wrapper.text()).not.toContain("Loading artifact");

    resolveFormal(loaded("stale formal"));
    await flushPromises();
    expect(wrapper.text()).toContain("stream draft");
    expect(wrapper.text()).not.toContain("stale formal");
    wrapper.unmount();
  });

  it("shows copy/open/download failures and only exposes install for a real admin skill", async () => {
    mocks.load.mockResolvedValue(loaded("copy me"));
    mocks.probe.mockRejectedValueOnce(
      new ArtifactActionError(403, "artifact forbidden"),
    );
    const textPanel = mountPanel("/mnt/user-data/outputs/report.txt");
    await flushPromises();
    await textPanel.wrapper
      .get("button[aria-label='Copy to clipboard']")
      .trigger("click");
    expect(mocks.copy).toHaveBeenCalledWith("copy me");
    await textPanel.wrapper
      .get("button[aria-label='Open in new window']")
      .trigger("click");
    await flushPromises();
    expect(textPanel.wrapper.get("[role='alert']").text()).toContain(
      "artifact forbidden",
    );
    expect(globalThis.open).not.toHaveBeenCalled();
    textPanel.wrapper.unmount();

    const nonAdmin = mountPanel("/mnt/user-data/outputs/tool.skill");
    await flushPromises();
    expect(nonAdmin.wrapper.find("button[aria-label='Install']").exists()).toBe(
      false,
    );
    nonAdmin.wrapper.unmount();

    mocks.install.mockResolvedValueOnce({
      success: false,
      skill_name: "",
      message: "skill invalid",
    });
    const admin = mountPanel("/mnt/user-data/outputs/tool.skill", {
      isAdmin: true,
    });
    await admin.wrapper.get("button[aria-label='Install']").trigger("click");
    await flushPromises();
    expect(mocks.install).toHaveBeenCalledWith({
      thread_id: "thread-1",
      path: "/mnt/user-data/outputs/tool.skill",
    });
    expect(admin.wrapper.get("[role='alert']").text()).toContain(
      "skill invalid",
    );
    admin.wrapper.unmount();
  });

  it("saves a full formal text artifact with expected_sha256 and resets the draft", async () => {
    const nextSha = "b".repeat(64);
    mocks.load.mockResolvedValue(loaded("server"));
    mocks.save.mockResolvedValue({
      path: "/mnt/user-data/outputs/report.txt",
      sha256: nextSha,
      size: 5,
    });
    const { wrapper } = mountPanel("/mnt/user-data/outputs/report.txt");
    await flushPromises();
    await wrapper.get("button[aria-label='Edit']").trigger("click");
    await typeInEditor(wrapper, "saved");
    await wrapper.get("button[aria-label='Save']").trigger("click");
    await flushPromises();

    expect(mocks.save).toHaveBeenCalledWith({
      threadId: "thread-1",
      filepath: "/mnt/user-data/outputs/report.txt",
      content: "saved",
      expectedSha256: SHA,
    });
    expect(wrapper.find("[data-testid='artifact-editor']").exists()).toBe(
      false,
    );
    expect(wrapper.text()).toContain("saved");
    wrapper.unmount();
  });

  it.each([403, 404, 409, 413, 415])(
    "surfaces save HTTP %s without discarding the dirty draft",
    async (status) => {
      mocks.load.mockResolvedValue(loaded("server"));
      mocks.save.mockRejectedValue(
        new ArtifactRequestError(status, `gateway-${status}`),
      );
      const { wrapper } = mountPanel("/mnt/user-data/outputs/report.txt");
      await flushPromises();
      await wrapper.get("button[aria-label='Edit']").trigger("click");
      await typeInEditor(wrapper, "my draft");
      await wrapper.get("button[aria-label='Save']").trigger("click");
      await flushPromises();

      expect(wrapper.get("[role='alert']").text()).toContain(
        `gateway-${status}`,
      );
      expect(await editorText(wrapper)).toBe("my draft");
      wrapper.unmount();
    },
  );

  it("preserves a 412 draft, disables another save, and discards to the remote baseline", async () => {
    mocks.load.mockResolvedValue(loaded("server"));
    mocks.save.mockRejectedValue(
      new ArtifactRequestError(412, "revision changed"),
    );
    const { wrapper } = mountPanel("/mnt/user-data/outputs/report.txt");
    await flushPromises();
    await wrapper.get("button[aria-label='Edit']").trigger("click");
    await typeInEditor(wrapper, "my draft");
    await wrapper.get("button[aria-label='Save']").trigger("click");
    await flushPromises();

    expect(wrapper.get("[role='alert']").text()).toContain("revision changed");
    expect(
      wrapper.get("button[aria-label='Save']").attributes("disabled"),
    ).toBeDefined();
    await wrapper.get("button[aria-label='Discard changes']").trigger("click");
    expect(wrapper.find("[data-testid='artifact-editor']").exists()).toBe(
      false,
    );
    expect(wrapper.text()).toContain("server");
    wrapper.unmount();
  });

  it("blocks save during an active run and ignores a stale save after path change", async () => {
    mocks.load
      .mockResolvedValueOnce(loaded("old server"))
      .mockResolvedValueOnce(loaded("new server"));
    let resolveSave!: (value: { sha256: string }) => void;
    mocks.save.mockReturnValue(
      new Promise((resolve) => {
        resolveSave = resolve;
      }),
    );
    const active = mountPanel("/mnt/user-data/outputs/active.txt", {
      streaming: true,
    });
    await flushPromises();
    await active.wrapper.get("button[aria-label='Edit']").trigger("click");
    await typeInEditor(active.wrapper, "blocked");
    expect(
      active.wrapper.get("button[aria-label='Save']").attributes("disabled"),
    ).toBeDefined();
    expect(mocks.save).not.toHaveBeenCalled();
    active.wrapper.unmount();

    mocks.load
      .mockReset()
      .mockResolvedValueOnce(loaded("old server"))
      .mockResolvedValueOnce(loaded("new server"));
    const stale = mountPanel("/mnt/user-data/outputs/old.txt");
    await flushPromises();
    await stale.wrapper.get("button[aria-label='Edit']").trigger("click");
    await typeInEditor(stale.wrapper, "old draft");
    await stale.wrapper.get("button[aria-label='Save']").trigger("click");
    stale.selected.value = "/mnt/user-data/outputs/new.txt";
    await flushPromises();
    resolveSave({ sha256: "c".repeat(64) });
    await flushPromises();
    expect(stale.wrapper.text()).toContain("new server");
    expect(stale.wrapper.text()).not.toContain("old draft");
    stale.wrapper.unmount();
  });
});
