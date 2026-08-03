import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

import CodeBlock from "../../../../../app/widgets/workspace/messages/CodeBlock.vue";

describe("CodeBlock", () => {
  it("renders real syntax-highlighted tokens for a supported language", async () => {
    const wrapper = mount(CodeBlock, {
      props: {
        code: "const answer: number = 42;",
        language: "typescript",
      },
    });

    await flushPromises();
    await vi.waitFor(() => expect(wrapper.findAll("[style]").length).toBeGreaterThan(1));

    expect(wrapper.get('[data-testid="vue-message-code-language"]').text()).toBe("typescript");
    expect(wrapper.get('[data-streamdown="code-block-body"]')).toBeTruthy();
    expect(wrapper.text()).toContain("const answer");
  });

  it("keeps unknown formats readable without claiming a language grammar", async () => {
    const wrapper = mount(CodeBlock, {
      props: {
        code: "opaque content",
        language: "unknown-format",
      },
    });

    await flushPromises();

    expect(wrapper.get('[data-streamdown="code-block-body"] code').text()).toBe("opaque content");
  });

  it("shows a visible error when clipboard writing fails", async () => {
    const writeText = vi.fn(async () => {
      throw new Error("permission denied");
    });
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const wrapper = mount(CodeBlock, {
      props: {
        code: "const answer = 42;",
        language: "javascript",
      },
    });

    await wrapper.get('[data-testid="vue-message-code-copy"]').trigger("click");

    expect(writeText).toHaveBeenCalledWith("const answer = 42;");
    expect(wrapper.get('[data-testid="vue-message-code-copy-error"]').text()).toContain("复制失败");
  });

  it("keeps an incomplete streaming fence readable without waiting for Shiki", async () => {
    const wrapper = mount(CodeBlock, {
      props: {
        code: "const partial = true;",
        language: "typescript",
        streaming: true,
      },
    });

    await flushPromises();

    expect(wrapper.get('[data-streamdown="code-block-body"] code').text()).toBe(
      "const partial = true;",
    );
  });
});
