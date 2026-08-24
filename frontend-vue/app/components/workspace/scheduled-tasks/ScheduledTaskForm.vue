<script setup lang="ts">
/*
  【文件职责】     Scheduled-task create/edit 表单与 recipe 应用 UI。
  【架构位置】     L3 scheduled-task form component
  【主要导出】     默认 ScheduledTaskForm
  【依赖关系】     ScheduledTaskScheduleInput · form pure logic · recipes
  【边界与注意】   仅提交 draft；Gateway payload 由页面通过 form.ts 构建，组件不持有 server state。
*/
import { reactive, watch } from "vue";

import ScheduledTaskScheduleInput from "./ScheduledTaskScheduleInput.vue";
import {
  applyScheduledTaskRecipe,
  type ScheduledTaskDraft,
} from "@/core/scheduled-tasks/form";
import { RECIPES } from "@/core/scheduled-tasks/recipes";

const props = defineProps<{
  mode: "create" | "edit";
  draft: ScheduledTaskDraft;
  pending: boolean;
  error?: string | null;
}>();
const emit = defineEmits<{
  submit: [draft: ScheduledTaskDraft];
  cancel: [];
}>();
const { $i18n } = useNuxtApp();

function cloneDraft(draft: ScheduledTaskDraft): ScheduledTaskDraft {
  return {
    ...draft,
    schedule: {
      ...draft.schedule,
      schedule_spec: { ...draft.schedule.schedule_spec },
    },
  };
}

const local = reactive<ScheduledTaskDraft>(cloneDraft(props.draft));
watch(
  () => props.draft,
  (draft) => Object.assign(local, cloneDraft(draft)),
  { deep: true },
);

function applyRecipe(recipe: (typeof RECIPES)[number]) {
  const title = $i18n.t.value.scheduledTasks.recipes[recipe.titleKey].title;
  Object.assign(local, applyScheduledTaskRecipe(local, recipe, title));
}
</script>

<template>
  <form
    :data-testid="`scheduled-task-${mode}-form`"
    class="border-border space-y-4 rounded-xl border p-4"
    @submit.prevent="emit('submit', cloneDraft(local))"
  >
    <h2 class="font-medium">
      {{
        mode === "create"
          ? $i18n.t.value.scheduledTasks.create.title
          : $i18n.t.value.scheduledTasks.actions.edit
      }}
    </h2>

    <fieldset v-if="mode === 'create'" class="space-y-2">
      <legend class="text-muted-foreground text-xs font-medium uppercase">
        {{ $i18n.t.value.scheduledTasks.recipes.label }}
      </legend>
      <div class="grid gap-2 sm:grid-cols-2">
        <button
          v-for="recipe in RECIPES"
          :key="recipe.id"
          :data-testid="`scheduled-task-recipe-${recipe.id}`"
          type="button"
          class="hover:bg-accent rounded-md border p-2 text-left text-sm"
          @click="applyRecipe(recipe)"
        >
          <span class="font-medium"
            >{{ recipe.icon }}
            {{
              $i18n.t.value.scheduledTasks.recipes[recipe.titleKey].title
            }}</span
          >
          <span class="text-muted-foreground mt-1 block text-xs">{{
            $i18n.t.value.scheduledTasks.recipes[recipe.titleKey].desc
          }}</span>
        </button>
      </div>
    </fieldset>

    <div class="grid gap-3 sm:grid-cols-2">
      <label class="text-sm">
        <span>{{ $i18n.t.value.scheduledTasks.create.taskTitle }}</span>
        <input
          v-model="local.title"
          data-testid="scheduled-task-title"
          required
          class="border-input mt-1 w-full rounded-md border px-3 py-2"
          :placeholder="
            mode === 'edit'
              ? $i18n.t.value.scheduledTasks.edit.titlePlaceholder
              : $i18n.t.value.scheduledTasks.create.taskTitle
          "
        />
      </label>
      <label class="text-sm">
        <span>{{ $i18n.t.value.scheduledTasks.detail.contextMode }}</span>
        <select
          v-model="local.contextMode"
          data-testid="scheduled-task-context-mode"
          class="border-input mt-1 w-full rounded-md border px-3 py-2"
        >
          <option value="fresh_thread_per_run">
            {{ $i18n.t.value.scheduledTasks.context.fresh }}
          </option>
          <option value="reuse_thread">
            {{ $i18n.t.value.scheduledTasks.context.reuse }}
          </option>
        </select>
      </label>
    </div>
    <label v-if="local.contextMode === 'reuse_thread'" class="block text-sm">
      <span>{{ $i18n.t.value.scheduledTasks.detail.thread }}</span>
      <input
        v-model="local.threadId"
        data-testid="scheduled-task-thread-id"
        required
        class="border-input mt-1 w-full rounded-md border px-3 py-2"
        :placeholder="$i18n.t.value.scheduledTasks.context.threadIdPlaceholder"
      />
    </label>
    <label class="block text-sm">
      <span>{{ $i18n.t.value.scheduledTasks.create.prompt }}</span>
      <textarea
        v-model="local.prompt"
        data-testid="scheduled-task-prompt"
        required
        rows="5"
        class="border-input mt-1 w-full rounded-md border px-3 py-2"
        :placeholder="
          mode === 'edit'
            ? $i18n.t.value.scheduledTasks.edit.promptPlaceholder
            : $i18n.t.value.scheduledTasks.create.prompt
        "
      />
    </label>

    <ScheduledTaskScheduleInput
      v-model="local.schedule"
      :type-locked="mode === 'edit'"
    />

    <p
      v-if="error"
      role="alert"
      class="rounded-md bg-red-50 p-3 text-sm text-red-700"
    >
      {{ error }}
    </p>
    <div class="flex justify-end gap-2">
      <button
        v-if="mode === 'edit'"
        type="button"
        class="rounded-md border px-3 py-2 text-sm"
        :disabled="pending"
        @click="emit('cancel')"
      >
        {{ $i18n.t.value.scheduledTasks.actions.cancelEdit }}
      </button>
      <button
        type="submit"
        data-testid="scheduled-task-submit"
        class="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm"
        :disabled="pending"
      >
        {{
          mode === "create"
            ? $i18n.t.value.scheduledTasks.create.submit
            : $i18n.t.value.scheduledTasks.edit.submit
        }}
      </button>
    </div>
  </form>
</template>
