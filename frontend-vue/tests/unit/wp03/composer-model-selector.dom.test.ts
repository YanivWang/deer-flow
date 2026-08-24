import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import ComposerModelSelector from "@/components/chat/ComposerModelSelector.vue";
import type { Model } from "@/core/models/types";

const models: Model[] = [
  {
    id: "minimax-m3",
    name: "minimax-m3",
    model: "MiniMax-M3",
    display_name: "MiniMax CN / MiniMax-M3",
    supports_thinking: true,
    supports_reasoning_effort: true,
  },
  {
    id: "fast",
    name: "fast",
    model: "Fast",
    display_name: "Fast Model",
    supports_thinking: false,
    supports_reasoning_effort: false,
  },
];

describe("composer model selector", () => {
  it("uses the React responsive width contract and keeps truncation on the text only", () => {
    const wrapper = mount(ComposerModelSelector, {
      props: { models, selectedModel: models[0] },
    });

    const button = wrapper.get("button[aria-label='MiniMax CN / MiniMax-M3']");
    expect(button.classes()).toEqual(
      expect.arrayContaining(["min-w-0", "max-w-40", "px-2.5", "sm:max-w-56"]),
    );
    expect(button.classes()).not.toContain("truncate");
    expect(button.get("span").classes()).toContain("truncate");
  });

  it("owns the shared menu lifecycle and emits the selected model", async () => {
    const wrapper = mount(ComposerModelSelector, {
      props: { models, selectedModel: models[0] },
    });
    const trigger = wrapper.get("button[aria-label='MiniMax CN / MiniMax-M3']");

    expect(trigger.attributes("aria-expanded")).toBe("false");
    await trigger.trigger("click");
    expect(trigger.attributes("aria-expanded")).toBe("true");
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Fast Model")!
      .trigger("click");

    expect(wrapper.emitted("select")).toEqual([[models[1]]]);
    expect(trigger.attributes("aria-expanded")).toBe("false");
  });
});
