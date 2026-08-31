/*
  【文件职责】     钉住聊天头部的构成：两态 class 的合并方式、右侧分组容器、标题层。
  【架构位置】     L3 单元测试（只读源码，不挂载）
  【主要导出】     无；Vitest cases
  【依赖关系】     app/components/chat/AgentChat.vue
  【边界与注意】   几何本身由 e2e-parity 的 browser-feature 场景钉着（browser-trigger
                   的 x 直接受右侧那排控件的宽度支配）。这里补的是几何看不见的四件事：

                   1. 两态 class 必须走一个 cn()。写成 `class` + `:class` 两个属性时
                      `bg-background/80` 与 `bg-background/0` 会同时留在 class 上，
                      赢家由样式表顺序决定而不是模板顺序——同一份模板在不同的样式
                      产物里会画出不同的东西。
                   2. 右侧控件的分组容器。它不改变横向节奏（标题是唯一的 flex-1），
                      改变的是标题变长时缩谁。
                   3. 标题走 FlipDisplay，与上游 ThreadTitle 同构。
                   4. 会话页真的挂了 useHead——本仓此前一个都不设，标签页永远停在
                      根标题。

                   只读源码：挂载 AgentChat 要连上 stream/threads/query 一整套，
                   代价远大于它能多钉住的东西，而这四条都是模板里的结构事实。
*/

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const raw = readFileSync(
  new URL("../../../app/components/chat/AgentChat.vue", import.meta.url),
  "utf8",
);

/*
  注释先剥掉再比对。这里钉的每一条结构在文件里都**同时**出现在解释它的注释里
  （注释就是在讲那个 class 串），不剥的话把模板改坏了守卫照样绿——
  「负向验证跑出绿，第一嫌疑是自己没改到」的同一个坑，换了个地方。
*/
const source = raw
  .replaceAll(/<!--[\s\S]*?-->/g, "")
  .replaceAll(/\/\*[\s\S]*?\*\//g, "");

const headerTag = source.slice(
  source.indexOf("<header"),
  source.indexOf(">", source.indexOf("<header")) + 1,
);

describe("chat header composition", () => {
  it("binds the header class through a single cn() computed", () => {
    expect(headerTag).toBe('<header :class="headerClass">');
    // 静态 class 与动态 :class 并存 = 冲突类由样式表顺序决胜。
    expect(headerTag).not.toContain(" class=");
    expect(source).toContain("const headerClass = computed(() =>");
  });

  it("keeps the header at the upstream stacking level", () => {
    // 上游 chat-page.tsx 是 z-30；z-40 会把头部压到面板那一档之上。
    expect(source).toMatch(/z-30 flex h-12 shrink-0 items-center gap-2/);
    expect(source).not.toContain("z-40 flex h-12");
  });

  it("groups the right-hand controls in one shrink-0 container", () => {
    expect(source).toContain('<div class="flex shrink-0 items-center gap-2">');
  });

  it("names the browser tab after the thread", () => {
    // helper 存在不等于用上了：这条钉的是会话页真的挂了 useHead。
    expect(source).toContain("useHead(() => ({");
    expect(source).toContain("documentTitleOfThread({");
    expect(source).toContain("isLoading: stream.isHistoryLoading.value,");
  });

  it("renders the thread title through FlipDisplay", () => {
    expect(source).toContain(
      '<div class="flex min-w-0 flex-1 items-center text-sm font-medium">',
    );
    expect(source).toMatch(/<FlipDisplay\s+v-if="headerTitle"/);
  });
});
