<script setup lang="ts">
import { reactive } from "vue";

import type { ScheduledTaskPageController } from "../../../features/scheduled-tasks/use-scheduled-task-page";
import CronBuilder from "./CronBuilder.vue";

const props = defineProps<{ controller: ScheduledTaskPageController; editing?: boolean }>();
const controller = reactive(props.controller);
const { t } = useAppI18n();
</script>

<template>
  <template v-if="!editing">
    <label v-if="controller.scheduleType === 'cron'">
      <span>Cron</span>
      <input v-model="controller.cron" data-testid="vue-scheduled-cron" @input="controller.formError = null">
    </label>
    <CronBuilder v-if="controller.scheduleType === 'cron'" :controller="props.controller" />
    <section v-if="controller.scheduleType === 'cron'" class="scheduled-create__presets" data-testid="vue-scheduled-cron-presets">
      <h3>Cron 预设</h3>
      <button v-for="preset in controller.cronPresets" :key="preset.id" type="button" class="scheduled-create__type-button" :data-testid="`vue-scheduled-cron-preset-${preset.id}`" @click="controller.applyCronPreset(preset)">
        {{ preset.label }}
      </button>
    </section>
    <label v-else>
      <span>{{ t("scheduledTasks.fields.runAt") }}</span>
      <input v-model="controller.runAtLocal" data-testid="vue-scheduled-run-at" type="datetime-local">
    </label>
    <label>
      <span>时区</span>
      <select v-model="controller.timezone" data-testid="vue-scheduled-timezone">
        <option v-for="zone in controller.timezoneOptions" :key="zone" :value="zone">{{ zone }}</option>
      </select>
    </label>
    <p class="scheduled-create__preview" data-testid="vue-scheduled-preview">{{ controller.createSchedulePreview }}</p>
    <p class="scheduled-create__preview" data-testid="vue-scheduled-timezone-affordance">{{ controller.createTimezoneAffordance }}</p>
  </template>
  <template v-else-if="controller.visibleSelectedTask">
    <label v-if="controller.visibleSelectedTask.schedule_type === 'cron'">
      <span>Cron</span><input v-model="controller.editCron" data-testid="vue-scheduled-edit-cron">
    </label>
    <label v-else>
      <span>运行时间</span><input v-model="controller.editRunAtLocal" data-testid="vue-scheduled-edit-run-at" type="datetime-local">
    </label>
    <label>
      <span>时区</span>
      <select v-model="controller.editTimezone" data-testid="vue-scheduled-edit-timezone">
        <option v-for="zone in controller.timezoneOptions" :key="zone" :value="zone">{{ zone }}</option>
      </select>
    </label>
    <p class="scheduled-create__preview" data-testid="vue-scheduled-edit-preview">{{ controller.editSchedulePreview }}</p>
    <p class="scheduled-create__preview" data-testid="vue-scheduled-edit-timezone-affordance">{{ controller.editTimezoneAffordance }}</p>
  </template>
</template>
