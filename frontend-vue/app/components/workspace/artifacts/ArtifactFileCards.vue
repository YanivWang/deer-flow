<script setup lang="ts">
/*
  【文件职责】     把一组 artifact 路径画成可点开的文件卡片清单。
  【架构位置】     L3
  【主要导出】     默认 ArtifactFileCards 组件
  【依赖关系】     core/artifacts/display · core/artifacts/utils · Button L2
  【边界与注意】   这一份是从 ArtifactOverview 里**抽出来**的，不是新写的一份：上游
                   `frontend/src/components/workspace/artifacts/artifact-file-list.tsx`
                   是**同一个组件**同时被两处消费——artifact 面板的清单态
                   （chat-box.tsx 的 `renderedRightPanel === "artifacts"`）与会话流里的
                   present_files 组（message-list.tsx 的 assistant:present-files 分支）。
                   本仓此前只在面板那一处有，会话流那一处根本没有分支，于是
                   present_files 落进通用的工具折叠块，画出来是另一样东西。

                   条目是 `<ul>` 里的 div 卡片，**不是 li**：上游就是这个形状，
                   读屏器听到的是一个没有条目的 list。补成 li 会让两边的列表语义对不上。

                   下载是 `<a>` 穿上 Button 的样式，不是 button 包 a：上游用
                   `<Button asChild>` 把变体 class 交给锚点，所以读屏器听到的是 link
                   而不是 button——链接才能新窗口打开、才能被「复制链接地址」。

                   `.skill` 的 Install 按钮（wave 28 补齐）：上游在文件名以 `.skill`
                   结尾且当前用户是管理员时，下载左边还有一颗 Install。判据走的是本仓
                   既有的纯函数 `canInstallSkillArtifact`，也就是**比上游多一条
                   `!isMock`**——上游这份清单只判 `.skill && isAdmin`，而它的详情视图
                   （artifact-file-detail.tsx）同样不判 isMock。上游在案例页上不出这颗
                   按钮靠的是另一条路：showcase layout 传的是 `<AuthProvider
                   initialUser={null}>` 且没人调 refreshUser，于是 `isAdmin` 恒为 false。
                   本仓的 `isAdmin` 在 `authDisabled` 部署下即使在案例页也是 true
                   （AgentChat.vue:164），只靠 isAdmin 会让只读案例页长出一颗写入按钮。
                   `!isMock` 补的就是这条，与 ArtifactPanel 的详情视图同一个判据。

                   失败提示用 `artifacts.installFailed` 而不是上游写死的英文
                   "Failed to install skill"：本仓的详情视图早就用这条词条了，
                   同一个动作在两处说不同的话更糟。

                   toast 走 `useWorkspaceToast()`（**没有 provider 会抛**）。两个消费点
                   分别在 workspace layout 与 showcase layout 下，两者都 provide 了；
                   单测里直接挂 MessageList 的要自己 provide 一份。
*/
import { computed, ref } from "vue";
import { Download, Loader, Package } from "lucide-vue-next";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  artifactFileIcon,
  artifactFileName,
  artifactTypeDisplayName,
} from "@/core/artifacts/display";
import {
  canInstallSkillArtifact,
  classifyArtifact,
} from "@/core/artifacts/policy";
import { urlOfArtifact } from "@/core/artifacts/utils";
import { SkillRequestError, installSkill } from "@/core/skills/api";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";

const props = defineProps<{
  threadId: string;
  files: string[];
  isMock?: boolean;
  isAdmin?: boolean;
}>();
const emit = defineEmits<{ select: [path: string] }>();
const { $i18n } = useNuxtApp();
const toast = useWorkspaceToast();

/** 上游用一个 `installingFile` 记住是**哪一条**在装，不是一个全局布尔。 */
const installingFile = ref<string | null>(null);

const entries = computed(() =>
  props.files.map((filepath) => ({
    filepath,
    name: artifactFileName(filepath),
    type: artifactTypeDisplayName(filepath),
    icon: artifactFileIcon(filepath),
    installable: canInstallSkillArtifact(
      classifyArtifact(filepath, { isMock: props.isMock }),
      { isAdmin: props.isAdmin === true },
    ),
    downloadURL: urlOfArtifact({
      filepath,
      threadId: props.threadId,
      download: true,
      isMock: props.isMock,
    }),
  })),
);

async function install(filepath: string) {
  if (installingFile.value) return;
  installingFile.value = filepath;
  try {
    const result = await installSkill({
      thread_id: props.threadId,
      path: filepath,
    });
    if (result.success) {
      toast.success(result.message);
      return;
    }
    toast.error(result.message || $i18n.t.value.artifacts.installFailed);
  } catch (cause) {
    toast.error(
      cause instanceof SkillRequestError && cause.isAdminRequired
        ? $i18n.t.value.settings.skills.installAdminRequired
        : $i18n.t.value.artifacts.installFailed,
    );
  } finally {
    installingFile.value = null;
  }
}
</script>

<template>
  <ul class="flex w-full flex-col gap-4">
    <div
      v-for="entry in entries"
      :key="entry.filepath"
      class="bg-card text-card-foreground relative cursor-pointer rounded-xl border p-3 shadow-sm"
      @click="emit('select', entry.filepath)"
    >
      <div
        class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 pr-2 pl-1"
      >
        <div class="relative min-w-0 pl-8 leading-tight font-semibold">
          <div class="min-w-0 [overflow-wrap:anywhere] break-words">
            {{ entry.name }}
          </div>
          <div class="absolute top-2 -left-0.5">
            <component :is="entry.icon" class="size-6" />
          </div>
        </div>
        <div class="text-muted-foreground col-start-1 min-w-0 pl-8 text-xs">
          {{ $i18n.t.value.artifacts.fileTypeLabel(entry.type) }}
        </div>
        <!--
          上游是 `<CardAction className="row-span-1 self-center">`
          （artifact-file-list.tsx:109）。CardAction 的基础 class 里是
          `row-span-2 ... self-start justify-self-end`，调用点用 tailwind-merge
          把前两条换成了 `row-span-1 self-center`——本仓这里是一个裸 div，
          得把合并之后的结果直接写出来。跨两行还是一行会改卡片高度：
          按钮比标题行高，占一行时第一行被它撑开，占两行时两行一起分担。
        -->
        <div
          class="col-start-2 row-span-1 row-start-1 self-center justify-self-end"
        >
          <!--
            Install 在下载**左边**，与上游同序（artifact-file-list.tsx 的 CardAction
            先渲染 Install 再渲染 Download）。`@click.stop` 与上游的
            `e.stopPropagation(); e.preventDefault()` 同义：卡片本身是可点的，
            点安装不该顺手把这个文件在面板里打开。
          -->
          <Button
            v-if="entry.installable"
            variant="ghost"
            :disabled="installingFile === entry.filepath"
            @click.stop="install(entry.filepath)"
          >
            <Loader
              v-if="installingFile === entry.filepath"
              class="size-4 animate-spin"
            />
            <Package v-else class="size-4" />
            {{ $i18n.t.value.common.install }}
          </Button>
          <a
            :href="entry.downloadURL"
            target="_blank"
            rel="noopener noreferrer"
            :class="buttonVariants({ variant: 'ghost' })"
            @click.stop
          >
            <Download class="size-4" />
            {{ $i18n.t.value.common.download }}
          </a>
        </div>
      </div>
    </div>
  </ul>
</template>
