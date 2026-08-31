<!--
  【文件职责】     代码块与 mermaid 图共用的复制按钮（上游 `CodeBlockCopyButton`）。
  【架构位置】     L2 —— 通用渲染层组件
  【主要导出】     默认组件
  【依赖关系】     ./MarkdownIcon.vue · @/core/markdown/rendering-context
  【边界与注意】   ① **`data-streamdown="code-block-copy-button"` 在 mermaid 工具栏里
                   也是这个值**，不是 `mermaid-block-copy-button`。上游两处复用的是
                   同一个组件，槽位名跟着组件走；按容器改名会让选择器对不上。

                   ② **反馈在图标上，不在 title 上。** 复制成功后 2000ms 内换成对勾，
                   `title` 始终是 `Copy Code`。此前本仓反过来——图标不变、title 改成
                   「已复制」——那既与上游不同，也更差：`title` 是悬停才看得见的，
                   而鼠标刚点完通常已经移开，于是这条反馈实际上没人看得到。

                   ③ 已经处于「已复制」状态时再点不做任何事（上游 `i || (...)`）：
                   否则连点会把定时器不断续期，对勾一直不消。

                   ④ 剪贴板不可用（无权限、非安全上下文）时**不改变任何渲染状态**。
                   这是常态不是错误路径，弹错或红框都会让一次无害的点击变成噪音。
-->

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref } from "vue";

import { markdownStreamingKey } from "@/core/markdown/rendering-context";

import MarkdownIcon from "./MarkdownIcon.vue";

const props = defineProps<{ code: string }>();

const copied = ref(false);
const streaming = inject(
  markdownStreamingKey,
  computed(() => false),
);

const resetTimer = ref<ReturnType<typeof setTimeout> | undefined>(undefined);

onBeforeUnmount(() => {
  if (resetTimer.value !== undefined) clearTimeout(resetTimer.value);
});

async function copy() {
  if (streaming.value || copied.value) return;
  try {
    await navigator.clipboard.writeText(props.code);
    copied.value = true;
    resetTimer.value = setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    // 见文件头 ④。
  }
}
</script>

<template>
  <button
    class="text-muted-foreground hover:text-foreground cursor-pointer p-1 transition-all disabled:cursor-not-allowed disabled:opacity-50"
    data-streamdown="code-block-copy-button"
    :disabled="streaming"
    :title="$i18n.t.value.markdown.copyCode"
    type="button"
    @click="copy"
  >
    <MarkdownIcon :name="copied ? 'CheckIcon' : 'CopyIcon'" :size="14" />
  </button>
</template>
