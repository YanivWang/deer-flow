<script setup lang="ts">
import { ChevronLeft, ChevronUp, MessageSquarePlus, Settings2 } from "lucide-vue-next";
import type { AgentThread } from "../../../core/api/thread/types";
import type { useThreadList } from "../../../entities/thread/use-thread-list";
import type { ChatSidebarChannelsController } from "../../../features/chat/sidebar/use-chat-sidebar-channels";
import type { ChatSidebarPaginationController } from "../../../features/chat/sidebar/use-chat-sidebar-pagination";
import type { WorkspaceNavigationController } from "../../../features/workspace/navigation/use-workspace-navigation";
import ChatThreadList from "./ChatThreadList.vue";
import ChannelProviderIcon from "./ChannelProviderIcon.vue";
import WorkspaceNavigation from "../navigation/WorkspaceNavigation.vue";

type ThreadList = ReturnType<typeof useThreadList>;

const props = defineProps<{
  agentsEnabled: boolean;
  channels: ChatSidebarChannelsController;
  isThreadListLoading: boolean;
  pagination: ChatSidebarPaginationController;
  threadActionErrorMessage: string | null;
  threadId: string;
  threadList: ThreadList;
  threads: AgentThread[];
  navigation: WorkspaceNavigationController;
}>();

const emit = defineEmits<{
  createThread: [];
  deleteThread: [threadId: string];
  goToNewChat: [];
  prepareThreadNavigation: [threadId: string];
  togglePinned: [threadId: string, pinned: boolean];
  toggleSettingsMenu: [];
}>();

const channelsMenuOpen = ref(false);
const { t } = useAppI18n();
const channelConnectionsEnabled = props.channels.channelConnectionsEnabled;
const visibleChannelProviders = props.channels.visibleChannelProviders;
const channelActionMessage = props.channels.channelActionMessage;
const channelSetupProvider = props.channels.channelSetupProvider;
const channelSetupValues = props.channels.channelSetupValues;
const isChannelMutationPending = props.channels.isMutationPending;
const channelIsConnected = props.channels.channelIsConnected;

function handleTogglePinned(threadId: string, pinned: boolean): void {
  emit("togglePinned", threadId, pinned);
}

function eventTargetValue(event: Event): string {
  const target = event.target;
  return target instanceof HTMLInputElement ? target.value.trim() : "";
}

</script>

<template>
  <div data-testid="vue-thread-list" data-sidebar="sidebar" data-mobile="true">
    <div class="workspace-sidebar__header">
      <h2>DeerFlow</h2>
      <button
        type="button"
        class="workspace-sidebar__mobile-toggle"
        data-sidebar="trigger"
        @click="props.navigation.toggleMobileOpen"
      >
        Toggle sidebar
      </button>
      <button
        class="workspace-sidebar__collapse"
        type="button"
        aria-label="折叠侧栏"
        @click="props.navigation.toggleCollapsed"
      >
        <ChevronLeft :size="18" aria-hidden="true" />
      </button>
      <a-button
        class="workspace-sidebar__new-chat"
        type="default"
        :disabled="props.threadList.isCreatingThread.value"
        :loading="props.threadList.isCreatingThread.value"
        data-testid="vue-thread-create"
        @click="emit('createThread')"
      >
        <MessageSquarePlus :size="17" aria-hidden="true" />
        {{ t("sidebar.newChat") }}
      </a-button>
    </div>
    <div class="workspace-sidebar__scroll-area">
      <WorkspaceNavigation :navigation="props.navigation" :embedded="true" />
      <section
        v-if="channelConnectionsEnabled && visibleChannelProviders.length > 0"
        class="workspace-sidebar__channels"
        data-testid="vue-workspace-channels"
      >
        <h3>{{ t("sidebar.channels") }}</h3>
        <div v-for="provider in visibleChannelProviders" :key="provider.provider" class="workspace-sidebar__channel">
          <span class="workspace-sidebar__channel-name">
            <ChannelProviderIcon :provider="provider.provider" :data-provider="provider.provider" />
            {{ provider.display_name }}
          </span>
          <button
            type="button"
            :disabled="isChannelMutationPending"
            @click="() => { void props.channels.connectChannel(provider); }"
          >
            {{ channelIsConnected(provider) ? t("channels.connected") : t("channels.connect") }}
          </button>
        </div>
      </section>
      <p v-if="channelActionMessage" class="workspace-sidebar__channel-message">{{ channelActionMessage }}</p>
      <section
        v-if="channelSetupProvider"
        class="workspace-sidebar__channel-dialog"
        data-testid="vue-workspace-channel-dialog"
        role="dialog"
      >
        <h2>
          {{ channelIsConnected(channelSetupProvider) ? t("channels.setupEditTitle", { name: channelSetupProvider.display_name }) : t("channels.setupTitle", { name: channelSetupProvider.display_name }) }}
        </h2>
        <p>{{ t("channels.setupDescription") }}</p>
        <label v-for="field in channelSetupProvider.credential_fields" :key="field.name">
          <span>{{ field.label }}</span>
          <input
            class="workspace-sidebar__channel-input"
            type="text"
            autocomplete="off"
            data-1p-ignore="true"
            data-lpignore="true"
            :value="channelSetupValues[field.name] ?? ''"
            @input="props.channels.updateChannelSetupValue(field.name, eventTargetValue($event))"
          >
        </label>
        <button type="button" @click="props.channels.cancelChannelSetup">{{ t("common.cancel") }}</button>
        <button type="button" @click="() => { void props.channels.saveChannelSetup(); }">{{ t("channels.saveAndConnect") }}</button>
      </section>
      <ChatThreadList
        :is-loading="props.isThreadListLoading"
        :thread-action-error-message="props.threadActionErrorMessage"
        :thread-id="props.threadId"
        :thread-list="props.threadList"
        :threads="props.threads"
        :pagination="props.pagination"
        @delete-thread="emit('deleteThread', $event)"
        @prepare-thread-navigation="emit('prepareThreadNavigation', $event)"
        @toggle-pinned="handleTogglePinned"
      />
    </div>
    <button class="workspace-sidebar__settings-more" type="button" @click="channelsMenuOpen = !channelsMenuOpen">
      <Settings2 :size="20" aria-hidden="true" />
      {{ t("workspace.settingsAndMore") }}
      <ChevronUp class="workspace-sidebar__settings-chevron" :size="18" aria-hidden="true" />
    </button>
    <div v-if="channelsMenuOpen" class="workspace-sidebar__settings-menu" role="menu">
      <button role="menuitem" type="button" @click="emit('toggleSettingsMenu')">{{ t("common.settings") }}</button>
    </div>
  </div>
</template>
