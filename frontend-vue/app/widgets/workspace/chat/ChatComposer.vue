<script setup lang="ts">
import { useQuery } from "@tanstack/vue-query";
import { computed, onBeforeUnmount, ref, shallowRef } from "vue";
import { ArrowUp, GraduationCap, Mic, Paperclip, Sparkles, X } from "lucide-vue-next";

import { listModels, type ModelProfile } from "../../../core/api/models/client";
import type { ChatThreadSettingsController } from "../../../features/chat/thread-settings/use-chat-thread-settings";

import WorkspaceChatWelcomeSuggestions from "./WorkspaceChatWelcomeSuggestions.vue";

type SkillSuggestion = { name: string };
type WelcomeSuggestion = { label: string; prompt: string };
type ConversationReference = { label: string; messageId?: string; role: "user" | "assistant"; content: string };
type Attachment = { file: File };
type UploadLimits = { max_files: number; max_file_size: number; max_total_size: number };
type PolishUndo = { originalText: string; rewrittenText: string } | null;
type ChatMode = "flash" | "thinking" | "pro" | "ultra";
type SpeechRecognitionResult = { 0?: { transcript?: string } };
type SpeechRecognitionEventLike = { results: ArrayLike<SpeechRecognitionResult> };
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

const props = defineProps<{
  attachmentErrorMessage: string;
  attachmentTooltipVisible: boolean;
  attachments: Attachment[];
  conversationReferences: ConversationReference[];
  draft: string;
  editingMessageId: string | null;
  formatUploadSize: (bytes: number) => string;
  isBusy: boolean;
  isWelcomeMode: boolean;
  matchingSkills: SkillSuggestion[];
  polishingInput: boolean;
  polishUndo: PolishUndo;
  selectedSlashSkill: string | null;
  skillSuggestionIndex: number;
  uploadLimits: UploadLimits;
  welcomeSuggestions: WelcomeSuggestion[];
  threadSettings: ChatThreadSettingsController;
}>();

const emit = defineEmits<{
  addAttachment: [event: Event];
  attachmentTooltipVisible: [];
  cancelEdit: [];
  cancelPolish: [];
  clearReferences: [];
  clearAttachmentTooltip: [];
  editableInput: [event: Event];
  keydown: [event: KeyboardEvent];
  polish: [];
  selectSkill: [name: string];
  selectSuggestion: [prompt: string];
  submit: [];
  updateAndRerun: [];
  "update:draft": [value: string];
}>();

const { t } = useAppI18n();
const modeMenuOpen = ref(false);
const modelMenuOpen = ref(false);
const reasoningMenuOpen = ref(false);
const modelSearch = ref("");
const reasoningEfforts = ["minimal", "low", "medium", "high"] as const;
const quickSuggestionsVisible = ref(true);
const voiceListening = ref(false);
const voiceRecognition = shallowRef<SpeechRecognitionLike | null>(null);
const voiceBaseText = ref("");
const quickSuggestions = [
  "浪漫小页面那个怎么做的？",
  "有什么好玩的新AI工具推荐吗？",
  "你都能帮我做什么呀？",
];
const modelsQuery = useQuery({
  queryKey: ["models"],
  queryFn: listModels,
});

const models = computed(() => modelsQuery.data.value ?? []);
const voiceSupported = computed(() => {
  if (typeof window === "undefined") return false;
  const speechWindow = window as SpeechRecognitionWindow;
  return Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition);
});
const selectedModel = computed(() => {
  const selectedName = props.threadSettings.effectiveContext.value.model_name;
  return models.value.find((model) => model.name === selectedName) ?? models.value[0] ?? null;
});
// Keep the configured Pro state visible while the model list is loading. Once
// the API responds, the selected model's capability is authoritative.
const supportsThinking = computed(() => selectedModel.value?.supports_thinking ?? true);
const selectedMode = computed(() => {
  const mode = props.threadSettings.effectiveContext.value.mode;
  if (mode === "thinking" && !supportsThinking.value) return "flash";
  return mode === "flash" || mode === "thinking" || mode === "ultra" ? mode : supportsThinking.value ? "pro" : "flash";
});
const visibleModes = computed<Array<{ value: ChatMode; label: string; description: string }>>(() => {
  const modes: Array<{ value: ChatMode; label: string; description: string }> = [
    { value: "flash", label: t("inputBox.flashMode"), description: t("inputBox.flashModeDescription") },
    { value: "thinking", label: t("inputBox.reasoningMode"), description: t("inputBox.reasoningModeDescription") },
    { value: "pro", label: t("inputBox.proMode"), description: t("inputBox.proModeDescription") },
    { value: "ultra", label: t("inputBox.ultraMode"), description: t("inputBox.ultraModeDescription") },
  ];
  return modes.filter((mode) => mode.value !== "thinking" || supportsThinking.value);
});
const filteredModels = computed(() => {
  const query = modelSearch.value.trim().toLocaleLowerCase();
  if (!query) return models.value;
  return models.value.filter((model) =>
    [model.name, model.model, model.display_name].some((value) => value?.toLocaleLowerCase().includes(query)),
  );
});

