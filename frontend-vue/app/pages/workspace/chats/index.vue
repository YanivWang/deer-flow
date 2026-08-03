<script setup lang="ts">
import ChatListPage from "../../../widgets/workspace/chat/ChatListPage.vue";
import WorkspaceNavShell from "../../../widgets/workspace/navigation/WorkspaceNavShell.vue";
import { useChatListPage } from "../../../features/chat-list/use-chat-list-page";

const chats = useChatListPage();
</script>

<template>
  <WorkspaceNavShell>
    <ChatListPage :chats="chats" />
  </WorkspaceNavShell>
</template>
