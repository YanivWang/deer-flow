<script setup lang="ts">
/*
  【文件职责】     编排 scheduled-task route 默认值、表单、筛选、selection 与 Vue Query owners。
  【对应 frontend/】 src/app/workspace/scheduled-tasks/page.tsx
  【架构位置】     L3 application page
  【主要导出】     默认 scheduled tasks page
  【依赖关系】     useScheduledTasks · scheduled-task components · form/view-model pure logic
  【边界与注意】   route thread_id 只提供默认/列表 scope；表单可切 fresh/reuse；页面不保留 server-state 副本。
*/
import { computed, ref, watch } from "vue";

import ScheduledTaskDetail from "@/components/workspace/scheduled-tasks/ScheduledTaskDetail.vue";
import ScheduledTaskFilters from "@/components/workspace/scheduled-tasks/ScheduledTaskFilters.vue";
import ScheduledTaskForm from "@/components/workspace/scheduled-tasks/ScheduledTaskForm.vue";
import ScheduledTaskList from "@/components/workspace/scheduled-tasks/ScheduledTaskList.vue";
import {
  buildScheduledTaskCreatePayload,
  buildScheduledTaskUpdatePayload,
  createScheduledTaskDraft,
  draftForScheduledTask,
  type ScheduledTaskDraft,
} from "@/core/scheduled-tasks/form";
import {
  filterScheduledTasks,
  resolveScheduledTaskSelection,
  type ScheduledTaskScheduleFilter,
  type ScheduledTaskStatusFilter,
} from "@/core/scheduled-tasks/view-model";
import type { ScheduledTask } from "@/core/scheduled-tasks/types";
import {
  useScheduledTaskDetail,
  useScheduledTaskMutations,
  useScheduledTaskRuns,
  useScheduledTasks,
} from "@/composables/useScheduledTasks";

definePageMeta({ layout: "workspace" });

const route = useRoute();
const { $i18n } = useNuxtApp();
const routeThreadId = computed(() => {
  const value = route.query.thread_id;
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" && first.trim() ? first.trim() : null;
});

const tasksQuery = useScheduledTasks(routeThreadId);
const statusFilter = ref<ScheduledTaskStatusFilter>("all");
const scheduleTypeFilter = ref<ScheduledTaskScheduleFilter>("all");
const selectedId = ref<string | null>(null);
const filteredTasks = computed(() =>
  filterScheduledTasks(tasksQuery.tasks.value, {
    status: statusFilter.value,
    scheduleType: scheduleTypeFilter.value,
  }),
);

watch(
  filteredTasks,
  (tasks) => {
    const next = resolveScheduledTaskSelection(tasks, selectedId.value);
    if (next !== selectedId.value) selectedId.value = next;
  },
  { immediate: true },
);

const detailQuery = useScheduledTaskDetail(selectedId);
const selectedTask = computed<ScheduledTask | null>(() => {
  if (detailQuery.data.value?.id === selectedId.value) {
    return detailQuery.data.value;
  }
  return (
    tasksQuery.tasks.value.find((task) => task.id === selectedId.value) ?? null
  );
});
const runsQuery = useScheduledTaskRuns(selectedId);
const mutations = useScheduledTaskMutations();
const mutationPending = computed(() =>
  [
    mutations.create,
    mutations.update,
    mutations.pause,
    mutations.resume,
    mutations.trigger,
    mutations.remove,
  ].some((mutation) => mutation.isPending.value),
);

const createDraft = ref<ScheduledTaskDraft>(createScheduledTaskDraft());
const createFormKey = ref(0);
watch(
  routeThreadId,
  (threadId) => {
    createDraft.value = createScheduledTaskDraft({ routeThreadId: threadId });
    createFormKey.value += 1;
  },
  { immediate: true },
);

const editing = ref(false);
const editDraft = ref<ScheduledTaskDraft | null>(null);
watch(selectedId, () => {
  editing.value = false;
  editDraft.value = null;
});

const operationError = ref<string | null>(null);
const operationFeedback = ref<string | null>(null);

function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

function resetMessages() {
  operationError.value = null;
  operationFeedback.value = null;
}

async function createTask(draft: ScheduledTaskDraft) {
  resetMessages();
  try {
    const created = await mutations.create.mutateAsync(
      buildScheduledTaskCreatePayload(draft),
    );
    selectedId.value = created.id;
    createDraft.value = createScheduledTaskDraft({
      routeThreadId: routeThreadId.value,
    });
    createFormKey.value += 1;
    operationFeedback.value = $i18n.t.value.scheduledTasks.feedback.created;
  } catch (cause) {
    operationError.value = errorMessage(
      cause,
      $i18n.t.value.scheduledTasks.errors.create,
    );
  }
}

