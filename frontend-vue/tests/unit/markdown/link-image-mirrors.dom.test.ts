/*
  【文件职责】     markdown 的三个新镜像：安全链接、链接确认弹窗、图片外框，以及
                   「只包一张图的段落不渲染 <p>」。
  【架构位置】     L3 测试
  【依赖关系】     components/markdown/{MarkdownSafeLink,MarkdownLinkSafetyModal,MarkdownImage,components}
  【边界与注意】   这三处此前**本仓完全没有**：链接直接跳转（上游要先确认）、图片是裸
                   `<img>`（上游有外框与下载按钮）、图片段落多一层 `<p>`。
                   前两条是 streamdown 的**内建默认**而不是可选装饰，尤其链接那一条是
                   一层安全控制——markdown 正文是模型产出的（线索 112）。

                   台账只盯得住图片与段落那两条（artifact 预览取样在 markdown 上）；
                   链接那一条在两个取样面上都被调用点覆盖掉了（artifact 用
                   MarkdownLink、消息流用它自己的），只有关于页走默认——而 settings 域
                   进不了取样面。所以链接这一簇**只有这里守得住**。
*/

import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import MarkdownImage from "@/components/markdown/MarkdownImage.vue";
import MarkdownLinkSafetyModal from "@/components/markdown/MarkdownLinkSafetyModal.vue";
import MarkdownSafeLink from "@/components/markdown/MarkdownSafeLink.vue";
import StreamMarkdown from "@/components/markdown/StreamMarkdown.vue";
import { richContentComponents } from "@/components/markdown/components";
import { defaultRemarkPlugins } from "@/core/markdown/plugins";

const openSpy = vi.fn();

beforeEach(() => {
  vi.stubGlobal("open", openSpy);
  openSpy.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  document.body.style.overflow = "";
  delete document.body.dataset.markdownModalDepth;
});

describe("MarkdownSafeLink", () => {
  /*
    上游渲染的是 `<button>` 不是 `<a>`——这是有意的：markdown 正文是模型产出的，
    直接给可点外链等于把跳转决定权交给模型。
  */
  it("renders a button rather than a navigable anchor", () => {
    const wrapper = mount(MarkdownSafeLink, {
      props: { href: "https://example.com/a" },
      slots: { default: "label" },
    });
    expect(wrapper.findAll("a")).toHaveLength(0);
    const button = wrapper.get('button[data-streamdown="link"]');
    expect(button.attributes("type")).toBe("button");
    expect(button.attributes("data-incomplete")).toBe("false");
    expect(button.text()).toBe("label");
    wrapper.unmount();
  });

  it("asks before navigating, and only navigates once confirmed", async () => {
    const wrapper = mount(MarkdownSafeLink, {
      props: { href: "https://example.com/a" },
      slots: { default: "label" },
      attachTo: document.body,
    });
    expect(wrapper.find('[data-streamdown="link-safety-modal"]').exists()).toBe(
      false,
    );

    await wrapper.get("button").trigger("click");
    const modal = wrapper.get('[data-streamdown="link-safety-modal"]');
    expect(modal.text()).toContain("https://example.com/a");
    expect(openSpy).not.toHaveBeenCalled();

    const openButton = modal
      .findAll("button")
      .find((button) => button.text() === "Open link")!;
    await openButton.trigger("click");
    expect(openSpy).toHaveBeenCalledWith(
      "https://example.com/a",
      "_blank",
      "noreferrer",
    );
    expect(wrapper.find('[data-streamdown="link-safety-modal"]').exists()).toBe(
      false,
    );
    wrapper.unmount();
  });

  /*
    流式中途的半截链接：上游把 href 写成 `streamdown:incomplete-link`，
    这时候按下去不该弹任何东西。
  */
  it("stays inert for a half-streamed link", async () => {
    const wrapper = mount(MarkdownSafeLink, {
      props: { href: "streamdown:incomplete-link" },
      slots: { default: "label" },
    });
    expect(wrapper.get("button").attributes("data-incomplete")).toBe("true");
    await wrapper.get("button").trigger("click");
    expect(wrapper.find('[data-streamdown="link-safety-modal"]').exists()).toBe(
      false,
    );
    wrapper.unmount();
  });
});

