<script setup lang="ts">
/*
  【文件职责】     显示 sidecar 消息选区引用附件。
  【对应 frontend/】 src/components/workspace/sidecar/reference-attachment.tsx
  【架构位置】     L3 extension reference
  【主要导出】     默认 ReferenceAttachment 组件
  【依赖关系】     useSidecar SidecarReference
  【边界与注意】   sidecar 专有引用形状，不进入 L2。
*/
import { MessageSquareQuote, X } from "lucide-vue-next";

import type { SidecarReference } from "@/composables/useSidecar";

defineProps<{
  references: SidecarReference[];
  testId?: string;
  clearable?: boolean;
}>();
const emit = defineEmits<{ clear: [] }>();
</script>

<template>
  <div
    v-if="references.length"
    :data-testid="testId"
    class="border-border bg-muted/40 text-foreground inline-flex max-w-[min(18rem,100%)] items-center gap-1.5 rounded-full border px-2.5 py-1.5 shadow-sm"
    :title="references.map((item) => item.context.content).join('\n\n')"
  >
    <MessageSquareQuote class="text-muted-foreground size-4 shrink-0" />
    <span class="truncate text-sm font-medium">
      {{ references.length }} selected text
      {{ references.length === 1 ? "fragment" : "fragments" }}
    </span>
    <button
      v-if="clearable"
      type="button"
      aria-label="Clear selected references"
      class="text-muted-foreground hover:text-foreground flex size-6 items-center justify-center rounded-full"
      @click="emit('clear')"
    >
      <X :size="14" />
    </button>
  </div>
</template>
