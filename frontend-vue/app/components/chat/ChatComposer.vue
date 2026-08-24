<script setup lang="ts">
/*
  【文件职责】     DeerFlow 输入区，接线技能、上传、模型、模式、目标、语音和发送状态。
  【对应 frontend/】 src/components/workspace/input-box.tsx
  【架构位置】     L3
  【主要导出】     默认 ChatComposer 组件
  【依赖关系】     skills/uploads/models/goal APIs · composer draft · AgentChat
  【边界与注意】   props/events 是当前宿主接线面；通用 composer 行为由 E 组合同约束。
*/
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import {
  ArrowUp,
  Mic,
  Paperclip,
  Square,
  WandSparkles,
  X,
} from "lucide-vue-next";
import ComposerAttachmentChip from "@/components/chat/ComposerAttachmentChip.vue";
import ComposerModelSelector from "@/components/chat/ComposerModelSelector.vue";
import ComposerSurface from "@/components/chat/ComposerSurface.vue";
import WelcomeSuggestionList from "@/components/chat/WelcomeSuggestionList.vue";
import ReferenceAttachment from "@/components/workspace/sidecar/ReferenceAttachment.vue";
import GoalStatus from "@/components/workspace/GoalStatus.vue";
import type { SidecarReference } from "@/composables/useSidecar";
import { useComposerDraft } from "@/composables/useComposerDraft";
import { useModels } from "@/composables/useModels";
import { useSkillsCatalog } from "@/composables/useSkillsCatalog";

import {
  clearComposerDraft,
  getSessionComposerDraftStorage,
} from "@/core/threads/composer-draft";
import { polishInputDraft } from "@/core/input-polish/api";
import { RESERVED_SLASH_SKILL_NAMES } from "@/core/skills/slash";
import { findSuggestionTemplatePlaceholder } from "@/core/suggestions/placeholders";
import { fetch as fetchWithAuth } from "@/core/api/fetcher";
import { isImeComposing } from "@/core/input/ime";
import { getBackendBaseURL } from "@/core/config";
import { getUploadLimits, type UploadLimits } from "@/core/uploads/api";
import {
  formatUploadSize,
  splitUnsupportedUploadFiles,
  validateUploadLimits,
} from "@/core/uploads/file-validation";
import {
  createSubmissionFileCache,
  prepareSubmissionFiles,
} from "@/core/uploads/submission-files";
import type { FileInMessage } from "@/core/messages/utils";
import type { Model } from "@/core/models/types";
import {
  normalizeComposerContext,
  resolveComposerModel,
} from "@/core/models/capabilities";
import type { ThreadRunContextInput } from "@/core/threads/submit";
import {
  MAX_GOAL_OBJECTIVE_CHARS,
  parseGoalCommand,
  readGoalResponseError,
} from "@/core/threads/goal";
import { invalidateThreadCaches } from "@/core/threads/cache-invalidation";
import { isCompactCommand } from "@/core/threads/compact-command";
import { compactThreadContext } from "@/core/threads/api";
import type { GoalState } from "@/core/threads/types";
import { createAsyncGeneration } from "@/core/async/generation";
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

