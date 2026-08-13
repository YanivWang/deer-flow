<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";

import { useThreadsStore } from "@/stores/threads";
import {
  channelSourceOfThread,
  pathOfThread,
  titleOfThread,
} from "@/core/threads/utils";

const route = useRoute();
const router = useRouter();
const threads = useThreadsStore();
const menuThreadId = ref<string | null>(null);
const sentinel = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;

onMounted(() => {
  void threads.loadInitial();
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting))
        void threads.loadMore();
    },
    { rootMargin: "40px" },
  );
  if (sentinel.value) observer.observe(sentinel.value);
});
onUnmounted(() => observer?.disconnect());

function isActive(path: string) {
  return route.path === path;
}

function startNewChat() {
  globalThis.dispatchEvent(new CustomEvent("deerflow:new-chat"));
}

async function removeThread(threadId: string) {
  menuThreadId.value = null;
  const active = route.path.endsWith(`/${threadId}`);
  try {
    await threads.remove(threadId);
  } finally {
    if (active) await router.push("/workspace/chats/new");
  }
}
</script>

<template>
  <aside
    data-sidebar="sidebar"
    class="border-border bg-secondary/35 flex h-screen w-64 shrink-0 flex-col border-r"
  >
    <div class="border-border border-b p-4">
      <NuxtLink class="text-lg font-semibold" to="/workspace"
        >DeerFlow</NuxtLink
      >
    </div>
    <nav class="space-y-1 p-3 text-sm">
      <NuxtLink
        class="hover:bg-accent block rounded-md px-3 py-2"
        to="/workspace/agents"
        >Agents</NuxtLink
      >
      <NuxtLink
        class="hover:bg-accent block rounded-md px-3 py-2"
        to="/workspace/chats"
        >All chats</NuxtLink
      >
      <NuxtLink
        data-sidebar="menu-button"
        to="/workspace/chats/new"
        :data-active="isActive('/workspace/chats/new')"
        class="hover:bg-accent block rounded-md px-3 py-2 font-medium"
        @click="startNewChat"
        >New chat</NuxtLink
      >
    </nav>

    <div
      class="px-4 py-2 text-xs font-semibold tracking-wide text-gray-500 uppercase"
    >
      Recent chats
    </div>
    <ul class="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-4">
      <li
        v-for="thread in threads.displayedThreads"
        :key="thread.thread_id"
        data-sidebar="menu-item"
        class="group hover:bg-accent relative flex items-center rounded-md"
      >
        <NuxtLink
          data-sidebar="menu-button"
          :to="pathOfThread(thread)"
          class="min-w-0 flex-1 truncate px-3 py-2 text-sm"
          :data-active="isActive(pathOfThread(thread))"
        >
          <span
            v-if="threads.isPinned(thread)"
            aria-label="Pinned chat"
            class="mr-1 inline-block size-1.5 rounded-full bg-current"
          ></span>
          {{ titleOfThread(thread) }}
          <span
            v-if="channelSourceOfThread(thread)"
            :aria-label="`${channelSourceOfThread(thread)?.label} channel`"
            class="ml-1 text-xs"
            >{{ channelSourceOfThread(thread)?.label }}</span
          >
        </NuxtLink>
        <button
          type="button"
          aria-label="More"
          class="mr-1 rounded px-2 py-1 opacity-0 group-hover:opacity-100 focus:opacity-100"
          @click="
            menuThreadId =
              menuThreadId === thread.thread_id ? null : thread.thread_id
          "
        >
          ⋯
        </button>
        <div
          v-if="menuThreadId === thread.thread_id"
          role="menu"
          class="bg-background border-border absolute top-9 right-1 z-30 w-32 rounded-md border p-1 shadow-lg"
        >
          <button
            role="menuitem"
            class="hover:bg-accent block w-full rounded px-2 py-1 text-left"
            @click="
              threads.setPinned(thread.thread_id, !threads.isPinned(thread));
              menuThreadId = null;
            "
          >
            {{ threads.isPinned(thread) ? "Unpin chat" : "Pin chat" }}
          </button>
          <button
            role="menuitem"
            class="text-destructive hover:bg-accent block w-full rounded px-2 py-1 text-left"
            @click="removeThread(thread.thread_id)"
          >
            Delete
          </button>
        </div>
      </li>
      <li
        v-if="threads.hasMore"
        ref="sentinel"
        data-testid="recent-chat-list-sentinel"
        class="h-1"
      />
    </ul>
  </aside>
</template>
