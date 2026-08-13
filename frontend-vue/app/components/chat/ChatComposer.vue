<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import {
  ArrowUp,
  FlaskConical,
  Mic,
  Paperclip,
  Sparkles,
  Square,
  WandSparkles,
  X,
} from "lucide-vue-next";
import ReferenceAttachment from "@/components/workspace/sidecar/ReferenceAttachment.vue";
import GoalStatus from "@/components/workspace/GoalStatus.vue";
import type { SidecarReference } from "@/composables/useSidecar";

import {
  buildComposerDraftKey,
  clearComposerDraft,
  getSessionComposerDraftStorage,
  readComposerDraft,
  writeComposerDraft,
} from "@/core/threads/composer-draft";
import { polishInputDraft } from "@/core/input-polish/api";
import { loadSkills } from "@/core/skills/api";
import { RESERVED_SLASH_SKILL_NAMES } from "@/core/skills/slash";
import type { Skill } from "@/core/skills/type";
import { findSuggestionTemplatePlaceholder } from "@/core/suggestions/placeholders";
import { fetch as fetchWithAuth } from "@/core/api/fetcher";
import { getBackendBaseURL } from "@/core/config";
import {
  getUploadLimits,
  uploadFiles,
  type UploadLimits,
} from "@/core/uploads/api";
import {
  formatUploadSize,
  splitUnsupportedUploadFiles,
  validateUploadLimits,
} from "@/core/uploads/file-validation";
import type { FileInMessage } from "@/core/messages/utils";
import { loadModels } from "@/core/models/api";
import type { Model } from "@/core/models/types";
import type { ThreadRunContextInput } from "@/core/threads/submit";
import {
  MAX_GOAL_OBJECTIVE_CHARS,
  parseGoalCommand,
  readGoalResponseError,
} from "@/core/threads/goal";
import type { GoalState } from "@/core/threads/types";
import {
  appendSpeechTranscript,
  getSpeechRecognitionConstructor,
  getSpeechRecognitionLanguage,
  mapSpeechRecognitionError,
  readSpeechRecognitionTranscript,
  shouldRestartSpeechRecognition,
  type BrowserSpeechRecognition,
  type SpeechRecognitionErrorKind,
} from "@/core/voice-input/speech-recognition";

const props = defineProps<{
  threadKey: string;
  targetThreadId: string;
  agentName?: string | null;
  streaming: boolean;
  uploading: boolean;
  promptHistory: string[];
  ensureThread?: () => Promise<string>;
  isWelcome?: boolean;
  references?: SidecarReference[];
  context?: ThreadRunContextInput;
  goal?: GoalState | null;
}>();
const { $i18n } = useNuxtApp();
const emit = defineEmits<{
  send: [text: string, files: FileInMessage[]];
  stop: [];
  uploadingChange: [value: boolean];
  clearReferences: [];
  contextChange: [value: ThreadRunContextInput];
  goalChange: [value: GoalState | null];
}>();

const input = ref("");
const selectedSkill = ref<string | null>(null);
const skills = ref<Skill[]>([]);
const selectedFiles = ref<File[]>([]);
const limits = ref<UploadLimits | undefined>();
const suggestionIndex = ref(0);
const polishOriginal = ref<string | null>(null);
const polishing = ref(false);
const polishController = ref<AbortController | null>(null);
const toast = ref("");
const models = ref<Model[]>([]);
const modelMenu = ref(false);
const modeMenu = ref(false);
const voiceListening = ref(false);
const voiceRecognition = ref<BrowserSpeechRecognition | null>(null);
let voiceBaseText = "";
let voiceLastError: SpeechRecognitionErrorKind | null = null;
let voiceStopRequested = false;
let voiceRestartTimer: ReturnType<typeof setTimeout> | null = null;
const voiceSupported = computed(
  () => import.meta.client && getSpeechRecognitionConstructor(globalThis),
);
const disclaimer = computed(() =>
  $i18n.locale.value === "zh-CN"
    ? "内容由AI生成，重要信息请务必核查"
    : "Deerflow is AI and can make mistakes",
);
const selectedModel = computed(
  () =>
    models.value.find((model) => model.name === props.context?.model_name) ??
    models.value[0],
);
const selectedMode = computed(() => String(props.context?.mode ?? "flash"));
const modes = computed(() => [
  {
    id: "flash",
    label: $i18n.t.value.inputBox.flashMode,
    description: $i18n.t.value.inputBox.flashModeDescription,
    effort: "minimal" as const,
  },
  {
    id: "thinking",
    label: $i18n.t.value.inputBox.reasoningMode,
    description: $i18n.t.value.inputBox.reasoningModeDescription,
    effort: "low" as const,
  },
  {
    id: "pro",
    label: $i18n.t.value.inputBox.proMode,
    description: $i18n.t.value.inputBox.proModeDescription,
    effort: "medium" as const,
  },
  {
    id: "ultra",
    label: $i18n.t.value.inputBox.ultraMode,
    description: $i18n.t.value.inputBox.ultraModeDescription,
    effort: "high" as const,
  },
]);
const textarea = ref<HTMLTextAreaElement | null>(null);
const chipInput = ref<HTMLElement | null>(null);
let historyIndex = -1;
const skillCommandNames = new Set([...RESERVED_SLASH_SKILL_NAMES, "compact"]);

