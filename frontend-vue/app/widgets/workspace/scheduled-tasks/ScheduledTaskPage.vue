<script setup lang="ts">
import { reactive } from "vue";

import ScheduledTaskCreateForm from "./ScheduledTaskCreateForm.vue";
import ScheduledTaskDetail from "./ScheduledTaskDetail.vue";
import ScheduledTaskFilters from "./ScheduledTaskFilters.vue";
import ScheduledTaskList from "./ScheduledTaskList.vue";
import WorkspaceNavShell from "../navigation/WorkspaceNavShell.vue";
import { useScheduledTaskPage } from "../../../features/scheduled-tasks/use-scheduled-task-page";
import AppButton from "../../../shared/ui/AppButton.vue";

const route = useRoute();
const threadId = computed(() => route.query.thread_id?.toString() || null);
const rawController = useScheduledTaskPage(threadId);
const controller = reactive(rawController);
</script>

<template>
  <WorkspaceNavShell>
    <section class="scheduled-page">
      <header class="scheduled-page__header">
        <div>
          <p class="workspace-chat__eyebrow">工作区</p>
          <h1>计划任务</h1>
        </div>
        <AppButton
          :loading="controller.query.isFetching"
          variant="ghost"
          aria-label="刷新计划任务"
          data-testid="vue-scheduled-refresh"
          @click="controller.refreshScheduledTasks"
        >
          刷新
        </AppButton>
      </header>

      <a-alert
        v-if="controller.loadErrorMessage"
        data-testid="vue-scheduled-load-error"
        role="alert"
        type="error"
        show-icon
        :message="controller.loadErrorMessage"
      />
      <a-alert
        v-if="controller.actionErrorMessage"
        data-testid="vue-scheduled-action-error"
        role="alert"
        type="error"
        show-icon
        :message="controller.actionErrorMessage"
      />

      <ScheduledTaskCreateForm :controller="rawController" />
      <ScheduledTaskFilters :controller="rawController" />
      <section class="scheduled-layout">
        <ScheduledTaskList :controller="rawController" />
        <ScheduledTaskDetail :controller="rawController" />
      </section>
    </section>
  </WorkspaceNavShell>
</template>
