/*
  【文件职责】     从真实 MessageList → StreamMarkdown components 路径验证链接安全与业务解析。
  【架构位置】     测试
  【主要导出】     无
  【依赖关系】     MessageList.vue · StreamMarkdown.vue · MarkdownLink.vue
  【边界与注意】   不以默认 Markdown pipeline 的孤立测试替代真实消息 components map。
*/

import { flushPromises, mount } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import MessageList from "@/components/chat/MessageList.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import {
  createWorkspaceToastStore,
  workspaceToastKey,
} from "@/core/workspace-shell/toast";

const toastStore = createWorkspaceToastStore();

class ResizeObserverStub {
  observe() {}
  disconnect() {}
  unobserve() {}
}

beforeEach(() => {
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS), locale: ref("en-US") },
  }));
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    return window.setTimeout(() => callback(performance.now()), 16);
  });
  vi.stubGlobal("cancelAnimationFrame", (handle: number) =>
    window.clearTimeout(handle),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MessageList MarkdownLink integration", () => {
  it("routes every rendered message link through the allowlist and business resolver", async () => {
    const wrapper = mount(MessageList, {
      props: {
        messages: [
          {
            id: "assistant-1",
            type: "ai",
            content: [
              "[Relative](report.md)",
              "[Secure](https://example.com/report)",
              "[Artifact](/mnt/user-data/outputs/report.md)",
              "[citation:Paper](https://source.example/paper)",
              "[Script](javascript:alert(1))",
              "[Data](data:text/html;base64,PHNjcmlwdD4=)",
            ].join(" "),
          },
        ],
        streaming: false,
        loading: false,
        threadId: "thread-1",
        interactive: false,
      },
      global: {
        provide: { [workspaceToastKey as symbol]: toastStore },
        plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]],
      },
    });

    await flushPromises();
    await vi.waitFor(
      () => expect(wrapper.find('a[href="report.md"]').exists()).toBe(true),
      { timeout: 2_000 },
    );

    const relative = wrapper.get('a[href="report.md"]');
    expect(relative.text()).toBe("Relative");
    expect(relative.attributes("target")).toBeUndefined();
    expect(relative.attributes("rel")).toBeUndefined();

    const secure = wrapper.get('a[href="https://example.com/report"]');
    expect(secure.text()).toBe("Secure");
    expect(secure.attributes()).toMatchObject({
      href: "https://example.com/report",
      target: "_blank",
      rel: "noopener noreferrer",
    });

    const artifact = wrapper.get(
      'a[href="/api/threads/thread-1/artifacts/mnt/user-data/outputs/report.md"]',
    );
    expect(artifact.text()).toBe("Artifact");
    expect(artifact.attributes()).toMatchObject({
      href: "/api/threads/thread-1/artifacts/mnt/user-data/outputs/report.md",
      target: "_blank",
      rel: "noopener noreferrer",
    });

    const citation = wrapper.get(
      'a[data-message-markdown-link="citation"][href="https://source.example/paper"]',
    );
    expect(citation.text()).toContain("Paper");
    expect(citation.attributes()).toMatchObject({
      href: "https://source.example/paper",
      target: "_blank",
      rel: "noopener noreferrer",
      "data-message-markdown-link": "citation",
    });

    const blocked = wrapper.findAll('[data-message-markdown-link="blocked"]');
    expect(blocked).toHaveLength(2);
    expect(blocked.map((entry) => entry.text()).sort()).toEqual([
      "Data",
      "Script",
    ]);
    expect(blocked.every((entry) => entry.element.tagName === "SPAN")).toBe(
      true,
    );
    expect(wrapper.html()).not.toContain('href="javascript:');
    expect(wrapper.html()).not.toContain('href="data:');

    wrapper.unmount();
  });

  it("keeps React-equivalent list markers and inline emphasis in final answers", async () => {
    const wrapper = mount(MessageList, {
      props: {
        messages: [
          {
            id: "assistant-weather",
            type: "ai",
            content: [
              "**Today's weather**",
              "",
              "- Temperature: 29°C",
              "- Conditions: Cloudy",
            ].join("\n"),
          },
        ],
        streaming: false,
        loading: false,
        threadId: "thread-1",
        interactive: false,
      },
      global: {
        provide: { [workspaceToastKey as symbol]: toastStore },
        plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]],
      },
    });

    await flushPromises();
    await vi.waitFor(() =>
      expect(
        wrapper.find("ul[data-streamdown='unordered-list']").exists(),
      ).toBe(true),
    );
    expect(
      wrapper.get("ul[data-streamdown='unordered-list']").classes(),
    ).toEqual(expect.arrayContaining(["list-inside", "list-disc"]));
    expect(wrapper.get("li[data-streamdown='list-item']").classes()).toContain(
      "py-1",
    );
    expect(wrapper.get("[data-streamdown='strong']").classes()).toContain(
      "font-semibold",
    );
    wrapper.unmount();
  });
});

describe("MessageList on-demand history", () => {
  it("does not auto-fetch, coalesces requests and preserves the viewport after prepend", async () => {
    const wrapper = mount(MessageList, {
      props: {
        messages: [],
        streaming: false,
        loading: false,
        threadId: "thread-1",
        hasMoreHistory: true,
        historyLoadingMore: false,
      },
      global: {
        provide: { [workspaceToastKey as symbol]: toastStore },
        plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]],
      },
    });
    await flushPromises();
    expect(wrapper.emitted("loadMoreHistory")).toBeUndefined();

    const scroller = wrapper.get('[role="log"] > div').element as HTMLElement;
    let scrollHeight = 500;
    Object.defineProperty(scroller, "scrollHeight", {
      configurable: true,
      get: () => scrollHeight,
    });
    scroller.scrollTop = 20;
    const button = wrapper.get('[data-testid="load-earlier-messages"]');
    await button.trigger("click");
    await button.trigger("click");
    expect(wrapper.emitted("loadMoreHistory")).toHaveLength(1);

    await wrapper.setProps({ historyLoadingMore: true });
    scrollHeight = 720;
    await wrapper.setProps({ historyLoadingMore: false });
    await flushPromises();
    expect(scroller.scrollTop).toBe(240);

    wrapper.unmount();
  });
});
