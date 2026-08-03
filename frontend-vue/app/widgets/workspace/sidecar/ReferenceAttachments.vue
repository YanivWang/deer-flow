<script setup lang="ts">
const props = defineProps<{
  references: Array<{ label: string; messageId?: string; role: "user" | "assistant"; content: string }>;
}>();

const emit = defineEmits<{
  clear: [];
}>();
</script>

<template>
  <div v-if="props.references.length > 0" class="workspace-chat__reference-attachment" data-testid="sidecar-reference-attachment">
    <span>{{ props.references.length }} selected text fragment{{ props.references.length === 1 ? '' : 's' }}</span>
    <button type="button" @click="emit('clear')">×</button>
  </div>
</template>
