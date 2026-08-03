<script setup lang="ts">
import { nextTick, onUpdated, ref } from "vue";
import MessageContentRenderer from "../messages/MessageContentRenderer.vue";

type SidecarMessage = { role: string; content: string; id?: string };

const props = defineProps<{
  messages: SidecarMessage[];
  selectionText: string;
}>();

const emit = defineEmits<{
  addSelectedReference: [];
  selection: [message: SidecarMessage];
}>();

const messageScroll = ref<HTMLElement | null>(null);

onUpdated(async () => {
  await nextTick();
  if (messageScroll.value) messageScroll.value.scrollTop = messageScroll.value.scrollHeight;
});
</script>

<template>
  <div class="workspace-sidecar__messages" data-testid="sidecar-message-list">
    <div ref="messageScroll" class="workspace-sidecar__scroll-container">
      <div v-if="props.selectionText" class="message-list__selection-toolbar" data-sidecar-selection-toolbar>
        <button type="button" @click="emit('addSelectedReference')">Add to conversation</button>
      </div>
      <article v-for="message in props.messages" :key="message.id ?? `${message.role}:${message.content}`" :data-role="message.role" @mouseup="emit('selection', message)">
        <MessageContentRenderer
          :content="message.content"
          :message-role="message.role === 'ai' || message.role === 'assistant' ? 'ai' : 'unknown'"
        />
      </article>
    </div>
  </div>
</template>
