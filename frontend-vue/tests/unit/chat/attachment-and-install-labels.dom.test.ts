/*
  【文件职责】     守住两句「上游有、本仓 wave 36 之前没有」的说明文字。
  【架构位置】     测试
  【主要导出】     无
  【依赖关系】     MessageAttachments.vue · ArtifactActions.vue
  【边界与注意】   **不能靠 i18n 基线兜底**（线索 153）：`uploads.uploading` 的叶子名
                   与到处都是的 `.uploading` 撞车，`toolCalls.skillInstallTooltip`
                   同样。wave 36 的负向验证当场抓到这两条假绿——把文字删掉，
                   `make i18n-unused` 纹丝不动。

                   两处都是**只有视觉、没有文字**的状态：上传中只有一颗转圈图标
                   （没有文字替代），安装键只有一个包裹图标 + 一句「安装」
                   （说不清安装到哪里）。上游分别在
                   `message-list-item.tsx:701` 写 `{t.uploads.uploading}`、
                   在 `artifact-file-detail.tsx:532` 外面套一层
                   `<Tooltip content={t.toolCalls.skillInstallTooltip}>`。

                   对照台账看不见：附件要有正在上传的文件（第①与第⑥类），
                   `.skill` 的安装键要管理员 + 特定后缀（第⑥类）。
*/

import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import ArtifactActions from "@/components/workspace/artifacts/ArtifactActions.vue";
import MessageAttachments from "@/components/chat/MessageAttachments.vue";
import { enUS } from "@/core/i18n/locales/en-US";
import type { Message } from "@/core/types/message";

beforeEach(() => {
  vi.stubGlobal("useNuxtApp", () => ({
    $i18n: { t: ref(enUS), locale: ref("en-US") },
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

function messageWith(status: string): Message {
  return {
    type: "human",
    content: "Review these",
    additional_kwargs: {
      files: [{ filename: "notes.txt", size: 42, status }],
    },
  } as Message;
}

describe("uploading attachment", () => {
  it("says it is still uploading instead of relying on the spinner alone", () => {
    const wrapper = mount(MessageAttachments, {
      props: { message: messageWith("uploading"), threadId: "thread-1" },
    });

    expect(wrapper.text()).toContain("notes.txt");
    expect(wrapper.text()).toContain(enUS.uploads.uploading);
  });

  /* 传完了就不该再说「上传中」——只测出现的那一支，写成恒显也是绿的。 */
  it("drops the label once the upload finished", () => {
    const wrapper = mount(MessageAttachments, {
      props: { message: messageWith("uploaded"), threadId: "thread-1" },
    });

    expect(wrapper.text()).not.toContain(enUS.uploads.uploading);
  });
});

describe("skill install action", () => {
  it("explains what installing does, beyond the button's own name", () => {
    const wrapper = mount(ArtifactActions, {
      props: {
        canEdit: false,
        editing: false,
        dirty: false,
        saving: false,
        conflict: false,
        streaming: false,
        canCopy: true,
        canOpen: true,
        canDownload: true,
        canInstall: true,
        installing: false,
        copyDisabled: false,
      },
    });

    /*
      **名字与说明是两句话**（上游 artifact-file-detail.tsx:532 传
      `label={t.common.install}` 与 `tooltip={t.toolCalls.skillInstallTooltip}`）。
      wave 69 之前本仓把说明挂在原生 `title` 上，这一排八颗纯图标键里
      只有它 hover 有反应；现在整排都走 `<Tooltip>`，与上游的
      `ArtifactAction` 一致。

      **浮层文字要 hover 才进 DOM**（Reka 把 TooltipContent 渲染在 portal 里），
      挂载后断言不到——那一档归 e2e。这里钉的是结构：这颗键在触发器里、
      名字仍是 `common.install` 而不是被说明顶替。
    */
    const install = wrapper.get(`button[aria-label="${enUS.common.install}"]`);
    expect(install.attributes("title")).toBeUndefined();
    expect(install.element.closest("[data-slot='tooltip-trigger']")).not.toBe(
      null,
    );
    expect(enUS.common.install).not.toBe(enUS.toolCalls.skillInstallTooltip);
  });

  /*
    这一排此前只有安装那颗 hover 有反应（原生 title），其余七颗纯图标键
    鼠标悬停什么都不出——aria-label 只解决读屏器那半边。
  */
  /*
    附件卡上游画的是 `FileIcon`（=File，素页），本仓此前画 `FileText`
    （带横线的页）——两颗不同字形。本仓另外两处用 FileText 的地方
    （ExportTrigger / ThreadActionsMenu）与上游一致，那两处不动。
  */
  it("attachment cards draw the upstream plain File glyph", async () => {
    const source = await import("node:fs").then((fs) =>
      fs
        .readFileSync("app/components/chat/MessageAttachments.vue", "utf8")
        // 先剥注释：解释这条修法的注释里就写着 FileText（线索 174）。
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/^[ \t]*\/\/.*$/gm, ""),
    );

    expect(source).toContain("FileIcon");
    expect(source).not.toContain("FileText");
  });

  it("wraps every action in a tooltip, not just the install one", () => {
    const wrapper = mount(ArtifactActions, {
      props: {
        canEdit: true,
        editing: false,
        dirty: false,
        saving: false,
        conflict: false,
        streaming: false,
        canCopy: true,
        copyDisabled: false,
        canOpen: true,
        canDownload: true,
        canInstall: true,
        installing: false,
      },
    });

    const buttons = wrapper.findAll("button");
    expect(buttons.length).toBeGreaterThanOrEqual(5);
    for (const button of buttons) {
      expect(button.element.closest("[data-slot='tooltip-trigger']")).not.toBe(
        null,
      );
      // 图标是上游的 16px，不是 15。
      expect(button.find("svg").attributes("width")).toBe("16");
      /*
        走 Button primitive 才有这四样。手写 `<button>` 时它们全没有：
        禁用的保存与复制**看起来和能点一模一样**，键盘焦点也没有可见指示。
      */
      expect(button.classes()).toContain("disabled:opacity-50");
      expect(button.classes()).toContain("disabled:pointer-events-none");
      expect(button.classes()).toContain("focus-visible:ring-[3px]");
      expect(button.classes()).toContain("hover:text-foreground");
    }
  });

  /*
    三颗此前画的是**别的字形**：编辑 `Edit3`(=PenLine) 而上游 `PencilIcon`(=Pencil)、
    退出编辑 `X` 而上游 `PencilOffIcon`（带斜线的铅笔，"停止编辑" ≠ "关闭"）、
    新窗口打开 `ExternalLink` 而上游 `SquareArrowOutUpRightIcon`。
  */
  it("draws the upstream glyphs for edit, exit-editing and open-in-new-window", () => {
    const base = {
      canEdit: true,
      dirty: true,
      saving: false,
      conflict: false,
      streaming: false,
      canCopy: false,
      copyDisabled: false,
      canOpen: true,
      canDownload: false,
      canInstall: false,
      installing: false,
    };

    const idle = mount(ArtifactActions, { props: { ...base, editing: false } });
    expect(idle.find(".lucide-pencil").exists()).toBe(true);
    expect(idle.find(".lucide-pen-line").exists()).toBe(false);
    expect(idle.find(".lucide-square-arrow-out-up-right").exists()).toBe(true);
    expect(idle.find(".lucide-external-link").exists()).toBe(false);

    const editing = mount(ArtifactActions, {
      props: { ...base, editing: true },
    });
    expect(editing.find(".lucide-pencil-off").exists()).toBe(true);
    expect(editing.find(".lucide-x").exists()).toBe(false);
  });
});
