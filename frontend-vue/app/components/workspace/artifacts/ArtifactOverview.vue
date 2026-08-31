<script setup lang="ts">
/*
  【文件职责】     artifact 面板在**没有选中任何文件**时的样子：文件清单或空状态。
  【架构位置】     L3 extension reference
  【主要导出】     默认 ArtifactOverview 组件
  【依赖关系】     core/artifacts/display · core/artifacts/utils · ui/conversation · AgentChat
  【边界与注意】   这条分支以前 Vue 没有：头部的 artifacts 入口会顺手把第一个文件选中，
                   于是面板直接进详情。React 不选（frontend/src/components/workspace/artifacts/artifact-trigger.tsx
                   只调 setOpen(true)），面板落在这份清单上
                   （workspace/chats/chat-box.tsx 里 renderedRightPanel === "artifacts"
                   且 selectedArtifact 为空的那一支）。差别不只是长相：自动选中会去
                   拉那个文件的内容，fixture 里那条路径不在 /mnt/user-data 下，Gateway
                   直接 400，面板上于是多出一条 React 不会有的报错。

                   条目是 li 之外的卡片：React 的 ArtifactFileList 是 `<ul>` 里放
                   `<Card>`（div），所以读屏器听到的是一个没有条目的 list。这里照抄，
                   不是笔误——补成 li 会让两边的列表语义对不上。
*/
import { computed } from "vue";
import { Download, Files, X } from "lucide-vue-next";

import { Button, buttonVariants } from "@/components/ui/button";
import { ConversationEmptyState } from "@/components/ui/conversation";
import {
  artifactFileIcon,
  artifactFileName,
  artifactTypeDisplayName,
} from "@/core/artifacts/display";
import { urlOfArtifact } from "@/core/artifacts/utils";

const props = defineProps<{
  threadId: string;
  artifacts: string[];
  isMock?: boolean;
}>();
const emit = defineEmits<{ close: []; select: [path: string] }>();

const entries = computed(() =>
  props.artifacts.map((filepath) => ({
    filepath,
    name: artifactFileName(filepath),
    type: artifactTypeDisplayName(filepath),
    icon: artifactFileIcon(filepath),
    downloadURL: urlOfArtifact({
      filepath,
      threadId: props.threadId,
      download: true,
      isMock: props.isMock,
    }),
  })),
);
</script>

<template>
  <div
    data-testid="artifact-overview"
    class="relative flex size-full justify-center"
  >
    <div class="absolute top-1 right-1 z-30">
      <!--
        关闭按钮没有可访问名：React 这一支渲染的就是一个只有 XIcon 的 Button，
        没有 sr-only 也没有 aria-label（chat-box.tsx）。详情面板的关闭按钮是另一颗，
        那颗有名字（ArtifactAction 会把 tooltip 写进 sr-only）。
      -->
      <Button variant="ghost" size="icon-sm" @click="emit('close')">
        <X />
      </Button>
    </div>
    <ConversationEmptyState
      v-if="entries.length === 0"
      :title="$i18n.t.value.artifacts.noSelectionTitle"
      :description="$i18n.t.value.artifacts.noSelectionDescription"
    >
      <template #icon><Files /></template>
    </ConversationEmptyState>
    <div
      v-else
      class="flex size-full max-w-[var(--container-width-sm)] flex-col justify-center p-4 pt-8"
    >
      <header class="shrink-0">
        <h2 class="text-lg font-medium">
          {{ $i18n.t.value.common.artifacts }}
        </h2>
      </header>
      <main class="min-h-0 grow">
        <ul
          class="flex w-full max-w-[var(--container-width-sm)] flex-col gap-4 p-4 pt-12"
        >
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
              <div
                class="text-muted-foreground col-start-1 min-w-0 pl-8 text-xs"
              >
                {{ $i18n.t.value.artifacts.fileTypeLabel(entry.type) }}
              </div>
              <div class="col-start-2 row-span-2 row-start-1 self-center">
                <!--
                  下载是 `<a>` 穿上 Button 的样式，不是 button 包 a：React 用
                  `<Button asChild>` 把变体 class 交给锚点（artifact-file-list.tsx），
                  所以读屏器听到的是一个 link 而不是 button——链接才能新窗口打开、
                  才能被「复制链接地址」。
                -->
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
      </main>
    </div>
  </div>
</template>
