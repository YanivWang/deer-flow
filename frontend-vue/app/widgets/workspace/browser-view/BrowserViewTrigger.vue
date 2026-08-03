<script setup lang="ts">
const props = defineProps<{
  enabled: boolean;
  open: boolean;
  sidecarOpen: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
}>();
</script>

<template>
  <button
    v-if="props.enabled"
    class="workspace-button"
    data-testid="browser-trigger"
    type="button"
    @click="emit('toggle')"
  >
    浏览器
  </button>
</template>
