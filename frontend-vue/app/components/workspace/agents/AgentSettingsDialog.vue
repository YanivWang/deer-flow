<script setup lang="ts">
/*
  【文件职责】     用真实 /api/models capability 编辑 Agent 模型与生成参数。
  【对应 frontend/】 components/workspace/agents/agent-settings-dialog.tsx
  【架构位置】     L3 Agent settings component
  【主要导出】     默认 AgentSettingsDialog
  【依赖关系】     agents/settings · agents/types · models/types · i18n
  【边界与注意】   pending 时锁定冲突操作；失败不关闭；unsupported capability 由 exact payload 清空。
*/
import { computed, ref, watch } from "vue";

import {
  DEFAULT_AGENT_MODEL_VALUE,
  buildAgentSettingsUpdatePayload,
  resolveAgentSettingsModel,
  type AgentReasoningSelection,
  type AgentThinkingSelection,
} from "@/core/agents/settings";
import type { Agent, UpdateAgentRequest } from "@/core/agents/types";
import type { Model } from "@/core/models/types";

const props = defineProps<{
  agent: Agent;
  models: readonly Model[];
  modelsLoading?: boolean;
  modelError?: string;
  pending?: boolean;
  submitError?: string;
}>();
const emit = defineEmits<{
  cancel: [];
  save: [request: UpdateAgentRequest];
}>();
const { $i18n } = useNuxtApp();
const model = ref(DEFAULT_AGENT_MODEL_VALUE);
// Vue deliberately casts v-model values from number inputs to numbers in the
// browser, while reset starts from serialized API strings.
const temperature = ref<string | number>("");
const maxTokens = ref<string | number>("");
const thinking = ref<AgentThinkingSelection>("inherit");
const reasoningEffort = ref<AgentReasoningSelection>("inherit");
const validationError = ref("");

function reset(agent: Agent) {
  model.value = agent.model ?? DEFAULT_AGENT_MODEL_VALUE;
  temperature.value = agent.model_settings?.temperature?.toString() ?? "";
  maxTokens.value = agent.model_settings?.max_tokens?.toString() ?? "";
  thinking.value =
    agent.thinking_enabled == null
      ? "inherit"
      : agent.thinking_enabled
        ? "on"
        : "off";
  reasoningEffort.value = agent.reasoning_effort ?? "inherit";
  validationError.value = "";
}
watch(() => props.agent, reset, { immediate: true });

const selectedModel = computed(() =>
  resolveAgentSettingsModel(props.models, model.value),
);
const unknownCurrentModel = computed(
  () =>
    props.agent.model !== null &&
    !props.models.some((item) => item.name === props.agent.model),
);
const supportsThinking = computed(
  () => selectedModel.value?.supports_thinking === true,
);
const supportsReasoning = computed(
  () => selectedModel.value?.supports_reasoning_effort === true,
);

function save() {
  validationError.value = "";
  const result = buildAgentSettingsUpdatePayload(props.models, {
    model: model.value,
    temperature: temperature.value,
    maxTokens: maxTokens.value,
    thinking: thinking.value,
    reasoningEffort: reasoningEffort.value,
  });
  if (!result.ok) {
    validationError.value =
      result.error === "temperature"
        ? $i18n.t.value.agents.settingsInvalidTemperature
        : result.error === "max_tokens"
          ? $i18n.t.value.agents.settingsInvalidMaxTokens
          : $i18n.t.value.agents.settingsInvalidModel;
    return;
  }
  emit("save", result.request);
}
</script>

