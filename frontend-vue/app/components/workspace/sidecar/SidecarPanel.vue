<script setup lang="ts">
/*
  【文件职责】     渲染与父 thread 隔离的 DeerFlow sidecar 会话。
  【架构位置】     L3 extension reference
  【主要导出】     默认 SidecarPanel 组件
  【依赖关系】     useSidecarSession · MessageList · ReferenceAttachment · ui/alert-dialog · ui/dropdown-menu
  【边界与注意】   只做 UI 适配；restore/create/run/files/HIL 由唯一 session 拥有。
*/
import { computed, onMounted, reactive, ref, watch } from "vue";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ComposerAttachmentChip from "@/components/chat/ComposerAttachmentChip.vue";
import ComposerModelSelector from "@/components/chat/ComposerModelSelector.vue";
import ModeHoverGuide from "@/components/chat/ModeHoverGuide.vue";
import ComposerSurface from "@/components/chat/ComposerSurface.vue";
import ReferenceAttachment from "@/components/workspace/sidecar/ReferenceAttachment.vue";
import type { SidecarSession } from "@/composables/useSidecarSession";
import type { SidecarReference } from "@/composables/useSidecar";
import { isImeComposing } from "@/core/input/ime";
import { loadModels } from "@/core/models/api";
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
  deleted: [];
}>();
const { $i18n } = useNuxtApp();

const compositionActive = ref(false);
const models = ref<Model[]>([]);
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
/* 触发器文案与 hover 说明取自同一条记录；未知 mode 回落到 pro，与 React 一致。 */
const activeMode = computed(
  () =>
    modeOptions.value.find(
      (option) => option.id === String(localContext.mode ?? "pro"),
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

onMounted(async () => {
  try {
    models.value = (await loadModels()).models;
    const model = selectedModel.value;
    if (model) selectModel(model);
  } catch {
    models.value = [];
  }
});

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
    <header
      class="border-border/70 flex h-12 shrink-0 items-center gap-2 border-b px-3"
    >
      <MessageSquareText :size="16" class="text-muted-foreground" />
      <h2 class="min-w-0 flex-1 truncate text-sm font-semibold">
        {{ $i18n.t.value.sidecar.emptyTitle }}
      </h2>
      <button
        v-if="session.threadId.value"
        type="button"
        data-testid="sidecar-delete-button"
        :aria-label="$i18n.t.value.sidecar.delete"
        class="hover:bg-accent flex size-8 items-center justify-center rounded-md"
        @click="deleteDialog = true"
      >
        <Trash2 :size="16" />
      </button>
      <button
        v-else
        type="button"
        data-testid="sidecar-close-button"
        :aria-label="$i18n.t.value.sidecar.close"
        class="hover:bg-accent flex size-8 items-center justify-center rounded-md"
        @click="emit('close')"
      >
        <X :size="16" />
      </button>
    </header>

    <MessageList
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
        <ReferenceAttachment
          :references="references"
          test-id="sidecar-reference-attachment"
          clearable
          class="mb-2"
          @clear="emit('clearReferences')"
        />
        <ComposerSurface test-id="sidecar-composer-surface">
          <div
            v-if="session.selectedFiles.value.length"
            data-slot="input-group-header"
          >
            <ComposerAttachmentChip
              v-for="file in session.selectedFiles.value"
              :key="`${file.name}:${file.size}:${file.lastModified}`"
              :file="file"
              @remove="session.removeFile(file)"
            />
          </div>
          <div data-slot="input-group-body">
            <textarea
              v-model="sessionInput"
              name="message"
              data-slot="input-group-control"
              :placeholder="$i18n.t.value.sidecar.placeholder"
              :aria-label="$i18n.t.value.sidecar.inputLabel"
              :disabled="composerBusy"
              rows="1"
              class="field-sizing-content max-h-48 min-h-6! w-full min-w-0 resize-none bg-transparent p-0! text-sm leading-6! outline-none focus-visible:ring-0 focus-visible:outline-none"
              @keydown="onKeydown"
              @compositionstart="compositionActive = true"
              @compositionend="compositionActive = false"
            />
          </div>
          <div data-slot="input-group-footer">
            <label
              data-testid="sidecar-add-attachments-button"
              class="text-muted-foreground hover:bg-accent flex size-8 cursor-pointer items-center justify-center rounded-md"
            >
              <Paperclip :size="14" />
              <span class="sr-only">{{
                $i18n.t.value.inputBox.uploadFiles
              }}</span>
              <input
                type="file"
                multiple
                class="sr-only"
                @change="chooseFiles"
              />
            </label>
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
              <DropdownMenuContent align="start" side="top" class="w-32">
                <DropdownMenuRadioGroup
                  :model-value="String(localContext.mode ?? 'pro')"
                  @update:model-value="selectMode(String($event))"
                >
                  <DropdownMenuRadioItem
                    v-for="mode in modeOptions"
                    :key="mode.id"
                    :value="mode.id"
                    class="text-xs capitalize"
                  >
                    {{ mode.label }}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <span class="flex-1" />
            <ComposerModelSelector
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
              :disabled="
                (!session.input.value.trim() &&
                  session.selectedFiles.value.length === 0) ||
                composerBusy
              "
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
      <p
        data-testid="sidecar-composer-disclaimer"
        class="text-muted-foreground/70 absolute right-3 bottom-0 left-3 px-4 text-center text-xs leading-4"
      >
        {{ $i18n.t.value.inputBox.disclaimer }}
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
@media (max-width: 999px) {
  .sidecar-model-control {
    display: none;
  }
}
</style>
