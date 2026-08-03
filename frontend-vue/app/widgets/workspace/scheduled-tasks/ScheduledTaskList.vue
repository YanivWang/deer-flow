<script setup lang="ts">
import { reactive } from "vue";

import { scheduleSummary } from "../../../entities/scheduled-task/model";
import type { ScheduledTaskPageController } from "../../../features/scheduled-tasks/use-scheduled-task-page";

const props = defineProps<{ controller: ScheduledTaskPageController }>();
const controller = reactive(props.controller);
</script>

<template>
  <section class="scheduled-list" data-testid="vue-scheduled-task-list">
    <a-spin v-if="controller.query.isLoading" role="status" />
    <a-empty v-else-if="controller.tasks.length === 0" description="暂无计划任务" />
    <a-empty v-else-if="controller.filteredTasks.length === 0" description="没有匹配的计划任务" />
    <template v-else>
      <div
        v-for="task in controller.filteredTasks"
        :key="task.id"
        :data-testid="`scheduled-task-item-${task.id}`"
        class="scheduled-list__item-hit-area"
      >
        <button
          type="button"
          class="scheduled-list__item"
          :class="{ 'scheduled-list__item--active': task.id === controller.selectedTaskId }"
          :data-testid="`vue-scheduled-task-${task.id}`"
          @click="controller.selectedTaskId = task.id"
        >
          <strong>{{ task.title }}</strong>
          <span>{{ scheduleSummary(task) }} · {{ task.status === "paused" ? "Paused" : task.status }}</span>
        </button>
      </div>
    </template>
  </section>
</template>
