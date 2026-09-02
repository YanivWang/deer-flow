<script setup lang="ts">
/*
  【文件职责】     DeerFlow 输入区，接线技能、上传、模型、模式、目标、语音和发送状态。
  【架构位置】     L3
  【主要导出】     默认 ChatComposer 组件
  【依赖关系】     skills/uploads/models/goal APIs · composer draft · AgentChat
  【边界与注意】   props/events 是当前宿主接线面；通用 composer 行为由 E 组合同约束。
*/
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  shallowRef,
  watch,
} from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import {
  ArrowUp,
  Mic,
  Paperclip,
  Sparkles,
  Square,
  Target,
  WandSparkles,
  X,
} from "lucide-vue-next";
import ComposerAttachmentChip from "@/components/chat/ComposerAttachmentChip.vue";
import ComposerModelSelector from "@/components/chat/ComposerModelSelector.vue";
import ModeHoverGuide from "@/components/chat/ModeHoverGuide.vue";
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
import { canPolishInput } from "@/core/input-polish/can-polish";
import { polishInputDraft } from "@/core/input-polish/api";
import {
  getLeadingSlashQuery,
  getMatchingSlashSuggestions,
  type SlashSuggestion,
} from "@/core/skills/slash-suggestions";
import { findSuggestionTemplatePlaceholder } from "@/core/suggestions/placeholders";
import { fetch as fetchWithAuth } from "@/core/api/fetcher";
import { isImeComposing } from "@/core/input/ime";
import { getBackendBaseURL } from "@/core/config";
import { useUploadLimits } from "@/composables/useUploads";
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
  getGoalObjectiveCounter,
  MAX_GOAL_OBJECTIVE_CHARS,
  parseGoalCommand,
  readGoalResponseError,
} from "@/core/threads/goal";
import { invalidateThreadCaches } from "@/core/threads/cache-invalidation";
import { isCompactCommand } from "@/core/threads/compact-command";
import { isCompleteBuiltinCommand } from "@/core/threads/builtin-command";
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
    /*
      只加在输入框外框上的 class。欢迎态的 -translate-y 属于**输入框本身**，不属于
      整个 composer——React 把它拼进 PromptInput 的 className（见 chat-page.tsx 传给
      InputBox 的 className 与 input-box.tsx 里 PromptInput 的 cn(...)），于是输入框往上
      挪、下面的建议行与免责声明留在原地。挂到根节点上会把整叠一起搬走，间距就不对了。
    */
    surfaceClass?: string;
  }>(),
  { showWelcomeSuggestions: true, surfaceClass: "" },
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
/*
  限额走 Vue Query，不再在 onMounted 里裸调一次 getUploadLimits。

  React 用的就是 useUploadLimits（frontend/src/core/uploads/hooks.ts），键是
  ["uploads","limits",threadId]。本仓这一处原来绕开了缓存，于是同一条 thread 的限额
  会被问两遍——输入框一次、sidecar 会话一次，两次问的是同一个 id、拿到的是同一份答案。
  换成同一个 owner 之后它们共享一次请求，也共享 60s 的 staleTime。
*/
const limitsQuery = useUploadLimits(() =>
  props.disabled ? "" : props.targetThreadId,
);
const limits = computed(() => limitsQuery.data.value);
const suggestionIndex = ref(0);
const polishOriginal = ref<string | null>(null);
const polishing = ref(false);
const compactPending = ref(false);
const submissionPending = ref(false);
let compactController: AbortController | null = null;
let compactGeneration = 0;
/*
  shallowRef 不是风格选择。`ref()` 会对普通对象调 reactive()，而"是不是普通对象"
  的判据是 `Object.prototype.toString.call(x)`：浏览器与 Node 的 AbortController
  带 Symbol.toStringTag，念出来是 `[object AbortController]`，reactive() 直接放行，
  于是 `polishController.value === controller` 成立；**happy-dom 的 AbortController
  没有这个 tag**，念出来是 `[object Object]`，于是它被包成 Proxy，那句身份比较
  在单测里恒为 false——finally 里的 `polishing.value = false` 一次都没跑过，
  组件测试里润色永远停在"润色中"。产物没问题，是测试环境看不见完成态。
  shallowRef 让两个环境同一行为，也本来就够用：控制器没有需要追踪的响应式字段。
*/
const polishController = shallowRef<AbortController | null>(null);
let goalController: AbortController | null = null;
const goalGeneration = createAsyncGeneration();
const polishGeneration = createAsyncGeneration();
let submissionGeneration = 0;
const toast = ref("");
const skillCatalog = useSkillsCatalog({
  enabled: computed(() => !props.disabled),
});
/*
  **不按 disabled 关掉。** 上游 input-box.tsx:356 是裸的 `useModels()`。关掉它的后果
  不是少发一个请求，而是模式与模型这两颗触发器的**文字来源没了**：模式触发器只在
  `context.mode` 是四个合法值之一时才写字，而 context.mode 是模型目录到位后由
  「自动选模型」那一步写进去的（上游 getResolvedMode(undefined, supportsThinking)
  给出 "pro"）；模型触发器写的是 selectedModel.display_name。目录不来，两颗按钮
  就都是空的——可访问性树上是两颗**没有名字**的按钮。
*/
const modelCatalog = useModels();
const skills = skillCatalog.skills;
const models = modelCatalog.models;
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
/*
  「用户真的选过的模式」与「兜底展示用的模式」是两件事，React 也把它们分开
  （frontend/src/components/workspace/input-box.tsx）：触发器上的文字与菜单里的勾
  都直接读 context.mode，没选过就**什么都不显示**；只有 hover 说明用 flash 兜底。

  Vue 原来只有一个带兜底的 selectedMode，于是一个从没被选中、也从没发给后端的
  「Flash」被同时写在按钮上和菜单里——界面在替用户回答一个他没回答过的问题。
*/
const MODE_IDS = ["flash", "thinking", "pro", "ultra"] as const;
const explicitMode = computed(() => {
  const mode = props.context?.mode;
  return typeof mode === "string" &&
    (MODE_IDS as readonly string[]).includes(mode)
    ? mode
    : "";
});
const selectedMode = computed(() => explicitMode.value || "flash");
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
/*
  触发器的文案和 hover 说明必须来自同一条记录。原来模板里对同一个 find 调用了
  三次（标签一次、native title 的两段各一次），改一处漏两处是迟早的事。
  没有匹配项时回落到第一个可用模式，这样触发器永远有名字。
*/
const activeMode = computed(
  () =>
    availableModes.value.find((mode) => mode.id === selectedMode.value) ??
    availableModes.value[0] ??
    modes.value[0]!,
);
const textarea = ref<HTMLTextAreaElement | null>(null);
const chipInput = ref<HTMLElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
let historyIndex = -1;
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
const builtinSlashCommands = computed<SlashSuggestion[]>(() => [
  {
    name: "goal",
    description: $i18n.t.value.inputBox.goalCommandDescription,
    kind: "builtin",
  },
  {
    name: "compact",
    description: $i18n.t.value.inputBox.compactCommandDescription,
    kind: "builtin",
  },
]);
const slashQuery = computed(() => getLeadingSlashQuery(input.value));
const suggestions = computed<SlashSuggestion[]>(() => {
  if (slashQuery.value === null) return [];
  const matches = getMatchingSlashSuggestions(
    skills.value,
    slashQuery.value,
    builtinSlashCommands.value,
  );
  /*
    内建命令拥有**整行**，所以不能跟技能激活叠在一起：选中技能之后再选 `/goal`，
    提交出去的是一句聊天文本而不是命令。所以这里把它们从结果里去掉，而不是不喂给
    helper——helper 需要这份清单去预留它们的名字（叫这个名字的技能同样够不着，
    理由镜像：它提交出去运行的是命令而不是那个技能）。
  */
  return selectedSkill.value
    ? matches.filter(({ kind }) => kind === "skill")
    : matches;
});
/*
  焦点态与「关掉过」是显示条件的一部分，不是可有可无的装饰（上游
  input-box.tsx:1322 的 showSkillSuggestions）。本仓原来只看 `suggestions.length`，
  于是这个浮层**关不掉**：Escape 没有分支，点走焦点也不消失，它就一直盖在会话流上。

  记的是**当时那行文本**而不是一个裸布尔。记布尔的话，Escape 之后再敲一个字符
  列表也回不来了——而用户按 Escape 想说的是「这一行我不需要提示」，不是
  「这个会话里别再提示我」。文本一变（继续打字、退格），条件自然不再成立。
*/
const textareaFocused = ref(false);
const dismissedSuggestionValue = ref<string | null>(null);
const showSuggestions = computed(
  () =>
    props.disabled !== true &&
    textareaFocused.value &&
    slashQuery.value !== null &&
    suggestions.value.length > 0 &&
    dismissedSuggestionValue.value !== input.value,
);