function startEdit() {
  const task = selectedTask.value;
  if (!task || task.status === "running") return;
  editDraft.value = draftForScheduledTask(task);
  editing.value = true;
  resetMessages();
}

async function saveEdit(draft: ScheduledTaskDraft) {
  const task = selectedTask.value;
  if (!task) return;
  resetMessages();
  try {
    await mutations.update.mutateAsync({
      task,
      payload: buildScheduledTaskUpdatePayload(draft, task),
    });
    editing.value = false;
    editDraft.value = null;
    operationFeedback.value = $i18n.t.value.scheduledTasks.feedback.updated;
  } catch (cause) {
    operationError.value = errorMessage(
      cause,
      $i18n.t.value.scheduledTasks.errors.update,
    );
  }
}

async function runAction(operation: "pause" | "resume" | "trigger" | "remove") {
  const task = selectedTask.value;
  if (!task || task.status === "running") return;
  resetMessages();
  try {
    await mutations[operation].mutateAsync({ task });
    if (operation === "remove") {
      selectedId.value = null;
      editing.value = false;
    }
    operationFeedback.value =
      $i18n.t.value.scheduledTasks.feedback[
        operation === "remove" ? "deleted" : operation
      ];
  } catch (cause) {
    operationError.value = errorMessage(
      cause,
      $i18n.t.value.scheduledTasks.errors[
        operation === "remove" ? "delete" : operation
      ],
    );
  }
}

const loadError = computed(() =>
  tasksQuery.error.value
    ? errorMessage(
        tasksQuery.error.value,
        $i18n.t.value.scheduledTasks.detail.loadFailed,
      )
    : null,
);
const runsError = computed(() =>
  runsQuery.error.value
    ? errorMessage(
        runsQuery.error.value,
        $i18n.t.value.scheduledTasks.errors.loadRuns,
      )
    : null,
);
</script>

<template>
  <section class="h-full overflow-y-auto p-4 sm:p-6">
    <div class="mx-auto max-w-7xl space-y-5">
      <header>
        <h1 class="text-2xl font-semibold">
          {{ $i18n.t.value.sidebar.scheduledTasks }}
        </h1>
        <p v-if="routeThreadId" class="text-muted-foreground mt-1 text-sm">
          {{
            $i18n.t.value.scheduledTasks.detail.filteredByThread.replace(
              "{id}",
              routeThreadId,
            )
          }}
        </p>
      </header>

      <p
        v-if="loadError || operationError"
        role="alert"
        data-testid="scheduled-task-error"
        class="rounded-md bg-red-50 p-3 text-sm text-red-700"
      >
        {{ loadError || operationError }}
      </p>
      <p
        v-if="operationFeedback"
        role="status"
        data-testid="scheduled-task-feedback"
        class="rounded-md bg-green-50 p-3 text-sm text-green-800"
      >
        {{ operationFeedback }}
      </p>

      <ScheduledTaskForm
        :key="createFormKey"
        mode="create"
        :draft="createDraft"
        :pending="mutations.create.isPending.value"
        :error="operationError"
        @submit="createTask"
      />

      <ScheduledTaskFilters
        v-model:status="statusFilter"
        v-model:schedule-type="scheduleTypeFilter"
      />

      <div
        class="grid min-h-80 gap-4 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.4fr)]"
      >
        <ScheduledTaskList
          :tasks="filteredTasks"
          :selected-id="selectedId"
          :loading="tasksQuery.isLoading.value"
          @select="selectedId = $event"
        />

        <ScheduledTaskForm
          v-if="editing && editDraft"
          :key="selectedId ?? 'edit'"
          mode="edit"
          :draft="editDraft"
          :pending="mutations.update.isPending.value"
          :error="operationError"
          @submit="saveEdit"
          @cancel="editing = false"
        />
        <ScheduledTaskDetail
          v-else-if="selectedTask"
          :task="selectedTask"
          :runs="runsQuery.runs.value"
          :runs-loading="runsQuery.isLoading.value"
          :runs-loading-more="runsQuery.isFetchingNextPage.value"
          :runs-has-more="Boolean(runsQuery.hasNextPage.value)"
          :runs-error="runsError"
          :pending="mutationPending"
          @edit="startEdit"
          @pause="runAction('pause')"
          @resume="runAction('resume')"
          @trigger="runAction('trigger')"
          @delete="runAction('remove')"
          @load-more-runs="runsQuery.loadMore()"
        />
        <p
          v-else
          class="border-border text-muted-foreground rounded-xl border p-4 text-sm"
        >
          {{ $i18n.t.value.scheduledTasks.detail.noSelection }}
        </p>
      </div>
    </div>
  </section>
</template>
