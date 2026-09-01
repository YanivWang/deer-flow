<script setup lang="ts">
/*
  【文件职责】     渲染与父 thread 隔离的 DeerFlow sidecar 会话。
  【架构位置】     L3 extension reference
  【主要导出】     默认 SidecarPanel 组件
  【依赖关系】     useSidecarSession · MessageList · ReferenceAttachment · ui/alert-dialog
                   · ui/conversation · ui/dropdown-menu · ui/tooltip
  【边界与注意】   只做 UI 适配；restore/create/run/files/HIL 由唯一 session 拥有。
*/
import { computed, reactive, ref, watch } from "vue";
import {
  ArrowUp,
  MessageSquareText,
  Paperclip,
  Trash2,
  X,
} from "lucide-vue-next";

import MessageList from "@/components/chat/MessageList.vue";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ConversationEmptyState } from "@/components/ui/conversation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ComposerAttachmentChip from "@/components/chat/ComposerAttachmentChip.vue";
import ComposerModelSelector from "@/components/chat/ComposerModelSelector.vue";
import ModeHoverGuide from "@/components/chat/ModeHoverGuide.vue";
import ComposerSurface from "@/components/chat/ComposerSurface.vue";
import ReferenceAttachment from "@/components/workspace/sidecar/ReferenceAttachment.vue";
import type { SidecarSession } from "@/composables/useSidecarSession";
import type { SidecarReference } from "@/composables/useSidecar";
import { useModels } from "@/composables/useModels";
import { isImeComposing } from "@/core/input/ime";
import type { Model } from "@/core/models/types";
import {
  buildMessageSidecarContext,
  type SidecarContext,
} from "@/core/sidecar";
import type { ThreadRunContextInput } from "@/core/threads/submit";
import type { Message } from "@/core/types/message";

const props = defineProps<{
  session: SidecarSession;
  references: SidecarReference[];
  context: ThreadRunContextInput;
  active: boolean;
}>();
const emit = defineEmits<{
  "update:context": [value: ThreadRunContextInput];
  clearReferences: [];
  addReference: [value: SidecarContext];
  close: [];
  discard: [];
  deleted: [];
}>();
const { $i18n } = useNuxtApp();

const compositionActive = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
/*
  走共享的 useModels，而不是自己 loadModels()。本仓这里原来在 onMounted 里直接发
  请求，于是打开 sidecar 会**再发一次 `GET /api/models`**——页面已经发过一次了。
  上游 sidecar-panel.tsx:? 用的是 useModels() 这个 react-query hook，与页面共享
  同一份缓存，只发一次。ChatComposer / SubtaskCard / AgentChat 在本仓早就走
  useModels 了，只有这里是手搓的。对照台账里那条 `requestsOnlyVue GET /api/models`
  就是它。
*/
const modelCatalog = useModels();
const models = computed<Model[]>(() => modelCatalog.models.value);
const deleteDialog = ref(false);
const localContext = reactive<ThreadRunContextInput>({ ...props.context });
const sessionInput = computed({
  get: () => props.session.input.value,
  set: (value: string) => props.session.setInput(value),
});
const composerBusy = computed(
  () =>
    props.session.submissionPending.value ||
    props.session.stream.isStreaming.value,
);
/*
  上游 sidecar-panel.tsx:213 的 `disabled`：**输入框空不空不在里面**。
  「有引用但还没打字」正是 sidecar 最常见的起手式——上游允许直接发出去，
  本仓原来卡着不让发（判据写的是 `!input.trim() && files.length === 0`）。
  session.submit() 自己在 :220 还有一道同样的空判，所以放开按钮不会发出空请求，
  只是把「能不能点」这件事对齐。
*/
const composerDisabled = computed(
  () =>
    (!props.session.threadId.value && props.references.length === 0) ||
    composerBusy.value ||
    (Boolean(props.session.threadId.value) &&
      props.session.stream.isHistoryLoading.value),
);
/*
  头部副标题，三选一，与 sidecar-panel.tsx:534 同一条判据：待发引用优先报条数，
  其次「已有 thread」报 continuing，都没有才报 noContext。条数那一支的模板与
  ReferenceAttachment.vue 用的是同两条词典项，单复数判据也相同。
*/
const headerSubtitle = computed(() => {
  const count = props.references.length;
  if (count === 0) {
    return props.session.threadId.value
      ? $i18n.t.value.sidecar.continuing
      : $i18n.t.value.sidecar.noContext;
  }
  return (
    count === 1
      ? $i18n.t.value.sidecar.selectedTextFragment
      : $i18n.t.value.sidecar.selectedTextFragments
  ).replace("{count}", String(count));
});

