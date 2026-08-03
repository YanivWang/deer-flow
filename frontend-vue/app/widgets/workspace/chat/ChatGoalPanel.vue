<script setup lang="ts">
type GoalContinuation = {
  count: number;
  max: number;
};

const props = defineProps<{
  displayedGoalObjective: string | null;
  goalContinuation: GoalContinuation | null;
  goalDraft: string;
  goalErrorMessage: string | null;
  hasGoal: boolean;
  isGoalPending: boolean;
}>();

const emit = defineEmits<{
  clear: [];
  refresh: [];
  submit: [];
  "update:goalDraft": [value: string];
}>();

const { t } = useAppI18n();
</script>

<template>
  <section class="workspace-goal" data-testid="vue-goal-status">
    <div class="workspace-goal__header">
      <h2>{{ t("inputBox.goalLabel") }}</h2>
      <div class="workspace-goal__actions">
        <a-button
          size="small"
          :loading="props.isGoalPending"
          data-testid="vue-goal-refresh"
          @click="emit('refresh')"
        >
          Refresh
        </a-button>
        <a-button
          size="small"
          danger
          :disabled="!props.hasGoal || props.isGoalPending"
          data-testid="vue-goal-clear"
          @click="emit('clear')"
        >
          Clear
        </a-button>
      </div>
    </div>
    <a-alert
      v-if="props.goalErrorMessage"
      data-testid="vue-goal-error"
      role="alert"
      type="error"
      show-icon
      :message="props.goalErrorMessage"
    />
    <p v-if="props.displayedGoalObjective" class="workspace-goal__objective" data-testid="vue-goal-objective">
      <span class="font-medium">{{ props.displayedGoalObjective }}</span>
    </p>
    <p v-else class="workspace-goal__empty">{{ t("inputBox.goalNone") }}</p>
    <small v-if="props.goalContinuation" class="workspace-goal__continuation" data-testid="vue-goal-continuation">
      {{ t("inputBox.goalContinuing", { count: props.goalContinuation.count, max: props.goalContinuation.max }) }}
    </small>
    <form class="workspace-goal__form" @submit.prevent="emit('submit')">
      <a-input
        :value="props.goalDraft"
        :placeholder="t('inputBox.goalLabel')"
        data-testid="vue-goal-input"
        @update:value="emit('update:goalDraft', String($event))"
      />
      <a-button
        html-type="submit"
        type="primary"
        :disabled="!props.goalDraft.trim() || props.isGoalPending"
        :loading="props.isGoalPending"
        data-testid="vue-goal-submit"
      >
        {{ t("common.save") }}
      </a-button>
    </form>
  </section>
</template>