const draftKey = computed(() =>
  buildComposerDraftKey({
    userId: "anonymous",
    agentName: props.agentName,
    threadId: props.threadKey,
  }),
);
const slashQuery = computed(() => {
  if (!input.value.startsWith("/") || input.value.includes("\n")) return null;
  if (selectedSkill.value && !input.value.startsWith("/")) return null;
  const match = /^\/([^\s]*)$/.exec(input.value);
  return match?.[1]?.toLowerCase() ?? null;
});
const suggestions = computed(() => {
  if (slashQuery.value === null) return [];
  const query = slashQuery.value;
  const skillOptions = skills.value
    .filter((skill) => skill.enabled && !skillCommandNames.has(skill.name))
    .filter((skill) => skill.name.includes(query))
    .map((skill) => ({
      name: skill.name,
      label: skill.name,
      kind: "skill" as const,
    }));
  if (selectedSkill.value) return skillOptions;
  const commands = [
    {
      name: "goal",
      label: "Goal — Set, show, or clear an active goal",
      kind: "command" as const,
    },
    {
      name: "compact",
      label: "Compact earlier context",
      kind: "command" as const,
    },
  ].filter((command) => command.name.includes(query));
  return [...skillOptions, ...commands];
});

function persist() {
  writeComposerDraft(getSessionComposerDraftStorage(), draftKey.value, {
    text: input.value,
    skillName: selectedSkill.value,
  });
}
function restore() {
  const draft = readComposerDraft(
    getSessionComposerDraftStorage(),
    draftKey.value,
  );
  input.value = draft?.text ?? "";
  selectedSkill.value = draft?.skillName ?? null;
}
watch(draftKey, restore);
watch([input, selectedSkill], persist);
watch(selectedSkill, async () => {
  await nextTick();
  if (chipInput.value && chipInput.value.innerText !== input.value) {
    chipInput.value.innerText = input.value;
  }
});
watch(suggestions, () => {
  suggestionIndex.value = 0;
});

onMounted(async () => {
  restore();
  try {
    skills.value = await loadSkills();
  } catch {
    skills.value = [];
  }
  try {
    limits.value = await getUploadLimits(props.targetThreadId);
  } catch {
    limits.value = undefined;
  }
  try {
    models.value = (await loadModels()).models;
    if (selectedModel.value && !props.context?.model_name) {
      emit("contextChange", {
        ...props.context,
        model_name: selectedModel.value.name,
      });
    }
  } catch {
    models.value = [];
  }
});

function selectModel(model: Model) {
  emit("contextChange", { ...props.context, model_name: model.name });
  modelMenu.value = false;
}
function selectMode(mode: (typeof modes.value)[number]) {
  emit("contextChange", {
    ...props.context,
    mode: mode.id,
    reasoning_effort: mode.effort,
  });
  modeMenu.value = false;
}
onBeforeUnmount(() => {
  voiceStopRequested = true;
  if (voiceRestartTimer) clearTimeout(voiceRestartTimer);
  voiceRecognition.value?.abort();
});

function voiceErrorMessage(kind: SpeechRecognitionErrorKind) {
  const messages = $i18n.t.value.inputBox;
  switch (kind) {
    case "permission_denied":
      return messages.voiceInputPermissionDenied;
    case "microphone_unavailable":
      return messages.voiceInputMicrophoneUnavailable;
    case "unsupported_language":
      return messages.voiceInputUnsupportedLanguage;
    case "network":
      return messages.voiceInputNetworkError;
    case "no_speech":
      return messages.voiceInputNoSpeech;
    default:
      return messages.voiceInputFailed;
  }
}

