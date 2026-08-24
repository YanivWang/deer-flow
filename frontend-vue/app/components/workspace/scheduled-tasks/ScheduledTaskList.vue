<script setup lang="ts">
/*
  【文件职责】     Scheduled-task 列表、选择态、加载态与空态。
  【架构位置】     L3 presentational component
  【主要导出】     默认 ScheduledTaskList
  【依赖关系】     scheduled-tasks/types · app i18n
  【边界与注意】   不持有列表副本，不发网络请求。
*/
import type { ScheduledTask } from "@/core/scheduled-tasks/types";

defineProps<{
  tasks: ScheduledTask[];
  selectedId: string | null;
  loading: boolean;
}>();
const emit = defineEmits<{ select: [taskId: string] }>();
const { $i18n } = useNuxtApp();
</script>

<template>
  <div class="space-y-2" data-testid="scheduled-task-list">
    <p v-if="loading" class="text-muted-foreground p-3 text-sm" role="status">
      {{ $i18n.t.value.scheduledTasks.detail.loading }}
    </p>
    <p v-else-if="tasks.length === 0" class="text-muted-foreground p-3 text-sm">
      {{ $i18n.t.value.scheduledTasks.detail.noTasks }}
    </p>
    <button
      v-for="task in tasks"
      :key="task.id"
      type="button"
      :data-testid="`scheduled-task-item-${task.id}`"
      class="border-border hover:bg-accent flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left"
      :class="selectedId === task.id ? 'ring-primary ring-2' : ''"
      @click="emit('select', task.id)"
    >
      <span class="min-w-0">
        <span class="block truncate font-medium">{{ task.title }}</span>
        <span class="text-muted-foreground mt-1 block text-xs">
          {{ $i18n.t.value.scheduledTasks.scheduleType[task.schedule_type] }} ·
          {{ task.timezone }}
        </span>
      </span>
      <span class="bg-muted shrink-0 rounded-full px-2 py-1 text-xs">
        {{ $i18n.t.value.scheduledTasks.status[task.status] }}
      </span>
    </button>
  </div>
</template>
