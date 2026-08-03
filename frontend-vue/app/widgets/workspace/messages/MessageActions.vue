<script setup lang="ts">
import type { StreamViewMessage } from "../../../core/stream/view-model";

const props = defineProps<{ canBranch: boolean; displayIndex: number; message: StreamViewMessage; role: "human" | "ai" | "tool" | "error" | "unknown" }>();
const emit = defineEmits<{
  askSideChat: [message: StreamViewMessage, text: string, displayIndex: number];
  editMessage: [message: StreamViewMessage];
  regenerateMessage: [message: StreamViewMessage];
  branchConversation: [message: StreamViewMessage];
}>();
</script>

<template>
  <div v-if="role === 'ai'" class="message-list__actions">
    <button type="button" @click="emit('regenerateMessage', props.message)">Regenerate</button>
    <button v-if="canBranch" type="button" @click="emit('branchConversation', props.message)">Branch conversation</button>
    <button type="button" @click="emit('askSideChat', props.message, props.message.content, displayIndex)">Ask in side chat</button>
  </div>
  <div v-else-if="role === 'human'" class="message-list__actions">
    <button type="button" @click="emit('editMessage', props.message)">Edit and rerun</button>
  </div>
</template>
