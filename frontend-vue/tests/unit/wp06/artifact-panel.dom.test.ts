/*
  【文件职责】     固定 WP-06 ArtifactPanel 的文件策略、完整加载、动作、错误与 stale DOM 合同。
  【对应 frontend/】 frontend/src/components/workspace/artifacts/artifact-file-detail.tsx
  【架构位置】     测试
  【主要导出】     ArtifactPanel DOM 回归
  【依赖关系】     ArtifactPanel · useArtifactDraft
  【边界与注意】   通过用户可见 DOM 和真实调用参数证明边界，不断言组件内部实现细节。
*/

import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ArtifactPanel from "@/components/workspace/artifacts/ArtifactPanel.vue";
import { useArtifactDraft } from "@/composables/useArtifactDraft";
import { ArtifactActionError } from "@/core/artifacts/actions";
import { ArtifactRequestError } from "@/core/artifacts/api";

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

describe("WP-06 ArtifactPanel", () => {
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
    expect(wrapper.find("button[aria-label='Edit artifact']").exists()).toBe(
      false,
    );
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
    await wrapper.get("button[aria-label='Load full file']").trigger("click");
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
      .get("button[aria-label='Copy artifact']")
      .trigger("click");
    expect(mocks.copy).toHaveBeenCalledWith("copy me");
    await textPanel.wrapper
      .get("button[aria-label='Open artifact']")
      .trigger("click");
    await flushPromises();
    expect(textPanel.wrapper.get("[role='alert']").text()).toContain(
      "artifact forbidden",
    );
    expect(globalThis.open).not.toHaveBeenCalled();
    textPanel.wrapper.unmount();

    const nonAdmin = mountPanel("/mnt/user-data/outputs/tool.skill");
    await flushPromises();
    expect(
      nonAdmin.wrapper.find("button[aria-label='Install skill']").exists(),
    ).toBe(false);
    nonAdmin.wrapper.unmount();

    mocks.install.mockResolvedValueOnce({
      success: false,
      skill_name: "",
      message: "skill invalid",
    });
    const admin = mountPanel("/mnt/user-data/outputs/tool.skill", {
      isAdmin: true,
    });
    await admin.wrapper
      .get("button[aria-label='Install skill']")
      .trigger("click");
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
    await wrapper.get("button[aria-label='Edit artifact']").trigger("click");
    await wrapper.get("[data-testid='artifact-editor']").setValue("saved");
    await wrapper.get("button[aria-label='Save artifact']").trigger("click");
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
      await wrapper.get("button[aria-label='Edit artifact']").trigger("click");
      await wrapper.get("[data-testid='artifact-editor']").setValue("my draft");
      await wrapper.get("button[aria-label='Save artifact']").trigger("click");
      await flushPromises();

      expect(wrapper.get("[role='alert']").text()).toContain(
        `gateway-${status}`,
      );
      expect(
        (
          wrapper.get("[data-testid='artifact-editor']")
            .element as HTMLTextAreaElement
        ).value,
      ).toBe("my draft");
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
    await wrapper.get("button[aria-label='Edit artifact']").trigger("click");
    await wrapper.get("[data-testid='artifact-editor']").setValue("my draft");
    await wrapper.get("button[aria-label='Save artifact']").trigger("click");
    await flushPromises();

    expect(wrapper.get("[role='alert']").text()).toContain("revision changed");
    expect(
      wrapper.get("button[aria-label='Save artifact']").attributes("disabled"),
    ).toBeDefined();
    await wrapper
      .get("button[aria-label='Discard artifact changes']")
      .trigger("click");
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
    await active.wrapper
      .get("button[aria-label='Edit artifact']")
      .trigger("click");
    await active.wrapper
      .get("[data-testid='artifact-editor']")
      .setValue("blocked");
    expect(
      active.wrapper
        .get("button[aria-label='Save artifact']")
        .attributes("disabled"),
    ).toBeDefined();
    expect(mocks.save).not.toHaveBeenCalled();
    active.wrapper.unmount();

    mocks.load
      .mockReset()
      .mockResolvedValueOnce(loaded("old server"))
      .mockResolvedValueOnce(loaded("new server"));
    const stale = mountPanel("/mnt/user-data/outputs/old.txt");
    await flushPromises();
    await stale.wrapper
      .get("button[aria-label='Edit artifact']")
      .trigger("click");
    await stale.wrapper
      .get("[data-testid='artifact-editor']")
      .setValue("old draft");
    await stale.wrapper
      .get("button[aria-label='Save artifact']")
      .trigger("click");
    stale.selected.value = "/mnt/user-data/outputs/new.txt";
    await flushPromises();
    resolveSave({ sha256: "c".repeat(64) });
    await flushPromises();
    expect(stale.wrapper.text()).toContain("new server");
    expect(stale.wrapper.text()).not.toContain("old draft");
    stale.wrapper.unmount();
  });
});
