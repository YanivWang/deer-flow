/*
  【文件职责】     代码块槽位的首帧 DOM 对照与高亮行为验收。
  【对应 frontend/】 streamdown 的 `code-block` 槽位（录在夹具的 styledHtml 里）
  【架构位置】     门禁测试
  【主要导出】     无
  【依赖关系】     tests/fixtures/react-markdown-dom.json · app/components/markdown/*
  【边界与注意】   这里比的是**首帧**：shiki 的高亮是异步的，上游 SSR 拿到的同样是未高亮的
                   回退结构，两边在这一帧上可以逐属性对齐。高亮之后的 token DOM 不在
                   夹具里（SSR 录不到），所以只做行为断言——这一条写进证据文档的红项。

                   代码块与 mermaid 是本层唯二复刻的 streamdown 槽位，理由见
                   `app/components/markdown/components.ts`：它们是行为不是样式。
                   mermaid 在 `mermaid.dom.test.ts`——它要在模块级 mock 掉 mermaid 包，
                   和这里的真实 shiki 加载放同一个文件会互相干扰。
*/

import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import StreamMarkdown from "@/components/markdown/StreamMarkdown.vue";
import { richContentComponents } from "@/components/markdown/components";
import { appRehypePlugins, appRemarkPlugins } from "@/core/markdown/plugins";

import fixture from "../../fixtures/react-markdown-dom.json";
import {
  normalizeChildren,
  normalizeHtml,
  type NormalizedNode,
} from "../../support/dom-equivalence";

const entries = fixture.entries as unknown as Record<
  string,
  { styledHtml: string }
>;

const PIPELINE = {
  remarkPlugins: appRemarkPlugins,
  rehypePlugins: appRehypePlugins,
  components: richContentComponents as unknown as Record<string, unknown>,
};

/** 在归一化树里找第一个带指定 data-streamdown 槽位名的元素。 */
function findSlot(
  nodes: NormalizedNode[],
  slot: string,
): NormalizedNode | undefined {
  for (const node of nodes) {
    if (node.type !== "element") continue;
    if (node.attributes["data-streamdown"] === slot) return node;
    const hit = findSlot(node.children, slot);
    if (hit) return hit;
  }
  return undefined;
}

describe("代码块槽位 · 首帧 DOM 与上游一致", () => {
  for (const [id, language] of [
    ["code-block", "ts"],
    ["code-block-no-language", ""],
  ] as const) {
    it(`${id}（language=${JSON.stringify(language)}）`, () => {
      const markdown =
        language === "ts"
          ? "```ts\nconst x: number = 1;\n```"
          : "```\nplain text\n```";
      const wrapper = mount(StreamMarkdown, {
        props: { content: markdown, ...PIPELINE },
      });

      const expected = findSlot(
        normalizeHtml(entries[id]!.styledHtml),
        "code-block",
      );
      const actual = findSlot(normalizeChildren(wrapper.element), "code-block");

      expect(expected).toBeDefined();
      expect(actual).toEqual(expected);
      wrapper.unmount();
    });
  }

  it("高亮回来之后代码文本不丢、结构还在同一个槽位里", async () => {
    const wrapper = mount(StreamMarkdown, {
      props: { content: "```ts\nconst x: number = 1;\n```", ...PIPELINE },
    });
    await flushPromises();
    const body = wrapper.find('[data-streamdown="code-block-body"]');
    expect(body.exists()).toBe(true);
    expect(body.text()).toContain("const x: number = 1;");
    wrapper.unmount();
  });

  it("不认识的语言退回未高亮结构，不让代码块消失", async () => {
    const wrapper = mount(StreamMarkdown, {
      props: {
        content: "```not-a-real-language\nx := 1\n```",
        ...PIPELINE,
      },
    });
    await flushPromises();
    expect(
      wrapper.find('[data-streamdown="code-block-body"]').text(),
    ).toContain("x := 1");
    wrapper.unmount();
  });
});
