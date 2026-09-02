/*
  【文件职责】     守住输入框在**只读**（案例页 demo）下的可访问性形状。
  【架构位置】     测试
  【主要导出】     无
  【依赖关系】     ChatComposer.vue
  【边界与注意】   对照台账看不见这一屏：每个对照场景的输入框都是可写的，
                   而 /showcase/<id> 没有同名的 React spec 文件（线索 107）。

                   两条都是「只读态下才分叉的渲染路径」（天生看不见的第六类）：
                   `aria-disabled` 只有 disabled 为真时才写进树里，模型目录也只有
                   在 disabled 为真时才被关掉。
*/

import { readFileSync } from "node:fs";

import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import ChatComposer from "@/components/chat/ChatComposer.vue";
import { enUS } from "@/core/i18n/locales/en-US";

const mocks = vi.hoisted(() => ({
  loadSkills: vi.fn(),
  loadModels: vi.fn(),
  getUploadLimits: vi.fn(),
  uploadFiles: vi.fn(),
  polishInputDraft: vi.fn(),
  fetchWithAuth: vi.fn(),
}));

vi.mock("@/core/skills/api", () => ({ loadSkills: mocks.loadSkills }));
vi.mock("@/core/models/api", () => ({ loadModels: mocks.loadModels }));
vi.mock("@/core/uploads/api", () => ({
  getUploadLimits: mocks.getUploadLimits,
  uploadFiles: mocks.uploadFiles,
}));
vi.mock("@/core/input-polish/api", () => ({
  polishInputDraft: mocks.polishInputDraft,
}));
vi.mock("@/core/api/fetcher", () => ({ fetch: mocks.fetchWithAuth }));

function mountComposer(props: Record<string, unknown>) {
  return mount(ChatComposer, {
    props: {
      threadKey: "demo-thread",
      targetThreadId: "demo-thread",
      userId: null,
      agentName: null,
      streaming: false,
      uploading: false,
      promptHistory: [],
      context: {},
      /* 案例页上 agentResolved 恒为 true（没有 agentName），照抄。 */
      modelSelectionReady: true,
      submitMessage: vi.fn(async () => true),
      ...props,
    },
    global: {
      plugins: [
        [
          VueQueryPlugin,
          {
            queryClient: new QueryClient({
              defaultOptions: { queries: { retry: false } },
            }),
          },
        ],
      ],
      stubs: { ReferenceAttachment: true, GoalStatus: true },
    },
  });
}

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS), locale: ref("en-US") },
  }));
  mocks.loadSkills.mockReset().mockResolvedValue([]);
  mocks.loadModels.mockReset().mockResolvedValue({
    models: [
      {
        id: "scenario",
        name: "scenario",
        model: "provider-scenario",
        display_name: "Scenario Model",
        supports_thinking: true,
        supports_reasoning_effort: true,
      },
    ],
    token_usage: { enabled: true },
  });
  mocks.getUploadLimits.mockReset().mockResolvedValue(undefined);
  mocks.uploadFiles.mockReset();
  mocks.polishInputDraft.mockReset();
  mocks.fetchWithAuth.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("read-only composer", () => {
  /*
    `aria-disabled` 是**向下继承**的：挂在表单上，可访问性树里连里面两个
    `role="group"` 的 addon 都会被标成 disabled，还会替没被禁用的控件宣布不可用。
    上游 input-box.tsx 一处都没写，它把 disabled 逐个发给真正的控件。
  */
  it("does not mark the whole form aria-disabled", async () => {
    const wrapper = mountComposer({ disabled: true });
    await flushPromises();

    const form = wrapper.get("form");
    expect(form.attributes("aria-disabled")).toBeUndefined();
    expect(form.classes()).toContain("pointer-events-none");
  });

  /*
    **这一条只能读源码，不能挂载后断言。** 语音按钮的可用性前面还有一道
    `voiceSupported = import.meta.client && getSpeechRecognitionConstructor(...)`，
    而 `import.meta.client` 在 vitest 的 `dom` project 里恒为 undefined
    （只有 `nuxt` project 才定义它，实测：stub 掉 SpeechRecognition 之后构造器拿得到，
    `import.meta.client` 仍然是 undefined）。于是那颗按钮在这个环境里**永远**是禁用的，
    挂载后的 `toBeDefined()` 断言测的是环境不是产品——第一版就是这样假绿的：
    把 `disabled ||` 整段变异掉，用例照样绿。
  */
  it("passes the composer's disabled down to the voice button", () => {
    /*
      happy-dom project 里 `import.meta.url` 是 http URL，不是 file URL，
      `new URL(..., import.meta.url)` 交给 readFileSync 会直接抛
      "The URL must be of scheme file"。用相对 vitest 工作目录的路径。
    */
    const source = readFileSync("app/components/chat/ChatComposer.vue", "utf8");
    // 上游 input-box.tsx:2340 传的是 composerLocked（= disabled || polishing）。
    expect(source).toContain(
      ':disabled="disabled || !voiceSupported || polishing || streaming"',
    );
    // 被 pointer-events-none 盖住不算禁用：读屏器听不到「不可用」。
    expect(source).not.toContain(
      ':disabled="!voiceSupported || polishing || streaming"',
    );
  });

  it("disables the mode trigger when read-only", async () => {
    const enabled = mountComposer({ disabled: false });
    await flushPromises();
    expect(
      enabled
        .get("[data-testid='composer-mode-trigger']")
        .attributes("disabled"),
    ).toBeUndefined();

    // 上游 input-box.tsx:2391 的 PromptInputActionMenuTrigger 传的是 composerLocked。
    const wrapper = mountComposer({ disabled: true });
    await flushPromises();
    expect(
      wrapper
        .get("[data-testid='composer-mode-trigger']")
        .attributes("disabled"),
    ).toBeDefined();
  });

  /*
    模型目录**不按 disabled 关掉**。关掉它的后果不是少一个请求：模式触发器的
    文字来自 context.mode，而 context.mode 是目录到位后由「自动选模型」那一步
    写进去的；模型触发器写的是 display_name。目录不来，两颗按钮都没有名字。
  */
  it("still names the mode and model triggers when read-only", async () => {
    const wrapper = mountComposer({ disabled: true });
    /* 坑 115：flushPromises 等不到动态 import 与 query 的解析，用 vi.waitFor。 */
    await vi.waitFor(
      async () => {
        await flushPromises();
        expect(wrapper.emitted("contextChange")).toBeTruthy();
      },
      { timeout: 3_000 },
    );

    // 上游 getResolvedMode(undefined, supportsThinking) 给出 "pro"。
    const latest = wrapper.emitted("contextChange")!.at(-1)![0];
    expect(latest).toMatchObject({ model_name: "scenario", mode: "pro" });

    await wrapper.setProps({ context: latest as Record<string, unknown> });
    await flushPromises();

    expect(wrapper.get("[data-testid='composer-mode-trigger']").text()).toBe(
      enUS.inputBox.proMode,
    );
    expect(wrapper.text()).toContain("Scenario Model");
  });
});
