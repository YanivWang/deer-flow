<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    colors?: string[];
    speed?: number;
    class?: string;
  }>(),
  {
    colors: () => ["#ff0080", "#7928ca", "#0070f3", "#38bdf8"],
    speed: 1,
    class: "",
  },
);

const gradient = computed(() => {
  const colors = props.colors.length ? props.colors : ["currentColor"];
  return `linear-gradient(135deg, ${[...colors, colors[0]].join(", ")})`;
});
const duration = computed(() => `${10 / Math.max(props.speed, 0.1)}s`);
</script>

<template>
  <span
    class="relative inline-block"
    :class="props.class"
    data-effect="aurora-text"
  >
    <span class="sr-only"><slot /></span>
    <span
      aria-hidden="true"
      class="aurora-text relative bg-clip-text text-transparent"
      :style="{ backgroundImage: gradient, animationDuration: duration }"
    >
      <slot />
    </span>
  </span>
</template>

<style scoped>
.aurora-text {
  background-size: 200% auto;
  animation-name: aurora-shift;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

@keyframes aurora-shift {
  from {
    background-position: 0% 50%;
  }
  to {
    background-position: 200% 50%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .aurora-text {
    animation: none;
    background-position: 50% 50%;
  }
}
</style>