function startVoiceRecognition() {
  const Constructor = getSpeechRecognitionConstructor(globalThis);
  if (!Constructor) {
    toast.value = $i18n.t.value.inputBox.voiceInputUnsupported;
    return;
  }
  const recognition = new Constructor();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.lang = getSpeechRecognitionLanguage($i18n.locale.value);
  voiceRecognition.value = recognition;
  voiceBaseText = input.value;
  voiceLastError = null;
  voiceStopRequested = false;
  recognition.onresult = (event) => {
    input.value = appendSpeechTranscript(
      voiceBaseText,
      readSpeechRecognitionTranscript(event.results).text,
    );
  };
  recognition.onerror = (event) => {
    voiceLastError = mapSpeechRecognitionError(event.error);
    if (voiceLastError !== "cancelled" && voiceLastError !== "no_speech") {
      toast.value = voiceErrorMessage(voiceLastError);
    }
  };
  recognition.onend = () => {
    voiceListening.value = false;
    voiceRecognition.value = null;
    if (!voiceStopRequested && shouldRestartSpeechRecognition(voiceLastError)) {
      voiceRestartTimer = setTimeout(startVoiceRecognition, 150);
    }
  };
  try {
    recognition.start();
    voiceListening.value = true;
  } catch {
    voiceRecognition.value = null;
    toast.value = $i18n.t.value.inputBox.voiceInputFailed;
  }
}

function toggleVoiceInput() {
  if (voiceListening.value) {
    voiceStopRequested = true;
    voiceRecognition.value?.stop();
    voiceListening.value = false;
    return;
  }
  startVoiceRecognition();
}

function selectSuggestion() {
  const item = suggestions.value[suggestionIndex.value];
  if (!item) return false;
  if (item.kind === "skill") {
    selectedSkill.value = item.name;
    input.value = "";
    void nextTick(() => chipInput.value?.focus());
  } else {
    input.value = `/${item.name} `;
  }
  return true;
}

async function submit() {
  if (suggestions.value.length > 0 && selectSuggestion()) return;
  const plain = input.value.trim();
  const text = selectedSkill.value
    ? `/${selectedSkill.value}${plain ? ` ${plain}` : ""}`
    : plain;
  if (!text && selectedFiles.value.length === 0) return;
  const placeholder = findSuggestionTemplatePlaceholder(text);
  if (placeholder) {
    await nextTick();
    const element = textarea.value;
    element?.focus();
    element?.setSelectionRange(placeholder.start, placeholder.end);
    return;
  }

  const goalCommand =
    selectedFiles.value.length === 0 ? parseGoalCommand(text) : null;
  if (goalCommand) {
    if (
      goalCommand.kind === "set" &&
      goalCommand.objective.length > MAX_GOAL_OBJECTIVE_CHARS
    ) {
      toast.value = `Goal is too long. Keep it under ${MAX_GOAL_OBJECTIVE_CHARS} characters.`;
      return;
    }
    try {
      const threadId = props.ensureThread
        ? await props.ensureThread()
        : props.targetThreadId;
      const endpoint = `${getBackendBaseURL()}/api/threads/${encodeURIComponent(threadId)}/goal`;
      const response = await fetchWithAuth(endpoint, {
        method:
          goalCommand.kind === "status"
            ? "GET"
            : goalCommand.kind === "clear"
              ? "DELETE"
              : "PUT",
        ...(goalCommand.kind === "set"
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ objective: goalCommand.objective }),
            }
          : {}),
      });
      if (!response.ok) throw new Error(await readGoalResponseError(response));
      const body = (await response.json()) as { goal?: GoalState | null };
      const nextGoal = body.goal ?? null;
      emit("goalChange", nextGoal);
      toast.value =
        goalCommand.kind === "status"
          ? nextGoal
            ? `Active goal: ${nextGoal.objective}`
            : "No active goal."
          : goalCommand.kind === "clear"
            ? "Goal cleared."
            : "Goal set.";
      clearComposerDraft(getSessionComposerDraftStorage(), draftKey.value);
      input.value = "";
      selectedSkill.value = null;
      if (goalCommand.kind === "set") {
        emit("send", goalCommand.objective, []);
      }
      return;
    } catch (cause) {
      toast.value =
        cause instanceof Error ? cause.message : "Goal command failed.";
      return;
    }
  }

  clearComposerDraft(getSessionComposerDraftStorage(), draftKey.value);
  input.value = "";
  selectedSkill.value = null;
  historyIndex = -1;
  const pending = [...selectedFiles.value];
  let uploaded: FileInMessage[] = [];
  if (pending.length > 0) {
    emit("uploadingChange", true);
    try {
      const uploadThreadId = props.ensureThread
        ? await props.ensureThread()
        : props.targetThreadId;
      const response = await uploadFiles(uploadThreadId, pending);
      uploaded = response.files.map((file) => ({
        filename: file.filename,
        size: file.size,
        path: file.virtual_path,
        status: "uploaded",
      }));
    } catch (error) {
      toast.value = error instanceof Error ? error.message : "Upload failed";
      return;
    } finally {
      emit("uploadingChange", false);
    }
  }
  selectedFiles.value = [];
  emit("send", text, uploaded);
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Enter" && event.shiftKey) return;
  if (suggestions.value.length > 0 && event.key === "ArrowDown") {
    event.preventDefault();
    suggestionIndex.value =
      (suggestionIndex.value + 1) % suggestions.value.length;
    return;
  }
  if (suggestions.value.length > 0 && event.key === "ArrowUp") {
    event.preventDefault();
    suggestionIndex.value =
      (suggestionIndex.value - 1 + suggestions.value.length) %
      suggestions.value.length;
    return;
  }
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    void submit();
    return;
  }
  if (
    suggestions.value.length === 0 &&
    event.key === "ArrowUp" &&
    (!input.value || historyIndex >= 0)
  ) {
    event.preventDefault();
    historyIndex = Math.min(historyIndex + 1, props.promptHistory.length - 1);
    input.value =
      props.promptHistory[props.promptHistory.length - 1 - historyIndex] ?? "";
  } else if (
    suggestions.value.length === 0 &&
    event.key === "ArrowDown" &&
    historyIndex >= 0
  ) {
    event.preventDefault();
    historyIndex -= 1;
    input.value =
      historyIndex < 0
        ? ""
        : (props.promptHistory[props.promptHistory.length - 1 - historyIndex] ??
          "");
  }
}