/*
  润色按钮的可用性判据，与 React 的 inputPolishDisabled 一一对应
  （frontend/src/components/workspace/input-box.tsx）。撤销态是唯一的例外：
  已经润色过之后，即使正在流式输出、即使草稿被清空，「撤销」也必须还能按，
  否则用户没有回到原文的路。
*/
const polishUndoAvailable = computed(
  () => !polishing.value && polishOriginal.value !== null,
);
/*
  `/goal <objective>` 写到接近上限时，工具条右侧出现一个 length/max 计数器
  （上游 input-box.tsx:2649）。可访问名走词典，数字本身是可见文本。
*/
const goalObjectiveCounter = computed(() =>
  getGoalObjectiveCounter(input.value),
);

const polishDisabled = computed(
  () =>
    props.disabled === true ||
    polishing.value ||
    (!polishUndoAvailable.value &&
      (props.streaming === true ||
        slashQuery.value !== null ||
        !canPolishInput(input.value))),
);

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
/*
  重置活动项的依赖跟上游一致（input-box.tsx:1538 的 [slashSkillQuery,
  skillSuggestions.length]），不是整个数组。数组身份每次重算都变，而 hover 会改
  suggestionIndex——盯着数组身份重置，等于把鼠标刚移上去的那一项又弹回第一项。
*/
watch([slashQuery, () => suggestions.value.length], () => {
  suggestionIndex.value = 0;
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
/* 推理强度是 mode 之外的**第二个**选择器，不是 mode 的显示名。
   mode 只给出一个起点（flash→minimal、thinking→low、pro→medium、ultra→high），
   用户可以脱离它单独覆盖；覆盖值由 normalizeComposerContext 原样提交。
   与 React 一致：只有模型声明 supports_reasoning_effort 且当前不是 flash 时出现——
   flash 的语义就是不推理，给它一个强度选择器没有意义。 */
const supportsReasoningEffort = computed(
  () => selectedModel.value?.supports_reasoning_effort === true,
);
const reasoningEfforts = computed(() => [
  {
    id: "minimal" as const,
    label: $i18n.t.value.inputBox.reasoningEffortMinimal,
    description: $i18n.t.value.inputBox.reasoningEffortMinimalDescription,
  },
  {
    id: "low" as const,
    label: $i18n.t.value.inputBox.reasoningEffortLow,
    description: $i18n.t.value.inputBox.reasoningEffortLowDescription,
  },
  {
    id: "medium" as const,
    label: $i18n.t.value.inputBox.reasoningEffortMedium,
    description: $i18n.t.value.inputBox.reasoningEffortMediumDescription,
  },
  {
    id: "high" as const,
    label: $i18n.t.value.inputBox.reasoningEffortHigh,
    description: $i18n.t.value.inputBox.reasoningEffortHighDescription,
  },
]);
/* 未设置时落在 medium：与 React 的 `medium || !reasoning_effort` 同一条分支，
   否则触发器会在用户还没选过时显示空值。 */
const selectedReasoningEffort = computed(() => {
  const effort = props.context?.reasoning_effort;
  return effort === "minimal" || effort === "low" || effort === "high"
    ? effort
    : "medium";
});
const activeReasoningEffort = computed(
  () =>
    reasoningEfforts.value.find(
      (candidate) => candidate.id === selectedReasoningEffort.value,
    ) ?? reasoningEfforts.value[2]!,
);

function selectReasoningEffort(id: string) {
  const effort = reasoningEfforts.value.find(
    (candidate) => candidate.id === id,
  );
  if (!effort) return;
  emit(
    "contextChange",
    normalizeComposerContext(
      { ...props.context, reasoning_effort: effort.id },
      selectedModel.value,
    ),
  );
}

function selectModeById(id: string) {
  const mode = availableModes.value.find((candidate) => candidate.id === id);
  if (!mode) return;
  const next = normalizeComposerContext(
    {
      ...props.context,
      mode: mode.id,
      reasoning_effort: mode.effort,
    },
    selectedModel.value,
  );
  emit("contextChange", next);
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

/*
  接受一条建议。两支的落点不同，这是上游 applySkillSuggestion（input-box.tsx:1541）
  的判据：技能变成一枚 chip、正文清空、光标回到 chip 里的正文区；内建命令则原样
  写回输入框成 `/name `——**带着那个尾随空格**，它同时是「命令已经打完」的信号
  （查询串含空白，目录自然关掉）和参数的起点。

  内建那一支还要把这一行记进 dismissed：`/goal ` 这行文本本来就不是一次查询，
  这一笔是防止后续退格回到 `/goal` 时目录又弹出来盖住刚打的命令。
*/
function applySuggestion(item: SlashSuggestion | undefined) {
  if (!item) return false;
  if (item.kind === "skill") {
    selectedSkill.value = item.name;
    input.value = "";
    dismissedSuggestionValue.value = null;
    void nextTick(() => chipInput.value?.focus());
  } else {
    const next = `/${item.name} `;
    input.value = next;
    dismissedSuggestionValue.value = next;
    void nextTick(() => {
      const element = textarea.value;
      if (!element) return;
      element.focus();
      element.setSelectionRange(next.length, next.length);
    });
  }
  return true;
}

async function submit() {
  if (props.disabled) return;
  /*
    流式输出期间提交要**说一句话**再退出，不是静悄悄什么都不做：上游
    handleSubmit 开头就是 `if (status === "streaming") { toast.info(
    t.inputBox.pleaseWaitStreaming); return reject }`（input-box.tsx:1165）。
    走到这里的只有回车那条路——按钮在流式态被 onSubmitButtonClick 拦成"停止"。
  */
  if (props.streaming) {
    toast.value = $i18n.t.value.inputBox.pleaseWaitStreaming;
    return;
  }
  const plain = input.value.trim();
  const text = selectedSkill.value
    ? `/${selectedSkill.value}${plain ? ` ${plain}` : ""}`
    : plain;
  const compactCommand =
    selectedFiles.value.length === 0 && isCompactCommand(text);
  if (!text && selectedFiles.value.length === 0) return;
  const placeholder = findSuggestionTemplatePlaceholder(text);
  if (placeholder) {
    /*
      只选中占位符是不够的：没有一句话解释为什么没发出去。上游先
      `toast.warning(t.inputBox.suggestionPlaceholderRequired)` 再选中
      （input-box.tsx:1071）。
    */
    toast.value = $i18n.t.value.inputBox.suggestionPlaceholderRequired;
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

/*
  斜杠目录的键盘导航，对应上游的 handleSkillSuggestionKeyDown（input-box.tsx:1569）。
  它在上游是**独立于提交路径**的一段：Enter/Tab 在 keydown 阶段就把建议接受掉并
  preventDefault，于是表单提交那条路根本看不见目录。本仓原来把「接受建议」塞在
  `submit()` 里，两条路混在一起，才需要 `!compactCommand` 那个硬编码去绕开自己。

  Enter 与 Tab 的分工不同（2026-09-02 用户拍板，两边同改）：**输入行正好是一条
  打全了的内建命令时，Enter 直接执行**，不再先接受一次它自己的建议——打全
  `/compact` 还要按两下回车是一记空keystroke。Tab 仍然只做补全。
  这条只在没有技能 chip 时成立：chip 态里目录只列技能，`/compact` 这行文本
  提交出去也不是命令，此时 Enter 该接受的就是那条技能建议。
*/
function onSuggestionKeydown(event: KeyboardEvent) {
  if (!showSuggestions.value) return;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    suggestionIndex.value =
      (suggestionIndex.value + 1) % suggestions.value.length;
    return;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    suggestionIndex.value =
      (suggestionIndex.value - 1 + suggestions.value.length) %
      suggestions.value.length;
    return;
  }
  if (event.key === "Enter" || event.key === "Tab") {
    if (event.shiftKey) return;
    if (
      event.key === "Enter" &&
      !selectedSkill.value &&
      isCompleteBuiltinCommand(input.value)
    ) {
      return;
    }
    event.preventDefault();
    applySuggestion(suggestions.value[suggestionIndex.value]);
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    dismissedSuggestionValue.value = input.value;
  }
}

function onKeydown(event: KeyboardEvent) {
  if (isImeComposing(event, compositionActive.value)) return;
  onSuggestionKeydown(event);
  if (event.defaultPrevented) return;
  if (event.key === "Enter" && event.shiftKey) return;
  if (event.key === "Enter") {
    event.preventDefault();
    void submit();
    return;
  }
  if (
    !showSuggestions.value &&
    event.key === "ArrowUp" &&
    (!input.value || historyIndex >= 0)
  ) {
    event.preventDefault();
    historyIndex = Math.min(historyIndex + 1, props.promptHistory.length - 1);
    input.value =
      props.promptHistory[props.promptHistory.length - 1 - historyIndex] ?? "";
  } else if (
    !showSuggestions.value &&
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
function openFileDialog() {
  fileInput.value?.click();
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
      /*
        API 说"没改动"（或者改出来是空的）时**不落草稿**，而且要把撤销态收回去。
        上游 input-box.tsx:1656 是
        `const rewrittenText = result.rewritten_text.trim();
         if (!rewrittenText || !result.changed) { toast.info(
           t.inputBox.inputPolishNoChanges); return; }`
        ——它的撤销态是**成功之后**才 setInputPolishUndo 的，所以 no-op 天然不会
        留下撤销按钮。本仓的 polishOriginal 是发请求**之前**就写好的（撤销要能在
        请求还没回来时就取消），所以这里得显式清掉，否则用户为一次什么都没发生的
        润色拿到一个"撤销"按钮。
      */
      const rewritten = result.rewritten_text.trim();
      if (!rewritten || !result.changed) {
        toast.value = $i18n.t.value.inputBox.inputPolishNoChanges;
        polishOriginal.value = null;
      } else {
        input.value = rewritten;
      }
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
  /*
    光标落到末尾，和上游 setPromptHistoryValue 一样（input-box.tsx:1609：
    focus() 之后 setSelectionRange(len, len)）。只 focus 的话浏览器把光标放在
    第 0 位，用户接着打字会写到预填文本的**前面**。
  */
  void nextTick(() => {
    const element = textarea.value;
    if (!element) return;
    element.focus();
    element.setSelectionRange(value.length, value.length);
  });
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
/*
  流式输出期间这个按钮仍然是 type="submit"（与 React 一致），所以停止分支必须自己
  拦下表单提交，否则「停止」会顺手再发一条空消息。
*/
function onSubmitButtonClick(event: MouseEvent) {
  if (!props.streaming) return;
  event.preventDefault();
  stopRun();
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
    <!--
      斜杠目录挂在**整叠 composer 的定位父**上，不在输入框边框里面——上游
      input-box.tsx:2139 就是这个位置（`{showSkillSuggestions && ...}` 排在
      `<PromptInput>` 之前），于是它 `bottom-full` 贴的是整个 composer 的上沿、
      宽度跟着 composer 走。本仓原来把它塞在 ComposerSurface 内部，于是量到的是
      边框内沿、宽度写死 320px。几何面只取 settle 锚点（浮层不在里面），所以这一处
      台账测不到，得照着上游的 DOM 位置摆。
    -->
    <div
      v-if="showSuggestions"
      class="absolute right-0 bottom-full left-0 z-40 mb-2 px-1"
    >
      <div
        role="listbox"
        :aria-label="$i18n.t.value.primitives.skillSuggestions"
        class="bg-popover/95 text-popover-foreground border-border max-h-72 overflow-y-auto rounded-xl border p-1 shadow-lg backdrop-blur-sm"
      >
        <!--
          `mouseenter` 把活动项挪到指针下那一项，与上游 input-box.tsx:2160 一致。
          少了它，`aria-selected` 说的是第一项、`mousedown` 生效的却是指针下那一项,
          读屏器听到的和点下去发生的是两回事。
        -->
        <button
          v-for="(suggestion, index) in suggestions"
          :key="`${suggestion.kind}:${suggestion.name}`"
          role="option"
          type="button"
          :aria-selected="index === suggestionIndex"
          class="aria-selected:bg-accent aria-selected:text-accent-foreground text-popover-foreground hover:bg-accent/70 hover:text-accent-foreground flex min-h-12 w-full min-w-0 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors"
          @mouseenter="suggestionIndex = index"
          @mousedown.prevent="
            suggestionIndex = index;
            applySuggestion(suggestion);
          "
        >
          <Target
            v-if="suggestion.kind === 'builtin'"
            :size="16"
            class="text-muted-foreground shrink-0"
            aria-hidden="true"
          />
          <Sparkles
            v-else
            :size="16"
            class="text-muted-foreground shrink-0"
            aria-hidden="true"
          />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium"
              >/{{ suggestion.name }}</span
            >
            <span
              v-if="suggestion.description"
              class="text-muted-foreground block truncate text-xs"
              >{{ suggestion.description }}</span
            >
          </span>
        </button>
      </div>
    </div>
    <!--
      **表单上不写 aria-disabled。** 上游 input-box.tsx 一处都没有，它把
      `disabled` 逐个发给真正的控件（composerLocked）。`aria-disabled` 是**向下继承**的：
      挂在这一层，可访问性树里连里面那两个 `role="group"` 的 addon 都会被标成
      disabled，而 group 根本不是可禁用的角色；更糟的是它会替那些**并没有被禁用**的
      控件宣布「不可用」——本仓的语音按钮就是这样：DOM 上是可用的，只是被
      `pointer-events-none` 盖住，读屏器却听到 disabled。
      要说「不可用」，就把 disabled 发给控件本身。
    -->
    <form
      class="mx-auto w-full"
      :class="disabled ? 'pointer-events-none opacity-60' : ''"
      :aria-busy="compactPending || submissionPending"
      @submit.prevent="submit"
    >
      <ComposerSurface
        :class="
          [surfaceClass, polishing ? 'ring-primary/25 shadow-lg ring-1' : '']
            .filter(Boolean)
            .join(' ')
        "
      >
        <!-- header / footer 都是 React 的 InputGroupAddon，role="group"。 -->
        <div
          v-if="selectedFiles.length || polishing || (references?.length ?? 0)"
          role="group"
          data-slot="input-group-header"
          :data-testid="
            selectedFiles.length ? 'composer-attachments' : undefined
          "
        >
          <ComposerAttachmentChip
            v-for="file in selectedFiles"
            :key="attachmentKey(file)"
            :file="file"
            @remove="
              selectedFiles = selectedFiles.filter((item) => item !== file)
            "
          />
          <div
            v-if="polishing"
            class="text-primary bg-primary/10 border-primary/20 relative z-30 flex h-7 items-center gap-1.5 rounded-full border py-0 pr-1 pl-2.5 text-xs font-medium"
          >
            <span class="size-2 animate-pulse rounded-full bg-current" />
            {{ $i18n.t.value.inputBox.inputPolishing }}
          </div>
          <!--
            引文块也在 header 里，排在附件与润色指示之后——上游 input-box.tsx:2229
            就是这个次序，而那个 header 正是 PromptInputHeader / InputGroupAddon。
            本仓原来把它放在 ComposerSurface **外面**、靠 `mb-2` 拉开距离。
            两个 composer 当时都这么写，所以「sidecar 与主输入框等高」这条不变量
            照样成立；把 sidecar 那份搬进 header 之后它就塌了（sidecar 高 4px：
            `mb-2` 的 8px 换成了 header 的 `pt-3` 12px）。真正的修法是两处一起搬，
            而不是把 sidecar 搬回去——上游两处都在 header 里。
          -->
          <ReferenceAttachment
            :references="references ?? []"
            test-id="conversation-quote-attachment"
            clearable
            @clear="emit('clearReferences')"
          />
        </div>
        <div data-slot="input-group-body">
          <div v-if="selectedSkill" class="flex items-start gap-2">
            <span class="bg-secondary rounded px-2 py-1 text-xs"
              >/{{ selectedSkill }}</span
            >
            <div
              ref="chipInput"
              role="textbox"
              data-slot="input-group-control"
              :aria-label="$i18n.t.value.inputBox.placeholder"
              :contenteditable="disabled ? 'false' : 'true'"
              class="min-h-10 flex-1 text-sm outline-none focus-visible:ring-0 focus-visible:outline-none"
              @input="onChipInput"
              @keydown="onKeydown"
              @focus="textareaFocused = true"
              @blur="textareaFocused = false"
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
            rows="1"
            class="field-sizing-content max-h-48 min-h-6! w-full min-w-0 resize-none bg-transparent p-0! text-base leading-6! outline-none focus-visible:ring-0 focus-visible:outline-none md:text-sm"
            :disabled="disabled || polishing || compactPending"
            @keydown="onKeydown"
            @focus="textareaFocused = true"
            @blur="textareaFocused = false"
            @compositionstart="compositionActive = true"
            @compositionend="compositionActive = false"
          />
        </div>
        <div role="group" data-slot="input-group-footer">
          <div class="relative">
            <Tooltip>
              <TooltipTrigger>
                <button
                  type="button"
                  data-testid="add-attachments-button"
                  :aria-label="$i18n.t.value.inputBox.addAttachments"
                  class="text-muted-foreground hover:bg-accent flex size-8 cursor-pointer items-center justify-center rounded-md disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="disabled || polishing"
                  @click="openFileDialog"
                >
                  <Paperclip :size="14" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" align="start" class="w-56">
                {{
                  $i18n.t.value.uploads.limitsHint(
                    limits?.max_files ?? 10,
                    formatUploadSize(limits?.max_file_size ?? 50 * 1024 * 1024),
                    formatUploadSize(
                      limits?.max_total_size ?? 100 * 1024 * 1024,
                    ),
                  )
                }}
              </TooltipContent>
            </Tooltip>
            <!--
              hidden 而不是 sr-only。React 的同一个 input 也带 aria-label，但它是
              display:none（frontend/src/components/ai-elements/prompt-input.tsx 的
              className="hidden"），因此**不进**可访问性树。sr-only 会让读屏器在纸夹
              按钮旁边再念出一个同义的「上传文件」按钮，多出一个并不存在的入口。
            -->
            <input
              ref="fileInput"
              type="file"
              multiple
              :aria-label="$i18n.t.value.inputBox.uploadFiles"
              class="hidden"
              @change="chooseFiles"
            />
          </div>
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
            :disabled="disabled || !voiceSupported || polishing || streaming"
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
            class="text-muted-foreground hover:bg-accent flex h-8 items-center gap-1 rounded-md px-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            :aria-label="
              polishOriginal === null
                ? $i18n.t.value.inputBox.inputPolish
                : $i18n.t.value.inputBox.inputPolishUndo
            "
            :disabled="polishDisabled"
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
          <DropdownMenu>
            <DropdownMenuTrigger>
              <ModeHoverGuide
                :label="activeMode.label"
                :description="activeMode.description"
              >
                <!--
                  触发器要接 disabled，与上游同一个 `composerLocked`
                  （input-box.tsx:2391 的 `disabled={composerLocked}`）。
                  只读会话里它此前仍然是可聚焦、可展开的：菜单打得开、
                  选中一项还会写回 context，而这条会话根本发不出消息。
                -->
                <button
                  type="button"
                  data-testid="composer-mode-trigger"
                  class="hover:bg-accent h-8 rounded-md px-2 text-xs"
                  :disabled="disabled || polishing"
                >
                  {{ explicitMode ? activeMode.label : "" }}
                </button>
              </ModeHoverGuide>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" class="w-80">
              <!--
                分组标题在 radio group **里面**，与上游同构（上游原来把它放在外面
                一层 DropdownMenuGroup 里，两层 role="group" 中有一层什么都不命名，
                已两边同改成这一种）。`inputBox.mode` 此前在本仓零消费，而未引用扫描
                器按叶子名匹配看不见它——缺的就是这一行。
              -->
              <DropdownMenuRadioGroup
                :model-value="explicitMode"
                @update:model-value="selectModeById(String($event))"
              >
                <DropdownMenuLabel class="text-muted-foreground text-xs">
                  {{ $i18n.t.value.inputBox.mode }}
                </DropdownMenuLabel>
                <DropdownMenuRadioItem
                  v-for="mode in availableModes"
                  :key="mode.id"
                  :value="mode.id"
                  class="py-2"
                >
                  <span class="block">
                    <span class="block text-sm font-medium">{{
                      mode.label
                    }}</span>
                    <span class="text-muted-foreground block text-xs">{{
                      mode.description
                    }}</span>
                  </span>
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu
            v-if="supportsReasoningEffort && explicitMode !== 'flash'"
          >
            <DropdownMenuTrigger>
              <button
                type="button"
                data-testid="composer-reasoning-effort-trigger"
                class="hover:bg-accent hidden h-8 rounded-md px-2 text-xs sm:inline-flex sm:items-center"
                :disabled="disabled"
              >
                {{ $i18n.t.value.inputBox.reasoningEffort }}:
                {{ activeReasoningEffort.label }}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" class="w-70">
              <DropdownMenuRadioGroup
                :model-value="selectedReasoningEffort"
                @update:model-value="selectReasoningEffort(String($event))"
              >
                <DropdownMenuLabel class="text-muted-foreground text-xs">
                  {{ $i18n.t.value.inputBox.reasoningEffort }}
                </DropdownMenuLabel>
                <DropdownMenuRadioItem
                  v-for="effort in reasoningEfforts"
                  :key="effort.id"
                  :value="effort.id"
                  class="py-2"
                >
                  <span class="block">
                    <span class="block text-sm font-medium">{{
                      effort.label
                    }}</span>
                    <span class="text-muted-foreground block text-xs">{{
                      effort.description
                    }}</span>
                  </span>
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <span
            v-if="goalObjectiveCounter"
            data-testid="goal-length-counter"
            :aria-label="
              $i18n.t.value.inputBox.goalLengthCounter
                .replace('{length}', String(goalObjectiveCounter.length))
                .replace('{max}', String(goalObjectiveCounter.max))
            "
            class="shrink-0 text-xs tabular-nums"
            :class="
              goalObjectiveCounter.overLimit
                ? 'text-destructive font-medium'
                : 'text-muted-foreground'
            "
            >{{ goalObjectiveCounter.length }}/{{
              goalObjectiveCounter.max
            }}</span
          >
          <!--
            disabled 跟着 React 的 composerLocked 走（input-box.tsx:1328 =
            `isComposerDisabled || polishingInput`，2673 行把它交给
            ModelSelectorTrigger 的按钮）：润色期间草稿正被改写，这时换模型
            会让请求打到一个用户还没看见的文本上。
          -->
          <ComposerModelSelector
            :models="models"
            :selected-model="selectedModel"
            :disabled="disabled || polishing"
            @select="selectModel"
          />
          <!--
            发送与停止是**同一个**按钮，和 React 的 PromptInputSubmit 一样：
            换的是可访问名和图标，不是元素。拆成两个 v-if 分支的话，开始流式输出的
            那一刻焦点所在的按钮被卸载，键盘用户会被丢回 body——而「按回车发出去、
            再按空格停下」正是最常见的一条键盘路径。

            空草稿**不**禁用：React 只在 composerLocked（外部 disabled / 正在润色）
            时禁用。禁用一个看得见的提交按钮会让读屏器连它为什么不能按都说不出来，
            而空提交本来就被 submit() 挡住了。
          -->
          <button
            type="submit"
            class="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-full disabled:opacity-50"
            :aria-label="
              streaming
                ? $i18n.t.value.primitives.stop
                : $i18n.t.value.primitives.submit
            "
            :disabled="disabled || polishing"
            @click="onSubmitButtonClick"
          >
            <Square v-if="streaming" :size="12" class="fill-current" />
            <ArrowUp v-else :size="16" />
          </button>
        </div>
      </ComposerSurface>
    </form>
    <!--
      建议行外面这层 `pt-2` 是 React 的（input-box.tsx 里
      `<div className="flex items-center justify-center pt-2">`）。它不是装饰：
      欢迎态的整叠是**贴着底边**排的，少这 8px，上面的输入框就整体下移 8px。
    -->
    <div
      v-if="
        isWelcome &&
        showWelcomeSuggestions !== false &&
        !selectedSkill &&
        !showSuggestions
      "
      class="flex items-center justify-center pt-2"
    >
      <WelcomeSuggestionList
        :disabled="disabled"
        @select="selectWelcomeSuggestion"
      />
    </div>
    <div
      v-if="!isWelcome"
      data-testid="composer-bottom-background"
      aria-hidden="true"
      class="bg-background absolute right-0 -bottom-[17px] left-0 z-0 h-4"
    />
    <p
      data-testid="composer-disclaimer"
      class="text-muted-foreground/70 px-4 text-center text-xs leading-4"
      :class="!isWelcome && 'absolute top-full right-0 left-0'"
    >
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