watch(
  () => props.context,
  (value) => Object.assign(localContext, value),
  { deep: true },
);

function resolvedMode(mode: string | undefined, supportsThinking: boolean) {
  if (!supportsThinking && mode !== "flash") return "flash";
  return mode ?? (supportsThinking ? "pro" : "flash");
}
function reasoningEffort(mode: string) {
  return mode === "ultra"
    ? "high"
    : mode === "pro"
      ? "medium"
      : mode === "thinking"
        ? "low"
        : "minimal";
}
const selectedModel = computed(
  () =>
    models.value.find((model) => model.name === localContext.model_name) ??
    models.value[0],
);
const modeOptions = computed(() => [
  {
    id: "flash",
    label: $i18n.t.value.inputBox.flashMode,
    description: $i18n.t.value.inputBox.flashModeDescription,
  },
  {
    id: "thinking",
    label: $i18n.t.value.inputBox.reasoningMode,
    description: $i18n.t.value.inputBox.reasoningModeDescription,
  },
  {
    id: "pro",
    label: $i18n.t.value.inputBox.proMode,
    description: $i18n.t.value.inputBox.proModeDescription,
  },
  {
    id: "ultra",
    label: $i18n.t.value.inputBox.ultraMode,
    description: $i18n.t.value.inputBox.ultraModeDescription,
  },
]);
/*
  模型不支持 thinking 时只留 Flash。上游 SidecarModeMenu 原来照样列出另外三项，
  但 selectMode 会把它们经 resolvedMode 拉回 flash——勾永远不动，只有隐藏的
  reasoning_effort 被改了。换成 radio 之后这更明显：一个点了不肯 checked 的
  menuitemradio 是坏掉的控件。已两边同改（sidecar-panel.tsx 同一处）。
*/
const availableModeOptions = computed(() =>
  selectedModel.value?.supports_thinking === true
    ? modeOptions.value
    : modeOptions.value.filter((option) => option.id === "flash"),
);
/* 触发器文案与 hover 说明取自同一条记录；未知 mode 回落到 pro，与 React 一致。 */
/*
  触发器读的必须是**解析后**的 mode。上游 SidecarModeMenu 一进来就跑
  `getResolvedMode(context.mode, supportThinking)`：模型不支持 thinking 时，
  任何非 flash 的 mode 都被拉回 flash。本仓原来直接读 `localContext.mode ?? "pro"`，
  于是模型目录还没到（或模型不支持 thinking）时，两个应用的档位按钮一个写
  「Flash」、一个写「Pro」——对照台账里那两行就是它。resolvedMode 这个函数本仓
  一直有，只是没用在这里。
*/
const resolvedActiveMode = computed(() =>
  resolvedMode(
    localContext.mode ? String(localContext.mode) : undefined,
    selectedModel.value?.supports_thinking ?? false,
  ),
);
const activeMode = computed(
  () =>
    modeOptions.value.find(
      (option) => option.id === resolvedActiveMode.value,
    ) ?? modeOptions.value.find((option) => option.id === "pro")!,
);

function updateContext(next: ThreadRunContextInput) {
  for (const key of Object.keys(localContext)) {
    Reflect.deleteProperty(localContext, key);
  }
  Object.assign(localContext, next);
  emit("update:context", { ...localContext });
}
function selectMode(mode: string) {
  const next = resolvedMode(
    mode,
    selectedModel.value?.supports_thinking ?? false,
  );
  updateContext({
    ...localContext,
    mode: next,
    reasoning_effort: reasoningEffort(next),
  });
}
function selectModel(model: Model) {
  const mode = resolvedMode(
    String(localContext.mode ?? "pro"),
    model.supports_thinking ?? false,
  );
  updateContext({
    ...localContext,
    model_name: model.name,
    mode,
    reasoning_effort: reasoningEffort(mode),
  });
}

