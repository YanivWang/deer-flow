<script setup lang="ts">
import { reactive } from "vue";

import type { ScheduledTaskPageController } from "../../../features/scheduled-tasks/use-scheduled-task-page";
import AppButton from "../../../shared/ui/AppButton.vue";
import AppActionGroup from "../../../shared/ui/AppActionGroup.vue";
import AppFormField from "../../../shared/ui/AppFormField.vue";
import ScheduledTaskScheduleInput from "./ScheduledTaskScheduleInput.vue";

const props = defineProps<{ controller: ScheduledTaskPageController }>();
const controller = reactive(props.controller);
const { t } = useAppI18n();
</script>

<template>
  <div data-testid="scheduled-task-create-form">
    <form
      class="scheduled-create"
      data-testid="vue-scheduled-create-form"
      @submit.prevent="controller.submitTask"
    >
      <h2>创建计划任务</h2>
      <section class="scheduled-create__recipes" data-testid="vue-scheduled-recipes">
        <h3>模板</h3>
        <AppButton
          v-for="recipe in controller.scheduleRecipes"
          :key="recipe.id"
          variant="ghost"
          size="sm"
          type="button"
          class="scheduled-create__type-button"
          :aria-label="recipe.title"
          :data-testid="`vue-scheduled-recipe-${recipe.id}`"
          @click="controller.applyRecipe(recipe)"
        >
          {{ recipe.title }}
        </AppButton>
      </section>
      <AppFormField for-id="vue-scheduled-title" :label="t('scheduledTasks.create.taskTitle')" required>
        <input
          id="vue-scheduled-title"
          v-model="controller.title"
          :placeholder="t('scheduledTasks.create.taskTitle')"
          data-testid="vue-scheduled-title"
        >
      </AppFormField>
      <AppFormField for-id="vue-scheduled-prompt" :label="t('scheduledTasks.create.prompt')" required>
        <textarea
          id="vue-scheduled-prompt"
          v-model="controller.prompt"
          :placeholder="t('scheduledTasks.create.prompt')"
          data-testid="vue-scheduled-prompt"
        />
      </AppFormField>
      <div class="scheduled-create__type" data-testid="vue-scheduled-type" role="group">
        <button
          type="button"
          :class="{ 'scheduled-create__type-button--active': controller.scheduleType === 'cron' }"
          data-testid="vue-scheduled-type-cron"
          @click="controller.scheduleType = 'cron'"
        >
          Cron
        </button>
        <button
          type="button"
          :class="{ 'scheduled-create__type-button--active': controller.scheduleType === 'once' }"
          data-testid="vue-scheduled-type-once"
          @click="controller.scheduleType = 'once'"
        >
          {{ t("scheduledTasks.scheduleType.once") }}
        </button>
      </div>
      <ScheduledTaskScheduleInput :controller="props.controller" />
      <small v-if="controller.resolvedThreadId" data-testid="vue-scheduled-thread-scope">
        复用对话 {{ controller.resolvedThreadId }}
      </small>
      <a-alert
        v-if="controller.formError"
        id="vue-scheduled-form-error-message"
        data-testid="vue-scheduled-form-error"
        role="alert"
        type="error"
        show-icon
        :message="controller.formError"
      />
      <AppActionGroup>
        <AppButton
          html-type="submit"
          variant="primary"
          :loading="controller.isActionPending"
          data-testid="vue-scheduled-submit"
        >
          {{ t("scheduledTasks.create.submit") }}
        </AppButton>
      </AppActionGroup>
    </form>
  </div>
</template>