function onChipInput(event: Event) {
  input.value = (event.target as HTMLElement).innerText;
}
function chooseFiles(event: Event) {
  const files = (event.target as HTMLInputElement).files;
  if (!files) return;
  const supported = splitUnsupportedUploadFiles(files);
  const result = validateUploadLimits(
    selectedFiles.value,
    supported.accepted,
    limits.value,
  );
  selectedFiles.value.push(...result.accepted);
  if (supported.message) toast.value = supported.message;
  if (result.violations.length > 0) {
    const violation = result.violations[0]!;
    toast.value = `${violation.files.map((file) => file.name).join(", ")} exceeds ${formatUploadSize(violation.limit)}`;
  }
  (event.target as HTMLInputElement).value = "";
}

async function polish() {
  if (polishOriginal.value !== null) {
    input.value = polishOriginal.value;
    polishOriginal.value = null;
    return;
  }
  if (!input.value.trim()) return;
  polishOriginal.value = input.value;
  polishing.value = true;
  const controller = new AbortController();
  polishController.value = controller;
  try {
    const result = await polishInputDraft(
      { text: input.value },
      { signal: controller.signal },
    );
    if (!controller.signal.aborted) input.value = result.rewritten_text;
  } catch (error) {
    if (!controller.signal.aborted) {
      toast.value =
        error instanceof Error ? error.message : "Failed to polish input";
      polishOriginal.value = null;
    }
  } finally {
    if (polishController.value === controller) {
      polishing.value = false;
      polishController.value = null;
    }
  }
}
function cancelPolish() {
  polishController.value?.abort();
  polishController.value = null;
  polishing.value = false;
  polishOriginal.value = null;
}
function applyResearchTemplate() {
  input.value =
    "Conduct a deep dive research on [topic], and summarize the findings.";
  void nextTick(() => textarea.value?.focus());
}
function replaceDraft(value: string) {
  input.value = value;
  selectedSkill.value = null;
  void nextTick(() => textarea.value?.focus());
}
defineExpose({ replaceDraft });
</script>

