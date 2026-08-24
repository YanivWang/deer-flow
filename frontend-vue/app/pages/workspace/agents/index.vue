<script setup lang="ts">
/*
  【文件职责】     通过 Vue Query 列出、编辑和删除 DeerFlow custom agents。
  【架构位置】     L3 application page
  【主要导出】     默认 agents page
  【依赖关系】     useAgents · useModels · workspace features · Agent components
  【边界与注意】   feature ready+enabled 才查询；Vue Query 是唯一 server-state owner。
*/
import { computed, ref } from "vue";

import AgentCard from "@/components/workspace/agents/AgentCard.vue";
import AgentSettingsDialog from "@/components/workspace/agents/AgentSettingsDialog.vue";
import { useAgents } from "@/composables/useAgents";
import { useModels } from "@/composables/useModels";
import { useWorkspaceFeatures } from "@/composables/useWorkspaceFeatures";
import type { Agent, UpdateAgentRequest } from "@/core/agents/types";

definePageMeta({ layout: "workspace" });
const { $i18n } = useNuxtApp();
const features = useWorkspaceFeatures();
const featureEnabled = computed(
  () => features.loaded.value && features.agentsApiEnabled.value,
);
const agentCatalog = useAgents({ enabled: featureEnabled });
const modelCatalog = useModels({ enabled: featureEnabled });
const editing = ref<Agent | null>(null);
const actionError = ref("");

function message(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim()
    ? `${fallback}: ${error.message}`
    : fallback;
}

const listError = computed(() =>
  agentCatalog.error.value
    ? message(agentCatalog.error.value, $i18n.t.value.agents.loadFailed)
    : "",
);
const modelError = computed(() =>
  modelCatalog.error.value
    ? message(
        modelCatalog.error.value,
        $i18n.t.value.agents.settingsModelsFailed,
      )
    : "",
);
const pending = computed(
  () =>
    agentCatalog.update.isPending.value || agentCatalog.remove.isPending.value,
);

function beginEdit(agent: Agent) {
  editing.value = agent;
  actionError.value = "";
}

async function saveEdit(request: UpdateAgentRequest) {
  if (!editing.value || pending.value) return;
  actionError.value = "";
  try {
    await agentCatalog.update.mutateAsync({ agent: editing.value, request });
    editing.value = null;
  } catch (cause) {
    actionError.value = message(cause, $i18n.t.value.agents.settingsSaveFailed);
  }
}

async function remove(agent: Agent) {
  if (
    pending.value ||
    !globalThis.confirm($i18n.t.value.agents.deleteConfirm)
  ) {
    return;
  }
  actionError.value = "";
  try {
    await agentCatalog.remove.mutateAsync(agent);
  } catch (cause) {
    actionError.value = message(cause, $i18n.t.value.agents.deleteFailed);
  }
}
</script>

<template>
  <div class="size-full">
    <section class="flex size-full flex-col">
      <header class="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 class="text-xl font-semibold">
            {{ $i18n.t.value.agents.title }}
          </h1>
          <p class="text-muted-foreground text-sm">
            {{ $i18n.t.value.agents.description }}
          </p>
        </div>
        <NuxtLink
          v-if="featureEnabled"
          to="/workspace/agents/new"
          class="bg-primary text-primary-foreground rounded-md px-3 py-2"
          >{{ $i18n.t.value.agents.newAgent }}</NuxtLink
        >
      </header>
      <div class="flex-1 overflow-y-auto p-6">
        <p
          v-if="features.loaded.value && !features.agentsApiEnabled.value"
          data-testid="agents-feature-disabled"
          class="text-muted-foreground rounded-xl border p-6"
        >
          <strong class="text-foreground block">{{
            $i18n.t.value.agents.featureDisabledTitle
          }}</strong>
          {{ $i18n.t.value.agents.featureDisabledDescription }}
        </p>
        <p
          v-else-if="!features.loaded.value || agentCatalog.loading.value"
          role="status"
          class="text-muted-foreground"
        >
          {{ $i18n.t.value.agents.loading }}
        </p>
        <p
          v-if="listError || (!editing && actionError)"
          role="alert"
          class="mb-4 text-sm text-red-600"
        >
          {{ listError || actionError }}
        </p>
        <div
          v-if="featureEnabled && !agentCatalog.loading.value && !listError"
          class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          <AgentCard
            v-for="agent in agentCatalog.agents.value"
            :key="agent.name"
            :agent="agent"
            :pending="pending"
            @settings="beginEdit"
            @delete="remove"
          />
          <div
            v-if="agentCatalog.agents.value.length === 0"
            class="text-muted-foreground col-span-full rounded-xl border p-8 text-center"
          >
            <strong class="text-foreground block">{{
              $i18n.t.value.agents.emptyTitle
            }}</strong>
            {{ $i18n.t.value.agents.emptyDescription }}
          </div>
        </div>
      </div>
    </section>

    <AgentSettingsDialog
      v-if="editing"
      :agent="editing"
      :models="modelCatalog.models.value"
      :models-loading="modelCatalog.loading.value"
      :model-error="modelError"
      :pending="agentCatalog.update.isPending.value"
      :submit-error="actionError"
      @cancel="editing = null"
      @save="saveEdit"
    />
  </div>
</template>
