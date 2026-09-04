<script setup lang="ts">
/*
  【文件职责】     展示、编辑和清除当前 DeerFlow goal。
  【架构位置】     L3
  【主要导出】     默认 GoalStatus 组件
  【依赖关系】     threads/goal · Gateway goal API · ChatComposer
  【边界与注意】   /goal 是 DeerFlow 产品命令，不进入 L2。
*/
import { computed } from "vue";
import { RefreshCw, Target } from "lucide-vue-next";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { goalContinuation } from "@/core/threads/goal";
import type { GoalState } from "@/core/threads/types";

const props = defineProps<{ goal: GoalState }>();
const { $i18n } = useNuxtApp();
const continuation = computed(() => goalContinuation(props.goal));
const continuationTitle = computed(() =>
  continuation.value
    ? $i18n.t.value.inputBox.goalContinuationTooltip
        .replace("{count}", String(continuation.value.count))
        .replace("{max}", String(continuation.value.max))
    : "",
);
const continuationLabel = computed(() =>
  continuation.value
    ? $i18n.t.value.inputBox.goalContinuing
        .replace("{count}", String(continuation.value.count))
        .replace("{max}", String(continuation.value.max))
    : "",
);
</script>

<template>
  <div
    class="bg-background/90 border-border flex min-h-10 w-full items-center gap-3 rounded-t-xl border border-b-0 px-4 py-2 text-sm shadow-sm backdrop-blur-sm"
  >
    <Target class="text-primary size-4 shrink-0" />
    <div class="min-w-0 flex-1 truncate">
      <span class="text-muted-foreground mr-2">{{
        $i18n.t.value.inputBox.goalLabel
      }}</span>
      <span class="font-medium">{{ goal.objective }}</span>
    </div>
    <!--
      上游 goal-status.tsx:36 把这一段包在 `<Tooltip>` 里，本仓原来用原生
      `title`。原生 title 的延迟、位置、配色都不受控（深色主题下尤其突兀），
      触屏上根本不出现，也不进可访问性树的描述——同 wave 68 语音键那一条。
    -->
    <Tooltip v-if="continuation">
      <TooltipTrigger>
        <span
          class="text-muted-foreground flex shrink-0 items-center gap-1 text-xs tabular-nums"
        >
          <RefreshCw class="size-3" />
          {{ continuationLabel }}
        </span>
      </TooltipTrigger>
      <TooltipContent>{{ continuationTitle }}</TooltipContent>
    </Tooltip>
  </div>
</template>