const props = withDefaults(
  defineProps<{
    threadKey: string;
    targetThreadId: string;
    userId?: string | null;
    agentName?: string | null;
    defaultModelName?: string | null;
    modelSelectionReady?: boolean;
    streaming: boolean;
    uploading: boolean;
    promptHistory: string[];
    ensureThread?: () => Promise<string>;
    submitMessage?: (
      text: string,
      files: FileInMessage[],
      options: { onAccepted: () => void },
    ) => Promise<boolean | undefined>;
    isWelcome?: boolean;
    showWelcomeSuggestions?: boolean;
    references?: SidecarReference[];
    context?: ThreadRunContextInput;
    goal?: GoalState | null;
    disabled?: boolean;
  }>(),
  { showWelcomeSuggestions: true },
);
const { $i18n } = useNuxtApp();
const queryClient = useQueryClient();
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
const selectedFiles = ref<File[]>([]);
const limits = ref<UploadLimits | undefined>();
const suggestionIndex = ref(0);
const polishOriginal = ref<string | null>(null);
const polishing = ref(false);
const compactPending = ref(false);
const submissionPending = ref(false);
let compactController: AbortController | null = null;
let compactGeneration = 0;
const polishController = ref<AbortController | null>(null);
let goalController: AbortController | null = null;
const goalGeneration = createAsyncGeneration();
const polishGeneration = createAsyncGeneration();
let submissionGeneration = 0;
const toast = ref("");
const skillCatalog = useSkillsCatalog({
  enabled: computed(() => !props.disabled),
});
const modelCatalog = useModels({ enabled: computed(() => !props.disabled) });
const skills = skillCatalog.skills;
const models = modelCatalog.models;
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
const disclaimer = computed(() => $i18n.t.value.inputBox.disclaimer);
const selectedModel = computed(() => {
  if (props.modelSelectionReady === false) return undefined;
  return resolveComposerModel(
    models.value,
    typeof props.context?.model_name === "string"
      ? props.context.model_name
      : undefined,
    props.defaultModelName,
  );
});
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
const availableModes = computed(() =>
  selectedModel.value?.supports_thinking === true
    ? modes.value
    : modes.value.filter((mode) => mode.id === "flash"),
);
const textarea = ref<HTMLTextAreaElement | null>(null);
const chipInput = ref<HTMLElement | null>(null);
let historyIndex = -1;
const skillCommandNames = new Set([...RESERVED_SLASH_SKILL_NAMES, "compact"]);
const enabledSkillNames = computed(
  () =>
    new Set(
      skills.value.filter((skill) => skill.enabled).map((skill) => skill.name),
    ),
);
const draft = useComposerDraft({
  userId: computed(() => props.userId),
  agentName: computed(() => props.agentName),
  threadId: computed(() => props.threadKey),
  ready: skillCatalog.ready,
  enabledSkillNames,
  text: input,
  skillName: selectedSkill,
});
const draftKey = draft.key;
const filesByDraftKey = new Map<string, File[]>();
const attachmentKeys = new WeakMap<File, number>();
let nextAttachmentKey = 0;
const uploadedByThread = createSubmissionFileCache();
const pendingFollowup = ref<string | null>(null);
let activeSubmissionDraft: {
  key: string;
  text: string;
  skillName: string | null;
} | null = null;
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
      label: `${$i18n.t.value.inputBox.goalLabel} — ${$i18n.t.value.inputBox.goalCommandDescription}`,
      kind: "command" as const,
    },
    {
      name: "compact",
      label: $i18n.t.value.inputBox.compactCommandDescription,
      kind: "command" as const,
    },
  ].filter((command) => command.name.includes(query));
  return [...skillOptions, ...commands];
});

function attachmentKey(file: File) {
  const current = attachmentKeys.get(file);
  if (current !== undefined) return current;
  const key = nextAttachmentKey++;
  attachmentKeys.set(file, key);
  return key;
}

watch(draftKey, (next, previous) => {
  filesByDraftKey.set(previous, [...selectedFiles.value]);
  selectedFiles.value = [...(filesByDraftKey.get(next) ?? [])];
});
watch(
  [() => props.targetThreadId, () => props.threadKey, () => props.agentName],
  () => {
    compactGeneration += 1;
    compactController?.abort();
    compactController = null;
    compactPending.value = false;
    goalController?.abort();
    goalController = null;
    goalGeneration.invalidate();
    polishController.value?.abort();
    polishController.value = null;
    polishGeneration.invalidate();
    polishing.value = false;
    submissionGeneration += 1;
    submissionPending.value = false;
    if (activeSubmissionDraft) {
      draft.cancelSubmission(activeSubmissionDraft);
      activeSubmissionDraft = null;
    }
    emit("uploadingChange", false);
    pendingFollowup.value = null;
  },
);
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
  if (props.disabled) return;
  try {
    limits.value = await getUploadLimits(props.targetThreadId);
  } catch {
    limits.value = undefined;
  }
});

