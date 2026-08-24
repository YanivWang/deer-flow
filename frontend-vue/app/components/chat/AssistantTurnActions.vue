<!--
  【文件职责】     统一助手消息尾部的复制、分支与重新生成操作规格。
  【对应 frontend/】 src/components/workspace/messages/message-list.tsx::AssistantTurn
  【架构位置】     L3 UI adapter
  【主要导出】     默认 AssistantTurnActions 组件
  【依赖关系】     Button L2 · lucide-vue-next
  【边界与注意】   只拥有动作呈现与事件转发；动作可用性与业务执行仍由 MessageList 决定。
-->

<script setup lang="ts">
import { Check, Copy, GitBranch, RefreshCw } from "lucide-vue-next";

import { Button } from "@/components/ui/button";

withDefaults(
  defineProps<{
    copied: boolean;
    copyLabel: string;
    branchLabel: string;
    regenerateLabel: string;
    showBranch?: boolean;
    showRegenerate?: boolean;
  }>(),
  {
    showBranch: false,
    showRegenerate: false,
  },
);

const emit = defineEmits<{
  copy: [];
  branch: [];
  regenerate: [];
}>();
</script>

<template>
  <div
    data-testid="assistant-turn-actions"
    class="text-muted-foreground mt-2 flex justify-start gap-1 opacity-0 transition-opacity delay-200 duration-300 group-hover:opacity-100"
  >
    <Button
      variant="ghost"
      size="icon-sm"
      :aria-label="copyLabel"
      @click="emit('copy')"
    >
      <Check v-if="copied" class="text-green-500" />
      <Copy v-else />
    </Button>
    <Button
      v-if="showBranch"
      variant="ghost"
      size="icon-sm"
      :aria-label="branchLabel"
      @click="emit('branch')"
    >
      <GitBranch class="size-4" />
    </Button>
    <Button
      v-if="showRegenerate"
      variant="ghost"
      size="icon-sm"
      :aria-label="regenerateLabel"
      @click="emit('regenerate')"
    >
      <RefreshCw class="size-3" />
    </Button>
  </div>
</template>
