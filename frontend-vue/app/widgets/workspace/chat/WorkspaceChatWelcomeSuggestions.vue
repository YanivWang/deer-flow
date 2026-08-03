<script setup lang="ts">
type WelcomeSuggestion = {
  label: string;
  prompt: string;
};

defineProps<{
  suggestions: WelcomeSuggestion[];
}>();

const emit = defineEmits<{
  select: [prompt: string];
}>();

const { t } = useAppI18n();
</script>

<template>
  <div class="workspace-chat__suggestions" data-slot="suggestions-list">
    <button type="button" @click="emit('select', t('inputBox.surpriseMePrompt'))">
      {{ t("inputBox.surpriseMe") }}
    </button>
    <button
      v-for="suggestion in suggestions"
      :key="suggestion.label"
      type="button"
      @click="emit('select', suggestion.prompt)"
    >
      {{ suggestion.label }}
    </button>
  </div>
  <small class="workspace-chat__disclaimer">{{ t("inputBox.disclaimer") }}</small>
</template>
