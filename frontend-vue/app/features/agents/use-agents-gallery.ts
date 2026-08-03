import { computed, ref } from "vue";

import { useAgentsApiEnabled } from "./use-agents-api-enabled";
import type { Agent, UpdateAgentRequest } from "../../core/api/agents/types";
import { useAgentsEntity } from "../../entities/agent/use-agents";

export function useAgentsGallery() {
  const feature = useAgentsApiEnabled();
  const entity = useAgentsEntity(
    computed(() => feature.enabled.value && !feature.isLoading.value),
  );
  const settingsAgent = ref<Agent | null>(null);
  const deleteTarget = ref<Agent | null>(null);
  const actionMessage = ref("");
  const actionError = ref("");

  const agents = computed(() => entity.agentsQuery.data.value ?? []);
  const listError = computed(() => {
    const error = entity.agentsQuery.error.value;
    return error instanceof Error ? error.message : "";
  });

  function openSettings(agent: Agent) {
    actionError.value = "";
    settingsAgent.value = agent;
  }

  function closeSettings() {
    if (!entity.isUpdating.value) settingsAgent.value = null;
  }

  function requestDelete(agent: Agent) {
    actionError.value = "";
    deleteTarget.value = agent;
  }

  function cancelDelete() {
    if (!entity.isDeleting.value) deleteTarget.value = null;
  }

  async function confirmDelete() {
    const agent = deleteTarget.value;
    if (!agent) return;
    actionError.value = "";
    try {
      await entity.deleteAgent(agent.name);
      deleteTarget.value = null;
      actionMessage.value = "智能体已删除";
    } catch (error) {
      actionError.value = error instanceof Error ? error.message : String(error);
    }
  }

  async function saveSettings(name: string, request: UpdateAgentRequest) {
    actionError.value = "";
    try {
      await entity.updateAgent({ name, request });
      settingsAgent.value = null;
      actionMessage.value = "模型设置已保存";
    } catch (error) {
      actionError.value = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  return {
    actionError,
    actionMessage,
    agents,
    agentsQuery: entity.agentsQuery,
    cancelDelete,
    confirmDelete,
    deleteTarget,
    feature,
    isDeleting: entity.isDeleting,
    isUpdating: entity.isUpdating,
    listError,
    modelsQuery: entity.modelsQuery,
    openSettings,
    requestDelete,
    saveSettings,
    settingsAgent,
    closeSettings,
  };
}

export type AgentsGalleryController = ReturnType<typeof useAgentsGallery>;
