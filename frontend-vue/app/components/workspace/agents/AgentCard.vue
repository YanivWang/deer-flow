<script setup lang="ts">
/*
  【文件职责】     精确展示 Agent 的 model、skills 与 tool-group filter，并提供 lifecycle actions。
  【架构位置】     L3 Agent gallery component
  【主要导出】     默认 AgentCard
  【依赖关系】     agents/presentation · i18n · workspace routes
  【边界与注意】   null tool_groups 与 [] 语义不同；badge 不去重、不重排。
*/
import { computed } from "vue";

import TruncatedTooltip from "@/components/workspace/agents/TruncatedTooltip.vue";
import { buildAgentCardViewModel } from "@/core/agents/presentation";
import type { Agent } from "@/core/agents/types";

const props = defineProps<{ agent: Agent; pending?: boolean }>();
const emit = defineEmits<{
  settings: [agent: Agent];
  delete: [agent: Agent];
}>();
const { $i18n } = useNuxtApp();
const view = computed(() => buildAgentCardViewModel(props.agent));
</script>

<template>
  <article
    :data-testid="`agent-card-${agent.name}`"
    class="flex min-w-0 flex-col rounded-xl border p-4"
  >
    <!--
      名字 `truncate`、描述 `line-clamp-2`，两者都是**用户自己填的、长度不可控**
      的文本，截掉之后本仓原来没有任何办法看到全文。上游 agent-card.tsx:141/157
      各包一层 TruncatedTooltip（只在真截断时才出）。
      模型那颗 badge 本仓是 `break-all` + `max-w-full`，会折行不会截断，
      所以**不需要**——上游那颗是 `truncate`，才要 TruncatedBadge。
    -->
    <TruncatedTooltip :text="view.name">
      <h2 class="truncate font-semibold">{{ view.name }}</h2>
    </TruncatedTooltip>
    <TruncatedTooltip :text="view.description">
      <p class="text-muted-foreground mt-2 line-clamp-2 text-sm">
        {{ view.description }}
      </p>
    </TruncatedTooltip>

    <dl class="mt-4 space-y-3 text-xs">
      <div>
        <dt class="text-muted-foreground mb-1">
          {{ $i18n.t.value.agents.cardModel }}
        </dt>
        <dd
          data-testid="agent-model"
          class="bg-secondary inline-flex max-w-full rounded px-2 py-1 break-all"
        >
          {{ view.model ?? $i18n.t.value.agents.settingsModelDefault }}
        </dd>
      </div>
      <div>
        <dt class="text-muted-foreground mb-1">
          {{ $i18n.t.value.agents.cardToolGroups }}
        </dt>
        <dd data-testid="agent-tool-groups" class="flex flex-wrap gap-1">
          <span
            v-if="view.toolGroups.mode === 'all'"
            data-testid="agent-tool-groups-all"
            class="rounded border px-2 py-1"
            >{{ $i18n.t.value.agents.cardToolGroupsAll }}</span
          >
          <span
            v-else-if="view.toolGroups.mode === 'none'"
            data-testid="agent-tool-groups-none"
            class="rounded border px-2 py-1"
            >{{ $i18n.t.value.agents.cardToolGroupsNone }}</span
          >
          <span
            v-for="item in view.toolGroups.items"
            v-else
            :key="item.key"
            data-testid="agent-tool-group"
            class="max-w-full rounded border px-2 py-1 break-all"
            >{{ item.label }}</span
          >
        </dd>
      </div>
      <div>
        <dt class="text-muted-foreground mb-1">
          {{ $i18n.t.value.agents.cardSkills }}
        </dt>
        <dd data-testid="agent-skills" class="flex flex-wrap gap-1">
          <span
            v-if="view.skills.length === 0"
            class="text-muted-foreground rounded border px-2 py-1"
            >{{ $i18n.t.value.agents.cardSkillsNone }}</span
          >
          <span
            v-for="item in view.skills"
            :key="item.key"
            data-testid="agent-skill"
            class="max-w-full rounded border px-2 py-1 break-all"
            >{{ item.label }}</span
          >
        </dd>
      </div>
    </dl>

    <div class="mt-auto flex gap-2 pt-5">
      <NuxtLink
        :to="`/workspace/agents/${encodeURIComponent(agent.name)}/chats/new`"
        class="bg-primary text-primary-foreground flex-1 rounded-md px-3 py-2 text-center text-sm"
        >{{ $i18n.t.value.agents.chat }}</NuxtLink
      >
      <button
        type="button"
        class="rounded-md border px-3"
        :aria-label="`${$i18n.t.value.agents.settings}: ${agent.name}`"
        :disabled="pending"
        @click="emit('settings', agent)"
      >
        ⚙
      </button>
      <button
        type="button"
        class="rounded-md border px-3 text-red-600"
        :aria-label="`${$i18n.t.value.agents.delete}: ${agent.name}`"
        :disabled="pending"
        @click="emit('delete', agent)"
      >
        ×
      </button>
    </div>
  </article>
</template>
