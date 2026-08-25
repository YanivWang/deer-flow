/*
  【文件职责】     mermaid 槽位的行为验收：成功出图、失败保持代码块、晚到结果不覆盖新内容。
  【架构位置】     门禁测试
  【主要导出】     无
  【依赖关系】     app/components/markdown/*（mermaid 包在模块级被 mock）
  【边界与注意】   ⚠️ **这里没有 DOM 对照，只有行为断言。** 原因是上游那张图根本录不到：
                   mermaid 只在浏览器里渲染，React SSR 输出的是代码块回退结构。
                   所以「Vue 版画出来的 SVG 与 React 版一样吗」这个问题，本窗口没有回答，
                   已写进证据文档的红项。

                   mermaid 包在模块级 mock 掉：真包数百 KB、要注册全局 config，
                   在 happy-dom 里跑一遍既慢又和别的用例互相污染。这里要验的是**分派与容错**，
                   不是 mermaid 自己画得对不对。

                   最要紧的一条是「解析失败是常态」：`graph TD; A--` 这样的中间态在流式
                   期间每个 chunk 都会出现，把它当异常处理会让每条含图的消息闪烁。
*/

import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import StreamMarkdown from "@/components/markdown/StreamMarkdown.vue";
import { richContentComponents } from "@/components/markdown/components";
import { appRemarkPlugins } from "@/core/markdown/plugins";

const mermaidMock = vi.hoisted(() => ({
  initialize: vi.fn(),
  parse: vi.fn(),
  render: vi.fn(),
}));

vi.mock("mermaid", () => ({ default: mermaidMock }));

const PIPELINE = {
  remarkPlugins: appRemarkPlugins,
  rehypePlugins: [], // 消息路径的同步 rehype 链现在是空的：KaTeX 由 core/markdown/math.ts 按内容加载。
  components: richContentComponents as unknown as Record<string, unknown>,
};

beforeEach(() => {
  mermaidMock.initialize.mockReset();
  mermaidMock.parse.mockReset();
  mermaidMock.render.mockReset();
});

describe("mermaid 槽位", () => {
  it("解析成功后换成 SVG", async () => {
    mermaidMock.parse.mockResolvedValue(true);
    mermaidMock.render.mockResolvedValue({ svg: '<svg data-fake="1"></svg>' });

    const wrapper = mount(StreamMarkdown, {
      props: { content: "```mermaid\ngraph TD; A-->B;\n```", ...PIPELINE },
    });
    await flushPromises();

    expect(wrapper.find('[data-streamdown="mermaid"]').exists()).toBe(true);
    expect(wrapper.find('[data-streamdown="mermaid"]').html()).toContain(
      "data-fake",
    );
    wrapper.unmount();
  });

  it("解析失败（流式中间态的常态）保持代码块，不清空也不抛", async () => {
    mermaidMock.parse.mockRejectedValue(new Error("incomplete"));

    const wrapper = mount(StreamMarkdown, {
      props: { content: "```mermaid\ngraph TD; A--\n```", ...PIPELINE },
    });
    await flushPromises();

    expect(wrapper.find('[data-streamdown="mermaid"]').exists()).toBe(false);
    expect(wrapper.find('[data-streamdown="code-block"]').text()).toContain(
      "graph TD; A--",
    );
    expect(mermaidMock.render).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("内容继续增长直到合法时补上图", async () => {
    mermaidMock.parse.mockRejectedValueOnce(new Error("incomplete"));

    const wrapper = mount(StreamMarkdown, {
      props: { content: "```mermaid\ngraph TD; A--\n```", ...PIPELINE },
    });
    await flushPromises();
    expect(wrapper.find('[data-streamdown="mermaid"]').exists()).toBe(false);

    mermaidMock.parse.mockResolvedValue(true);
    mermaidMock.render.mockResolvedValue({ svg: "<svg></svg>" });
    await wrapper.setProps({ content: "```mermaid\ngraph TD; A-->B;\n```" });
    await flushPromises();

    expect(wrapper.find('[data-streamdown="mermaid"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it("按不可信内容初始化（securityLevel: strict）", async () => {
    mermaidMock.parse.mockResolvedValue(true);
    mermaidMock.render.mockResolvedValue({ svg: "<svg></svg>" });

    const wrapper = mount(StreamMarkdown, {
      props: { content: "```mermaid\ngraph TD; A-->B;\n```", ...PIPELINE },
    });
    await flushPromises();

    expect(mermaidMock.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ securityLevel: "strict", startOnLoad: false }),
    );
    wrapper.unmount();
  });
});
