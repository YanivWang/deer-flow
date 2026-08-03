<script setup lang="ts">
import type { AgentsGalleryController } from "../../../features/agents/use-agents-gallery";
import AgentCard from "./AgentCard.vue";
import AgentSettingsDialog from "./AgentSettingsDialog.vue";
import AppDialog from "../../../shared/ui/AppDialog.vue";
import AppEmptyState from "../../../shared/ui/AppEmptyState.vue";
import AppFeedback from "../../../shared/ui/AppFeedback.vue";

const { t } = useAppI18n();
const props = defineProps<{ gallery: AgentsGalleryController }>();
</script>

<template>
  <AppEmptyState v-if="props.gallery.feature.isLoading.value" state="loading" :title="t('common.loading')" data-testid="vue-workspace-agents-loading" />
  <section v-else-if="!props.gallery.feature.enabled.value" class="workspace-feature-disabled" data-testid="vue-agents-feature-disabled">
    <div class="workspace-feature-disabled__icon">A</div>
    <h1>{{ t("agents.featureDisabledTitle") }}</h1>
    <p>{{ t("agents.featureDisabledDescription") }}</p>
  </section>
  <section v-else class="workspace-agents-page" data-testid="vue-workspace-agents-index">
    <header class="workspace-agents-page__header">
      <div>
        <h1>{{ t("agents.title") }}</h1>
        <p>{{ t("agents.description") }}</p>
      </div>
      <NuxtLink class="workspace-button workspace-button--primary" data-testid="vue-agents-new-link" to="/workspace/agents/new">
        {{ t("agents.newAgent") }}
      </NuxtLink>
    </header>
    <AppEmptyState v-if="props.gallery.agentsQuery.isLoading.value" state="loading" :title="t('common.loading')" />
    <AppFeedback v-else-if="props.gallery.listError.value" tone="error" :message="props.gallery.listError.value" data-testid="vue-agents-error" />
    <AppEmptyState v-else-if="props.gallery.agents.value.length === 0" state="empty" :title="t('agents.emptyTitle')" :message="t('agents.emptyDescription')" data-testid="vue-agents-empty">
      <NuxtLink class="workspace-button workspace-button--ghost" to="/workspace/agents/new">{{ t("agents.newAgent") }}</NuxtLink>
    </AppEmptyState>
    <div v-else class="workspace-agents-grid" data-testid="vue-agents-grid">
      <AgentCard v-for="agent in props.gallery.agents.value" :key="agent.name" :agent="agent" @open-settings="props.gallery.openSettings" @request-delete="props.gallery.requestDelete" />
    </div>
    <AppFeedback v-if="props.gallery.actionMessage.value" tone="success" :message="props.gallery.actionMessage.value" data-testid="vue-agents-action-message" />
    <AppFeedback v-if="props.gallery.actionError.value && !props.gallery.settingsAgent.value" tone="error" :message="props.gallery.actionError.value" data-testid="vue-agents-action-error" />
  </section>

  <AgentSettingsDialog v-if="props.gallery.settingsAgent.value" :agent="props.gallery.settingsAgent.value" :gallery="props.gallery" />

  <AppDialog
    :open="Boolean(props.gallery.deleteTarget.value)"
    :title="t('agents.delete')"
    data-testid="vue-agent-delete-dialog"
    @close="props.gallery.cancelDelete"
  >
    <p>{{ t("agents.deleteConfirm") }}</p>
    <AppFeedback v-if="props.gallery.actionError.value" tone="error" :message="props.gallery.actionError.value" />
    <footer class="workspace-dialog__footer">
      <button class="workspace-button workspace-button--ghost" type="button" :disabled="props.gallery.isDeleting.value" @click="props.gallery.cancelDelete">{{ t("common.cancel") }}</button>
      <button class="workspace-button workspace-button--danger" data-testid="vue-agent-delete-confirm" type="button" :disabled="props.gallery.isDeleting.value" @click="props.gallery.confirmDelete">
        {{ props.gallery.isDeleting.value ? t("common.loading") : t("common.delete") }}
      </button>
    </footer>
  </AppDialog>
</template>
