/*
  【文件职责】     守住聊天面上「哪条提示走 toaster、哪条留在页面里」这条分界线。
  【架构位置】     L3 单元测试（AgentChat 只读源码，不挂载）
  【主要导出】     无；Vitest cases
  【依赖关系】     app/components/chat/AgentChat.vue
  【边界与注意】   AgentChat 只读源码，理由与 followup-chip-guards.test.ts 相同：
                   挂载它要连上 stream/threads/query 一整套。

                   **对照台账天生看不见这一簇**（第⑥类：只在某种后端状态下才分叉）。
                   replay gap 要假 Gateway 制造断流、分支失败要后端拒收、发送失败要
                   线程创建抛异常——没有一个对照场景会走到，判据写歪了不会有门禁变红。

                   分界线本身写在 `failedSend` 的声明上，与 BrowserPanel 文件头第 3 条
                   是同一条：**带着操作的提示是 UI 状态，留在页面里；纯播报走 toaster。**
                   toast 五秒后自己走掉，「再试一次」不能跟着一起消失。
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

describe("流的两条播报走 workspace toaster", () => {
  /* 上游 `core/threads/hooks.ts:1805` 是 toast.warning，本仓 warning 映到 info。 */
  it("routes the replay-gap warning to the toaster", () => {
    expect(agentChat).toContain("warn: (message) =>\n      toast.info(");
  });

  /* 上游 `:1846` 是 toast.error；toaster 会把 error 播成 assertive。 */
  it("routes stream errors to the toaster", () => {
    expect(agentChat).toContain("error: (message) => toast.error(message),");
  });

  /*
    此前这两条 push 进一个**只增不减**的 `warnings` 数组。数组没了，这条断言就是
    「不许把它加回来」——一次性的警告挂在屏幕上不走是它最明显的症状。
  */
  it("keeps no ever-growing warnings array", () => {
    expect(agentChat).not.toContain("warnings");
  });
});

describe("发送失败留在页面里", () => {
  /*
    唯一留在页面里的那条：它带着「再试一次」，而重试要用到原始的 text/files。
    上游同一处只有 `toast.error(getStreamErrorMessage(error))`，没有重试入口。
  */
  it("keeps the retry banner inline with the text and files it needs", () => {
    expect(agentChat).toContain('v-if="failedSend"');
    expect(agentChat).toContain('data-testid="send-failure"');
    expect(agentChat).toContain("{{ failedSend.message }}");
    for (const field of ["text,", "files,", "message:"]) {
      expect(
        agentChat.slice(
          agentChat.indexOf("failedSend.value = {"),
          agentChat.indexOf("failedSend.value = {") + 260,
        ),
        `failedSend 少了 ${field}`,
      ).toContain(field);
    }
  });
});

describe("留在页面里的三处状态", () => {
  /*
    判据是**时长**不是「有没有按钮」：在某一刻发生的事走 toaster，在一段时间里为真的
    事留在页面里。`llmRetry` 是后者——正在重试，流恢复或出错时自己消失，
    上游那边则是每个 llm_retry 事件一条 toast（hooks.ts:1835）。
  */
  it("keeps the retry-in-progress banner on the page", () => {
    expect(agentChat).toContain('v-if="stream.llmRetry.value"');
    expect(agentChat).toContain('data-testid="llm-retry-status"');
  });

  /*
    判据本身要留在源码里。它是这一簇唯一说得清「为什么这条走 toast、那条不走」的
    东西，删掉之后下一个人只会看到三处不一致的写法。
  */
  it("writes the ownership rule down where the exception lives", () => {
    const source = readFileSync(
      new URL("../../../app/components/chat/AgentChat.vue", import.meta.url),
      "utf8",
    );
    expect(source).toContain(
      "在某一刻发生的事 → workspace toaster；在一段时间里为真的事 → 页面里的状态",
    );
  });
});

/*
  「改完重跑会丢掉这一轮之后的消息」这句提醒，上游写在编辑框与两颗按钮之间
  （message-list-item.tsx:530）。本仓此前没有——用户按下「Update and rerun」之前
  看不到任何关于后果的说明，而这是一个**会丢内容**的操作。
  `common.editRerunWarning` 也因此一直躺在 unused 里（wave 35）。
*/
describe("编辑并重跑的提醒", () => {
  it("warns about the consequence before the two buttons", () => {
    const box = agentChat.slice(
      agentChat.indexOf('v-if="editState"'),
      agentChat.indexOf("$i18n.t.value.common.updateAndRerun"),
    );
    expect(box).toContain("$i18n.t.value.common.editRerunWarning");
    // 要在两颗按钮**之前**，与上游同序：看到警告再决定按哪一颗。
    expect(box.indexOf("editRerunWarning")).toBeLessThan(
      box.indexOf("$i18n.t.value.common.cancel"),
    );
  });
});

describe("分支的两条播报", () => {
  /*
    上游 `chat-page.tsx:225` 把整段包在 try/catch 里。本仓此前一个 catch 都没有——
    `branchThreadFromTurn` 一抛就是一条未处理的 rejection：不跳转、不提示，
    用户点完「分支」屏幕纹丝不动。
  */
  it("announces both outcomes and never leaves the rejection unhandled", () => {
    const branch = agentChat.slice(
      agentChat.indexOf("async function branch("),
      agentChat.indexOf("async function regenerate("),
    );
    expect(branch).toContain("} catch (error) {");
    expect(branch).toContain("$i18n.t.value.conversation.branchFailed");
    expect(branch).toContain(
      "toast.success($i18n.t.value.conversation.branchCreated);",
    );
    // 成功那条要在跳转**之前**播报，否则新路由把它冲掉。
    expect(branch.indexOf("toast.success")).toBeLessThan(
      branch.indexOf("await router.push(path)"),
    );
  });
});
