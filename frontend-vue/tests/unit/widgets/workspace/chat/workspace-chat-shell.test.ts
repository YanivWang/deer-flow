import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import WorkspaceChatShell from "../../../../../app/widgets/workspace/chat/WorkspaceChatShell.vue";

describe("WorkspaceChatShell", () => {
  it("keeps the sidebar and main chat regions as stable layout boundaries", () => {
    const wrapper = mount(WorkspaceChatShell, {
      props: { isWelcomeMode: true },
      slots: {
        sidebar: "sidebar content",
        utility: "utility content",
        default: "chat content",
      },
    });

    expect(wrapper.get(".workspace-sidebar").text()).toBe("sidebar content");
    expect(wrapper.get("#workspace-chat-content").text()).toContain("chat content");
    expect(wrapper.get(".workspace-chat__utility-bar").text()).toContain("utility content");
    expect(wrapper.get(".workspace-chat").classes()).toContain("workspace-chat--welcome");
  });
});
