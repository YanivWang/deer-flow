/*
  【文件职责】     守住 follow-up 建议 chip 的显示判据与它的确认框形态。
  【架构位置】     L3 单元测试（AgentChat 只读源码，不挂载）
  【主要导出】     无；Vitest cases
  【依赖关系】     app/components/chat/AgentChat.vue · app/components/chat/ChatComposer.vue
  【边界与注意】   AgentChat 只读源码，理由与 agent-save-hint.test.ts 相同：挂载它要连上
                   stream/threads/query 一整套。确认框那一半是真挂载的，在
                   composer-workflow.dom.test.ts 里。

                   **对照台账看不见这一簇**：默认 mock 的 `/api/suggestions/config`
                   之后没有任何对照场景跑完一整轮 run，chip 永远不出现（第①与第⑥类
                   差异各占一半）。判据写歪了不会有门禁变红。
*/

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/* 注释先剥掉：下面钉的每一条在文件里都同时出现在解释它的注释里。 */
function sourceOf(relative: string) {
  return readFileSync(new URL(relative, import.meta.url), "utf8")
    .replaceAll(/<!--[\s\S]*?-->/g, "")
    .replaceAll(/\/\*[\s\S]*?\*\//g, "");
}

const agentChat = sourceOf("../../../app/components/chat/AgentChat.vue");
const composer = sourceOf("../../../app/components/chat/ChatComposer.vue");

describe("follow-up chip visibility", () => {
  /*
    上游 `showFollowups`（input-box.tsx:1981）是六条判据的合取。本仓少了四条：
    demo、composer 里开着的浮层（两条合成一条）、以及流式中。最后一条是真缺陷——
    `send()` 只清 `followups` 不清 `followupsLoading`，上一轮建议还没取回来时再发
    一条，「正在生成建议」那颗 chip 会一直挂在新的流上面。
  */
  it("carries every guard upstream's showFollowups has", () => {
    const block = agentChat.slice(
      agentChat.indexOf('data-slot="suggestions-list"') - 400,
      agentChat.indexOf('data-slot="suggestions-list"'),
    );
    for (const guard of [
      "!bootstrap",
      "!isDemo",
      "!isWelcomeMode",
      "!followupsSuppressed",
      "!stream.isStreaming.value",
      "(followupsLoading || followups.length > 0)",
    ]) {
      expect(block, `缺判据 ${guard}`).toContain(guard);
    }
  });

  /* 上游三条提交路径都把 loading 一起清掉（input-box.tsx:1024 / 1091 / 1202）。 */
  it("clears the loading chip when a new message is sent", () => {
    expect(agentChat).toContain(
      "followups.value = [];\n  followupsLoading.value = false;",
    );
  });

  /* 判据来自 composer 内部两个外面看不见的状态，靠这条 emit 送出来。 */
  it("takes the composer's own blockers through an emit", () => {
    expect(agentChat).toContain(
      '@followups-suppressed-change="followupsSuppressed = $event"',
    );
    expect(composer).toContain("followupsSuppressedChange: [value: boolean];");
    expect(composer).toContain(
      "() => showSuggestions.value || selectedSkill.value !== null,",
    );
  });
});

describe("follow-up confirm dialog", () => {
  /*
    上游是真 `<Dialog>`（input-box.tsx:2765）。手搓副本的特征是 `aria-modal="true"`
    写在一个 `absolute` 定位的 div 上——它只是在**说**自己是模态，浏览器不会因此
    拦住焦点，Escape 也关不掉。这条钉的是那个副本没有回来。
  */
  it("is a real Dialog, not an absolutely positioned look-alike", () => {
    expect(composer).toContain("<DialogTitle>");
    expect(composer).toContain("<DialogDescription>");
    expect(composer).toContain(':close-label="$i18n.t.value.primitives.close"');
    expect(composer).not.toContain('aria-modal="true"');
    expect(composer).not.toContain("absolute right-0 bottom-full left-0 z-50");
  });

  /* 上游只画标题与描述，不把待发的那句建议再渲染一遍。 */
  it("does not echo the pending suggestion back", () => {
    expect(composer).not.toContain("{{ pendingFollowup }}");
  });
});
