<script setup lang="ts">
import { computed, ref, watch } from "vue";

import type { Agent } from "../../../core/api/agents/types";
import type { AgentsGalleryController } from "../../../features/agents/use-agents-gallery";
import {
  DEFAULT_MODEL_VALUE,
  INHERIT_VALUE,
  MAX_AGENT_OUTPUT_TOKENS,
  parseAgentModelSettingsDraft,
  resolveEffectiveModel,
  selectionToThinkingEnabled,
  thinkingEnabledToSelection,
  type ThinkingSelection,
} from "../../../entities/agent/model";

const { t } = useAppI18n();
const props = defineProps<{
  agent: Agent;
  gallery: AgentsGalleryController;
}>();

const model = ref(DEFAULT_MODEL_VALUE);
const temperature = ref("");
const maxTokens = ref("");
const thinking = ref<ThinkingSelection>(INHERIT_VALUE);
const reasoningEffort = ref<string>(INHERIT_VALUE);
const validationError = ref("");

const models = computed(() => props.gallery.modelsQuery.data.value ?? []);
const selectedModel = computed(() => resolveEffectiveModel(models.value, model.value));
const supportsThinking = computed(() => selectedModel.value?.supports_thinking ?? false);
const supportsReasoningEffort = computed(
  () => selectedModel.value?.supports_reasoning_effort ?? false,
);

watch(
  () => props.agent,
  (agent) => {
    model.value = agent.model ?? DEFAULT_MODEL_VALUE;
    temperature.value = agent.model_settings?.temperature == null ? "" : String(agent.model_settings.temperature);
    maxTokens.value = agent.model_settings?.max_tokens == null ? "" : String(agent.model_settings.max_tokens);
    thinking.value = thinkingEnabledToSelection(agent.thinking_enabled);
    reasoningEffort.value = agent.reasoning_effort ?? INHERIT_VALUE;
    validationError.value = "";
  },
  { immediate: true },
);

async function save() {
  const parsed = parseAgentModelSettingsDraft({
    temperature: String(temperature.value),
    maxTokens: String(maxTokens.value),
  });
  if (!parsed.ok) {
    validationError.value = parsed.error === "temperature"
      ? t("agents.settingsInvalidTemperature")
      : t("agents.settingsInvalidMaxTokens");
    return;
  }
  validationError.value = "";
  await props.gallery.saveSettings(props.agent.name, {
    model: model.value === DEFAULT_MODEL_VALUE ? null : model.value,
    model_settings: parsed.modelSettings,
    thinking_enabled: supportsThinking.value ? selectionToThinkingEnabled(thinking.value) : null,
    reasoning_effort: supportsReasoningEffort.value && reasoningEffort.value !== INHERIT_VALUE
      ? reasoningEffort.value as "low" | "medium" | "high"
      : null,
  });
}
</script>

<template>
  <div class="workspace-dialog-backdrop" data-testid="vue-agent-settings-dialog" role="presentation" @click.self="props.gallery.closeSettings">
    <section class="workspace-dialog" role="dialog">
      <header class="settings-dialog-heading">
        <div>
          <h2 id="vue-agent-settings-title">{{ t("agents.settingsTitle") }}</h2>
          <p>{{ t("agents.settingsDescription") }}</p>
        </div>
        <button class="workspace-button workspace-button--ghost" type="button" :disabled="props.gallery.isUpdating.value" @click="props.gallery.closeSettings">
          {{ t("common.cancel") }}
        </button>
      </header>
      <form class="workspace-dialog__fields" novalidate @submit.prevent="save">
        <label class="workspace-field">
          <span>{{ t("agents.settingsModel") }}</span>
          <select v-model="model" data-testid="vue-agent-settings-model">
            <option :value="DEFAULT_MODEL_VALUE">{{ t("agents.settingsModelDefault") }}</option>
            <option v-for="entry in models" :key="entry.name" :value="entry.name">
              {{ entry.display_name || entry.name }}
            </option>
          </select>
        </label>
        <label class="workspace-field">
          <span>{{ t("agents.settingsTemperature") }}</span>
          <input v-model="temperature" data-testid="vue-agent-settings-temperature" type="number" min="0" max="2" step="0.1" :placeholder="t('agents.settingsInherit')">
          <small>{{ t("agents.settingsTemperatureHint") }}</small>
        </label>
        <label class="workspace-field">
          <span>{{ t("agents.settingsMaxTokens") }}</span>
          <input v-model="maxTokens" data-testid="vue-agent-settings-max-tokens" type="number" min="1" :max="MAX_AGENT_OUTPUT_TOKENS" step="1" :placeholder="t('agents.settingsMaxTokensPlaceholder')">
        </label>
        <label v-if="supportsThinking" class="workspace-field">
            <span>{{ t("agents.settingsThinking") }}</span>
          <select v-model="thinking" data-testid="vue-agent-settings-thinking">
            <option :value="INHERIT_VALUE">{{ t("agents.settingsInherit") }}</option>
            <option value="on">{{ t("agents.settingsThinkingOn") }}</option>
            <option value="off">{{ t("agents.settingsThinkingOff") }}</option>
          </select>
        </label>
        <label v-if="supportsReasoningEffort" class="workspace-field">
            <span>{{ t("agents.settingsReasoningEffort") }}</span>
          <select v-model="reasoningEffort" data-testid="vue-agent-settings-reasoning">
            <option :value="INHERIT_VALUE">{{ t("agents.settingsInherit") }}</option>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </label>
        <p v-if="props.gallery.modelsQuery.isError.value" class="workspace-error" data-testid="vue-agent-settings-model-error">
          {{ props.gallery.modelsQuery.error.value instanceof Error ? props.gallery.modelsQuery.error.value.message : "模型列表加载失败。" }}
        </p>
        <p v-if="validationError" class="workspace-error" data-testid="vue-agent-settings-validation" role="alert">{{ validationError }}</p>
        <p v-if="props.gallery.actionError.value" class="workspace-error" data-testid="vue-agent-settings-error" role="alert">{{ props.gallery.actionError.value }}</p>
        <footer class="workspace-dialog__footer">
          <button class="workspace-button workspace-button--ghost" type="button" :disabled="props.gallery.isUpdating.value" @click="props.gallery.closeSettings">{{ t("common.cancel") }}</button>
          <button class="workspace-button workspace-button--primary" data-testid="vue-agent-settings-save" type="submit" :disabled="props.gallery.isUpdating.value">
            {{ props.gallery.isUpdating.value ? t("common.loading") : t("common.save") }}
          </button>
        </footer>
      </form>
    </section>
  </div>
</template>
