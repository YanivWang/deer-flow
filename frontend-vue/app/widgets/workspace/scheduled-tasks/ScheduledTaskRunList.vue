<script setup lang="ts">
import { reactive } from "vue";

import {
  formatRunStatusLabel,
  formatRunTriggerLabel,
  formatTaskTimestamp,
} from "../../../entities/scheduled-task/model";
import type { ScheduledTaskPageController } from "../../../features/scheduled-tasks/use-scheduled-task-page";

const props = defineProps<{ controller: ScheduledTaskPageController }>();
const controller = reactive(props.controller);
</script>

<template>
  <section class="scheduled-runs" data-testid="vue-scheduled-runs">
    <div data-testid="scheduled-task-runs">
      <h3>运行记录 · {{ controller.runs.length }} {{ controller.runs.length === 1 ? "run" : "runs" }}</h3>
      <a-spin v-if="controller.runsQuery.isLoading" role="status" />
      <a-empty v-else-if="controller.runs.length === 0" description="暂无运行记录" />
      <ul v-else data-testid="scheduled-task-run-list">
        <li v-for="run in controller.runs" :key="run.id">
          <strong>{{ formatRunStatusLabel(run.status) }}</strong>
          · {{ formatRunTriggerLabel(run.trigger) }}
          · {{ run.trigger === "manual" ? "Manual" : "Scheduled" }} · {{ run.status === "success" ? "Success" : run.status }}
          · 计划时间 {{ formatTaskTimestamp(run.scheduled_for, controller.visibleSelectedTask?.timezone ?? "UTC") }}
          <span v-if="run.run_id"> · 运行 {{ run.run_id }}</span>
          <span v-if="run.started_at"> · 开始 {{ formatTaskTimestamp(run.started_at, controller.visibleSelectedTask?.timezone ?? "UTC") }}</span>
          <span v-if="run.finished_at"> · 结束 {{ formatTaskTimestamp(run.finished_at, controller.visibleSelectedTask?.timezone ?? "UTC") }}</span>
          <span v-if="run.error"> · {{ run.error }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>
