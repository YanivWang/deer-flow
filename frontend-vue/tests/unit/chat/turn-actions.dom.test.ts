/*
  两排 turn actions 的合同。

  助手那排此前用错了两颗图标（GitBranch / RefreshCw，上游是 GitBranchPlus /
  RefreshCcw），人类那排干脆是两颗裸 `<button>`——一个 14px 的 svg 加一段带下划线
  的文字。这两处对照台账都看不见：可访问性树看不见 svg 长什么样，而整排
  `opacity-0` 又不是几何锚点，图标 + aria-label 与可见文字念出来还恰好是同一句。
*/

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import AssistantTurnActions from "@/components/chat/AssistantTurnActions.vue";
import HumanTurnActions from "@/components/chat/HumanTurnActions.vue";

const assistantProps = {
  copied: false,
  copyLabel: "Copy response",
  branchLabel: "Branch",
  regenerateLabel: "Regenerate",
  showBranch: true,
  showRegenerate: true,
};

describe("AssistantTurnActions", () => {
  it("draws the upstream branch and regenerate icons", () => {
    const wrapper = mount(AssistantTurnActions, { props: assistantProps });

    expect(wrapper.find(".lucide-git-branch-plus").exists()).toBe(true);
    expect(wrapper.find(".lucide-refresh-ccw").exists()).toBe(true);
    // 名字只差一两个字母的另外两颗。
    expect(wrapper.find(".lucide-git-branch-icon").exists()).toBe(false);
    expect(wrapper.find(".lucide-refresh-cw-icon").exists()).toBe(false);
  });

  it("leaves the row colour to the ghost buttons", () => {
    const row = mount(AssistantTurnActions, {
      props: assistantProps,
    }).get("[data-testid='assistant-turn-actions']");

    expect(row.classes()).not.toContain("text-muted-foreground");
    expect(row.classes()).toContain("gap-1");
  });
});

describe("HumanTurnActions", () => {
  const props = {
    copied: false,
    copyLabel: "Copy response",
    editLabel: "Edit and rerun",
    showEdit: true,
  };

  it("uses icon buttons instead of a text link", () => {
    const wrapper = mount(HumanTurnActions, { props });
    const buttons = wrapper.findAll("button");

    expect(buttons).toHaveLength(2);
    expect(wrapper.find(".lucide-pencil").exists()).toBe(true);
    expect(wrapper.text()).not.toContain("Edit and rerun");
    expect(buttons[1]?.attributes("aria-label")).toBe("Edit and rerun");
  });

  /*
    复制那颗**不给可访问名**：上游 CopyButton 只有图标和 tooltip，而同一排的
    编辑按钮写了 aria-label。两个应用必须念出同一句，所以这一条钉的是"确实没有"。
  */
  it("leaves the copy button unnamed, like upstream", () => {
    const copy = mount(HumanTurnActions, { props }).findAll("button")[0];

    expect(copy?.attributes("aria-label")).toBeUndefined();
    expect(copy?.text()).toBe("");
  });

  /*
    这一排从 16px 高变成 32px 高（icon-sm 按钮），底边偏移要跟着从 -bottom-7
    变成 -bottom-9，气泡与按钮之间才还是 4px。
  */
  it("keeps the upstream toolbar geometry classes", () => {
    const row = mount(HumanTurnActions, { props }).get(
      "[data-testid='human-turn-actions']",
    );

    expect(row.classes()).toContain("-bottom-9");
    expect(row.classes()).toContain("mt-4");
    expect(row.classes()).toContain("z-20");
    expect(row.classes()).toContain("justify-end");
    expect(row.classes()).not.toContain("-bottom-7");
    expect(row.classes()).not.toContain("justify-between");
    expect(row.get("div").classes()).toContain("pointer-events-auto");
  });

  it("hides the edit button when the turn is not editable", () => {
    const wrapper = mount(HumanTurnActions, {
      props: { ...props, showEdit: false },
    });

    expect(wrapper.findAll("button")).toHaveLength(1);
  });
});
