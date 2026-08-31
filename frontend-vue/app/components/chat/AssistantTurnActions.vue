<!--
  【文件职责】     统一助手消息尾部的复制、分支与重新生成操作规格。
  【架构位置】     L3 UI adapter
  【主要导出】     默认 AssistantTurnActions 组件
  【依赖关系】     Button L2 · Tooltip L2 · lucide-vue-next
  【边界与注意】   只拥有动作呈现与事件转发；动作可用性与业务执行仍由 MessageList 决定。
                   分支与重新生成的 aria-label 与 tooltip 文案是同一份：tooltip 是给鼠标
                   用户补上可见名字，不是可访问名字的来源，所以 aria-label 不能因此去掉。
                   图标要认准上游那两颗：分支是 **GitBranchPlus**（带 + 号的那颗，
                   `message-list.tsx:808`）、重新生成是 **RefreshCcw**（逆时针，
                   `message-list.tsx:844`）。本仓此前用的是 GitBranch 与 RefreshCw——
                   名字只差一两个字母，画出来是另外两颗图标，而可访问性树看不见 svg
                   长什么样，所以对照台账永远不会报这一条。

                   容器上**不写** `text-muted-foreground`：上游那一行只有布局与
                   淡入类，颜色由 ghost 按钮自己继承。多写一句会把三颗图标整体调暗。

                   复制是例外，且是照着 React 抄的例外：React 的 CopyButton
                   （frontend/src/components/workspace/copy-button.tsx）只有图标和 tooltip，
                   同一个文件里的「编辑并重跑」却写了 aria-label——所以它不是「React
                   一律不写」，是这一颗确实没有名字。两个应用必须念出同一句，
                   这里就跟着不写。
-->

<script setup lang="ts">
import {
  Check,
  Copy,
  GitBranchPlusIcon,
  RefreshCcwIcon,
} from "lucide-vue-next";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  <TooltipProvider>
    <div
      data-testid="assistant-turn-actions"
      class="mt-2 flex justify-start gap-1 opacity-0 transition-opacity delay-200 duration-300 group-hover:opacity-100"
    >
      <Tooltip>
        <TooltipTrigger>
          <Button variant="ghost" size="icon-sm" @click="emit('copy')">
            <Check v-if="copied" class="text-green-500" />
            <Copy v-else />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ copyLabel }}</TooltipContent>
      </Tooltip>
      <Tooltip v-if="showBranch">
        <TooltipTrigger>
          <Button
            variant="ghost"
            size="icon-sm"
            :aria-label="branchLabel"
            @click="emit('branch')"
          >
            <GitBranchPlusIcon class="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ branchLabel }}</TooltipContent>
      </Tooltip>
      <Tooltip v-if="showRegenerate">
        <TooltipTrigger>
          <Button
            variant="ghost"
            size="icon-sm"
            :aria-label="regenerateLabel"
            @click="emit('regenerate')"
          >
            <RefreshCcwIcon class="size-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ regenerateLabel }}</TooltipContent>
      </Tooltip>
    </div>
  </TooltipProvider>
</template>