<template>
  <div class="relative flex min-w-0 flex-col gap-2">
    <GoalStatus v-if="goal" :goal="goal" />
    <form class="mx-auto w-full" @submit.prevent="submit">
      <ReferenceAttachment
        :references="references ?? []"
        test-id="conversation-quote-attachment"
        clearable
        class="mb-2"
        @clear="emit('clearReferences')"
      />
      <div
        v-if="selectedFiles.length"
        class="mb-2 flex flex-wrap gap-2 text-xs"
      >
        <span
          v-for="file in selectedFiles"
          :key="file.name"
          class="bg-secondary border-border flex items-center gap-1 rounded-lg border px-2 py-1"
        >
          {{ file.name }}
          <button
            type="button"
            :aria-label="`Remove ${file.name}`"
            @click="
              selectedFiles = selectedFiles.filter((item) => item !== file)
            "
          >
            <X :size="12" />
          </button>
        </span>
      </div>
      <div
        class="border-input bg-background/85 relative z-10 rounded-2xl border p-2 shadow-sm backdrop-blur-sm transition-all duration-300"
        :class="polishing ? 'ring-primary/25 shadow-lg ring-1' : ''"
      >
        <div v-if="selectedSkill" class="mb-1 flex items-start gap-2">
          <span class="bg-secondary rounded px-2 py-1 text-xs"
            >/{{ selectedSkill }}</span
          >
          <div
            ref="chipInput"
            role="textbox"
            aria-label="How can I assist you today?"
            contenteditable="true"
            class="min-h-10 flex-1 px-1 py-2 text-sm outline-none"
            @input="onChipInput"
            @keydown="onKeydown"
          />
        </div>
        <textarea
          v-else
          ref="textarea"
          v-model="input"
          name="message"
          aria-label="How can I assist you today?"
          placeholder="How can I assist you today?"
          rows="2"
          class="min-h-16 w-full resize-none bg-transparent px-2 py-2 text-sm leading-6 outline-none"
          :disabled="polishing"
          @keydown="onKeydown"
        />
        <div
          v-if="suggestions.length"
          role="listbox"
          class="bg-background border-border absolute bottom-full left-0 z-20 mb-2 w-80 rounded-lg border p-1 shadow-lg"
        >
          <button
            v-for="(suggestion, index) in suggestions"
            :key="suggestion.name"
            role="option"
            type="button"
            :aria-selected="index === suggestionIndex"
            class="aria-selected:bg-accent block w-full rounded px-3 py-2 text-left text-sm"
            @mousedown.prevent="
              suggestionIndex = index;
              selectSuggestion();
            "
          >
            {{ suggestion.label }}
          </button>
        </div>
        <div
          v-if="polishing"
          class="text-primary bg-primary/10 border-primary/20 mx-2 mb-1 flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
        >
          <span class="size-2 animate-pulse rounded-full bg-current" />
          Polishing input...
        </div>
        <div class="flex min-w-0 items-center gap-1 pt-1">
          <label
            data-testid="add-attachments-button"
            class="group hover:bg-accent text-muted-foreground relative flex size-8 cursor-pointer items-center justify-center rounded-md"
          >
            <Paperclip :size="14" aria-hidden="true" />
            <span class="sr-only">Upload files</span>
            <input
              type="file"
              multiple
              aria-label="Upload files"
              class="sr-only"
              @change="chooseFiles"
            />
            <span
              role="tooltip"
              class="bg-foreground text-background pointer-events-none absolute bottom-full left-0 mb-2 hidden w-56 rounded px-2 py-1 text-xs group-hover:block"
            >
              Up to
              {{ formatUploadSize(limits?.max_file_size ?? 50 * 1024 * 1024) }}
              each,
              {{
                formatUploadSize(limits?.max_total_size ?? 100 * 1024 * 1024)
              }}
              total
            </span>
          </label>
          <button
            data-testid="voice-input-button"
            type="button"
            class="text-muted-foreground hover:bg-accent flex size-8 items-center justify-center rounded-md"
            :class="voiceListening ? 'bg-primary/10 text-primary' : ''"
            :aria-label="
              voiceListening
                ? $i18n.t.value.inputBox.voiceInputStopLabel
                : $i18n.t.value.inputBox.voiceInputStartLabel
            "
            :aria-pressed="voiceListening"
            :title="
              voiceSupported
                ? voiceListening
                  ? $i18n.t.value.inputBox.voiceInputListening
                  : $i18n.t.value.inputBox.voiceInputStart
                : $i18n.t.value.inputBox.voiceInputUnsupported
            "
            :disabled="!voiceSupported || polishing || streaming"
            @click="toggleVoiceInput"
          >
            <Square v-if="voiceListening" :size="12" class="fill-current" />
            <Mic v-else :size="14" />
          </button>
          <button
            type="button"
            class="text-muted-foreground hover:bg-accent hidden h-8 items-center gap-1 rounded-md px-2 text-xs sm:flex"
            aria-label="Research"
            @click="applyResearchTemplate"
          >
            <FlaskConical :size="14" /> Research
          </button>
          <button
            v-if="polishing"
            data-testid="cancel-polish-input-button"
            type="button"
            class="text-muted-foreground hover:bg-accent flex h-8 items-center gap-1 rounded-md px-2 text-xs"
            aria-label="Cancel polishing"
            @click="cancelPolish"
          >
            <X :size="14" /> Cancel
          </button>
          <button
            v-else
            data-testid="polish-input-button"
            type="button"
            class="text-muted-foreground hover:bg-accent flex h-8 items-center gap-1 rounded-md px-2 text-xs"
            :aria-label="
              polishOriginal === null ? 'Polish input' : 'Undo polish'
            "
            @click="polish"
          >
            <WandSparkles :size="14" />
            <span class="hidden sm:inline">{{
              polishOriginal === null ? "Polish" : "Undo"
            }}</span>
          </button>
          <span class="flex-1" />
          <div class="relative">
            <button
              type="button"
              class="hover:bg-accent h-8 rounded-md px-2 text-xs"
              :title="`${modes.find((mode) => mode.id === selectedMode)?.label}: ${modes.find((mode) => mode.id === selectedMode)?.description}`"
              @click="modeMenu = !modeMenu"
            >
              {{ modes.find((mode) => mode.id === selectedMode)?.label }}
            </button>
            <div
              v-if="modeMenu"
              class="bg-background border-border absolute right-0 bottom-full z-30 mb-1 w-72 rounded-md border p-1 shadow"
            >
              <button
                v-for="mode in modes"
                :key="mode.id"
                type="button"
                class="hover:bg-accent block w-full rounded px-2 py-2 text-left"
                @click="selectMode(mode)"
              >
                <span class="block text-sm font-medium">{{ mode.label }}</span>
                <span class="text-muted-foreground block text-xs">{{
                  mode.description
                }}</span>
              </button>
            </div>
          </div>
          <div class="relative">
            <button
              v-if="selectedModel"
              type="button"
              class="hover:bg-accent h-8 max-w-40 truncate rounded-md px-2 text-xs"
              :aria-label="selectedModel.display_name"
              @click="modelMenu = !modelMenu"
            >
              {{ selectedModel.display_name }}
            </button>
            <div
              v-if="modelMenu"
              class="bg-background border-border absolute right-0 bottom-full z-30 mb-1 w-56 rounded-md border p-1 shadow"
            >
              <button
                v-for="model in models"
                :key="model.id"
                type="button"
                class="hover:bg-accent block w-full rounded px-2 py-2 text-left text-sm"
                @click="selectModel(model)"
              >
                {{ model.display_name }}
              </button>
            </div>
          </div>
          <button
            v-if="streaming"
            type="button"
            class="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-full"
            aria-label="Stop"
            @click="emit('stop')"
          >
            <Square :size="12" class="fill-current" />
          </button>
          <button
            v-else
            type="submit"
            class="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-full disabled:opacity-50"
            aria-label="Send"
            :disabled="!input.trim() && selectedFiles.length === 0"
          >
            <ArrowUp :size="16" />
            <span aria-hidden="true" class="sr-only">Submit</span>
          </button>
        </div>
      </div>
    </form>
    <div
      v-if="isWelcome"
      class="flex min-h-12 flex-wrap items-center justify-center gap-2 pt-2"
    >
      <button
        type="button"
        class="text-muted-foreground hover:bg-accent flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs"
        @click="
          replaceDraft(
            'Surprise me with something interesting I can learn today.',
          )
        "
      >
        <Sparkles :size="14" /> Surprise me
      </button>
      <button
        type="button"
        class="text-muted-foreground hover:bg-accent rounded-full border px-4 py-1.5 text-xs"
        @click="applyResearchTemplate"
      >
        Explore
      </button>
      <button
        type="button"
        class="text-muted-foreground hover:bg-accent rounded-full border px-4 py-1.5 text-xs"
        @click="replaceDraft('Create a presentation about [topic].')"
      >
        Create
      </button>
    </div>
    <p class="text-muted-foreground/70 px-4 text-center text-xs leading-4">
      {{ disclaimer }}
    </p>
    <div
      v-if="toast"
      data-sonner-toast
      class="bg-foreground text-background fixed right-5 bottom-5 z-50 rounded-lg px-4 py-3 text-sm shadow"
    >
      {{ toast }}
    </div>
  </div>
</template>