function selectMode(mode: ChatMode) {
  props.threadSettings.updateMode(mode);
  props.threadSettings.updateReasoningEffort(
    mode === "ultra"
      ? "high"
      : mode === "pro"
        ? "medium"
        : mode === "thinking"
          ? "low"
          : "minimal",
  );
  modeMenuOpen.value = false;
}

function selectReasoningEffort(effort: (typeof reasoningEfforts)[number]) {
  props.threadSettings.updateReasoningEffort(effort);
  reasoningMenuOpen.value = false;
}

function selectModel(model: ModelProfile) {
  props.threadSettings.updateModelName(model.name);
  modelMenuOpen.value = false;
  reasoningMenuOpen.value = false;
  modelSearch.value = "";
}

function stopVoiceInput() {
  voiceRecognition.value?.stop();
  voiceRecognition.value = null;
  voiceListening.value = false;
}

function toggleVoiceInput() {
  if (!voiceSupported.value) return;
  if (voiceListening.value) {
    stopVoiceInput();
    return;
  }
  const speechWindow = window as SpeechRecognitionWindow;
  const Constructor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
  if (!Constructor) return;
  const recognition = new Constructor();
  voiceBaseText.value = props.draft;
  recognition.lang = "zh-CN";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.onresult = (event) => {
    const transcript = Array.from({ length: event.results.length }, (_, index) => event.results[index]?.[0]?.transcript ?? "").join("");
    emit("update:draft", `${voiceBaseText.value}${voiceBaseText.value && transcript ? " " : ""}${transcript}`);
  };
  recognition.onerror = () => {
    stopVoiceInput();
  };
  recognition.onend = () => {
    voiceRecognition.value = null;
    voiceListening.value = false;
  };
  voiceRecognition.value = recognition;
  voiceListening.value = true;
  recognition.start();
}

onBeforeUnmount(stopVoiceInput);
</script>

