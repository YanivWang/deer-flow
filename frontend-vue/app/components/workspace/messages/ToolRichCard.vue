<script setup lang="ts">
import type { ToolRichCard } from "../../../core/messages/tool-cards";

defineProps<{
  card: ToolRichCard;
}>();
</script>

<template>
  <section
    class="tool-rich-card"
    :data-kind="card.kind"
    :data-tool-name="card.name"
    data-testid="vue-tool-rich-card"
  >
    <header class="tool-rich-card__header">
      <span class="tool-rich-card__eyebrow">
        {{ card.kind === "assistant-call" ? "工具调用" : "工具结果" }}
      </span>
      <strong data-testid="vue-tool-rich-card-title">{{ card.title }}</strong>
    </header>
    <p
      v-if="card.description"
      class="tool-rich-card__description"
      data-testid="vue-tool-rich-card-description"
    >
      {{ card.description }}
    </p>
    <ul v-if="card.details.length > 0" class="tool-rich-card__details">
      <li v-for="detail in card.details" :key="detail">{{ detail }}</li>
    </ul>
    <pre
      v-if="card.draftPreview"
      class="tool-rich-card__draft"
      data-testid="vue-tool-rich-card-draft"
      :data-language="card.draftPreview.language"
    ><code>{{ card.draftPreview.content }}</code></pre>
  </section>
</template>
