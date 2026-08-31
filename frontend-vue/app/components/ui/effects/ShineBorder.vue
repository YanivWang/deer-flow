<script setup lang="ts">
/*
  【文件职责】     渲染消息卡片使用的流光边框。
  【架构位置】     L3 product UI
  【主要导出】     默认 ShineBorder 组件
  【依赖关系】     Vue computed · CSS 动画
  【边界与注意】   M7 视觉效果，不进入 M8 L2 公共集合。
*/
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    borderWidth?: number;
    duration?: number;
    shineColor?: string | string[];
  }>(),
  { borderWidth: 1, duration: 14, shineColor: "#000000" },
);
const colors = computed(() =>
  Array.isArray(props.shineColor)
    ? props.shineColor.join(",")
    : props.shineColor,
);
</script>

<template>
  <div
    data-effect="shine-border"
    aria-hidden="true"
    class="shine-border pointer-events-none absolute inset-0 size-full rounded-[inherit]"
    :style="{
      '--border-width': `${borderWidth}px`,
      '--duration': `${duration}s`,
      backgroundImage: `radial-gradient(transparent, transparent, ${colors}, transparent, transparent)`,
    }"
  />
</template>

<style scoped>
.shine-border {
  padding: var(--border-width);
  background-size: 300% 300%;
  mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  will-change: background-position;
}

/*
  上游是 `motion-safe:animate-shine`，也就是**只在 no-preference 下才有动画**，
  减动偏好下整条 animation 不存在、background-position 停在 CSS 初始值 `0% 0%`。
  此前这里写的是「总是动 + reduce 时 animation:none 并把 background-position 挪到
  50% 50%」——动画开关一致，但静止时停的位置不一样，于是同一份减动偏好下两边的
  流光边框亮在不同的地方。对照上下文正是 reducedMotion: "reduce"，只是这条差异
  落在 background-position 上，台账不取样它。
*/
@media (prefers-reduced-motion: no-preference) {
  .shine-border {
    animation: shine-border var(--duration) infinite linear;
  }
}

@keyframes shine-border {
  0% {
    background-position: 0% 0%;
  }
  50% {
    background-position: 100% 100%;
  }
  100% {
    background-position: 0% 0%;
  }
}
</style>
