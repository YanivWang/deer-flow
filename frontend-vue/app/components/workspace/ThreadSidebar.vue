<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import {
  Bot,
  ChevronsLeft,
  ChevronsRight,
  Languages,
  MessageSquarePlus,
  MessagesSquare,
  Moon,
  MoreHorizontal,
  Pin,
  Settings,
  Sun,
  Trash2,
} from "lucide-vue-next";

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
const collapsed = ref(false);
const mobileOpen = ref(false);
const settingsOpen = ref(false);
let observer: IntersectionObserver | null = null;

function toggleSidebar() {
  if (globalThis.matchMedia?.("(max-width: 767px)").matches) {
    mobileOpen.value = !mobileOpen.value;
  } else {
    collapsed.value = !collapsed.value;
  }
}

onMounted(() => {
  globalThis.addEventListener("deerflow:toggle-sidebar", toggleSidebar);
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
onUnmounted(() => {
  observer?.disconnect();
  globalThis.removeEventListener("deerflow:toggle-sidebar", toggleSidebar);
});

function isActive(path: string) {
  return route.path === path;
}

function startNewChat() {
  mobileOpen.value = false;
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

function setTheme(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem("deerflow-theme", theme);
}
</script>

<template>
  <aside
    data-sidebar="sidebar"
    class="border-sidebar-border bg-sidebar text-sidebar-foreground fixed inset-y-0 left-0 z-50 flex h-screen shrink-0 flex-col border-r transition-[width,transform] duration-200 md:static md:translate-x-0"
    :class="[
      collapsed ? 'w-12' : 'w-64',
      mobileOpen ? 'translate-x-0' : '-translate-x-full',
    ]"
  >
    <div class="flex h-12 shrink-0 items-center justify-between px-2">
      <NuxtLink
        v-if="!collapsed"
        class="text-primary px-2 font-serif text-base"
        to="/workspace"
        >DeerFlow</NuxtLink
      >
      <span v-else class="text-primary mx-auto font-serif">DF</span>
      <button
        type="button"
        class="hover:bg-sidebar-accent hidden size-8 items-center justify-center rounded-md md:flex"
        :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        @click="collapsed = !collapsed"
      >
        <ChevronsRight v-if="collapsed" :size="16" />
        <ChevronsLeft v-else :size="16" />
      </button>
    </div>
    <nav class="space-y-1 px-2 pb-2 text-sm">
      <NuxtLink
        data-sidebar="menu-button"
        to="/workspace/chats/new"
        :data-active="isActive('/workspace/chats/new')"
        class="text-muted-foreground hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground flex h-8 items-center gap-2 rounded-md px-2 font-medium"
        :title="collapsed ? $i18n.t.value.sidebar.newChat : undefined"
        @click="startNewChat"
      >
        <MessageSquarePlus :size="16" class="shrink-0" />
        <span v-if="!collapsed">{{ $i18n.t.value.sidebar.newChat }}</span>
      </NuxtLink>
      <NuxtLink
        data-sidebar="menu-button"
        class="text-muted-foreground hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground flex h-8 items-center gap-2 rounded-md px-2"
        :data-active="
          route.path.startsWith('/workspace/chats') &&
          !isActive('/workspace/chats/new')
        "
        to="/workspace/chats"
        :title="collapsed ? $i18n.t.value.sidebar.chats : undefined"
      >
        <MessagesSquare :size="16" class="shrink-0" />
        <span v-if="!collapsed">{{ $i18n.t.value.sidebar.chats }}</span>
      </NuxtLink>
      <NuxtLink
        data-sidebar="menu-button"
        class="text-muted-foreground hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground flex h-8 items-center gap-2 rounded-md px-2"
        :data-active="route.path.startsWith('/workspace/agents')"
        to="/workspace/agents"
        :title="collapsed ? $i18n.t.value.sidebar.agents : undefined"
      >
        <Bot :size="16" class="shrink-0" />
        <span v-if="!collapsed">{{ $i18n.t.value.sidebar.agents }}</span>
      </NuxtLink>
    </nav>

    <div
      v-if="!collapsed"
      class="text-muted-foreground px-4 py-2 text-xs font-medium"
    >
      {{ $i18n.t.value.sidebar.recentChats }}
    </div>
    <ul
      v-if="!collapsed"
      class="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-4"
    >
      <li
        v-for="thread in threads.displayedThreads"
        :key="thread.thread_id"
        data-sidebar="menu-item"
        class="group hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent relative flex items-center rounded-md"
      >
        <NuxtLink
          data-sidebar="menu-button"
          :to="pathOfThread(thread)"
          class="min-w-0 flex-1 truncate px-2 py-1.5 text-sm"
          :data-active="isActive(pathOfThread(thread))"
        >
          <span
            v-if="threads.isPinned(thread)"
            aria-label="Pinned chat"
            class="mr-1 inline-block align-middle"
            ><Pin :size="12"
          /></span>
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
          <MoreHorizontal :size="16" />
        </button>
        <div
          v-if="menuThreadId === thread.thread_id"
          role="menu"
          class="bg-popover text-popover-foreground border-border absolute top-9 right-1 z-30 w-36 rounded-md border p-1 shadow-lg"
        >
          <button
            role="menuitem"
            class="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-left"
            @click="
              threads.setPinned(thread.thread_id, !threads.isPinned(thread));
              menuThreadId = null;
            "
          >
            <Pin :size="14" />
            {{ threads.isPinned(thread) ? "Unpin chat" : "Pin chat" }}
          </button>
          <button
            role="menuitem"
            class="text-destructive hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-left"
            @click="removeThread(thread.thread_id)"
          >
            <Trash2 :size="14" /> Delete
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
    <div class="relative mt-auto p-2">
      <div
        v-if="settingsOpen"
        class="bg-popover text-popover-foreground border-border absolute right-2 bottom-12 left-2 z-30 space-y-1 rounded-lg border p-2 text-sm shadow-lg"
      >
        <div class="text-muted-foreground px-2 py-1 text-xs">Appearance</div>
        <div class="grid grid-cols-2 gap-1">
          <button
            type="button"
            class="hover:bg-accent flex items-center gap-2 rounded-md px-2 py-1.5"
            @click="setTheme('light')"
          >
            <Sun :size="14" /> Light
          </button>
          <button
            type="button"
            class="hover:bg-accent flex items-center gap-2 rounded-md px-2 py-1.5"
            @click="setTheme('dark')"
          >
            <Moon :size="14" /> Dark
          </button>
        </div>
        <div
          class="text-muted-foreground flex items-center gap-2 px-2 pt-1 text-xs"
        >
          <Languages :size="13" /> Language
        </div>
        <div class="grid grid-cols-2 gap-1">
          <button
            v-for="locale in ['en-US', 'zh-CN'] as const"
            :key="locale"
            type="button"
            class="hover:bg-accent rounded-md px-1 py-1.5"
            :class="{ 'bg-accent': $i18n.locale.value === locale }"
            @click="$i18n.setLocale(locale)"
          >
            {{ locale === "en-US" ? "EN" : "简" }}
          </button>
        </div>
      </div>
      <button
        type="button"
        class="text-muted-foreground hover:bg-sidebar-accent flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm"
        :title="collapsed ? 'Settings & more' : undefined"
        :aria-expanded="settingsOpen"
        @click="settingsOpen = !settingsOpen"
      >
        <Settings :size="16" class="shrink-0" />
        <span v-if="!collapsed">Settings &amp; more</span>
      </button>
    </div>
  </aside>
  <button
    v-if="mobileOpen"
    type="button"
    aria-label="Close sidebar"
    class="fixed inset-0 z-40 bg-black/30 md:hidden"
    @click="mobileOpen = false"
  />
</template>
