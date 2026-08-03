<script setup lang="ts">
import { reactive } from "vue";

import type { ScheduledTaskPageController } from "../../../features/scheduled-tasks/use-scheduled-task-page";

const props = defineProps<{ controller: ScheduledTaskPageController }>();
const controller = reactive(props.controller);
</script>

<template>
  <section class="scheduled-filters" data-testid="vue-scheduled-filters">
    <button
      type="button"
      :class="{ 'scheduled-create__type-button--active': controller.statusFilter === 'all' }"
      data-testid="vue-scheduled-filter-status-all"
      @click="controller.statusFilter = 'all'"
    >全部状态</button>
    <button
      type="button"
      :class="{ 'scheduled-create__type-button--active': controller.statusFilter === 'enabled' }"
      data-testid="vue-scheduled-filter-status-enabled"
      @click="controller.statusFilter = 'enabled'"
    >已启用</button>
    <button
      type="button"
      :class="{ 'scheduled-create__type-button--active': controller.statusFilter === 'paused' }"
      data-testid="vue-scheduled-filter-status-paused"
      @click="controller.statusFilter = 'paused'"
    >已暂停</button>
    <button
      type="button"
      :class="{ 'scheduled-create__type-button--active': controller.statusFilter === 'failed' }"
      data-testid="vue-scheduled-filter-status-failed"
      @click="controller.statusFilter = 'failed'"
    >失败</button>
    <button
      type="button"
      :class="{ 'scheduled-create__type-button--active': controller.typeFilter === 'all' }"
      data-testid="vue-scheduled-filter-type-all"
      @click="controller.typeFilter = 'all'"
    >全部类型</button>
    <button
      type="button"
      :class="{ 'scheduled-create__type-button--active': controller.typeFilter === 'cron' }"
      data-testid="vue-scheduled-filter-type-cron"
      @click="controller.typeFilter = 'cron'"
    >Cron</button>
    <button
      type="button"
      :class="{ 'scheduled-create__type-button--active': controller.typeFilter === 'once' }"
      data-testid="vue-scheduled-filter-type-once"
      @click="controller.typeFilter = 'once'"
    >单次</button>
  </section>
</template>
