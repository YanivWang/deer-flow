/*
  【文件职责】     守住只读会话（案例页）与两个此前没有渲染分支的消息组。
  【架构位置】     测试
  【主要导出】     无
  【依赖关系】     MessageList.vue · ArtifactFileCards.vue · AssistantTurnActions.vue
  【边界与注意】   这三条**对照台账天生看不见**，原因各不相同，写在每个 describe 上面。
                   台账现在能看见的只有「组里有这种内容时画什么」（夹具补进
                   branch-thread 与 artifact-stream-state 之后），看不见的是
                   「只读态下同一组该长什么样」——没有任何一个对照场景是 isMock 的。
*/

import { flushPromises, mount } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import MessageList from "@/components/chat/MessageList.vue";
import { enUS } from "@/core/i18n/locales/en-US";

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
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(performance.now()), 16),
  );
  vi.stubGlobal("cancelAnimationFrame", (handle: number) =>
    window.clearTimeout(handle),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mountList(props: Record<string, unknown>) {
  return mount(MessageList, {
    props: {
      streaming: false,
      loading: false,
      threadId: "thread-1",
      ...props,
    },
    global: { plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]] },
  });
}

const completedTurn = [
  { id: "human-1", type: "human", content: [{ type: "text", text: "Hi" }] },
  { id: "ai-1", type: "ai", content: "First answer" },
  { id: "human-2", type: "human", content: [{ type: "text", text: "More" }] },
  { id: "ai-2", type: "ai", content: "Second answer" },
];

/*
  只读态：对照台账里**一个 isMock 场景都没有**——每个对照场景都是可写的工作区会话
  （线索 107 的同一条机制：这一屏没被取样）。案例页 /showcase/<id> 有这一屏，
  但它没有对应的 React spec 文件名，进不了取样面。
*/
describe("read-only turn actions", () => {
  it("still renders branch and regenerate, disabled, when not interactive", async () => {
    const wrapper = mountList({ messages: completedTurn, interactive: false });
    await flushPromises();

    const branch = wrapper.get('button[aria-label="Branch conversation"]');
    const regenerate = wrapper.get('button[aria-label="Regenerate"]');
    expect(branch.attributes("disabled")).toBeDefined();
    expect(regenerate.attributes("disabled")).toBeDefined();
  });

  it("renders them enabled when interactive", async () => {
    const wrapper = mountList({ messages: completedTurn, interactive: true });
    await flushPromises();

    expect(
      wrapper
        .get('button[aria-label="Branch conversation"]')
        .attributes("disabled"),
    ).toBeUndefined();
    expect(
      wrapper.get('button[aria-label="Regenerate"]').attributes("disabled"),
    ).toBeUndefined();
  });

  /*
    坑 105：@vue/test-utils 的 trigger() 对 disabled 元素静默不做事，所以这条
    断言的是「事件没有发出去」，不是「点击被拦下来了」。
  */
  it("does not emit branch while disabled", async () => {
    const wrapper = mountList({ messages: completedTurn, interactive: false });
    await flushPromises();

    await wrapper
      .get('button[aria-label="Branch conversation"]')
      .trigger("click");
    expect(wrapper.emitted("branch")).toBeUndefined();
  });
});

/*
  present_files 组：上游给它一个专门的分支（文件卡片），本仓此前让它落进通用的
  ai 分支（Reasoning + 两个工具折叠块 + 一颗文件名按钮）。夹具里没有这种内容时
  台账永远是 0（线索 114），所以 artifact-stream-state 的夹具里补了一条。
*/
describe("assistant:present-files group", () => {
  const presentFiles = [
    { id: "human-1", type: "human", content: [{ type: "text", text: "Go" }] },
    {
      id: "ai-present",
      type: "ai",
      content: "",
      additional_kwargs: { reasoning_content: "thinking about it" },
      tool_calls: [
        {
          name: "present_files",
          args: { filepaths: ["/mnt/user-data/outputs/summary.txt"] },
          id: "call-1",
          type: "tool_call",
        },
      ],
    },
    {
      id: "tool-present",
      type: "tool",
      name: "present_files",
      tool_call_id: "call-1",
      content: "Successfully presented files",
    },
  ];

  it("draws a file card with a download link instead of tool disclosures", async () => {
    const wrapper = mountList({ messages: presentFiles, interactive: true });
    await flushPromises();

    const download = wrapper.get('a[target="_blank"]');
    expect(download.attributes("href")).toContain(
      "/artifacts/mnt/user-data/outputs/summary.txt",
    );
    expect(download.attributes("href")).toContain("download=true");
    expect(wrapper.text()).toContain("summary.txt");
    expect(wrapper.text()).toContain("Text file");

    // 通用 ai 分支的三样东西一个都不该出现在这一组里。
    expect(wrapper.text()).not.toContain("Present Files");
    expect(wrapper.text()).not.toContain("present_files result");
    expect(wrapper.find("details").exists()).toBe(false);
  });

  /*
    只读案例页上的下载链接必须走 `/mock/api`：那条路由才是公开可读的
    demo artifact 服务端点，`/api/threads/...` 要鉴权。上游 ArtifactFileList
    **漏了**这个参数（详情面板每一处都传了），所以那条链接在公开案例页上是断的——
    两边同改，React 侧一起补。
  */
  it("routes the download through /mock/api on a demo thread", async () => {
    const wrapper = mountList({
      messages: presentFiles,
      interactive: false,
      isMock: true,
    });
    await flushPromises();

    expect(wrapper.get('a[target="_blank"]').attributes("href")).toContain(
      "/mock/api/threads/thread-1/artifacts/mnt/user-data/outputs/summary.txt",
    );
  });

  it("selects the artifact when the card is clicked", async () => {
    const wrapper = mountList({ messages: presentFiles, interactive: true });
    await flushPromises();

    await wrapper.get("ul > div").trigger("click");
    expect(wrapper.emitted("artifact")?.[0]).toEqual([
      "/mnt/user-data/outputs/summary.txt",
    ]);
  });
});

/*
  clarification 组有两支，此前只做了带 `artifact.human_input` 的那一支。
  不带请求的那一支上游按 markdown 渲染，本仓此前什么都不画。
*/
describe("assistant:clarification without a structured request", () => {
  const messages = [
    { id: "human-1", type: "human", content: [{ type: "text", text: "Go" }] },
    { id: "ai-1", type: "ai", content: "Let me check." },
    {
      id: "tool-clarify",
      type: "tool",
      name: "ask_clarification",
      content: "Which one did you mean?\n\n  1. Staging\n  2. Production",
    },
  ];

  it("renders the tool text as markdown", async () => {
    const wrapper = mountList({ messages, interactive: true });
    await flushPromises();
    await vi.waitFor(
      () => expect(wrapper.text()).toContain("Which one did you mean?"),
      { timeout: 2_000 },
    );

    // markdown，不是一段纯文本：有序列表要真的变成 list。
    expect(wrapper.findAll("ol li").map((item) => item.text())).toEqual([
      "Staging",
      "Production",
    ]);
    // 也不该退回通用的 tool 折叠块。
    expect(wrapper.text()).not.toContain("ask_clarification result");
  });
});
