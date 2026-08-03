<script setup lang="ts">
import { computed } from "vue";

import NewAgentChatStep from "../../../widgets/workspace/agents/NewAgentChatStep.vue";
import NewAgentHeader from "../../../widgets/workspace/agents/NewAgentHeader.vue";
import NewAgentNameStep from "../../../widgets/workspace/agents/NewAgentNameStep.vue";
import WorkspaceNavShell from "../../../widgets/workspace/navigation/WorkspaceNavShell.vue";
import { useAgentsApiEnabled } from "../../../features/agents/use-agents-api-enabled";
import { useNewAgentPage } from "../../../features/agents/new/use-new-agent-page";

const router = useRouter();
const { t } = useAppI18n();
const agentsFeature = useAgentsApiEnabled();
const stream = useThreadStream();
const page = useNewAgentPage({ stream });

const isChatStep = computed(() => page.step.value === "chat");

function goToGallery(): void {
  void router.push("/workspace/agents");
}

function startChatting(): void {
  void router.push(`/workspace/agents/${encodeURIComponent(page.agentName.value)}/chats/new`);
}
</script>

<template>
  <WorkspaceNavShell>
    <section
      v-if="agentsFeature.isLoading.value"
      class="workspace-simple-page"
      data-testid="vue-workspace-agents-loading"
    >
      <p>{{ t("common.loading") }}</p>
    </section>
    <section
      v-else-if="!agentsFeature.enabled.value"
      class="workspace-feature-disabled"
      data-testid="vue-agents-feature-disabled"
    >
      <div class="workspace-feature-disabled__icon">A</div>
      <h1>{{ t("agents.featureDisabledTitle") }}</h1>
      <p>{{ t("agents.featureDisabledDescription") }}</p>
    </section>
    <section v-else class="new-agent-page">
      <NewAgentHeader
        :can-save="page.canSaveAgent.value"
        :setup-agent-status="page.setupAgentStatus.value"
        :step="page.step.value"
        @back="goToGallery"
        @save="page.saveAgent"
      />

      <NewAgentNameStep
        v-if="!isChatStep"
        :can-continue="page.canContinueName.value"
        :is-checking="page.isCheckingName.value"
        :model-value="page.nameInput.value"
        :name-error="page.nameError.value"
        @clear-error="page.clearNameError"
        @confirm="page.confirmName"
        @update:model-value="page.nameInput.value = $event"
      />
      <NewAgentChatStep
        v-else
        :agent="page.agent.value"
        :agent-name="page.agentName.value"
        :chat-draft="page.chatDraft.value"
        :is-busy="page.isBusy.value"
        :is-streaming="page.isStreaming.value"
        :messages="page.streamMessages.value"
        :setup-agent-status="page.setupAgentStatus.value"
        :show-save-hint="page.showSaveHint.value"
        :status-message="page.statusMessage.value"
        :stream-status="page.streamStatus.value"
        @back-to-gallery="goToGallery"
        @start-chatting="startChatting"
        @submit-chat="page.submitChatDraft"
        @submit-human-input="page.submitHumanInput"
        @update:chat-draft="page.chatDraft.value = $event"
      />
    </section>
  </WorkspaceNavShell>
</template>
