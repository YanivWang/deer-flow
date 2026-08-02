<script setup lang="ts">
import { useQuery } from "@tanstack/vue-query";
import { computed } from "vue";

const { t } = useAppI18n();
const agentsFeature = useAgentsApiEnabled();
const agentsQuery = useQuery({
  queryKey: ["agents"],
  queryFn: fetchAgents,
  enabled: computed(() => agentsFeature.enabled.value && !agentsFeature.isLoading.value),
});

async function fetchAgents() {
  const response = await fetch("/api/agents", { credentials: "include" });
  if (!response.ok) {
    throw new Error("Failed to load agents");
  }
  const payload = (await response.json()) as { agents?: Array<{ name: string; description?: string }> };
  return payload.agents ?? [];
}
</script>

<template>
  <WorkspaceNavShell>
    <section v-if="agentsFeature.isLoading.value" class="workspace-simple-page" data-testid="vue-workspace-agents-loading">
      <p>{{ t("common.loading") }}</p>
    </section>
    <section v-else-if="!agentsFeature.enabled.value" class="workspace-feature-disabled" data-testid="vue-agents-feature-disabled">
      <div class="workspace-feature-disabled__icon">A</div>
      <h1>{{ t("agents.featureDisabledTitle") }}</h1>
      <p>{{ t("agents.featureDisabledDescription") }}</p>
    </section>
    <section v-else class="workspace-simple-page" data-testid="vue-workspace-agents-index">
      <h1>{{ t("agents.title") }}</h1>
      <p>{{ t("agents.description") }}</p>
      <p v-if="agentsQuery.isLoading.value">{{ t("common.loading") }}</p>
      <p v-else-if="agentsQuery.isError.value" class="workspace-error">{{ agentsQuery.error.value?.message }}</p>
      <div v-else class="workspace-agents-grid">
        <article v-for="agent in agentsQuery.data.value" :key="agent.name" class="workspace-agent-card">
          <h2>{{ agent.name }}</h2>
          <p>{{ agent.description }}</p>
          <NuxtLink class="workspace-button workspace-button--primary" :to="`/workspace/agents/${encodeURIComponent(agent.name)}/chats/new`">
            {{ t("agents.chat") }}
          </NuxtLink>
        </article>
      </div>
      <NuxtLink class="workspace-button workspace-button--primary" data-testid="vue-agents-new-link" to="/workspace/agents/new">
        {{ t("agents.newAgent") }}
      </NuxtLink>
    </section>
  </WorkspaceNavShell>
</template>
