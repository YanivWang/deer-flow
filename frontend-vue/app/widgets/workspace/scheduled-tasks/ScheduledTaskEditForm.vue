<script setup lang="ts">
import { reactive } from "vue";

import type { ScheduledTaskPageController } from "../../../features/scheduled-tasks/use-scheduled-task-page";
import AppButton from "../../../shared/ui/AppButton.vue";
import AppFormField from "../../../shared/ui/AppFormField.vue";
import ScheduledTaskScheduleInput from "./ScheduledTaskScheduleInput.vue";

const props = defineProps<{ controller: ScheduledTaskPageController }>();
const controller = reactive(props.controller);
</script>

<template>
  <form v-if="controller.visibleSelectedTask" class="scheduled-edit" data-testid="vue-scheduled-edit-form" @submit.prevent="controller.submitEditTask">
    <AppFormField for-id="vue-scheduled-edit-title" label="标题" required><input id="vue-scheduled-edit-title" v-model="controller.editTitle" data-testid="vue-scheduled-edit-title"></AppFormField>
    <AppFormField for-id="vue-scheduled-edit-prompt" label="提示词" required><textarea id="vue-scheduled-edit-prompt" v-model="controller.editPrompt" data-testid="vue-scheduled-edit-prompt" /></AppFormField>
    <ScheduledTaskScheduleInput :controller="props.controller" editing />
    <a-alert v-if="controller.editError" id="vue-scheduled-edit-error-message" data-testid="vue-scheduled-edit-error" role="alert" type="error" show-icon :message="controller.editError" />
    <AppButton html-type="submit" variant="primary" :loading="controller.isActionPending" data-testid="vue-scheduled-edit-submit">保存修改</AppButton>
  </form>
</template>
