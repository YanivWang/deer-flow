import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

import WorkspaceChatWelcome from "../../../../../app/components/workspace/chat/WorkspaceChatWelcome.vue";

const i18nMock = vi.hoisted(() => ({
  useAppI18n: () => ({
    t: (key: string) =>
      ({
        "welcome.greeting": "Hello, again!",
        "welcome.description": "Welcome description",
      })[key] ?? key,
  }),
}));

vi.mock("../../../../../app/composables/use-app-i18n", () => i18nMock);

describe("WorkspaceChatWelcome", () => {
  it("renders only the welcome header so the page owns composer order", () => {
    const wrapper = mount(WorkspaceChatWelcome);

    expect(wrapper.get(".workspace-chat__welcome h2").text()).toContain("Hello, again!");
    expect(wrapper.get(".workspace-chat__welcome p").text()).toBe("Welcome description");
    expect(wrapper.find('[data-slot="suggestions-list"]').exists()).toBe(false);
  });
});
