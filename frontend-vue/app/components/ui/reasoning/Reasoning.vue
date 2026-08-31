<!--
  【文件职责】     推理披露的根（上游 `ai-elements/reasoning.tsx:48` 的 Reasoning）。
  【架构位置】     L2 —— 通用 UI primitive
  【主要导出】     Reasoning 组件
  【依赖关系】     ../collapsible/Collapsible.vue · ./context · @/lib/utils
  【边界与注意】   ① 根就是一个 Collapsible，类名 `not-prose mb-4`，与上游
                   `reasoning.tsx:114` 逐字一致。**外边距只有 mb-4 这一处**——
                   wave 9 把 streaming-reasoning-order 的 Δ 归到「ReasoningDisclosure
                   自身的外边距」，wave 14 的 probe 把两边整棵子树逐个盒子量下来，
                   证明根这一层两边完全相同（都是 y=152 / mb-4=16px），差异全在
                   内容层，见 ReasoningContent.vue。

                   ② **自动收起用 onMounted 而不是 immediate watch。** 上游是
                   `useEffect`，只在客户端跑；本仓此前用 `watch(..., {immediate:true})`,
                   那会在 setup 阶段执行，SSR 渲染时也会挂一个永远不会被读的 timer。
                   onMounted 是 useEffect 的等价物，顺带把这个泄漏堵上。

                   ③ **本仓与上游有一处**有意**的行为分叉：手动开合之后不再自动收起。**
                   上游的 `hasAutoClosed` 只在 timer 真的烧掉时才置位，于是
                   「用户在流式期间手动收起 → 结束后再手动展开」会被 1 秒后的 effect
                   再关一次；用户会看到自己刚打开的东西自己合上。本仓在 toggle 时就
                   置位。这条分叉有单测钉着（tests/unit/chat/processing-message-group
                   .dom.test.ts 的 "auto-closes settled reasoning once and leaves later
                   user toggles alone"），不是抄漏。

                   ④ 上游还有 `open` / `defaultOpen` / `onOpenChange` / `duration` /
                   `startTimeProp` / `onTurnDurationChange` 六个 prop。唯一的调用点
                   （message-list-item.tsx 的两处 `<Reasoning isStreaming={isLoading}>`）
                   一个都没传，defaultOpen 走的就是默认的 true。按 ui/collapsible
                   同一条判据——缺的不是能力，是需求——这里不移植它们。
-->

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from "vue";

import { cn } from "@/lib/utils";

import Collapsible from "../collapsible/Collapsible.vue";
import { reasoningKey } from "./context";

const props = withDefaults(
  defineProps<{ isStreaming?: boolean; class?: string }>(),
  { isStreaming: false, class: "" },
);

/** 上游 `AUTO_CLOSE_DELAY`。 */
const AUTO_CLOSE_DELAY_MS = 1_000;

/** 上游 `defaultOpen = true`。 */
const isOpen = ref(true);
/** 上游 `hasAutoClosed`，外加本仓的手动开合（见文件头③）。 */
let autoCloseSettled = false;
let closeTimer: ReturnType<typeof setTimeout> | undefined;

function clearCloseTimer() {
  if (closeTimer) clearTimeout(closeTimer);
  closeTimer = undefined;
}

/** 上游那个 effect 的 body：只安排收起，从不主动展开。 */
function scheduleAutoClose() {
  clearCloseTimer();
  if (props.isStreaming || !isOpen.value || autoCloseSettled) return;
  closeTimer = setTimeout(() => {
    isOpen.value = false;
    autoCloseSettled = true;
    closeTimer = undefined;
  }, AUTO_CLOSE_DELAY_MS);
}

function handleOpenChange(next: boolean) {
  clearCloseTimer();
  autoCloseSettled = true;
  isOpen.value = next;
}

onMounted(scheduleAutoClose);
watch(() => props.isStreaming, scheduleAutoClose);
onBeforeUnmount(clearCloseTimer);

provide(reasoningKey, { isOpen });

const classes = computed(() => cn("not-prose mb-4", props.class));
</script>

<template>
  <Collapsible :open="isOpen" :class="classes" @update:open="handleOpenChange">
    <slot />
  </Collapsible>
</template>
