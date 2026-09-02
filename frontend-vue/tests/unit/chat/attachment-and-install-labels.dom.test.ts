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
        truncated: false,
      },
    });

    const install = wrapper.get(`button[aria-label="${enUS.common.install}"]`);
    expect(install.attributes("title")).toBe(
      enUS.toolCalls.skillInstallTooltip,
    );
  });
});