<template>
  <div
    v-if="!props.isWelcomeMode && quickSuggestionsVisible && !props.isBusy && props.draft.trim() === ''"
    class="workspace-chat__quick-suggestions"
    data-testid="vue-chat-quick-suggestions"
  >
    <button
      v-for="suggestion in quickSuggestions"
      :key="suggestion"
      type="button"
      @click="emit('selectSuggestion', suggestion); emit('submit')"
    >
      {{ suggestion }}
    </button>
    <button type="button" aria-label="关闭" @click="quickSuggestionsVisible = false">
      <X :size="16" aria-hidden="true" />
    </button>
  </div>
  <form class="workspace-chat__composer" :class="{ 'workspace-chat__composer--welcome': props.isWelcomeMode }" @submit.prevent="emit('submit')">
    <div v-if="props.conversationReferences.length > 0" class="workspace-chat__reference-attachment" data-testid="conversation-quote-attachment">
      <span>{{ props.conversationReferences.length }} selected text fragment{{ props.conversationReferences.length === 1 ? '' : 's' }}</span>
      <button type="button" data-testid="clear-conversation-references" @click="emit('clearReferences')">×</button>
    </div>
    <div v-if="props.editingMessageId" class="workspace-chat__editing-banner">
      Editing a message
      <button type="button" @click="emit('cancelEdit')">Cancel edit</button>
      <button type="button" @click="emit('updateAndRerun')">Update and rerun</button>
    </div>
    <div v-if="props.selectedSlashSkill" class="workspace-chat__selected-skill">/{{ props.selectedSlashSkill }}</div>
    <ul v-if="props.matchingSkills.length > 0" class="workspace-chat__skill-suggestions">
      <li v-for="(skill, skillIndex) in props.matchingSkills" :key="skill.name">
        <button
          type="button"
          :disabled="props.isBusy || props.polishingInput"
          role="option"
          :class="{ 'workspace-chat__skill-suggestion--selected': skillIndex === props.skillSuggestionIndex }"
          v-bind="{ [(['aria', 'selected'].join('-'))]: skillIndex === props.skillSuggestionIndex }"
          @click="emit('selectSkill', skill.name)"
        >
          /{{ skill.name }}
        </button>
      </li>
    </ul>
    <a-textarea
      v-if="!props.selectedSlashSkill"
      class="workspace-chat__composer-input"
      :value="props.draft"
      name="message"
      :disabled="props.isBusy || props.polishingInput"
      :auto-size="{ minRows: 2, maxRows: 6 }"
      :placeholder="t('inputBox.placeholder')"
      data-testid="vue-chat-input"
      @update:value="emit('update:draft', String($event))"
      @keydown="emit('keydown', $event)"
    />
    <div
      v-else
      class="workspace-chat__skill-editor"
      contenteditable="true"
      role="textbox"
      :title="t('inputBox.placeholder')"
      :data-placeholder="t('inputBox.placeholder')"
      @input="emit('editableInput', $event)"
      @keydown="emit('keydown', $event)"
    >{{ props.draft }}</div>
    <div class="workspace-chat__composer-tools">
      <label
        class="workspace-chat__attachment-button"
        aria-label="添加附件"
        data-testid="add-attachments-button"
        @mouseenter="emit('attachmentTooltipVisible')"
        @mouseleave="emit('clearAttachmentTooltip')"
      >
        <Paperclip :size="18" aria-hidden="true" />
        <span class="sr-only">Upload files</span>
        <input type="file" multiple hidden @change="emit('addAttachment', $event)">
      </label>
      <button
        class="workspace-chat__voice-button"
        type="button"
        aria-label="语音输入"
        :aria-pressed="voiceListening"
        :disabled="props.isBusy || props.polishingInput || !voiceSupported"
        @click="toggleVoiceInput"
      >
        <Mic :size="18" aria-hidden="true" />
      </button>
      <button
        class="workspace-chat__polish-button"
        data-testid="polish-input-button"
        type="button"
        :disabled="props.polishingInput || !props.draft.trim()"
        :title="props.polishUndo && props.draft === props.polishUndo.rewrittenText ? 'Undo polish' : 'Polish input'"
        @click="emit('polish')"
      >
        <Sparkles :size="18" aria-hidden="true" />
        <span class="sr-only">{{ props.polishUndo && props.draft === props.polishUndo.rewrittenText ? "Undo polish" : "Polish input" }}</span>
      </button>
      <span v-if="props.attachmentTooltipVisible" role="tooltip">
        {{ props.uploadLimits.max_files }} files · {{ props.formatUploadSize(props.uploadLimits.max_file_size) }} each · {{ props.formatUploadSize(props.uploadLimits.max_total_size) }} total
      </span>
      <span v-if="props.polishingInput" role="status">Polishing input...</span>
      <button v-if="props.polishingInput" data-testid="cancel-polish-input-button" type="button" @click="emit('cancelPolish')">
        Cancel polishing
      </button>
    </div>
    <div v-if="props.attachments.length > 0" class="workspace-chat__attachments">
      <span v-for="attachment in props.attachments" :key="attachment.file.name" class="workspace-chat__attachment">
        {{ attachment.file.name }}
      </span>
    </div>
    <div class="workspace-chat__submit-controls">
      <div class="workspace-chat__menu-wrap">
        <button
          class="workspace-chat__mode-button"
          data-testid="vue-chat-mode-selector"
          type="button"
          :disabled="props.isBusy || props.polishingInput"
          :aria-expanded="modeMenuOpen"
          aria-haspopup="menu"
          @click="modeMenuOpen = !modeMenuOpen; modelMenuOpen = false; reasoningMenuOpen = false"
        >
          <GraduationCap :size="16" aria-hidden="true" />
          {{ visibleModes.find((mode) => mode.value === selectedMode)?.label }}
        </button>
        <div v-if="modeMenuOpen" class="workspace-chat__menu" data-testid="vue-chat-mode-menu" role="menu">
          <button
            v-for="mode in visibleModes"
            :key="mode.value"
            class="workspace-chat__menu-item"
            :class="{ 'workspace-chat__menu-item--selected': mode.value === selectedMode }"
            role="menuitemradio"
            :aria-checked="mode.value === selectedMode"
            type="button"
            @click="selectMode(mode.value)"
          >
            <span>
              <strong>{{ mode.label }}</strong>
              <small>{{ mode.description }}</small>
            </span>
            <span v-if="mode.value === selectedMode" aria-hidden="true">✓</span>
          </button>
        </div>
      </div>
      <div class="workspace-chat__menu-wrap workspace-chat__model-menu-wrap">
        <button
          class="workspace-chat__model-button"
          data-main-model-selector
          data-testid="main-model-selector"
          type="button"
          :aria-expanded="modelMenuOpen"
          aria-haspopup="listbox"
          @click="modelMenuOpen = !modelMenuOpen; modeMenuOpen = false"
        >
          {{ selectedModel?.display_name || selectedModel?.name || "DeepSeek V4 Pro" }}
        </button>
        <div v-if="modelMenuOpen" class="workspace-chat__menu workspace-chat__model-menu" data-testid="vue-chat-model-menu" role="dialog">
          <input
            v-model="modelSearch"
            class="workspace-chat__model-search"
            :placeholder="t('inputBox.searchModels')"
            aria-label="Search models"
            data-testid="vue-chat-model-search"
          >
          <div role="listbox" aria-label="Models">
            <button
              v-for="model in filteredModels"
              :key="model.name"
              class="workspace-chat__menu-item"
              :class="{ 'workspace-chat__menu-item--selected': model.name === selectedModel?.name }"
              role="option"
              :aria-selected="model.name === selectedModel?.name"
              type="button"
              @click="selectModel(model)"
            >
              <span>
                <strong>{{ model.display_name || model.name }}</strong>
                <small>{{ model.model }}</small>
              </span>
              <span v-if="model.name === selectedModel?.name" aria-hidden="true">✓</span>
            </button>
            <p v-if="modelsQuery.isLoading.value" class="workspace-chat__menu-empty">{{ t("common.loading") }}</p>
            <p v-else-if="filteredModels.length === 0" class="workspace-chat__menu-empty">{{ t("common.search") }}</p>
          </div>
        </div>
      </div>
      <div v-if="selectedMode !== 'flash'" class="workspace-chat__menu-wrap">
        <button
          class="workspace-chat__mode-button"
          data-testid="vue-thread-settings-reasoning"
          type="button"
          :disabled="props.isBusy || props.polishingInput"
          :aria-expanded="reasoningMenuOpen"
          aria-haspopup="menu"
          @click="reasoningMenuOpen = !reasoningMenuOpen; modeMenuOpen = false; modelMenuOpen = false"
        >
          {{ t("inputBox.reasoningEffort") }}:
          {{ t(`inputBox.reasoningEffort${(props.threadSettings.effectiveContext.value.reasoning_effort ?? 'medium').charAt(0).toUpperCase()}${(props.threadSettings.effectiveContext.value.reasoning_effort ?? 'medium').slice(1)}`) }}
        </button>
        <div v-if="reasoningMenuOpen" class="workspace-chat__menu" data-testid="vue-thread-settings-reasoning-menu" role="menu">
          <button
            v-for="effort in reasoningEfforts"
            :key="effort"
            class="workspace-chat__menu-item"
            :class="{ 'workspace-chat__menu-item--selected': effort === (props.threadSettings.effectiveContext.value.reasoning_effort ?? 'medium') }"
            role="menuitemradio"
            :aria-checked="effort === (props.threadSettings.effectiveContext.value.reasoning_effort ?? 'medium')"
            type="button"
            :data-testid="`vue-thread-settings-reasoning-${effort}`"
            @click="selectReasoningEffort(effort)"
          >
            <span>
              <strong>{{ t(`inputBox.reasoningEffort${effort.charAt(0).toUpperCase()}${effort.slice(1)}`) }}</strong>
              <small>{{ t(`inputBox.reasoningEffort${effort.charAt(0).toUpperCase()}${effort.slice(1)}Description`) }}</small>
            </span>
            <span v-if="effort === (props.threadSettings.effectiveContext.value.reasoning_effort ?? 'medium')" aria-hidden="true">✓</span>
          </button>
        </div>
      </div>
      <a-button type="primary" html-type="submit" :disabled="!props.draft.trim() || props.isBusy || props.polishingInput" data-testid="vue-chat-send">
        <ArrowUp :size="18" aria-hidden="true" />
        <span class="sr-only">Submit</span>
      </a-button>
    </div>
  </form>
  <WorkspaceChatWelcomeSuggestions
    v-if="props.isWelcomeMode"
    :suggestions="props.welcomeSuggestions"
    @select="emit('selectSuggestion', $event)"
  />
  <div v-if="props.attachmentErrorMessage" data-sonner-toast role="status">{{ props.attachmentErrorMessage }}</div>
</template>
