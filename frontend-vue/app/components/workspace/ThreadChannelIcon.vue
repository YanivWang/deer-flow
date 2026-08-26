<script setup lang="ts">
/*
  【文件职责】     会话行首的 IM 渠道来源图标。
  【架构位置】     L3 product UI
  【主要导出】     默认 ThreadChannelIcon 组件
  【依赖关系】     ChannelProviderIcon · core/threads/utils
  【边界与注意】   名字走 primitives.channel（两份词典同为英文）：React 把
                   `${label} channel` 写死在 thread-channel-source.tsx 里，没接词典，
                   中文界面下读屏器念的也是这一串。理由见 I18N_INVENTORY.md。
                   没有来源时**整个元素不渲染**，与 React 的 `if (!source) return null`
                   一致——渲染一个空 span 会在可访问性树里多出一个节点。
*/
import ChannelProviderIcon from "@/components/workspace/channels/ChannelProviderIcon.vue";
import type { ChannelThreadSource } from "@/core/threads/utils";

defineProps<{ source: ChannelThreadSource | null }>();
const { $i18n } = useNuxtApp();
</script>

<template>
  <span
    v-if="source"
    :aria-label="$i18n.t.value.primitives.channel(source.label)"
    :title="$i18n.t.value.primitives.channel(source.label)"
    class="inline-flex shrink-0 items-center"
  >
    <ChannelProviderIcon :provider="source.provider" size="size-4" />
  </span>
</template>
