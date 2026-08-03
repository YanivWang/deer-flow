<script setup lang="ts">
import { Brain, ChevronDown } from "lucide-vue-next";

const props = defineProps<{ content: string; streaming?: boolean }>();
const open = ref(false);
</script>

<template>
  <section class="message-list__reasoning" data-testid="vue-message-reasoning">
    <button type="button" class="message-list__reasoning-trigger" :aria-expanded="open" @click="open = !open">
      <Brain :size="16" aria-hidden="true" />
      {{ props.streaming ? "思考中…" : "思考过程" }}
      <ChevronDown :size="16" class="message-list__reasoning-chevron" :class="{ 'is-open': open }" aria-hidden="true" />
    </button>
    <p v-if="open">{{ props.content }}</p>
  </section>
</template>
