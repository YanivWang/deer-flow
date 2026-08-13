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
}>();
const { $i18n } = useNuxtApp();
const emit = defineEmits<{
  send: [text: string, files: FileInMessage[]];
  stop: [];
  uploadingChange: [value: boolean];
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
const goal = ref("");
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
});
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

  if (text.startsWith("/goal ")) {
    goal.value = text.slice(6).trim();
    await fetchWithAuth(
      `${getBackendBaseURL()}/api/threads/${encodeURIComponent(props.targetThreadId)}/goal`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective: goal.value }),
      },
    ).catch(() => undefined);
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
  <div class="border-border border-t px-5 py-3">
    <div v-if="goal" class="mx-auto mb-2 max-w-3xl text-sm">
      Goal: <span class="font-medium">{{ goal }}</span>
    </div>
    <form class="mx-auto max-w-3xl" @submit.prevent="submit">
      <div
        v-if="selectedFiles.length"
        class="mb-2 flex flex-wrap gap-2 text-xs"
      >
        <span
          v-for="file in selectedFiles"
          :key="file.name"
          class="bg-secondary rounded px-2 py-1"
          >{{ file.name }}</span
        >
      </div>
      <div
        class="border-input bg-background relative rounded-xl border p-2 shadow-sm"
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
            class="min-h-8 flex-1 px-1 py-1 text-sm outline-none"
            @input="onChipInput"
            @keydown="onKeydown"
          ></div>
        </div>
        <textarea
          v-else
          ref="textarea"
          v-model="input"
          name="message"
          aria-label="How can I assist you today?"
          placeholder="How can I assist you today?"
          rows="2"
          class="w-full resize-none bg-transparent px-2 py-1 text-sm outline-none"
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
        <p v-if="polishing" class="px-2 text-xs text-gray-500">
          Polishing input...
        </p>
        <div class="flex items-center gap-2 pt-1">
          <label
            data-testid="add-attachments-button"
            class="group hover:bg-accent relative cursor-pointer rounded px-2 py-1"
          >
            <span aria-hidden="true">＋</span
            ><span class="sr-only">Upload files</span>
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
            class="hover:bg-accent rounded px-2 py-1 text-xs"
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
            {{ voiceListening ? "■" : "🎙" }}
          </button>
          <button
            type="button"
            class="hover:bg-accent rounded px-2 py-1 text-xs"
            aria-label="Research"
            @click="applyResearchTemplate"
          >
            Research
          </button>
          <button
            v-if="polishing"
            data-testid="cancel-polish-input-button"
            type="button"
            class="hover:bg-accent rounded px-2 py-1 text-xs"
            aria-label="Cancel polishing"
            @click="cancelPolish"
          >
            Cancel
          </button>
          <button
            v-else
            data-testid="polish-input-button"
            type="button"
            class="hover:bg-accent rounded px-2 py-1 text-xs"
            :aria-label="
              polishOriginal === null ? 'Polish input' : 'Undo polish'
            "
            @click="polish"
          >
            {{ polishOriginal === null ? "Polish" : "Undo" }}
          </button>
          <span class="flex-1" />
          <button
            v-if="streaming"
            type="button"
            class="rounded-md border px-3 py-1.5 text-sm"
            @click="emit('stop')"
          >
            Stop
          </button>
          <button
            v-else
            type="submit"
            class="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm"
          >
            Send
          </button>
        </div>
      </div>
    </form>
    <p class="mt-2 text-center text-xs text-gray-500">
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
