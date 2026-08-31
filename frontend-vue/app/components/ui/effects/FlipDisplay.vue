<!--
  【文件职责】     内容按 key 变化时上下翻页式切换的小窗口。
  【架构位置】     L3 product UI
  【主要导出】     默认 FlipDisplay 组件
  【依赖关系】     Vue Transition · CSS 过渡
  【边界与注意】   上游 `workspace/flip-display.tsx` 用 `motion/react` 的
                   AnimatePresence(mode="wait") + motion.div，本仓**不引入动画库**，
                   用 `<Transition mode="out-in">` 加 CSS 过渡做同一件事：
                   mode="out-in" 就是 AnimatePresence 的 "wait"，key 变了先放旧的
                   exit、再放新的 enter。

                   **稳定态写成静态样式，不靠动画的 fill-mode。** 上游 animate 的终点
                   是 `{ y: 2, opacity: 1 }`，motion 会把它留在内联 style 上——probe
                   实测 React 折叠态下那个 div 是 `transform: matrix(1,0,0,1,0,2)`。
                   如果这里改用 `animation … forwards` 去落到同一个位置，
                   `prefers-reduced-motion` 或动画被跳过时终点就丢了，那 2px 会
                   变成几何差异。写成静态类则与是否播动画无关。

                   对照上下文是 `reducedMotion: "reduce"`，而 motion/react 默认不理会
                   这个媒体特性（要显式 useReducedMotion 才理），所以两边在对照里都
                   走完整过渡的终点。这里也不加 reduced-motion 分支，理由同上：
                   分支只该影响过程，不该影响终点。
-->
<script setup lang="ts">
import { computed } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<{ uniqueKey: string; class?: string }>();

const classes = computed(() => cn("relative overflow-hidden", props.class));
</script>

<template>
  <div :class="classes">
    <Transition name="flip-display" mode="out-in">
      <div :key="props.uniqueKey" class="flip-display__item">
        <slot />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.flip-display__item {
  opacity: 1;
  transform: translateY(2px);
}

.flip-display-enter-active,
.flip-display-leave-active {
  transition:
    opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.flip-display-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.flip-display-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
