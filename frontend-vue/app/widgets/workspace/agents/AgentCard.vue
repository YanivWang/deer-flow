<script setup lang="ts">
import type { Agent } from "../../../core/api/agents/types";
import AppCard from "../../../shared/ui/AppCard.vue";

const { t } = useAppI18n();
const props = defineProps<{ agent: Agent }>();

const emit = defineEmits<{
  "open-settings": [agent: Agent];
  "request-delete": [agent: Agent];
}>();
</script>

<template>
  <AppCard
    class="workspace-agent-card"
    tag="article"
    :data-testid="`vue-agent-card-${props.agent.name}`"
  >
    <header class="workspace-agent-card__header">
      <div class="workspace-agent-card__identity">
        <span class="workspace-agent-card__icon">A</span>
        <div>
          <h2 :title="props.agent.name">{{ props.agent.name }}</h2>
          <span v-if="props.agent.model" class="workspace-agent-card__badge" :title="props.agent.model">
            {{ props.agent.model }}
          </span>
        </div>
      </div>
    </header>
    <p v-if="props.agent.description" class="workspace-agent-card__description" :title="props.agent.description">
      {{ props.agent.description }}
    </p>
    <div
      v-if="(props.agent.tool_groups?.length ?? 0) + (props.agent.skills?.length ?? 0) > 0"
      class="workspace-agent-card__badges"
      data-testid="vue-agent-card-capabilities"
    >
      <span v-for="group in props.agent.tool_groups ?? []" :key="`tool:${group}`" class="workspace-agent-card__badge workspace-agent-card__badge--outline" :title="group">
        {{ group }}
      </span>
      <span v-for="skill in props.agent.skills ?? []" :key="`skill:${skill}`" class="workspace-agent-card__badge" :title="skill">
        {{ skill }}
      </span>
    </div>
    <footer class="workspace-agent-card__footer">
      <NuxtLink
        class="workspace-button workspace-button--primary workspace-agent-card__chat"
        :to="`/workspace/agents/${encodeURIComponent(props.agent.name)}/chats/new`"
        :data-testid="`vue-agent-card-chat-${props.agent.name}`"
      >
        {{ t("agents.chat") }}
      </NuxtLink>
      <button
        class="workspace-button workspace-button--ghost"
        :data-testid="`vue-agent-card-settings-${props.agent.name}`"
        type="button"
        @click="emit('open-settings', props.agent)"
      >
        ⚙
      </button>
      <button
        class="workspace-button workspace-button--ghost workspace-agent-card__delete"
        :data-testid="`vue-agent-card-delete-${props.agent.name}`"
        type="button"
        @click="emit('request-delete', props.agent)"
      >
        ×
      </button>
    </footer>
  </AppCard>
</template>