<template>
  <div
    role="dialog"
    :aria-label="$i18n.t.value.agents.settingsTitle"
    aria-modal="true"
    class="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-4"
  >
    <form
      novalidate
      class="bg-background w-full max-w-md space-y-4 rounded-xl border p-5"
      @submit.prevent="save"
    >
      <div>
        <h2 class="text-lg font-semibold">
          {{ $i18n.t.value.agents.settingsTitle }} · {{ agent.name }}
        </h2>
        <p class="text-muted-foreground mt-1 text-sm">
          {{ $i18n.t.value.agents.settingsDescription }}
        </p>
      </div>

      <p
        v-if="modelsLoading"
        role="status"
        class="text-muted-foreground text-sm"
      >
        {{ $i18n.t.value.agents.settingsModelsLoading }}
      </p>
      <p v-if="modelError" role="alert" class="text-sm text-red-600">
        {{ modelError }}
      </p>
      <label class="block text-sm">
        {{ $i18n.t.value.agents.settingsModel }}
        <select
          v-model="model"
          data-testid="agent-settings-model"
          class="border-input mt-1 w-full rounded-md border px-3 py-2"
          :disabled="pending || modelsLoading"
        >
          <option :value="DEFAULT_AGENT_MODEL_VALUE">
            {{ $i18n.t.value.agents.settingsModelDefault }}
          </option>
          <option v-if="unknownCurrentModel" :value="agent.model!" disabled>
            {{ agent.model }} ·
            {{ $i18n.t.value.agents.settingsModelUnavailable }}
          </option>
          <option v-for="item in models" :key="item.name" :value="item.name">
            {{ item.display_name || item.name }}
          </option>
        </select>
      </label>

      <label class="block text-sm">
        {{ $i18n.t.value.agents.settingsTemperature }}
        <input
          v-model="temperature"
          data-testid="agent-settings-temperature"
          type="number"
          min="0"
          max="2"
          step="0.1"
          class="border-input mt-1 w-full rounded-md border px-3 py-2"
          :disabled="pending"
        />
        <span class="text-muted-foreground mt-1 block text-xs">
          {{ $i18n.t.value.agents.settingsTemperatureHint }}
        </span>
      </label>
      <label class="block text-sm">
        {{ $i18n.t.value.agents.settingsMaxTokens }}
        <input
          v-model="maxTokens"
          data-testid="agent-settings-max-tokens"
          type="number"
          min="1"
          max="200000"
          class="border-input mt-1 w-full rounded-md border px-3 py-2"
          :placeholder="$i18n.t.value.agents.settingsMaxTokensPlaceholder"
          :disabled="pending"
        />
      </label>
      <label v-if="supportsThinking" class="block text-sm">
        {{ $i18n.t.value.agents.settingsThinking }}
        <select
          v-model="thinking"
          data-testid="agent-settings-thinking"
          class="border-input mt-1 w-full rounded-md border px-3 py-2"
          :disabled="pending"
        >
          <option value="inherit">
            {{ $i18n.t.value.agents.settingsInherit }}
          </option>
          <option value="on">
            {{ $i18n.t.value.agents.settingsThinkingOn }}
          </option>
          <option value="off">
            {{ $i18n.t.value.agents.settingsThinkingOff }}
          </option>
        </select>
      </label>
      <label v-if="supportsReasoning" class="block text-sm">
        {{ $i18n.t.value.agents.settingsReasoningEffort }}
        <select
          v-model="reasoningEffort"
          data-testid="agent-settings-reasoning"
          class="border-input mt-1 w-full rounded-md border px-3 py-2"
          :disabled="pending"
        >
          <option value="inherit">
            {{ $i18n.t.value.agents.settingsInherit }}
          </option>
          <option value="low">
            {{ $i18n.t.value.agents.settingsReasoningLow }}
          </option>
          <option value="medium">
            {{ $i18n.t.value.agents.settingsReasoningMedium }}
          </option>
          <option value="high">
            {{ $i18n.t.value.agents.settingsReasoningHigh }}
          </option>
        </select>
      </label>

      <p
        v-if="validationError || submitError"
        role="alert"
        class="text-sm text-red-600"
      >
        {{ validationError || submitError }}
      </p>
      <div class="flex justify-end gap-2">
        <button
          type="button"
          class="rounded-md border px-3 py-2"
          :disabled="pending"
          @click="emit('cancel')"
        >
          {{ $i18n.t.value.agents.settingsCancel }}
        </button>
        <button
          type="button"
          data-testid="agent-settings-save"
          class="bg-primary text-primary-foreground rounded-md px-3 py-2"
          :disabled="pending || modelsLoading || Boolean(modelError)"
          @click="save"
        >
          {{
            pending
              ? $i18n.t.value.agents.settingsSaving
              : $i18n.t.value.agents.settingsSave
          }}
        </button>
      </div>
    </form>
  </div>
</template>
