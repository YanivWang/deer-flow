/*
  【文件职责】     固定 useArtifactsPanel 将切文件和关面板交给唯一 draft owner。
  【架构位置】     测试
  【主要导出】     无；Vitest cases
  【依赖关系】     useArtifactsPanel · useArtifactDraft
  【边界与注意】   不复制 draft reducer；只证明面板出口实际消费 owner 的决策。
*/

import { mount } from "@vue/test-utils";
import { defineComponent, ref } from "vue";
import { afterEach, expect, it, vi } from "vitest";

import { useArtifactsPanel } from "@/composables/useArtifactsPanel";

vi.mock("vue-router", () => ({
  onBeforeRouteLeave: vi.fn(),
  onBeforeRouteUpdate: vi.fn(),
}));

it("blocks dirty switch and close, then discards through the same owner after confirmation", () => {
  const confirm = vi.fn(() => false);
  vi.stubGlobal("confirm", confirm);
  let panel!: ReturnType<typeof useArtifactsPanel>;
  const wrapper = mount(
    defineComponent({
      setup() {
        panel = useArtifactsPanel({
          threadId: ref("thread-1"),
          authoritativeArtifacts: ref(["/a.txt", "/b.txt"]),
          historyLoading: ref(false),
        });
        return () => null;
      },
    }),
  );
  panel.select("/a.txt");
  panel.draftOwner.reconcile("/a.txt", {
    content: "server",
    sha256: "a".repeat(64),
  });
  panel.draftOwner.update("/a.txt", "draft");

  expect(panel.select("/b.txt")).toBe(false);
  expect(panel.selectedArtifact.value).toBe("/a.txt");
  expect(panel.close()).toBe(false);
  expect(panel.open.value).toBe(true);

  confirm.mockReturnValue(true);
  expect(panel.select("/b.txt")).toBe(true);
  expect(panel.selectedArtifact.value).toBe("/b.txt");
  expect(panel.draftOwner.records["/a.txt"]?.draftContent).toBe("server");
  expect(panel.select("write-file:/b.txt", true)).toBe(false);
  expect(panel.selectedArtifact.value).toBe("/b.txt");
  wrapper.unmount();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
