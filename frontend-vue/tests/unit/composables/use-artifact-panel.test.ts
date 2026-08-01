import { mount } from "@vue/test-utils";
import { computed, defineComponent, h, ref } from "vue";
import { beforeEach, describe, expect, it } from "vitest";

import {
  artifactPanelStorageKey,
  useArtifactPanel,
} from "../../../app/composables/use-artifact-panel";

describe("useArtifactPanel", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("selects artifacts, opens the panel, and persists the route state", async () => {
    const routePath = ref("/workspace/chats/thread-a");
    const wrapper = mountArtifactHarness(routePath);

    await wrapper.vm.panel.selectArtifact("/workspace/report.md");
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.panel.open.value).toBe(true);
    expect(wrapper.vm.panel.selectedArtifact.value).toBe("/workspace/report.md");
    expect(readPersisted("/workspace/chats/thread-a")).toEqual({
      artifacts: ["/workspace/report.md"],
      open: true,
      selectedArtifact: "/workspace/report.md",
    });
  });

  it("restores open and selected artifact state from session storage", () => {
    window.sessionStorage.setItem(
      artifactPanelStorageKey("/workspace/chats/thread-a"),
      JSON.stringify({
        artifacts: ["/tmp/a.md", "/tmp/b.md"],
        open: true,
        selectedArtifact: "/tmp/b.md",
      }),
    );

    const wrapper = mountArtifactHarness(ref("/workspace/chats/thread-a"));

    expect(wrapper.vm.panel.artifacts.value).toEqual(["/tmp/a.md", "/tmp/b.md"]);
    expect(wrapper.vm.panel.open.value).toBe(true);
    expect(wrapper.vm.panel.selectedArtifact.value).toBe("/tmp/b.md");
  });

  it("hydrates each route independently when the chat route changes", async () => {
    window.sessionStorage.setItem(
      artifactPanelStorageKey("/workspace/chats/thread-b"),
      JSON.stringify({
        artifacts: ["/tmp/b.md"],
        open: true,
        selectedArtifact: "/tmp/b.md",
      }),
    );
    const routePath = ref("/workspace/chats/thread-a");
    const wrapper = mountArtifactHarness(routePath);

    await wrapper.vm.panel.selectArtifact("/tmp/a.md");
    routePath.value = "/workspace/chats/thread-b";
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.panel.artifacts.value).toEqual(["/tmp/b.md"]);
    expect(wrapper.vm.panel.open.value).toBe(true);
    expect(wrapper.vm.panel.selectedArtifact.value).toBe("/tmp/b.md");

    routePath.value = "/workspace/chats/thread-c";
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.panel.artifacts.value).toEqual([]);
    expect(wrapper.vm.panel.open.value).toBe(false);
    expect(wrapper.vm.panel.selectedArtifact.value).toBeNull();
  });

  it("ignores malformed persisted state", () => {
    window.sessionStorage.setItem(
      artifactPanelStorageKey("/workspace/chats/thread-a"),
      JSON.stringify({
        artifacts: ["/tmp/a.md", 1],
        open: "yes",
        selectedArtifact: "/tmp/a.md",
      }),
    );

    const wrapper = mountArtifactHarness(ref("/workspace/chats/thread-a"));

    expect(wrapper.vm.panel.artifacts.value).toEqual([]);
    expect(wrapper.vm.panel.open.value).toBe(false);
    expect(wrapper.vm.panel.selectedArtifact.value).toBeNull();
  });

  it("syncs discovered artifacts without erasing restored empty initial state", async () => {
    const routePath = ref("/workspace/chats/thread-a");
    const discovered = ref<readonly unknown[]>([]);
    const wrapper = mountArtifactHarness(routePath, discovered);

    discovered.value = ["/tmp/a.md", "/tmp/a.md", 42, "/tmp/b.md"];
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.panel.artifacts.value).toEqual(["/tmp/a.md", "/tmp/b.md"]);
    expect(wrapper.vm.panel.open.value).toBe(false);
    expect(wrapper.vm.panel.selectedArtifact.value).toBe("/tmp/a.md");
  });

  it("keeps selected artifact when the discovered list still contains it", async () => {
    const routePath = ref("/workspace/chats/thread-a");
    const discovered = ref<readonly unknown[]>(["/tmp/a.md", "/tmp/b.md"]);
    const wrapper = mountArtifactHarness(routePath, discovered);

    await wrapper.vm.panel.selectArtifact("/tmp/b.md");
    discovered.value = ["/tmp/b.md", "/tmp/c.md"];
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.panel.selectedArtifact.value).toBe("/tmp/b.md");
    expect(wrapper.vm.panel.artifacts.value).toEqual(["/tmp/b.md", "/tmp/c.md"]);
  });

  it("keeps a restored presented artifact in the detail options when discovery omits it", async () => {
    window.sessionStorage.setItem(
      artifactPanelStorageKey("/workspace/chats/thread-a"),
      JSON.stringify({
        artifacts: ["/tmp/presented.md"],
        open: true,
        selectedArtifact: "/tmp/presented.md",
      }),
    );
    const discovered = ref<readonly unknown[]>([]);
    const wrapper = mountArtifactHarness(ref("/workspace/chats/thread-a"), discovered);

    discovered.value = ["/tmp/generated.md"];
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.panel.selectedArtifact.value).toBe("/tmp/presented.md");
    expect(wrapper.vm.panel.artifacts.value).toEqual([
      "/tmp/presented.md",
      "/tmp/generated.md",
    ]);
  });
});

function mountArtifactHarness(
  routePath: ReturnType<typeof ref<string>>,
  discovered = ref<readonly unknown[]>([]),
) {
  return mount(
    defineComponent({
      setup() {
        const panel = useArtifactPanel(
          computed(() => routePath.value),
          computed(() => discovered.value),
        );
        return { panel };
      },
      render() {
        return h("div");
      },
    }),
  );
}

function readPersisted(pathname: string): unknown {
  const raw = window.sessionStorage.getItem(artifactPanelStorageKey(pathname));
  return raw ? JSON.parse(raw) : null;
}
