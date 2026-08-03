<script setup lang="ts">
import { reactive } from "vue";

import type { ScheduledTaskPageController } from "../../../features/scheduled-tasks/use-scheduled-task-page";

const props = defineProps<{ controller: ScheduledTaskPageController }>();
const controller = reactive(props.controller);
</script>

<template>
  <section class="scheduled-create__builder" data-testid="vue-scheduled-cron-builder">
    <h3>结构化 Cron 构建器</h3>
    <label>
      <span>重复</span>
      <select v-model="controller.cronBuilderMode" data-testid="vue-scheduled-cron-builder-mode" @change="controller.applyCronBuilder">
        <option v-for="mode in controller.cronBuilderModes" :key="mode.value" :value="mode.value">{{ mode.label }}</option>
      </select>
    </label>
    <label>
      <span>小时</span>
      <input v-model="controller.cronBuilderHour" data-testid="vue-scheduled-cron-builder-hour" inputmode="numeric" maxlength="2" @input="controller.applyCronBuilder">
    </label>
    <label>
      <span>分钟</span>
      <input v-model="controller.cronBuilderMinute" data-testid="vue-scheduled-cron-builder-minute" inputmode="numeric" maxlength="2" @input="controller.applyCronBuilder">
    </label>
    <label v-if="controller.cronBuilderMode === 'weekly'">
      <span>星期</span>
      <select v-model="controller.cronBuilderWeekday" data-testid="vue-scheduled-cron-builder-weekday" @change="controller.applyCronBuilder">
        <option v-for="weekday in controller.cronWeekdays" :key="weekday.value" :value="weekday.value">{{ weekday.label }}</option>
      </select>
    </label>
    <label v-if="controller.cronBuilderMode === 'monthly'">
      <span>每月日期</span>
      <select v-model="controller.cronBuilderMonthDay" data-testid="vue-scheduled-cron-builder-month-day" @change="controller.applyCronBuilder">
        <option v-for="day in controller.cronMonthDays" :key="day" :value="day">{{ day }}</option>
      </select>
    </label>
  </section>
</template>
