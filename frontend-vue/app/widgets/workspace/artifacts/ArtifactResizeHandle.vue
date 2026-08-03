<script setup lang="ts">
const props = defineProps<{
  axis: "horizontal" | "vertical";
  dragging: boolean;
  open: boolean;
}>();

const emit = defineEmits<{
  pointerdown: [event: PointerEvent];
}>();
</script>

<template>
  <button
    class="workspace-artifacts__resize-handle"
    :class="{ 'workspace-artifacts__resize-handle--vertical': props.axis === 'vertical' }"
    :data-axis="props.axis"
    data-slot="resizable-handle"
    :data-separator="props.dragging ? 'active' : props.open ? 'hover' : 'disabled'"
    type="button"
    @pointerdown="emit('pointerdown', $event)"
  />
</template>
