<script setup lang="ts">
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
