/*
  【文件职责】     钉住路由播报器的两件事：换页会播报，以及实时区域藏在 shadow root 里。
  【架构位置】     Vue DOM test
  【主要导出】     无；Vitest cases
  【依赖关系】     RouteAnnouncer · mocked useRoute
  【边界与注意】   第二条看着像实现细节，其实是**可观察行为**：Radix 与 Reka 共用的
                   `aria-hidden` 库在标记前先跑一次
                   `document.body.querySelectorAll('[aria-live], script')`，把命中节点
                   连同整条祖先链保下来。`aria-live` 一旦落在宿主（或宿主的任何后代、
                   只要不在 shadow 里），模态打开时本仓的播报器就会连着 `#__nuxt` 一起
                   留在可访问性树里，而 React 的会消失——那正是台账里那条 `- alert`。
                   跨应用的判据在 e2e-parity（integrations 两个维度、artifact-preview/mobile
                   都已清零），这里只是把它变成一条 10 毫秒就能红的快守卫。
*/

import { flushPromises, mount } from "@vue/test-utils";
import { reactive } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import RouteAnnouncer from "@/components/RouteAnnouncer.vue";

const route = reactive({ fullPath: "/workspace/chats/new" });

function mountAnnouncer() {
  return mount(RouteAnnouncer, { attachTo: document.body });
}

beforeEach(() => {
  document.title = "DeerFlow";
  vi.stubGlobal("useRoute", () => route);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  route.fullPath = "/workspace/chats/new";
});

describe("RouteAnnouncer", () => {
  it("keeps the live region inside a shadow root so a modal can hide it", async () => {
    const wrapper = mountAnnouncer();
    await flushPromises();

    const host = document.getElementById("__route-announcer__")!;
    // 宿主本身不能带 aria-live，否则 aria-hidden 的实时区域豁免会把它整条祖先链保下来。
    expect(host.getAttribute("aria-live")).toBeNull();
    expect(document.body.querySelectorAll("[aria-live]")).toHaveLength(0);

    const live = host.shadowRoot?.querySelector("p");
    expect(live?.getAttribute("role")).toBe("alert");
    expect(live?.getAttribute("aria-live")).toBe("assertive");
    wrapper.unmount();
  });

  it("announces a changed page name once and stays silent when it is unchanged", async () => {
    const wrapper = mountAnnouncer();
    await flushPromises();
    const live = document
      .getElementById("__route-announcer__")!
      .shadowRoot!.querySelector("p")!;

    // 首次加载不播报：页面本来就会被读一遍。
    expect(live.textContent).toBe("");

    // 同名页面之间跳转不重复念。
    route.fullPath = "/workspace/chats/other";
    await flushPromises();
    expect(live.textContent).toBe("");

    document.title = "Scheduled tasks";
    route.fullPath = "/workspace/scheduled-tasks";
    await flushPromises();
    expect(live.textContent).toBe("Scheduled tasks");
    wrapper.unmount();
  });
});
