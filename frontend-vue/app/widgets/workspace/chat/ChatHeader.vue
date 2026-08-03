<script setup lang="ts">
import { CalendarClock, Download } from "lucide-vue-next";

import BrowserViewTrigger from "../browser-view/BrowserViewTrigger.vue";
import WorkspaceChatTokenIndicator from "./WorkspaceChatTokenIndicator.vue";

const props = defineProps<{
  activeThreadPinned: boolean;
  activeThreadTitle: string;
  agentName: string | null;
  browserEnabled: boolean;
  browserOpen: boolean;
  canCompactThread: boolean;
  currentThread: boolean;
  hasSidecarConversation: boolean;
  isBusy: boolean;
  isCompacting: boolean;
  isWelcomeMode: boolean;
  inputTokens: number | null;
  outputTokens: number | null;
  pinningThread: boolean;
  sidecarOpen: boolean;
  status: string;
  totalTokens: number | null;
  threadId: string;
}>();

const emit = defineEmits<{
  compact: [];
  export: [format: "markdown" | "json"];
  stopRun: [];
  toggleActivePinned: [];
  toggleSidecar: [];
  toggleBrowser: [];
}>();

const { t } = useAppI18n();
const exportMenuOpen = ref(false);
</script>

<template>
  <header v-if="!props.isWelcomeMode" class="workspace-chat__header">
    <div>
      <h1>{{ props.activeThreadTitle }}</h1>
      <span v-if="props.agentName" class="workspace-chat__agent-badge">{{ props.agentName }}</span>
    </div>
    <div class="workspace-chat__header-actions">
      <NuxtLink
        v-if="props.threadId !== 'new'"
        class="workspace-button"
        :to="{ path: '/workspace/scheduled-tasks', query: { thread_id: props.threadId } }"
      >
        <CalendarClock :size="17" aria-hidden="true" />
        {{ t("sidebar.scheduledTasks") }}
      </NuxtLink>
      <WorkspaceChatTokenIndicator
        :input-tokens="props.inputTokens"
        :output-tokens="props.outputTokens"
        :total-tokens="props.totalTokens"
      />
      <div v-if="props.currentThread" class="workspace-chat__export-wrap">
        <button
          class="workspace-button workspace-chat__export-button"
          type="button"
          aria-haspopup="menu"
          :aria-expanded="exportMenuOpen"
          @click="exportMenuOpen = !exportMenuOpen"
        >
          <Download :size="17" aria-hidden="true" />
          {{ t("common.export") }}
        </button>
        <div v-if="exportMenuOpen" class="workspace-chat__export-menu" role="menu">
          <button type="button" role="menuitem" @click="emit('export', 'markdown'); exportMenuOpen = false">
            {{ t("common.exportAsMarkdown") }}
          </button>
          <button type="button" role="menuitem" @click="emit('export', 'json'); exportMenuOpen = false">
            {{ t("common.exportAsJSON") }}
          </button>
        </div>
      </div>
      <BrowserViewTrigger
        :enabled="props.browserEnabled"
        :open="props.browserOpen"
        :sidecar-open="props.sidecarOpen"
        @toggle="emit('toggleBrowser')"
      />
      <button
        v-if="props.hasSidecarConversation || props.sidecarOpen"
        class="workspace-button"
        data-testid="sidecar-header-trigger"
        type="button"
        @click="emit('toggleSidecar')"
      >
        {{ props.sidecarOpen ? 'Close side chat' : 'Open side chat' }}
      </button>
      <a-button
        v-if="props.currentThread"
        class="workspace-chat__pin-button"
        :disabled="props.pinningThread"
        @click="emit('toggleActivePinned')"
      >
        {{ props.activeThreadPinned ? t("chats.unpinChat") : t("chats.pinChat") }}
      </a-button>
      <a-button
        v-if="props.currentThread"
        class="workspace-chat__compact-button"
        :disabled="props.isBusy || props.isCompacting || !props.canCompactThread"
        :loading="props.isCompacting"
        data-testid="vue-chat-compact"
        @click="emit('compact')"
      >
        {{ t("inputBox.compactCommandDescription") }}
      </a-button>
      <a-button
        v-if="props.isBusy"
        danger
        :loading="props.status === 'stopping'"
        data-testid="vue-chat-stop"
        @click="emit('stopRun')"
      >
        {{ t("common.cancel") }}
      </a-button>
    </div>
  </header>
</template>