/* 目录到位之后把 context 收敛到实际可用的模型上，与原来 onMounted 里那一步等价。 */
watch(
  () => models.value,
  (list) => {
    if (list.length === 0) return;
    const model = selectedModel.value;
    if (model) selectModel(model);
  },
  { immediate: true },
);

function onKeydown(event: KeyboardEvent) {
  if (isImeComposing(event, compositionActive.value)) return;
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    void props.session.submit();
  }
}
function addSelectedReference(payload: {
  message: Message;
  selectedText: string;
  displayIndex: number;
}) {
  const context = buildMessageSidecarContext(
    payload.message,
    payload.displayIndex,
    { selectedText: payload.selectedText },
  );
  if (context) emit("addReference", context);
}
function chooseFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  props.session.addFiles(Array.from(input.files ?? []));
  input.value = "";
}

async function confirmDelete() {
  if (await props.session.deleteThread()) {
    emit("deleted");
    deleteDialog.value = false;
  }
}
</script>

<template>
  <section
    data-testid="sidecar-panel"
    class="bg-background flex size-full min-h-0 flex-col"
  >
    <!--
      头部照 sidecar-panel.tsx:527 重排。原来这里有四处分叉，都不是笔误级别的：

      ① 标题读的是 `sidecar.emptyTitle`（"Ask a follow-up"），上游读的是
         `sidecar.title`（"Side chat"）——同一颗面板在两个应用里叫的名字不一样。
      ② 上游标题下面还有一行**副标题**，三选一：有待发引用时报条数、
         已有 thread 时报 `continuing`、都没有时报 `noContext`。本仓整行都没有，
         于是 `sidecar.continuing` / `sidecar.noContext` 两条词典项在 Vue 侧
         零消费（`baseline/i18n-keys.json` 的 unused 列表里就有它们俩，
         那份清单本来就是在替这一行喊）。
      ③ **删除与关闭原来是 `v-if` / `v-else`**，上游是「删除按条件、关闭恒在」。
         后果是：一旦 sidecar 建出了 thread，本仓这颗面板就再也没有关闭按钮，
         只能回头点头部那颗 sidecar-header-trigger。这是功能缺失，不是样式差异。
      ④ 关闭按钮的可访问名读的是 `sidecar.close`（"Close side chat"），
         上游读 `common.close`（"Close"）。

      标题那两行上游用的是 div 而不是 heading——这里照抄。补成 h2 会给 Vue 的
      可访问性树多一个 React 没有的标题层级。
    -->
    <header
      class="border-border/70 flex h-12 shrink-0 items-center gap-2 border-b px-3"
    >
      <MessageSquareText :size="16" class="text-muted-foreground" />
      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-medium">
          {{ $i18n.t.value.sidecar.title }}
        </div>
        <div class="text-muted-foreground truncate text-xs">
          {{ headerSubtitle }}
        </div>
      </div>
      <TooltipProvider>
        <Tooltip v-if="session.threadId.value">
          <TooltipTrigger>
            <Button
              type="button"
              data-testid="sidecar-delete-button"
              :aria-label="$i18n.t.value.sidecar.delete"
              class="text-muted-foreground hover:text-destructive"
              size="icon-sm"
              variant="ghost"
              @click="deleteDialog = true"
            >
              <Trash2 />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ $i18n.t.value.sidecar.delete }}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger>
            <Button
              type="button"
              data-testid="sidecar-close-button"
              :aria-label="$i18n.t.value.common.close"
              class="text-muted-foreground hover:text-foreground"
              size="icon-sm"
              variant="ghost"
              @click="session.threadId.value ? emit('close') : emit('discard')"
            >
              <X />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ $i18n.t.value.common.close }}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </header>

    <!--
      没有 sidecar thread 时上游落在空状态上（sidecar-panel.tsx:594），本仓原来
      **无条件**渲染 MessageList——于是刚打开、还没建 thread 的那一屏，两个应用一个
      是「Ask a follow-up + 说明」，另一个是一块空的消息区。`sidecar.emptyDescription`
      在 Vue 侧一直零消费就是这个缺口留下的痕迹（unused 扫描器按叶子名匹配，
      `agents.emptyDescription` 顶掉了它，所以它没被算进那 60 条里）。

      上游把两支都套在一个 `min-h-0 flex-1` 的 div 里、再给 MessageList 加 size-full；
      本仓的 MessageList 根节点自己就带 `min-h-0 flex-1`，是这一列的 flex 子节点，
      而且这条布局已经被 chat / branch-thread 等场景的几何取样证明与上游落在同一个
      盒子里。所以这里只给**空状态**那一支补上等价的 flex 子节点，不去动已经对齐的
      那一支——包一层不可见的 div 换不来任何可观察的一致，却要重开一次几何验证。
    -->
    <div v-if="!session.threadId.value" class="min-h-0 flex-1">
      <ConversationEmptyState
        :title="$i18n.t.value.sidecar.emptyTitle"
        :description="$i18n.t.value.sidecar.emptyDescription"
      >
        <template #icon><MessageSquareText :size="20" /></template>
      </ConversationEmptyState>
    </div>
    <MessageList
      v-else
      data-testid="sidecar-message-list"
      test-id="sidecar-message-list"
      selection-mode="sidecar"
      :messages="session.stream.messages.value"
      :raw-messages="session.stream.messages.value"
      :streaming="session.stream.isStreaming.value"
      :loading="session.stream.isHistoryLoading.value"
      :thread-id="session.threadId.value"
      :thread-error="session.stream.error.value"
      :submit-human-input="session.submitHumanInput"
      interactive
      :active="active"
      resize-scroll="instant"
      @selection-add="addSelectedReference"
    />

    <div class="relative flex shrink-0 flex-col gap-2 px-3 pb-4">
      <form
        class="mx-auto w-full"
        :aria-busy="composerBusy"
        @submit.prevent="session.submit()"
      >
        <ComposerSurface test-id="sidecar-composer-surface">
          <!--
            引用块在**框内**，和附件筹码同属一个 header。上游把
            ReferenceAttachmentSummary 放进 PromptInputHeader
            （sidecar-panel.tsx:610），而 PromptInputHeader 就是 InputGroupAddon，
            带 role="group"。本仓原来把它放在 ComposerSurface **外面**、
            header 只在有附件时才出现，于是草稿态（有引用、没附件）下 React 的
            可访问性树里比本仓多一个分组——对照台账里那条 `ariaOnlyReact - group:`。
          -->
          <div
            v-if="session.selectedFiles.value.length || references.length"
            role="group"
            data-slot="input-group-header"
          >
            <ComposerAttachmentChip
              v-for="file in session.selectedFiles.value"
              :key="`${file.name}:${file.size}:${file.lastModified}`"
              :file="file"
              @remove="session.removeFile(file)"
            />
            <ReferenceAttachment
              :references="references"
              test-id="sidecar-reference-attachment"
              clearable
              @clear="emit('clearReferences')"
            />
          </div>
          <div data-slot="input-group-body">
            <textarea
              v-model="sessionInput"
              name="message"
              data-slot="input-group-control"
              :placeholder="$i18n.t.value.sidecar.placeholder"
              :disabled="composerDisabled"
              rows="1"
              class="field-sizing-content max-h-48 min-h-6! w-full min-w-0 resize-none bg-transparent p-0! text-sm leading-6! outline-none focus-visible:ring-0 focus-visible:outline-none"
              @keydown="onKeydown"
              @compositionstart="compositionActive = true"
              @compositionend="compositionActive = false"
            />
          </div>
          <!--
            footer 与 header 都是上游的 InputGroupAddon，带 role="group"
            （frontend/src/components/ui/input-group.tsx:67）。ChatComposer.vue 早就
            照抄了这一条，只有 sidecar 这份手搓副本漏了，于是可访问性树里 React 比
            本仓多一个分组。
          -->
          <div role="group" data-slot="input-group-footer">
            <!--
              纸夹是**按钮**，file input 是 `hidden` 的旁路——不是 `sr-only` 的 label。
              ChatComposer.vue 里那段注释记着同一条：sr-only 的 input 仍然在可访问性
              树里，读屏器会在纸夹旁边再念出一个同义按钮，凭空多一个入口。本仓这里
              原来就是那个写法，而且名字读的是 `inputBox.uploadFiles`，上游读的是
              `inputBox.addAttachments`。
            -->
            <button
              type="button"
              data-testid="sidecar-add-attachments-button"
              :aria-label="$i18n.t.value.inputBox.addAttachments"
              class="text-muted-foreground hover:bg-accent flex size-8 cursor-pointer items-center justify-center rounded-md"
              @click="fileInput?.click()"
            >
              <Paperclip :size="14" aria-hidden="true" />
            </button>
            <input
              ref="fileInput"
              type="file"
              multiple
              :aria-label="$i18n.t.value.inputBox.uploadFiles"
              class="hidden"
              @change="chooseFiles"
            />
            <DropdownMenu>
              <DropdownMenuTrigger>
                <ModeHoverGuide
                  :label="activeMode.label"
                  :description="activeMode.description"
                >
                  <button
                    type="button"
                    data-testid="sidecar-mode-trigger"
                    class="hover:bg-accent h-8 rounded-md px-2 text-xs"
                  >
                    {{ activeMode.label }}
                  </button>
                </ModeHoverGuide>
              </DropdownMenuTrigger>
              <!--
                与上游 SidecarModeMenu 同构：w-80、组内标题、每项「名字 + 说明」。
                本仓原来是 w-32 的裸标签列表，于是同一个下拉在主输入框里读得出
                「Flash 快速高效……」、在 sidecar 里只读得出「Flash」。
              -->
              <DropdownMenuContent align="start" side="top" class="w-80">
                <DropdownMenuRadioGroup
                  :model-value="resolvedActiveMode"
                  @update:model-value="selectMode(String($event))"
                >
                  <DropdownMenuLabel class="text-muted-foreground text-xs">
                    {{ $i18n.t.value.inputBox.mode }}
                  </DropdownMenuLabel>
                  <DropdownMenuRadioItem
                    v-for="mode in availableModeOptions"
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
            <span class="flex-1" />
            <!--
              **只有 sidecar 这一支**在没有选中模型时整个不渲染：上游
              SidecarModelSelector 开头就是 `if (!selectedModel) return null`
              （sidecar-panel.tsx:920）。主输入框那一支不是这样，它照样渲染一个
              没有名字的触发器，所以 ComposerModelSelector 自己的默认行为
              （见它的文件头）对主输入框是对的，只是不适用于这里。
              两边差的就是台账里那条 `ariaOnlyVue - button`：一颗没有可访问名的按钮。
            -->
            <ComposerModelSelector
              v-if="selectedModel"
              class="sidecar-model-control"
              test-id="sidecar-model-selector"
              :models="models"
              :selected-model="selectedModel"
              @select="selectModel"
            />
            <button
              type="submit"
              :aria-label="$i18n.t.value.inputBox.submit"
              class="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-full disabled:opacity-50"
              :disabled="composerDisabled"
            >
              <ArrowUp :size="16" />
            </button>
          </div>
        </ComposerSurface>
      </form>
      <p
        v-if="session.fileError.value || session.errorMessage.value"
        role="status"
        class="px-2 text-xs text-red-600"
      >
        {{ session.fileError.value || session.errorMessage.value }}
      </p>
    </div>
  </section>

  <AlertDialog
    :open="deleteDialog"
    @update:open="!$event && !session.deleting.value && (deleteDialog = false)"
  >
    <AlertDialogContent
      class="w-[min(92vw,28rem)]"
      @escape-key-down="session.deleting.value && $event.preventDefault()"
    >
      <AlertDialogHeader>
        <AlertDialogTitle class="text-base">
          {{ $i18n.t.value.sidecar.delete }}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {{ $i18n.t.value.sidecar.deleteConfirm }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel size="sm" :disabled="session.deleting.value">
          {{ $i18n.t.value.common.cancel }}
        </AlertDialogCancel>
        <Button
          data-testid="sidecar-delete-confirm-button"
          variant="destructive"
          size="sm"
          :disabled="session.deleting.value"
          @click="confirmDelete"
        >
          {{
            session.deleting.value
              ? $i18n.t.value.sidecar.deleting
              : $i18n.t.value.common.delete
          }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<style scoped>
/*
  用 :deep()——`.sidecar-model-control` 落在 ComposerModelSelector 内部的触发器按钮上，
  不是它的根节点，拿不到本组件的 scope 属性（那个组件把 attrs 显式绑到按钮上，
  原因见它的文件头）。不加 :deep() 这条规则就一条元素也选不中，窄面板里模型名会
  把工具条挤出去。
*/
@media (max-width: 999px) {
  :deep(.sidecar-model-control) {
    display: none;
  }
}
</style>