describe("MarkdownLinkSafetyModal", () => {
  it("closes on Escape and on the backdrop, but not on the card itself", async () => {
    const wrapper = mount(MarkdownLinkSafetyModal, {
      props: { url: "https://example.com/a", open: true },
      attachTo: document.body,
    });

    await wrapper.get('[role="presentation"]').trigger("click");
    expect(wrapper.emitted("close")).toBeUndefined();

    await wrapper.get('[data-streamdown="link-safety-modal"]').trigger("click");
    expect(wrapper.emitted("close")).toHaveLength(1);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flushPromises();
    expect(wrapper.emitted("close")).toHaveLength(2);
    wrapper.unmount();
  });

  /*
    滚动锁是**引用计数**的，不是一个布尔：同时开两层时，先关的那个不能把滚动还回去。
  */
  it("reference-counts the body scroll lock", async () => {
    const first = mount(MarkdownLinkSafetyModal, {
      props: { url: "https://example.com/a", open: true },
      attachTo: document.body,
    });
    const second = mount(MarkdownLinkSafetyModal, {
      props: { url: "https://example.com/b", open: true },
      attachTo: document.body,
    });
    expect(document.body.style.overflow).toBe("hidden");

    first.unmount();
    expect(document.body.style.overflow).toBe("hidden");

    second.unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("confirms through both events so the caller can navigate then close", async () => {
    const wrapper = mount(MarkdownLinkSafetyModal, {
      props: { url: "https://example.com/a", open: true },
      attachTo: document.body,
    });
    const openButton = wrapper
      .findAll("button")
      .find((button) => button.text() === "Open link")!;
    await openButton.trigger("click");
    expect(wrapper.emitted("confirm")).toHaveLength(1);
    expect(wrapper.emitted("close")).toHaveLength(1);
    wrapper.unmount();
  });
});

describe("MarkdownImage", () => {
  /*
    图都还没加载出来就给一颗下载按钮，点下去只会存到一个坏文件。
  */
  it("withholds the download button until the image actually loads", async () => {
    const wrapper = mount(MarkdownImage, {
      props: { src: "https://example.com/a.png", alt: "chart" },
    });
    expect(wrapper.get('[data-streamdown="image-wrapper"]')).toBeTruthy();
    expect(wrapper.findAll("button")).toHaveLength(0);

    await wrapper.get("img").trigger("load");
    expect(wrapper.get("button").attributes("title")).toBe("Download image");
    wrapper.unmount();
  });

  /*
    先 load 再 error，不能上来就 error：happy-dom 里 `<img>` 挂载后 `complete` 已经是
    true 而 `naturalWidth` 是 0，挂载时那次补判就把 errored 置上了——直接 error 的话
    **删掉 @error 处理器这条用例照样绿**（wave 24 实测的一条假绿）。先 load 把状态推到
    「成功」，再 error，才只剩处理器这一条路能改变它。
  */
  it("swaps a failed image for the fallback note", async () => {
    const wrapper = mount(MarkdownImage, {
      props: { src: "https://example.com/a.png", alt: "chart" },
    });
    await wrapper.get("img").trigger("load");
    expect(wrapper.find('[data-streamdown="image-fallback"]').exists()).toBe(
      false,
    );
    await wrapper.get("img").trigger("error");
    expect(wrapper.get('[data-streamdown="image-fallback"]').text()).toBe(
      "Image not available",
    );
    expect(wrapper.get("img").classes()).toContain("hidden");
    expect(wrapper.findAll("button")).toHaveLength(0);
    wrapper.unmount();
  });

  /*
    调用方显式给了尺寸时是在占位：这时候塞一句"图片不可用"会把布局撑坏，
    而下载按钮反而要留着。
  */
  it("treats an explicitly sized image as a placeholder", async () => {
    const wrapper = mount(MarkdownImage, {
      props: { src: "https://example.com/a.png", alt: "chart" },
      attrs: { width: "320" },
    });
    expect(wrapper.findAll("button")).toHaveLength(1);
    await wrapper.get("img").trigger("error");
    expect(wrapper.find('[data-streamdown="image-fallback"]').exists()).toBe(
      false,
    );
    wrapper.unmount();
  });

  it("renders nothing without a src", () => {
    const wrapper = mount(MarkdownImage, { props: { alt: "chart" } });
    expect(wrapper.find('[data-streamdown="image-wrapper"]').exists()).toBe(
      false,
    );
    wrapper.unmount();
  });
});

describe("richContentComponents", () => {
  /*
    只包一张图片的段落不渲染 `<p>`：`<p><div></div></p>` 在 HTML 解析器眼里根本
    不合法，浏览器会把 div 提出去、留下一个空段落——对照台账上就是 Vue 多一个
    `paragraph` 节点。
  */
  it("unwraps a paragraph whose only child is an image", async () => {
    const wrapper = mount(StreamMarkdown, {
      props: {
        content: "![chart](https://example.com/a.png)\n\nplain text\n",
        components: richContentComponents,
        remarkPlugins: defaultRemarkPlugins,
      },
    });
    await flushPromises();

    const wrapperDiv = wrapper.get('[data-streamdown="image-wrapper"]');
    expect(wrapperDiv.element.parentElement?.tagName.toLowerCase()).not.toBe(
      "p",
    );
    // 普通段落照常渲染。
    expect(
      wrapper.findAll("p").filter((node) => node.text() === "plain text"),
    ).toHaveLength(1);
    wrapper.unmount();
  });

  it("routes markdown links through the safety button by default", async () => {
    const wrapper = mount(StreamMarkdown, {
      props: {
        content: "[label](https://example.com/a)\n",
        components: richContentComponents,
        remarkPlugins: defaultRemarkPlugins,
      },
    });
    await flushPromises();
    expect(wrapper.findAll("a")).toHaveLength(0);
    const link = wrapper.get('button[data-streamdown="link"]');
    expect(link.text()).toBe("label");
    /*
      解包只认图片（与块级代码），**不是"只要独生子是元素就解包"**：一个只包着一条
      链接的段落照样要有 `<p>`，否则整段文字会被提到 markdown 根下面。
    */
    expect(link.element.parentElement?.tagName.toLowerCase()).toBe("p");
    wrapper.unmount();
  });
});
