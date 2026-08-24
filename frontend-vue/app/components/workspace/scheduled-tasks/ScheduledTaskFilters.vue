<script setup lang="ts">
/*
  【文件职责】     Scheduled-task 六状态与 once/cron 类型筛选控件。
  【架构位置】     L3 presentational component
  【主要导出】     默认 ScheduledTaskFilters
  【依赖关系】     scheduled-tasks/view-model · app i18n
  【边界与注意】   只发筛选值；实际筛选由 view-model 纯函数完成。
*/
import type {
  ScheduledTaskScheduleFilter,
  ScheduledTaskStatusFilter,
} from "@/core/scheduled-tasks/view-model";

defineProps<{
  status: ScheduledTaskStatusFilter;
  scheduleType: ScheduledTaskScheduleFilter;
}>();
const emit = defineEmits<{
  "update:status": [value: ScheduledTaskStatusFilter];
  "update:scheduleType": [value: ScheduledTaskScheduleFilter];
}>();
const { $i18n } = useNuxtApp();
</script>

<template>
  <div class="flex flex-wrap gap-2" data-testid="scheduled-task-filters">
    <label class="text-sm">
      <span class="sr-only">{{
        $i18n.t.value.scheduledTasks.filters.statusLabel
      }}</span>
      <select
        data-testid="scheduled-task-status-filter"
        class="border-input rounded-md border px-3 py-2"
        :value="status"
        @change="
          emit(
            'update:status',
            ($event.target as HTMLSelectElement)
              .value as ScheduledTaskStatusFilter,
          )
        "
      >
        <option value="all">
          {{ $i18n.t.value.scheduledTasks.filters.allStatuses }}
        </option>
        <option
          v-for="value in [
            'enabled',
            'paused',
            'running',
            'completed',
            'failed',
            'cancelled',
          ] as const"
          :key="value"
          :value="value"
        >
          {{ $i18n.t.value.scheduledTasks.status[value] }}
        </option>
      </select>
    </label>
    <label class="text-sm">
      <span class="sr-only">{{
        $i18n.t.value.scheduledTasks.filters.typeLabel
      }}</span>
      <select
        data-testid="scheduled-task-type-filter"
        class="border-input rounded-md border px-3 py-2"
        :value="scheduleType"
        @change="
          emit(
            'update:scheduleType',
            ($event.target as HTMLSelectElement)
              .value as ScheduledTaskScheduleFilter,
          )
        "
      >
        <option value="all">
          {{ $i18n.t.value.scheduledTasks.filters.allTypes }}
        </option>
        <option value="cron">
          {{ $i18n.t.value.scheduledTasks.filters.cron }}
        </option>
        <option value="once">
          {{ $i18n.t.value.scheduledTasks.filters.once }}
        </option>
      </select>
    </label>
  </div>
</template>
