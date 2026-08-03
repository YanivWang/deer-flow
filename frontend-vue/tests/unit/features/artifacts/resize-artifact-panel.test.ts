import { mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ARTIFACT_PANEL_MAX_HEIGHT,
  ARTIFACT_PANEL_MAX_WIDTH,
  ARTIFACT_PANEL_MIN_HEIGHT,
  ARTIFACT_PANEL_MIN_WIDTH,
  clampArtifactPanelHeight,
  clampArtifactPanelWidth,
  resolveArtifactResizeAxis,
} from "../../../../app/features/artifacts/resize-artifact-panel/model";
import { useResizeArtifactPanel } from "../../../../app/features/artifacts/resize-artifact-panel/use-resize-artifact-panel";

const ResizeHarness = defineComponent({
  setup() {
    const controller = useResizeArtifactPanel({
      artifactOpen: true,
      onOpenChange: vi.fn(),
      storageKey: "test-artifact-layout",
    });
    return { controller };
  },
  template: `
    <div data-slot="resizable-panel-group">
      <button data-slot="resize-handle" @pointerdown="controller.beginArtifactResize" />
      <output data-slot="width">{{ controller.artifactPanelWidth }}</output>
      <output data-slot="height">{{ controller.artifactPanelHeight }}</output>
      <output data-slot="axis">{{ controller.artifactPanelResizeAxis }}</output>
    </div>
  `,
});

describe("resize-artifact-panel", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  });

  it("clamps desktop and mobile bounds and resolves the correct axis", () => {
    expect(clampArtifactPanelWidth(-1)).toBe(ARTIFACT_PANEL_MIN_WIDTH);
    expect(clampArtifactPanelWidth(100)).toBe(ARTIFACT_PANEL_MAX_WIDTH);
    expect(clampArtifactPanelHeight(0)).toBe(ARTIFACT_PANEL_MIN_HEIGHT);
    expect(clampArtifactPanelHeight(100)).toBe(ARTIFACT_PANEL_MAX_HEIGHT);
    expect(resolveArtifactResizeAxis(false)).toBe("horizontal");
    expect(resolveArtifactResizeAxis(true)).toBe("vertical");
  });

  it("restores persisted layout and persists the post-drag snapshot", async () => {
    window.sessionStorage.setItem(
      "test-artifact-layout",
      JSON.stringify({ height: 70, restoreHeight: 72, restoreWidth: 55, width: 55 }),
    );
    const wrapper = mount(ResizeHarness);
    await wrapper.vm.$nextTick();
    const group = wrapper.get('[data-slot="resizable-panel-group"]').element;
    Object.defineProperty(group, "clientWidth", { configurable: true, value: 1000 });
    expect(wrapper.get('[data-slot="width"]').text()).toBe("55");

    await wrapper.get('[data-slot="resize-handle"]').trigger("pointerdown", { clientX: 500, pointerId: 1 });
    window.dispatchEvent(new PointerEvent("pointermove", { clientX: 300 }));
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-slot="width"]').text()).toBe("70");
    expect(JSON.parse(window.sessionStorage.getItem("test-artifact-layout") ?? "{}").width).toBe(70);
  });

  it("uses vertical resizing on a narrow viewport", async () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    const wrapper = mount(ResizeHarness);
    const group = wrapper.get('[data-slot="resizable-panel-group"]').element;
    Object.defineProperty(group, "clientHeight", { configurable: true, value: 1000 });

    await wrapper.get('[data-slot="resize-handle"]').trigger("pointerdown", { clientY: 500, pointerId: 1 });
    window.dispatchEvent(new PointerEvent("pointermove", { clientY: 300 }));
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-slot="axis"]').text()).toBe("vertical");
    expect(wrapper.get('[data-slot="height"]').text()).toBe("95");
  });
});
