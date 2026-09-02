<script setup lang="ts">
/*
  【文件职责】     artifact 面板在**没有选中任何文件**时的样子：文件清单或空状态。
  【架构位置】     L3 extension reference
  【主要导出】     默认 ArtifactOverview 组件
  【依赖关系】     ArtifactFileCards · ui/conversation · AgentChat
  【边界与注意】   这条分支以前 Vue 没有：头部的 artifacts 入口会顺手把第一个文件选中，
                   于是面板直接进详情。React 不选（frontend/src/components/workspace/artifacts/artifact-trigger.tsx
                   只调 setOpen(true)），面板落在这份清单上
                   （workspace/chats/chat-box.tsx 里 renderedRightPanel === "artifacts"
                   且 selectedArtifact 为空的那一支）。差别不只是长相：自动选中会去
                   拉那个文件的内容，fixture 里那条路径不在 /mnt/user-data 下，Gateway
                   直接 400，面板上于是多出一条 React 不会有的报错。

                   卡片清单本身在 ArtifactFileCards 里，两处消费点共用一份：上游
                   `artifact-file-list.tsx` 就是同一个组件既画这份面板清单、也画会话流里
                   present_files 那一组（message-list.tsx 的 assistant:present-files 分支）。
                   条目为什么不是 li、下载为什么是 link，都写在那个文件的头注释里。
*/
import { computed } from "vue";
import { Files, X } from "lucide-vue-next";

import { Button } from "@/components/ui/button";
import { ConversationEmptyState } from "@/components/ui/conversation";
import ArtifactFileCards from "./ArtifactFileCards.vue";

const props = defineProps<{
  threadId: string;
  artifacts: string[];
  isMock?: boolean;
}>();
const emit = defineEmits<{ close: []; select: [path: string] }>();

const isEmpty = computed(() => props.artifacts.length === 0);
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
      v-if="isEmpty"
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
        <!--
          清单的外边距是**调用点**给的，不是组件自带的：上游这一处传的是
          `className="max-w-(--container-width-sm) p-4 pt-12"`（chat-box.tsx），
          会话流那一处什么都不传。
        -->
        <ArtifactFileCards
          class="max-w-[var(--container-width-sm)] p-4 pt-12"
          :thread-id="threadId"
          :files="artifacts"
          :is-mock="isMock"
          @select="emit('select', $event)"
        />
      </main>
    </div>
  </div>
</template>
