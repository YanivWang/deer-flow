<script setup lang="ts">
defineProps<{ canAsk: boolean }>();
const emit = defineEmits<{ add: []; ask: [] }>();
</script>

<template>
  <div class="message-list__selection-toolbar" data-sidecar-selection-toolbar>
    <button type="button" @click="emit('add')">Add to conversation</button>
    <button v-if="canAsk" type="button" @click="emit('ask')">Ask in side chat</button>
  </div>
</template>
