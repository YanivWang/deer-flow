<script setup lang="ts">
/*
  【文件职责】     展示、编辑和清除当前 DeerFlow goal。
  【对应 frontend/】 src/components/workspace/goal-status.tsx
  【架构位置】     L3
  【主要导出】     默认 GoalStatus 组件
  【依赖关系】     threads/goal · Gateway goal API · ChatComposer
  【边界与注意】   /goal 是 DeerFlow 产品命令，不进入 L2。
*/
import { computed } from "vue";
import { RefreshCw, Target } from "lucide-vue-next";

import { goalContinuation } from "@/core/threads/goal";
import type { GoalState } from "@/core/threads/types";

const props = defineProps<{ goal: GoalState }>();
const continuation = computed(() => goalContinuation(props.goal));
</script>

<template>
  <div
    class="bg-background/90 border-border flex min-h-10 w-full items-center gap-3 rounded-t-xl border border-b-0 px-4 py-2 text-sm shadow-sm backdrop-blur-sm"
  >
    <Target class="text-primary size-4 shrink-0" />
    <div class="min-w-0 flex-1 truncate">
      <span class="text-muted-foreground mr-2">Goal</span>
      <span class="font-medium">{{ goal.objective }}</span>
    </div>
    <span
      v-if="continuation"
      class="text-muted-foreground flex shrink-0 items-center gap-1 text-xs tabular-nums"
      :title="`Auto-continued ${continuation.count}/${continuation.max} times toward the goal; stops at the limit.`"
    >
      <RefreshCw class="size-3" />
      Continuing {{ continuation.count }}/{{ continuation.max }}
    </span>
  </div>
</template>
