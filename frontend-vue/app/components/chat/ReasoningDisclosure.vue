<script setup lang="ts">
/*
  【文件职责】     渲染终态 assistant reasoning，并复刻流式自动展开、settle 后一次性收起。
  【架构位置】     L3 chat UI adapter
  【主要导出】     默认 ReasoningDisclosure 组件
  【依赖关系】     StreamMarkdown · core/markdown/safe-markdown
  【边界与注意】   自动收起只发生一次；用户之后手动展开不得再次被 timer 关闭。
*/
import { onBeforeUnmount, ref, watch } from "vue";
import { Brain, ChevronDown } from "lucide-vue-next";

import MessageMarkdown from "@/components/chat/MessageMarkdown.vue";

const props = defineProps<{
  content: string;
  streaming: boolean;
  markdownComponents?: Record<string, unknown>;
}>();
const { $i18n } = useNuxtApp();
const open = ref(true);
let autoClosed = false;
let closeTimer: ReturnType<typeof setTimeout> | undefined;

function clearCloseTimer() {
  if (closeTimer) clearTimeout(closeTimer);
  closeTimer = undefined;
}

watch(
  () => props.streaming,
  (streaming) => {
    clearCloseTimer();
    if (streaming) {
      open.value = true;
      return;
    }
    if (!open.value || autoClosed) return;
    closeTimer = setTimeout(() => {
      open.value = false;
      autoClosed = true;
      closeTimer = undefined;
    }, 1_000);
  },
  { immediate: true },
);

function toggle() {
  clearCloseTimer();
  autoClosed = true;
  open.value = !open.value;
}

onBeforeUnmount(clearCloseTimer);
</script>

<template>
  <div class="not-prose mb-4">
    <button
      type="button"
      class="text-muted-foreground hover:text-foreground flex w-full items-center gap-2 text-sm transition-colors"
      :aria-expanded="open"
      @click="toggle"
    >
      <Brain :size="16" />
      <span>{{ $i18n.t.value.runDuration.reasoning }}</span>
      <ChevronDown
        :size="16"
        class="transition-transform"
        :class="open ? 'rotate-180' : 'rotate-0'"
      />
    </button>
    <div v-if="open" class="text-muted-foreground mt-2 text-sm leading-relaxed">
      <MessageMarkdown
        :content="content"
        :components="markdownComponents"
        :streaming="streaming"
      />
    </div>
  </div>
</template>