watch(
  [
    models,
    () => props.context,
    () => props.defaultModelName,
    () => props.modelSelectionReady,
  ],
  () => {
    const model = selectedModel.value;
    if (!model) return;
    const normalized = normalizeComposerContext(
      { ...(props.context ?? {}) },
      model,
    );
    if (
      normalized.model_name !== props.context?.model_name ||
      normalized.mode !== props.context?.mode ||
      normalized.reasoning_effort !== props.context?.reasoning_effort
    ) {
      emit("contextChange", normalized);
    }
  },
  { immediate: true },
);

function selectModel(model: Model) {
  emit(
    "contextChange",
    normalizeComposerContext(
      { ...props.context, model_name: model.name },
      model,
    ),
  );
}
function selectMode(mode: (typeof modes.value)[number]) {
  const next = normalizeComposerContext(
    {
      ...props.context,
      mode: mode.id,
      reasoning_effort: mode.effort,
    },
    selectedModel.value,
  );
  emit("contextChange", next);
  modeMenu.value = false;
}
onBeforeUnmount(() => {
  compactGeneration += 1;
  compactController?.abort();
  goalController?.abort();
  goalGeneration.invalidate();
  polishController.value?.abort();
  polishGeneration.invalidate();
  submissionGeneration += 1;
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
  if (props.disabled) return;
  const plain = input.value.trim();
  const text = selectedSkill.value
    ? `/${selectedSkill.value}${plain ? ` ${plain}` : ""}`
    : plain;
  const compactCommand =
    selectedFiles.value.length === 0 && isCompactCommand(text);
  if (!compactCommand && suggestions.value.length > 0 && selectSuggestion())
    return;
  if (!text && selectedFiles.value.length === 0) return;
  const placeholder = findSuggestionTemplatePlaceholder(text);
  if (placeholder) {
    await nextTick();
    const element = textarea.value;
    element?.focus();
    element?.setSelectionRange(placeholder.start, placeholder.end);
    return;
  }

  if (compactCommand) {
    if (compactPending.value) return;
    if (props.isWelcome) {
      clearComposerDraft(getSessionComposerDraftStorage(), draftKey.value);
      input.value = "";
      selectedSkill.value = null;
      toast.value = $i18n.t.value.inputBox.compactSkipped;
      return;
    }
    compactPending.value = true;
    const generation = ++compactGeneration;
    const controller = new AbortController();
    compactController?.abort();
    compactController = controller;
    const targetThreadId = props.targetThreadId;
    try {
      const result = await compactThreadContext(targetThreadId, {
        signal: controller.signal,
        agentName:
          typeof props.context?.agent_name === "string"
            ? props.context.agent_name
            : props.agentName,
        modelName:
          typeof props.context?.model_name === "string"
            ? props.context.model_name
            : null,
      });
      if (
        controller.signal.aborted ||
        generation !== compactGeneration ||
        targetThreadId !== props.targetThreadId
      ) {
        return;
      }
      clearComposerDraft(getSessionComposerDraftStorage(), draftKey.value);
      input.value = "";
      selectedSkill.value = null;
      historyIndex = -1;
      invalidateThreadCaches(queryClient, targetThreadId);
      toast.value = result.compacted
        ? $i18n.t.value.inputBox.compactSuccess
        : result.reason
          ? $i18n.t.value.inputBox.compactNotPerformed(result.reason)
          : $i18n.t.value.inputBox.compactSkipped;
    } catch (error) {
      if (
        !controller.signal.aborted &&
        generation === compactGeneration &&
        targetThreadId === props.targetThreadId
      ) {
        toast.value =
          error instanceof Error
            ? error.message
            : $i18n.t.value.inputBox.compactFailed;
      }
    } finally {
      if (compactController === controller) compactController = null;
      if (generation === compactGeneration) compactPending.value = false;
    }
    return;
  }

  const goalCommand =
    selectedFiles.value.length === 0 ? parseGoalCommand(text) : null;
  if (goalCommand) {
    if (
      goalCommand.kind === "set" &&
      goalCommand.objective.length > MAX_GOAL_OBJECTIVE_CHARS
    ) {
      toast.value = $i18n.t.value.inputBox.goalTooLong.replace(
        "{max}",
        String(MAX_GOAL_OBJECTIVE_CHARS),
      );
      return;
    }
    const scope = `${props.threadKey}\u0000${props.targetThreadId}\u0000${props.agentName ?? "lead-agent"}`;
    const token = goalGeneration.begin(scope);
    const controller = new AbortController();
    goalController?.abort();
    goalController = controller;
    const draftSnapshot = {
      key: draftKey.value,
      text: input.value,
      skillName: selectedSkill.value,
    };
    try {
      const threadId = props.ensureThread
        ? await props.ensureThread()
        : props.targetThreadId;
      if (
        controller.signal.aborted ||
        !goalGeneration.isCurrent(token, scope) ||
        draftKey.value !== draftSnapshot.key
      ) {
        return;
      }
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
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(await readGoalResponseError(response));
      const body = (await response.json()) as { goal?: GoalState | null };
      if (
        controller.signal.aborted ||
        !goalGeneration.isCurrent(token, scope) ||
        draftKey.value !== draftSnapshot.key
      ) {
        return;
      }
      const nextGoal = body.goal ?? null;
      emit("goalChange", nextGoal);
      toast.value =
        goalCommand.kind === "status"
          ? nextGoal
            ? $i18n.t.value.inputBox.goalActive.replace(
                "{goal}",
                nextGoal.objective,
              )
            : $i18n.t.value.inputBox.goalNone
          : goalCommand.kind === "clear"
            ? $i18n.t.value.inputBox.goalCleared
            : $i18n.t.value.inputBox.goalSet;
      if (goalCommand.kind === "set") {
        const onAccepted = () => {
          draft.clearIfUnchanged(draftSnapshot);
        };
        if (props.submitMessage) {
          await props.submitMessage(goalCommand.objective, [], { onAccepted });
        } else {
          emit("send", goalCommand.objective, []);
          onAccepted();
        }
      } else {
        draft.clearIfUnchanged(draftSnapshot);
      }
      return;
    } catch (cause) {
      if (
        !controller.signal.aborted &&
        goalGeneration.isCurrent(token, scope)
      ) {
        toast.value =
          cause instanceof Error
            ? cause.message
            : $i18n.t.value.inputBox.goalFailed;
      }
      return;
    } finally {
      if (goalController === controller) goalController = null;
    }
  }

  if (submissionPending.value) return;
  submissionPending.value = true;
  const generation = ++submissionGeneration;
  const scopeKey = draftKey.value;
  const targetAtStart = props.targetThreadId;
  const draftSnapshot = {
    key: scopeKey,
    text: input.value,
    skillName: selectedSkill.value,
  };
  activeSubmissionDraft = draftSnapshot;
  draft.beginSubmission(draftSnapshot);
  const pending = [...selectedFiles.value];
  try {
    const uploadThreadId = props.ensureThread
      ? await props.ensureThread()
      : props.targetThreadId;
    if (
      generation !== submissionGeneration ||
      scopeKey !== draftKey.value ||
      targetAtStart !== props.targetThreadId
    ) {
      return;
    }
    const hasMissingUploads = pending.some(
      (file) => !uploadedByThread.get(uploadThreadId)?.has(file),
    );
    if (hasMissingUploads) {
      emit("uploadingChange", true);
    }
    const uploaded = await prepareSubmissionFiles({
      threadId: uploadThreadId,
      files: pending,
      cache: uploadedByThread,
    });
    if (
      generation !== submissionGeneration ||
      scopeKey !== draftKey.value ||
      targetAtStart !== props.targetThreadId
    ) {
      return;
    }
    const onAccepted = () => {
      if (generation !== submissionGeneration || scopeKey !== draftKey.value) {
        return;
      }
      draft.clearIfUnchanged(draftSnapshot);
      if (activeSubmissionDraft === draftSnapshot) {
        activeSubmissionDraft = null;
      }
      selectedFiles.value = selectedFiles.value.filter(
        (file) => !pending.includes(file),
      );
      filesByDraftKey.set(scopeKey, [...selectedFiles.value]);
      historyIndex = -1;
    };
    if (props.submitMessage) {
      const dispatched = await props.submitMessage(text, uploaded, {
        onAccepted,
      });
      if (dispatched === false) {
        draft.cancelSubmission(draftSnapshot);
        if (activeSubmissionDraft === draftSnapshot) {
          activeSubmissionDraft = null;
        }
      }
    } else {
      emit("send", text, uploaded);
      onAccepted();
    }
  } catch (error) {
    draft.cancelSubmission(draftSnapshot);
    if (activeSubmissionDraft === draftSnapshot) {
      activeSubmissionDraft = null;
    }
    if (generation === submissionGeneration && scopeKey === draftKey.value) {
      toast.value =
        error instanceof Error
          ? error.message
          : $i18n.t.value.common.requestFailed;
    }
  } finally {
    if (generation === submissionGeneration) {
      emit("uploadingChange", false);
      submissionPending.value = false;
    }
  }
}

const compositionActive = ref(false);

function onKeydown(event: KeyboardEvent) {
  if (isImeComposing(event, compositionActive.value)) return;
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
  selectedFiles.value = [...selectedFiles.value, ...result.accepted];
  if (supported.message) toast.value = supported.message;
  if (result.violations.length > 0) {
    const violation = result.violations[0]!;
    const names = violation.files.map((file) => file.name).join(", ");
    toast.value =
      violation.code === "max_files"
        ? $i18n.t.value.uploads.tooManyFiles(
            violation.files.length,
            violation.limit,
          )
        : violation.code === "max_total_size"
          ? $i18n.t.value.uploads.totalSizeTooLarge(
              violation.files.length,
              formatUploadSize(violation.limit),
            )
          : $i18n.t.value.uploads.filesTooLarge(
              names,
              formatUploadSize(violation.limit),
            );
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
  const original = input.value;
  polishOriginal.value = original;
  polishing.value = true;
  const scope = `${props.threadKey}\u0000${props.targetThreadId}\u0000${props.agentName ?? "lead-agent"}`;
  const token = polishGeneration.begin(scope);
  const controller = new AbortController();
  polishController.value?.abort();
  polishController.value = controller;
  try {
    const result = await polishInputDraft(
      {
        text: original,
        locale: $i18n.locale.value,
        thread_id: props.targetThreadId,
      },
      { signal: controller.signal },
    );
    if (
      !controller.signal.aborted &&
      polishGeneration.isCurrent(token, scope) &&
      input.value === original
    ) {
      input.value = result.rewritten_text;
    }
  } catch (error) {
    if (
      !controller.signal.aborted &&
      polishGeneration.isCurrent(token, scope)
    ) {
      toast.value =
        error instanceof Error
          ? error.message
          : $i18n.t.value.inputBox.inputPolishFailed;
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
  polishGeneration.invalidate();
  polishController.value = null;
  polishing.value = false;
  polishOriginal.value = null;
}
function replaceDraft(value: string) {
  input.value = value;
  selectedSkill.value = null;
  void nextTick(() => textarea.value?.focus());
}
function selectWelcomeSuggestion(value: string) {
  input.value = value;
  selectedSkill.value = null;
  const placeholder = findSuggestionTemplatePlaceholder(value);
  void nextTick(() => {
    requestAnimationFrame(() => {
      if (!textarea.value) return;
      textarea.value.focus();
      if (placeholder) {
        textarea.value.setSelectionRange(placeholder.start, placeholder.end);
      }
    });
  });
}
function offerFollowup(value: string) {
  if (
    !input.value.trim() &&
    !selectedSkill.value &&
    selectedFiles.value.length === 0
  ) {
    replaceDraft(value);
    void nextTick(() => submit());
    return;
  }
  pendingFollowup.value = value;
}
function resolveFollowup(action: "append" | "replace" | "cancel") {
  const value = pendingFollowup.value;
  pendingFollowup.value = null;
  if (!value || action === "cancel") return;
  if (action === "replace") {
    replaceDraft(value);
    void nextTick(() => submit());
    return;
  }
  input.value = input.value.trimEnd()
    ? `${input.value.trimEnd()}\n${value}`
    : value;
  void nextTick(() => submit());
}
function stopRun() {
  compactGeneration += 1;
  compactController?.abort();
  compactController = null;
  compactPending.value = false;
  goalController?.abort();
  goalController = null;
  goalGeneration.invalidate();
  polishController.value?.abort();
  polishController.value = null;
  polishGeneration.invalidate();
  polishing.value = false;
  polishOriginal.value = null;
  submissionGeneration += 1;
  submissionPending.value = false;
  if (activeSubmissionDraft) {
    draft.cancelSubmission(activeSubmissionDraft);
    activeSubmissionDraft = null;
  }
  emit("uploadingChange", false);
  emit("stop");
}
defineExpose({ replaceDraft, offerFollowup });
</script>

<template>
  <div
    class="relative flex min-w-0 flex-col"
    :class="isWelcome ? 'gap-4' : 'gap-2'"
  >
    <GoalStatus v-if="goal" :goal="goal" />
    <div
      v-if="pendingFollowup"
      role="dialog"
      aria-modal="true"
      :aria-label="$i18n.t.value.inputBox.followupConfirmTitle"
      class="border-border bg-background absolute right-0 bottom-full left-0 z-50 mb-2 rounded-xl border p-4 shadow-lg"
    >
      <h3 class="text-sm font-semibold">
        {{ $i18n.t.value.inputBox.followupConfirmTitle }}
      </h3>
      <p class="text-muted-foreground mt-1 text-xs">
        {{ $i18n.t.value.inputBox.followupConfirmDescription }}
      </p>
      <p class="bg-muted mt-3 rounded-md p-2 text-sm">{{ pendingFollowup }}</p>
      <div class="mt-3 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-md border px-3 py-1.5 text-xs"
          @click="resolveFollowup('cancel')"
        >
          {{ $i18n.t.value.common.cancel }}
        </button>
        <button
          type="button"
          class="rounded-md border px-3 py-1.5 text-xs"
          @click="resolveFollowup('append')"
        >
          {{ $i18n.t.value.inputBox.followupConfirmAppend }}
        </button>
        <button
          type="button"
          class="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs"
          @click="resolveFollowup('replace')"
        >
          {{ $i18n.t.value.inputBox.followupConfirmReplace }}
        </button>
      </div>
    </div>
    <form
      class="mx-auto w-full"
      :class="disabled ? 'pointer-events-none opacity-60' : ''"
      :aria-disabled="disabled"
      :aria-busy="compactPending || submissionPending"
      @submit.prevent="submit"
    >
      <ReferenceAttachment
        :references="references ?? []"
        test-id="conversation-quote-attachment"
        clearable
        class="mb-2"
        @clear="emit('clearReferences')"
      />
      <ComposerSurface
        :class="polishing ? 'ring-primary/25 shadow-lg ring-1' : ''"
      >
        <div
          v-if="selectedFiles.length"
          data-testid="composer-attachments"
          class="flex flex-wrap items-center gap-1 px-1 pt-1 pb-0"
        >
          <ComposerAttachmentChip
            v-for="file in selectedFiles"
            :key="attachmentKey(file)"
            :file="file"
            @remove="
              selectedFiles = selectedFiles.filter((item) => item !== file)
            "
          />
        </div>
        <div v-if="selectedSkill" class="mb-1 flex items-start gap-2">
          <span class="bg-secondary rounded px-2 py-1 text-xs"
            >/{{ selectedSkill }}</span
          >
          <div
            ref="chipInput"
            role="textbox"
            data-slot="input-group-control"
            :aria-label="$i18n.t.value.inputBox.placeholder"
            :contenteditable="disabled ? 'false' : 'true'"
            class="min-h-10 flex-1 px-1 py-2 text-sm outline-none focus-visible:ring-0 focus-visible:outline-none"
            @input="onChipInput"
            @keydown="onKeydown"
            @compositionstart="compositionActive = true"
            @compositionend="compositionActive = false"
          />
        </div>
        <textarea
          v-else
          ref="textarea"
          v-model="input"
          name="message"
          data-slot="input-group-control"
          :aria-label="$i18n.t.value.inputBox.placeholder"
          :placeholder="$i18n.t.value.inputBox.placeholder"
          rows="2"
          class="min-h-16 w-full resize-none bg-transparent px-2 py-2 text-sm leading-6 outline-none focus-visible:ring-0 focus-visible:outline-none"
          :disabled="disabled || polishing || compactPending"
          @keydown="onKeydown"
          @compositionstart="compositionActive = true"
          @compositionend="compositionActive = false"
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
          {{ $i18n.t.value.inputBox.inputPolishing }}
        </div>
        <div class="flex min-w-0 items-center gap-1 pt-1">
          <label
            data-testid="add-attachments-button"
            class="group hover:bg-accent text-muted-foreground relative flex size-8 cursor-pointer items-center justify-center rounded-md"
          >
            <Paperclip :size="14" aria-hidden="true" />
            <span class="sr-only">{{
              $i18n.t.value.inputBox.uploadFiles
            }}</span>
            <input
              type="file"
              multiple
              :aria-label="$i18n.t.value.inputBox.uploadFiles"
              class="sr-only"
              @change="chooseFiles"
            />
            <span
              role="tooltip"
              class="bg-foreground text-background pointer-events-none absolute bottom-full left-0 mb-2 hidden w-56 rounded px-2 py-1 text-xs group-hover:block"
            >
              {{
                $i18n.t.value.uploads.limitsHint(
                  limits?.max_files ?? 10,
                  formatUploadSize(limits?.max_file_size ?? 50 * 1024 * 1024),
                  formatUploadSize(limits?.max_total_size ?? 100 * 1024 * 1024),
                )
              }}
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
            v-if="polishing"
            data-testid="cancel-polish-input-button"
            type="button"
            class="text-muted-foreground hover:bg-accent flex h-8 items-center gap-1 rounded-md px-2 text-xs"
            :aria-label="$i18n.t.value.inputBox.inputPolishCancel"
            @click="cancelPolish"
          >
            <X :size="14" /> {{ $i18n.t.value.common.cancel }}
          </button>
          <button
            v-else
            data-testid="polish-input-button"
            type="button"
            class="text-muted-foreground hover:bg-accent flex h-8 items-center gap-1 rounded-md px-2 text-xs"
            :aria-label="
              polishOriginal === null
                ? $i18n.t.value.inputBox.inputPolish
                : $i18n.t.value.inputBox.inputPolishUndo
            "
            @click="polish"
          >
            <WandSparkles :size="14" />
            <span class="hidden sm:inline">{{
              polishOriginal === null
                ? $i18n.t.value.inputBox.inputPolish
                : $i18n.t.value.inputBox.inputPolishUndo
            }}</span>
          </button>
          <span class="flex-1" />
          <div class="relative">
            <button
              type="button"
              class="hover:bg-accent h-8 rounded-md px-2 text-xs"
              :title="`${availableModes.find((mode) => mode.id === selectedMode)?.label}: ${availableModes.find((mode) => mode.id === selectedMode)?.description}`"
              @click="modeMenu = !modeMenu"
            >
              {{
                availableModes.find((mode) => mode.id === selectedMode)?.label
              }}
            </button>
            <div
              v-if="modeMenu"
              class="bg-background border-border absolute right-0 bottom-full z-30 mb-1 w-72 rounded-md border p-1 shadow"
            >
              <button
                v-for="mode in availableModes"
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
          <ComposerModelSelector
            :models="models"
            :selected-model="selectedModel"
            @select="selectModel"
          />
          <button
            v-if="streaming"
            type="button"
            class="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-full"
            :aria-label="$i18n.t.value.inputBox.stop"
            @click="stopRun"
          >
            <Square :size="12" class="fill-current" />
          </button>
          <button
            v-else
            type="submit"
            class="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-full disabled:opacity-50"
            :aria-label="$i18n.t.value.inputBox.send"
            :disabled="
              disabled ||
              compactPending ||
              submissionPending ||
              (!input.trim() && selectedFiles.length === 0)
            "
          >
            <ArrowUp :size="16" />
            <span aria-hidden="true" class="sr-only">{{
              $i18n.t.value.inputBox.submit
            }}</span>
          </button>
        </div>
      </ComposerSurface>
    </form>
    <WelcomeSuggestionList
      v-if="
        isWelcome &&
        showWelcomeSuggestions !== false &&
        !selectedSkill &&
        suggestions.length === 0
      "
      :disabled="disabled"
      @select="selectWelcomeSuggestion"
    />
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
