<script setup lang="ts">
import type { ToolRichCard as ToolRichCardModel } from "../../../core/messages/tool-cards";
import ToolRichCard from "./ToolRichCard.vue";

defineProps<{ cards: ToolRichCardModel[] }>();
const emit = defineEmits<{ selectArtifact: [path: string] }>();
</script>

<template>
  <div v-if="cards.length > 0" class="message-list__tool-cards">
    <ToolRichCard
      v-for="card in cards"
      :key="`${card.kind}-${card.id ?? card.name}-${card.title}`"
      :card="card"
      @select-artifact="emit('selectArtifact', $event)"
    />
  </div>
</template>
