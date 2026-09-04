/*
  【文件职责】     钉住四处「aria 天生看不见」的图标 / tooltip 形状。
  【架构位置】     测试
  【主要导出】     无
  【依赖关系】     SubtaskCard · CitationSourcesPanel · GoalStatus · ArtifactTrigger
  【边界与注意】   这四条对照台账与 `dom-parity` 的几何档都看不见：

                   · 字形不进可访问性树——`CheckCircle2`（=CircleCheck）与上游的
                     `CheckCircleIcon`（=CircleCheckBig）念出来是同一个名字，
                     画出来一个勾在圈内、一个勾冲出圆圈；
                   · 图标差 1~2px 也不进可访问性树，几何档要两边同时跑起来、
                     且那个元素当时可见才够得着；
                   · 原生 `title` 与 `<Tooltip>` 在可访问性树上都不是可访问名
                     （前者是 title 属性、后者是 aria-describedby），
                     换掉哪一个树都不动。

                   wave 68 的 `scripts/icon-parity.mjs` 是这四条的来源，
                   但它是顾问工具（要读 `../frontend`），不能当门禁。
*/

import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import ArtifactTrigger from "@/components/workspace/artifacts/ArtifactTrigger.vue";
import GoalStatus from "@/components/workspace/GoalStatus.vue";
import { enUS } from "@/core/i18n/locales/en-US";

vi.stubGlobal("useNuxtApp", () => ({
  $i18n: { t: ref(enUS), locale: ref("en-US") },
}));

describe("上游图标字形", () => {
  /*
    lucide 的 `CheckCircle2` 与 `CheckCircle` 是两个**不同的图标**的别名
    （CircleCheck / CircleCheckBig）。上游 subtask-card.tsx:113/251 用的是后者。
    这里读源码而不是挂载：两处分别在 status 为 completed 与 icon 插槽里，
    要把整张卡片喂到那两个分支上，成本远高于它守住的东西。
  */
  it("SubtaskCard 画的是上游那一颗 CircleCheckBig", async () => {
    const raw = await import("node:fs").then((fs) =>
      fs.readFileSync("app/components/chat/SubtaskCard.vue", "utf8"),
    );
    /*
      **先剥注释再问「用没用」**（线索 174）。第一版没剥，而解释这条修法的
      注释里就写着 `CheckCircle2` 四个字，于是断言撞在自己的注释上。
    */
    const source = raw
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(source).toContain("  CheckCircle,\n");
    // 别名不同、字形也不同的那一颗。
    expect(source).not.toContain("CheckCircle2");
  });

  it("引用面板的外链图标是上游的 14px", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("app/components/chat/CitationSourcesPanel.vue", "utf8"),
    );
    // 上游 citation-sources-panel.tsx:69 是 `size-3.5`。
    expect(source).toContain('<ExternalLink :size="14" />');
    expect(source).not.toContain('<ExternalLink :size="13" />');
  });

  it("sidecar 的回形针是上游的 12px", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync(
        "app/components/workspace/sidecar/SidecarPanel.vue",
        "utf8",
      ),
    );
    // 上游 sidecar-panel.tsx:745 是 `size-3`。
    expect(source).toContain('<Paperclip :size="12" aria-hidden="true" />');
  });
});

describe("原生 title 换成 Tooltip 组件", () => {
  const goal = {
    objective: "Ship the release",
    continuation_count: 2,
    max_continuations: 5,
  };

  it("GoalStatus 的续跑计数走 Tooltip，不走原生 title", () => {
    const wrapper = mount(GoalStatus, { props: { goal: goal as never } });

    const counter = wrapper
      .findAll("span")
      .find((node) => node.text().includes("2"));
    expect(counter).toBeDefined();
    // 原生 title 的延迟 / 位置 / 配色都不受控，触屏上根本不出现。
    expect(wrapper.html()).not.toContain("title=");
    expect(wrapper.find("[data-slot='tooltip-trigger']").exists()).toBe(true);
  });

  it("ArtifactTrigger 包在 Tooltip 里", () => {
    const wrapper = mount(ArtifactTrigger, { props: { count: 3 } });

    expect(wrapper.find("[data-slot='tooltip-trigger']").exists()).toBe(true);
    expect(
      wrapper.get("[data-testid='artifact-trigger']").attributes("aria-label"),
    ).toBe(enUS.common.showArtifacts);
  });

  it("没有 artifact 时整颗键都不渲染", () => {
    const wrapper = mount(ArtifactTrigger, { props: { count: 0 } });
    expect(wrapper.find("[data-testid='artifact-trigger']").exists()).toBe(
      false,
    );
  });
});
