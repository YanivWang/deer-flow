<script setup lang="ts">
/*
  【文件职责】     会话行尾的 IM 渠道来源徽标。
  【架构位置】     L3 product UI
  【主要导出】     默认 ThreadChannelBadge 组件
  【依赖关系】     ChannelProviderIcon · core/threads/utils
  【边界与注意】   名字挂在 title 而不是 aria-label：React 的 ThreadChannelBadge 只有
                   title（图标本身才带 aria-label），两者在可访问性树上不是一回事——
                   aria-label 会让这个 span 变成有名字的节点，与同一行的图标重复播报。
*/
import type { HTMLAttributes } from "vue";

import ChannelProviderIcon from "@/components/workspace/channels/ChannelProviderIcon.vue";
import type { ChannelThreadSource } from "@/core/threads/utils";
import { cn } from "@/lib/utils";

const props = defineProps<{
  source: ChannelThreadSource | null;
  class?: HTMLAttributes["class"];
}>();
const { $i18n } = useNuxtApp();
</script>

<template>
  <span
    v-if="source"
    :title="$i18n.t.value.primitives.channel(source.label)"
    :class="
      cn(
        'bg-muted text-muted-foreground inline-flex h-6 max-w-32 items-center gap-1 rounded-md px-2 text-xs font-medium',
        props.class,
      )
    "
  >
    <ChannelProviderIcon :provider="source.provider" size="size-3.5" />
    <span class="truncate">{{ source.label }}</span>
  </span>
</template>
