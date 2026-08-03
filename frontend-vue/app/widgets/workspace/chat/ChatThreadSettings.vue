<script setup lang="ts">
import type { ChatThreadSettingsController } from "../../../features/chat/thread-settings/use-chat-thread-settings";

const props = defineProps<{
  controller: ChatThreadSettingsController;
  isWelcomeMode: boolean;
}>();

const { t } = useAppI18n();

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readMode(value: unknown): "flash" | "thinking" | "pro" | "ultra" | "" {
  return value === "flash" || value === "thinking" || value === "pro" || value === "ultra" ? value : "";
}
</script>

<template>
  <section v-if="!props.isWelcomeMode" class="workspace-settings" data-testid="vue-thread-settings">
    <div class="workspace-settings__header">
      <h2>{{ t("common.settings") }}</h2>
      <a-button size="small" data-testid="vue-thread-settings-reset" @click="props.controller.resetContext">Reset</a-button>
    </div>
    <label class="workspace-settings__field">
      <span>{{ t("inputBox.searchModels") }}</span>
      <a-input :value="readString(props.controller.effectiveContext.value.model_name)" :placeholder="t('inputBox.searchModels')" data-testid="vue-thread-settings-model" @update:value="props.controller.updateModelName(String($event))" />
    </label>
    <label class="workspace-settings__field">
      <span>{{ t("inputBox.mode") }}</span>
      <select :value="readMode(props.controller.effectiveContext.value.mode)" data-testid="vue-thread-settings-mode" @change="props.controller.updateMode(($event.target as HTMLSelectElement).value)">
        <option value="" />
        <option value="flash">{{ t("inputBox.flashMode") }}</option>
        <option value="thinking">Reasoning mode</option>
        <option value="pro">Pro</option>
        <option value="ultra">Ultra</option>
      </select>
    </label>
    <label class="workspace-settings__field">
      <span>{{ t("inputBox.reasoningEffort") }}</span>
      <select :value="readString(props.controller.effectiveContext.value.reasoning_effort) || ''" data-testid="vue-thread-settings-reasoning" @change="props.controller.updateReasoningEffort(($event.target as HTMLSelectElement).value)">
        <option value="" />
        <option value="minimal">{{ t("inputBox.reasoningEffortMinimal") }}</option>
        <option value="low">{{ t("inputBox.reasoningEffortLow") }}</option>
        <option value="medium">{{ t("inputBox.reasoningEffortMedium") }}</option>
        <option value="high">{{ t("inputBox.reasoningEffortHigh") }}</option>
      </select>
    </label>
    <label class="workspace-settings__check">
      <input type="checkbox" :checked="props.controller.effectiveContext.value.thinking_enabled === true" data-testid="vue-thread-settings-thinking" @change="props.controller.updateThinkingEnabled(($event.target as HTMLInputElement).checked)">
      <span>Reasoning enabled</span>
    </label>
    <label class="workspace-settings__check">
      <input type="checkbox" :checked="props.controller.effectiveContext.value.subagent_enabled === true" data-testid="vue-thread-settings-subagent" @change="props.controller.updateSubagentEnabled(($event.target as HTMLInputElement).checked)">
      <span>{{ t("inputBox.ultraMode") }}</span>
    </label>
  </section>
</template>
