<script setup lang="ts">
import { reactive } from "vue";

import {
  formatTaskStatusLabel,
  formatTaskTimestamp,
} from "../../../entities/scheduled-task/model";
import type { ScheduledTaskPageController } from "../../../features/scheduled-tasks/use-scheduled-task-page";
import ScheduledTaskEditForm from "./ScheduledTaskEditForm.vue";
import ScheduledTaskRunList from "./ScheduledTaskRunList.vue";
import AppActionGroup from "../../../shared/ui/AppActionGroup.vue";

const props = defineProps<{ controller: ScheduledTaskPageController }>();
const controller = reactive(props.controller);
const { t } = useAppI18n();
</script>

<template>
  <section class="scheduled-detail" data-testid="vue-scheduled-detail">
    <div data-testid="scheduled-task-detail">
      <template v-if="controller.visibleSelectedTask">
        <div class="scheduled-detail__title-row">
          <h2>{{ controller.visibleSelectedTask.title }}</h2>
          <a-button
            :disabled="controller.visibleSelectedTask.status === 'running' || controller.isActionPending"
            data-testid="vue-scheduled-edit-toggle"
            @click="controller.isEditing = !controller.isEditing"
          >
            {{ controller.isEditing ? "取消编辑" : "编辑" }}
          </a-button>
        </div>
        <p v-if="!controller.isEditing">{{ controller.visibleSelectedTask.prompt }}</p>
        <dl>
          <dt>状态</dt>
          <dd>{{ formatTaskStatusLabel(controller.visibleSelectedTask.status) }}</dd>
          <dt>下次运行</dt>
          <dd>{{ formatTaskTimestamp(controller.visibleSelectedTask.next_run_at, controller.visibleSelectedTask.timezone) }}</dd>
          <dt>租约</dt>
          <dd>{{ formatTaskTimestamp(controller.visibleSelectedTask.lease_expires_at, controller.visibleSelectedTask.timezone) }}</dd>
          <dt>租约持有者</dt>
          <dd>{{ controller.visibleSelectedTask.lease_owner || "无" }}</dd>
          <dt>重叠策略</dt>
          <dd>{{ controller.visibleSelectedTask.overlap_policy }}</dd>
          <dt>运行次数</dt>
          <dd>{{ controller.visibleSelectedTask.run_count }}</dd>
          <dt>上次运行</dt>
          <dd>{{ controller.visibleSelectedTask.last_run_id || "无" }}</dd>
          <dt>上次对话</dt>
          <dd>{{ controller.visibleSelectedTask.last_thread_id || "无" }}</dd>
          <dt>上次错误</dt>
          <dd>{{ controller.visibleSelectedTask.last_error || "无" }}</dd>
        </dl>
        <ScheduledTaskEditForm v-if="controller.isEditing" :controller="props.controller" />
        <AppActionGroup class="scheduled-detail__actions">
          <a-button
            :disabled="controller.visibleSelectedTask.status === 'running' || controller.isActionPending"
            data-testid="vue-scheduled-pause"
            @click="controller.pauseSelectedTask"
          >{{ t("scheduledTasks.actions.pause") }}</a-button>
          <a-button
            :disabled="controller.visibleSelectedTask.status === 'running' || controller.isActionPending"
            data-testid="vue-scheduled-resume"
            @click="controller.resumeSelectedTask"
          >恢复</a-button>
          <a-button :disabled="controller.isActionPending" data-testid="vue-scheduled-trigger" @click="controller.triggerSelectedTask">
            {{ t("scheduledTasks.actions.trigger") }}
          </a-button>
          <a-button
            danger
            :disabled="controller.visibleSelectedTask.status === 'running' || controller.isActionPending"
            data-testid="vue-scheduled-delete"
            @click="controller.deleteSelectedTask"
          >删除</a-button>
        </AppActionGroup>
        <ScheduledTaskRunList :controller="props.controller" />
      </template>
      <a-empty v-else description="未选择计划任务" />
    </div>
  </section>
</template>
