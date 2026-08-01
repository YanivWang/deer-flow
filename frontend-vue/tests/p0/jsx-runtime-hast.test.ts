import { mount } from "@vue/test-utils";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { Fragment, jsx, jsxs } from "vue/jsx-runtime";
import { defineComponent, h, nextTick, ref } from "vue";
import { describe, expect, it } from "vitest";

type TextNode = { type: "text"; value: string };
type ElementNode = {
  type: "element";
  tagName: string;
  properties?: Record<string, unknown>;
  children: Array<ElementNode | TextNode>;
};

function root(children: Array<ElementNode | TextNode>) {
  return { type: "root", children };
}

const paragraph: ElementNode = {
  type: "element",
  tagName: "p",
  properties: { className: ["lead"] },
  children: [{ type: "text", value: "hello" }],
};

describe("hast-util-to-jsx-runtime with vue/jsx-runtime", () => {
  it("renders HAST and keeps existing DOM mounted when appending a sibling", async () => {
    const expanded = ref(false);
    const Probe = defineComponent({
      setup() {
        return () =>
          h(
            "section",
            toJsxRuntime(root(expanded.value ? [paragraph, {
              type: "element",
              tagName: "p",
              properties: { className: ["tail"] },
              children: [{ type: "text", value: "world" }],
            }] : [paragraph]), {
              Fragment,
              jsx,
              jsxs,
              elementAttributeNameCase: "html",
              stylePropertyNameCase: "css",
            }),
          );
      },
    });

    const wrapper = mount(Probe);
    const firstParagraph = wrapper.find("p").element;

    expect(wrapper.text()).toContain("hello");
    expanded.value = true;
    await nextTick();

    expect(wrapper.findAll("p")).toHaveLength(2);
    expect(wrapper.find("p").element).toBe(firstParagraph);
  });
});
