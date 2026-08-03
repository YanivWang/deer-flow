import { mount } from "@vue/test-utils";
import { defineComponent, h, inject } from "vue";
import { describe, expect, it } from "vitest";

import WorkspacePanelLayout from "../../../../../app/widgets/workspace/panel-layout/WorkspacePanelLayout.vue";
import { workspacePanelLayoutKey } from "../../../../../app/widgets/workspace/panel-layout/context";

const PanelLayoutProbe = defineComponent({
  setup() {
    const context = inject(workspacePanelLayoutKey);
    if (!context) {
      throw new Error("Panel layout context is missing.");
    }
    return () => h(
      "button",
      {
        "data-slot": "resizable-handle",
        onPointerdown: (event: PointerEvent) => context.beginArtifactResize(event),
      },
      String(context.artifactPanelWidth.value),
    );
  },
});

describe("WorkspacePanelLayout", () => {
  it("owns the canonical width and restores it after a drag collapse", async () => {
    const wrapper = mount(WorkspacePanelLayout, {
      props: {
        artifactOpen: true,
        sidecarOpen: false,
      },
      slots: {
        default: () => h("div", { "data-slot": "resizable-panel-group" }, h(PanelLayoutProbe)),
      },
    });
    const group = wrapper.get("[data-slot='resizable-panel-group']").element;
    Object.defineProperty(group, "clientWidth", { configurable: true, value: 1000 });

    await wrapper.get('[data-slot="resizable-handle"]').trigger("pointerdown", {
      clientX: 500,
      pointerId: 1,
    });
    window.dispatchEvent(new PointerEvent("pointermove", { clientX: 1000 }));
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-panel-layout-owner]').attributes("style")).toContain(
      "--workspace-artifact-width: 0%;",
    );
    expect(wrapper.emitted("updateArtifactOpen")?.at(-1)).toEqual([false]);

    await wrapper.setProps({ artifactOpen: false });
    await wrapper.setProps({ artifactOpen: true });

    expect(wrapper.get('[data-panel-layout-owner]').attributes("style")).toContain(
      "--workspace-artifact-width: 40%;",
    );
  });

  it("keeps a widened width when the panel is closed without a collapse drag", async () => {
    const wrapper = mount(WorkspacePanelLayout, {
      props: {
        artifactOpen: true,
        sidecarOpen: false,
      },
      slots: {
        default: () => h("div", { "data-slot": "resizable-panel-group" }, h(PanelLayoutProbe)),
      },
    });
    const group = wrapper.get("[data-slot='resizable-panel-group']").element;
    Object.defineProperty(group, "clientWidth", { configurable: true, value: 1000 });

    await wrapper.get('[data-slot="resizable-handle"]').trigger("pointerdown", {
      clientX: 500,
      pointerId: 1,
    });
    window.dispatchEvent(new PointerEvent("pointermove", { clientX: 300 }));
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[data-panel-layout-owner]').attributes("style")).toContain(
      "--workspace-artifact-width: 60%;",
    );

    await wrapper.setProps({ artifactOpen: false });
    await wrapper.setProps({ artifactOpen: true });

    expect(wrapper.get('[data-panel-layout-owner]').attributes("style")).toContain(
      "--workspace-artifact-width: 60%;",
    );
  });

  it("keeps the open desktop panel within the React chat/right-panel bounds", async () => {
    const wrapper = mount(WorkspacePanelLayout, {
      props: { artifactOpen: true, sidecarOpen: false },
      slots: {
        default: () => h("div", { "data-slot": "resizable-panel-group" }, h(PanelLayoutProbe)),
      },
    });
    const group = wrapper.get("[data-slot='resizable-panel-group']").element;
    Object.defineProperty(group, "clientWidth", { configurable: true, value: 1000 });

    await wrapper.get('[data-slot="resizable-handle"]').trigger("pointerdown", {
      clientX: 500,
      pointerId: 1,
    });
    window.dispatchEvent(new PointerEvent("pointermove", { clientX: -500 }));
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-panel-layout-owner]').attributes("style")).toContain(
      "--workspace-artifact-width: 70%;",
    );
  });
});
