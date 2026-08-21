<script setup lang="ts">
/*
  【文件职责】     渲染与父 thread 隔离的 DeerFlow sidecar 会话。
  【对应 frontend/】 src/components/workspace/sidecar/sidecar-panel.tsx
  【架构位置】     L3 extension reference
  【主要导出】     默认 SidecarPanel 组件
  【依赖关系】     useSidecarSession · MessageList · ReferenceAttachment
  【边界与注意】   只做 UI 适配；restore/create/run/files/HIL 由唯一 session 拥有。
*/
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import {
  ArrowUp,
  MessageSquareText,
  Paperclip,
  Trash2,
  X,
} from "lucide-vue-next";

import MessageList from "@/components/chat/MessageList.vue";
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

const compositionActive = ref(false);
const models = ref<Model[]>([]);
const modeMenu = ref(false);
const modelMenu = ref(false);
const deleteDialog = ref(false);
const localContext = reactive<ThreadRunContextInput>({ ...props.context });
const sessionInput = computed({
  get: () => props.session.input.value,
  set: (value: string) => props.session.setInput(value),
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
const modeLabel = computed(() => {
  const mode = String(localContext.mode ?? "pro");
  return mode.charAt(0).toUpperCase() + mode.slice(1);
});

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
  modeMenu.value = false;
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
  modelMenu.value = false;
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
function onEscape(event: KeyboardEvent) {
  if (
    event.key === "Escape" &&
    deleteDialog.value &&
    !props.session.deleting.value
  ) {
    deleteDialog.value = false;
  }
}
onMounted(() => globalThis.addEventListener("keydown", onEscape));
onBeforeUnmount(() => globalThis.removeEventListener("keydown", onEscape));
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
        Ask a follow-up
      </h2>
      <button
        v-if="session.threadId.value"
        type="button"
        data-testid="sidecar-delete-button"
        aria-label="Delete side chat"
        class="hover:bg-accent flex size-8 items-center justify-center rounded-md"
        @click="deleteDialog = true"
      >
        <Trash2 :size="16" />
      </button>
      <button
        v-else
        type="button"
        data-testid="sidecar-close-button"
        aria-label="Close side chat"
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

    <div class="flex shrink-0 flex-col gap-2 px-3 pb-4">
      <form
        class="mx-auto w-full"
        :aria-busy="session.submissionPending.value"
        @submit.prevent="session.submit()"
      >
        <ReferenceAttachment
          :references="references"
          test-id="sidecar-reference-attachment"
          clearable
          class="mb-2"
          @clear="emit('clearReferences')"
        />
        <div
          class="border-input bg-background rounded-2xl border p-2 shadow-sm"
        >
          <div
            v-if="session.selectedFiles.value.length"
            class="mb-2 flex flex-wrap gap-2 text-xs"
          >
            <span
              v-for="file in session.selectedFiles.value"
              :key="`${file.name}:${file.size}:${file.lastModified}`"
              class="bg-secondary border-border flex items-center gap-1 rounded-lg border px-2 py-1"
            >
              {{ file.name }}
              <button
                type="button"
                :aria-label="`Remove ${file.name}`"
                @click="session.removeFile(file)"
              >
                <X :size="12" />
              </button>
            </span>
          </div>
          <textarea
            v-model="sessionInput"
            name="message"
            placeholder="Ask a deeper follow-up..."
            aria-label="Ask a deeper follow-up"
            rows="2"
            class="min-h-16 w-full resize-none bg-transparent px-2 py-2 text-sm leading-6 outline-none"
            @keydown="onKeydown"
            @compositionstart="compositionActive = true"
            @compositionend="compositionActive = false"
          />
          <div class="flex min-w-0 items-center gap-1 pt-1">
            <label
              data-testid="sidecar-add-attachments-button"
              class="text-muted-foreground hover:bg-accent flex size-8 cursor-pointer items-center justify-center rounded-md"
            >
              <Paperclip :size="14" />
              <span class="sr-only">Upload files</span>
              <input
                type="file"
                multiple
                class="sr-only"
                @change="chooseFiles"
              />
            </label>
            <div class="relative">
              <button
                type="button"
                class="hover:bg-accent h-8 rounded-md px-2 text-xs"
                @click="modeMenu = !modeMenu"
              >
                {{ modeLabel }}
              </button>
              <div
                v-if="modeMenu"
                role="menu"
                class="bg-background border-border absolute bottom-full left-0 z-30 mb-1 w-32 rounded-md border p-1 shadow"
              >
                <button
                  v-for="mode in ['flash', 'thinking', 'pro', 'ultra']"
                  :key="mode"
                  role="menuitem"
                  type="button"
                  class="hover:bg-accent block w-full rounded px-2 py-1.5 text-left text-xs capitalize"
                  @click="selectMode(mode)"
                >
                  {{ mode }}
                </button>
              </div>
            </div>
            <span class="flex-1" />
            <div class="sidecar-model-control relative">
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
              type="submit"
              aria-label="Submit"
              class="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-full disabled:opacity-50"
              :disabled="
                (!session.input.value.trim() &&
                  session.selectedFiles.value.length === 0) ||
                session.stream.isStreaming.value ||
                session.submissionPending.value
              "
            >
              <ArrowUp :size="16" />
            </button>
          </div>
        </div>
      </form>
      <p
        v-if="session.fileError.value || session.errorMessage.value"
        role="status"
        class="px-2 text-xs text-red-600"
      >
        {{ session.fileError.value || session.errorMessage.value }}
      </p>
      <p class="text-muted-foreground/70 px-4 text-center text-xs leading-4">
        Deerflow is AI and can make mistakes
      </p>
    </div>
  </section>

  <Teleport to="body">
    <div
      v-if="deleteDialog"
      data-slot="dialog-overlay"
      class="fixed inset-0 z-[70] flex items-center justify-center bg-black/45"
      @click.self="!session.deleting.value && (deleteDialog = false)"
    >
      <section
        data-slot="dialog-content"
        role="dialog"
        aria-modal="true"
        class="bg-background relative w-[min(92vw,28rem)] rounded-xl border p-5 shadow-2xl"
      >
        <button
          v-if="!session.deleting.value"
          data-slot="dialog-close"
          type="button"
          aria-label="Close"
          class="absolute top-4 right-4"
          @click="deleteDialog = false"
        >
          <X :size="16" />
        </button>
        <h2 class="text-base font-semibold">Delete side chat</h2>
        <p class="text-muted-foreground mt-2 text-sm">
          This action cannot be undone. The side conversation will be
          permanently deleted.
        </p>
        <div class="mt-5 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-md border px-3 py-2 text-sm"
            :disabled="session.deleting.value"
            @click="deleteDialog = false"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="sidecar-delete-confirm-button"
            class="bg-destructive text-destructive-foreground rounded-md px-3 py-2 text-sm"
            :disabled="session.deleting.value"
            @click="confirmDelete"
          >
            {{ session.deleting.value ? "Deleting…" : "Delete" }}
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
@media (max-width: 999px) {
  .sidecar-model-control {
    display: none;
  }
}
</style>
