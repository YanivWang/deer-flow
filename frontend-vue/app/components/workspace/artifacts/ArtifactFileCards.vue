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

                   **已知与上游的一处差异**：上游这份清单在文件名以 `.skill` 结尾
                   且当前用户是管理员时，下载左边还有一颗 Install 按钮（会调
                   `installSkill` 并弹 toast）。本仓两个消费点都没有它。抽这一份的时候
                   没有顺手补上，是因为它需要 admin 判据 + 安装请求 + 安装中状态，
                   与「present_files 组该画什么」不是同一件事；这一条记在交接文档的
                   「挂着的账」里，别当成已经对齐。
*/
import { computed } from "vue";
import { Download } from "lucide-vue-next";

import { buttonVariants } from "@/components/ui/button";
import {
  artifactFileIcon,
  artifactFileName,
  artifactTypeDisplayName,
} from "@/core/artifacts/display";
import { urlOfArtifact } from "@/core/artifacts/utils";

const props = defineProps<{
  threadId: string;
  files: string[];
  isMock?: boolean;
}>();
const emit = defineEmits<{ select: [path: string] }>();

const entries = computed(() =>
  props.files.map((filepath) => ({
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
        <div class="col-start-2 row-span-2 row-start-1 self-center">
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
