<script setup lang="ts">
/*
  【文件职责】     展示子任务状态、模型、token、实时步骤与按需历史 backfill。
  【对应 frontend/】 src/components/workspace/messages/subtask-card.tsx
  【架构位置】     L3 UI adapter
  【主要导出】     默认 SubtaskCard 组件
  【依赖关系】     core/tasks/api · core/tasks/view-model
  【边界与注意】   展开才请求历史步骤；实时与历史合并由纯 view model 去重排序。
*/
import { computed, onUnmounted, ref } from "vue";
import {
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  CircleX,
  Sparkles,
  Wrench,
} from "lucide-vue-next";

import ShineBorder from "@/components/ui/effects/ShineBorder.vue";
import { fetchSubtaskSteps } from "@/core/tasks/api";
import type { SubtaskStep } from "@/core/tasks/steps";
import type { SubtaskResultUpdate } from "@/core/tasks/subtask-result";
import type { Subtask } from "@/core/tasks/types";
import { buildSubtaskCardViewModel } from "@/core/tasks/view-model";

const props = defineProps<{
  taskId: string;
  threadId?: string | null;
  runId?: string | null;
  description: string;
  prompt: string;
  liveTask?: Subtask;
  terminal?: SubtaskResultUpdate;
  pendingStatus: Subtask["status"];
  isLoading: boolean;
}>();

const expanded = ref(false);
const historicalSteps = ref<SubtaskStep[]>([]);
const loadingSteps = ref(false);
const stepsError = ref<string | null>(null);
let loadGeneration = 0;
let disposed = false;

const viewModel = computed(() =>
  buildSubtaskCardViewModel({
    id: props.taskId,
    description: props.description,
    prompt: props.prompt,
    pendingStatus: props.pendingStatus,
    liveTask: props.liveTask,
    terminal: props.terminal,
    historicalSteps: historicalSteps.value,
  }),
);
const panelId = computed(() => `subtask-panel-${props.taskId}`);

async function loadHistoricalSteps() {
  if (
    loadingSteps.value ||
    historicalSteps.value.length > 0 ||
    !props.threadId ||
    !props.runId
  ) {
    return;
  }
  const generation = ++loadGeneration;
  loadingSteps.value = true;
  stepsError.value = null;
  try {
    const steps = await fetchSubtaskSteps(
      props.threadId,
      props.runId,
      props.taskId,
    );
    if (!disposed && generation === loadGeneration) {
      historicalSteps.value = steps;
    }
  } catch (error) {
    if (!disposed && generation === loadGeneration) {
      stepsError.value =
        error instanceof Error ? error.message : "Failed to load steps.";
    }
  } finally {
    if (!disposed && generation === loadGeneration) {
      loadingSteps.value = false;
    }
  }
}

function toggle(event: MouseEvent) {
  (event.currentTarget as HTMLButtonElement | null)?.focus();
  expanded.value = !expanded.value;
  if (expanded.value) void loadHistoricalSteps();
}

function retrySteps() {
  historicalSteps.value = [];
  stepsError.value = null;
  void loadHistoricalSteps();
}

onUnmounted(() => {
  disposed = true;
  loadGeneration += 1;
});
</script>

<template>
  <article
    class="border-border bg-background relative overflow-hidden rounded-lg border"
    :aria-busy="viewModel.status === 'in_progress' || isLoading"
    :data-task-id="taskId"
  >
    <ShineBorder
      v-if="viewModel.status === 'in_progress'"
      :border-width="1.5"
      :shine-color="['#A07CFE', '#FE8FB5', '#FFBE7B']"
    />
    <button
      data-testid="subtask-toggle"
      type="button"
      class="hover:bg-accent/50 flex w-full items-center gap-2 px-3 py-2 text-left"
      :aria-expanded="expanded"
      :aria-controls="panelId"
      @click="toggle"
    >
      <CheckCircle2
        v-if="viewModel.status === 'completed'"
        :size="16"
        class="shrink-0 text-emerald-600"
      />
      <CircleX
        v-else-if="viewModel.status === 'failed'"
        :size="16"
        class="text-destructive shrink-0"
      />
      <CircleDashed
        v-else
        :size="16"
        class="text-muted-foreground shrink-0 animate-spin"
      />
      <span class="min-w-0 flex-1">
        <span class="block truncate text-sm font-medium">{{
          viewModel.description
        }}</span>
        <span class="text-muted-foreground flex flex-wrap gap-x-2 text-xs">
          <span>{{ viewModel.statusLabel }}</span>
          <span v-if="viewModel.modelLabel">{{ viewModel.modelLabel }}</span>
          <span v-if="viewModel.tokenLabel">{{ viewModel.tokenLabel }}</span>
        </span>
      </span>
      <ChevronDown
        :size="16"
        aria-hidden="true"
        class="text-muted-foreground shrink-0 transition-transform"
        :class="expanded ? 'rotate-180' : ''"
      />
    </button>

    <div
      v-if="expanded"
      :id="panelId"
      class="border-border space-y-3 border-t px-4 py-3"
    >
      <p v-if="viewModel.prompt" class="text-muted-foreground text-sm">
        {{ viewModel.prompt }}
      </p>
      <p
        v-if="loadingSteps"
        role="status"
        class="text-muted-foreground text-xs"
      >
        Loading steps…
      </p>
      <div v-else-if="stepsError" role="alert" class="text-destructive text-xs">
        <span>{{ stepsError }}</span>
        <button
          data-testid="subtask-steps-retry"
          type="button"
          class="ml-2 underline"
          @click="retrySteps"
        >
          Try again
        </button>
      </div>
      <ol v-if="viewModel.steps.length" class="space-y-2">
        <li
          v-for="step in viewModel.steps"
          :key="step.message_index"
          class="text-muted-foreground flex items-start gap-2 text-sm"
        >
          <Wrench v-if="step.kind === 'tool'" :size="14" class="mt-0.5" />
          <Sparkles v-else :size="14" class="mt-0.5" />
          <span>{{ step.kind === "tool" ? step.tool_name : step.text }}</span>
        </li>
      </ol>
      <p v-if="viewModel.result" class="text-sm">{{ viewModel.result }}</p>
      <p v-if="viewModel.error" class="text-destructive text-sm">
        {{ viewModel.error }}
      </p>
    </div>
  </article>
</template>
