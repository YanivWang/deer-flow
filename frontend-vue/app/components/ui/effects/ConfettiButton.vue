<script setup lang="ts">
/*
  【文件职责】     在按钮交互上附加受控 confetti 效果。
  【架构位置】     L3 product UI
  【主要导出】     默认 ConfettiButton 组件
  【依赖关系】     canvas-confetti · ./confetti
  【边界与注意】   M7 视觉效果，不进入 M8 L2 公共集合。
*/
import { Button } from "@/components/ui/button";
import { emitConfettiFrom } from "./confetti";

const props = withDefaults(
  defineProps<{
    angle?: number;
    particleCount?: number;
    startVelocity?: number;
    spread?: number;
    variant?:
      "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
    size?: "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg";
    class?: string;
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
  }>(),
  {
    angle: 90,
    particleCount: 36,
    startVelocity: 35,
    spread: 70,
    variant: "default",
    size: "default",
    class: "",
    type: "button",
    disabled: false,
  },
);
const emit = defineEmits<{ click: [event: MouseEvent] }>();

function onClick(event: MouseEvent) {
  emitConfettiFrom(event.currentTarget as HTMLElement, props);
  emit("click", event);
}
</script>

<template>
  <Button
    :variant="variant"
    :size="size"
    :class="props.class"
    :type="type"
    :disabled="disabled"
    data-effect="confetti-button"
    @click="onClick"
  >
    <slot />
  </Button>
</template>
