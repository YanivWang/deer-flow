import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import MessageContentRenderer from "../../../../../app/widgets/workspace/messages/MessageContentRenderer.vue";

describe("MessageContentRenderer", () => {
  it("owns task-message rendering instead of sending task content through Markdown", () => {
    const wrapper = mount(MessageContentRenderer, {
      props: {
        content: "上传文件中",
        messageElement: "task",
        messageRole: "ai",
      },
    });

    expect(wrapper.get('[data-testid="vue-message-task"]').text()).toContain("上传文件中");
    expect(wrapper.find('[data-testid="vue-message-paragraph"]').exists()).toBe(false);
  });

  it("exposes an observable loading state for an empty streaming assistant message", () => {
    const wrapper = mount(MessageContentRenderer, {
      props: {
        content: "",
        isLoading: true,
        messageRole: "ai",
      },
    });

    expect(wrapper.get('[data-testid="vue-message-loading"]').text()).toContain("正在生成");
  });

  it("keeps tool and error messages on the same renderer owner with explicit roles", () => {
    const tool = mount(MessageContentRenderer, {
      props: { content: "tool result", messageRole: "tool" },
    });
    const error = mount(MessageContentRenderer, {
      props: { content: "stream failed", messageRole: "error" },
    });

    expect(tool.get('[data-testid="vue-rich-message-content"]').attributes("data-message-role")).toBe("tool");
    expect(error.get('[data-testid="vue-rich-message-content"]').attributes("data-message-role")).toBe("error");
    expect(error.classes()).toContain("rich-message-content--error");
  });
});
