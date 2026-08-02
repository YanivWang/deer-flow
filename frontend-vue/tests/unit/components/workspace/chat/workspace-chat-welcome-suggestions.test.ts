import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

import WorkspaceChatWelcomeSuggestions from "../../../../../app/components/workspace/chat/WorkspaceChatWelcomeSuggestions.vue";

const i18nMock = vi.hoisted(() => ({
  useAppI18n: () => ({
    t: (key: string) =>
      ({
        "inputBox.surpriseMe": "Surprise",
        "inputBox.surpriseMePrompt": "surprise prompt",
        "inputBox.disclaimer": "AI can make mistakes",
      })[key] ?? key,
  }),
}));

vi.mock("../../../../../app/composables/use-app-i18n", () => i18nMock);

describe("WorkspaceChatWelcomeSuggestions", () => {
  it("emits prompt selection without owning composer state", async () => {
    const wrapper = mount(WorkspaceChatWelcomeSuggestions, {
      props: {
        suggestions: [{ label: "Write", prompt: "write prompt" }],
      },
    });

    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("select")?.[0]).toEqual(["surprise prompt"]);

    await wrapper.get("button:nth-of-type(2)").trigger("click");
    expect(wrapper.emitted("select")?.[1]).toEqual(["write prompt"]);
    expect(wrapper.get(".workspace-chat__disclaimer").text()).toBe("AI can make mistakes");
  });
});
