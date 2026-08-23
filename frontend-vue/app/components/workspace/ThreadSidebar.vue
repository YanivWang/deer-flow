<script setup lang="ts">
/*
  【文件职责】     DeerFlow thread 导航、搜索、分页、重命名与移动端侧栏。
  【对应 frontend/】 src/components/workspace/sidebar.tsx
  【架构位置】     L3
  【主要导出】     默认 ThreadSidebar 组件
  【依赖关系】     threads store/API · workspace routes
  【边界与注意】   业务导航壳，不属于通用 agent UI 契约。
*/
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import {
  Bot,
  CalendarClock,
  ChevronsLeft,
  ChevronsRight,
  Languages,
  MessageSquarePlus,
  MessagesSquare,
  Moon,
  Pin,
  Settings,
  Sun,
} from "lucide-vue-next";

import ChannelConnections from "@/components/workspace/channels/ChannelConnections.vue";
import ThreadActionsMenu from "@/components/workspace/ThreadActionsMenu.vue";
import { useSettingsDialog } from "@/composables/useSettingsDialog";
import { useThreads } from "@/composables/useThreads";
import { useWorkspaceFeatures } from "@/composables/useWorkspaceFeatures";
import { ThreadCascadeDeleteError } from "@/core/threads/delete";
import {
  channelSourceOfThread,
  pathOfThread,
  titleOfThread,
} from "@/core/threads/utils";

const route = useRoute();
const router = useRouter();
const threads = useThreads();
const features = useWorkspaceFeatures();
const settingsDialog = useSettingsDialog();
const sentinel = ref<HTMLElement | null>(null);
const sidebarElement = ref<HTMLElement | null>(null);
const collapsed = ref(false);
const mobileOpen = ref(false);
const sidebarExpanded = computed(() => !collapsed.value || mobileOpen.value);
const settingsOpen = ref(false);
const settingsTrigger = ref<HTMLButtonElement | null>(null);
const renameThreadId = ref<string | null>(null);
const renameTitle = ref("");
const renameError = ref<string | null>(null);
const deleteError = ref<string | null>(null);
const failedDeleteThreadId = ref<string | null>(null);
const deletingThreadId = ref<string | null>(null);
let observer: IntersectionObserver | null = null;
let focusBeforeMobileOpen: HTMLElement | null = null;

const SIDEBAR_COOKIE = "sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

function setCollapsed(value: boolean) {
  collapsed.value = value;
  document.cookie = `${SIDEBAR_COOKIE}=${String(!value)}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; samesite=lax`;
}

function closeMobileSidebar() {
  mobileOpen.value = false;
}

function toggleSidebar() {
  if (globalThis.matchMedia?.("(max-width: 767px)").matches) {
    mobileOpen.value = !mobileOpen.value;
  } else {
    setCollapsed(!collapsed.value);
  }
}

function onWindowKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && mobileOpen.value) {
    event.preventDefault();
    closeMobileSidebar();
  }
}

function keepMobileFocus(event: KeyboardEvent) {
  if (event.key !== "Tab" || !mobileOpen.value) return;
  const focusable = [
    ...(sidebarElement.value?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? []),
  ].filter(
    (element) =>
      !element.hidden &&
      globalThis.getComputedStyle(element).visibility !== "hidden" &&
      element.getClientRects().length > 0,
  );
  if (!focusable.length) return;
  const first = focusable[0]!;
  const last = focusable.at(-1)!;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

onMounted(() => {
  const persisted = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${SIDEBAR_COOKIE}=`))
    ?.slice(SIDEBAR_COOKIE.length + 1);
  if (persisted === "false") collapsed.value = true;
  globalThis.addEventListener("deerflow:toggle-sidebar", toggleSidebar);
  globalThis.addEventListener("keydown", onWindowKeydown);
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
  globalThis.removeEventListener("keydown", onWindowKeydown);
});

watch(sentinel, (element, previous) => {
  if (previous) observer?.unobserve(previous);
  if (element) observer?.observe(element);
});

watch(mobileOpen, async (open) => {
  globalThis.dispatchEvent(
    new CustomEvent("deerflow:sidebar-state", { detail: { open } }),
  );
  if (open) {
    focusBeforeMobileOpen =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    await nextTick();
    sidebarElement.value
      ?.querySelector<HTMLElement>("a[href], button:not([disabled])")
      ?.focus();
  } else {
    focusBeforeMobileOpen?.focus({ preventScroll: true });
    focusBeforeMobileOpen = null;
  }
});

watch(() => route.fullPath, closeMobileSidebar);

function isActive(path: string) {
  return route.path === path;
}

function startNewChat() {
  mobileOpen.value = false;
  globalThis.dispatchEvent(new CustomEvent("deerflow:new-chat"));
}

async function removeThread(threadId: string) {
  if (deletingThreadId.value) return;
  const active = route.path.endsWith(`/${threadId}`);
  deleteError.value = null;
  failedDeleteThreadId.value = null;
  deletingThreadId.value = threadId;
  try {
    await threads.remove(threadId);
    if (active) await router.push("/workspace/chats/new");
  } catch (cause) {
    failedDeleteThreadId.value = threadId;
    deleteError.value =
      cause instanceof ThreadCascadeDeleteError
        ? cause.message
        : cause instanceof Error
          ? cause.message
          : "Failed to delete conversation.";
  } finally {
    deletingThreadId.value = null;
  }
}

function beginRename(threadId: string) {
  const thread = threads.threads.find((item) => item.thread_id === threadId);
  renameThreadId.value = threadId;
  renameTitle.value = thread ? titleOfThread(thread) : "";
  renameError.value = null;
}

async function submitRename() {
  if (!renameThreadId.value || !renameTitle.value.trim()) return;
  renameError.value = null;
  try {
    await threads.rename(renameThreadId.value, renameTitle.value.trim());
    renameThreadId.value = null;
  } catch (cause) {
    renameError.value =
      cause instanceof Error ? cause.message : "Failed to rename thread.";
  }
}

function setTheme(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem("deerflow-theme", theme);
}

function openSettingsDialog() {
  settingsOpen.value = false;
  settingsDialog.show("account", { returnFocus: settingsTrigger.value });
}
</script>

<template>
  <aside
    id="workspace-sidebar"
    ref="sidebarElement"
    data-sidebar="sidebar"
    :data-mobile="mobileOpen ? 'true' : undefined"
    :role="mobileOpen ? 'dialog' : undefined"
    :aria-modal="mobileOpen ? 'true' : undefined"
    :aria-label="mobileOpen ? 'Workspace navigation' : undefined"
    class="border-sidebar-border bg-sidebar text-sidebar-foreground fixed inset-y-0 left-0 z-50 flex h-screen shrink-0 flex-col border-r transition-[width,transform] duration-200 md:static md:translate-x-0"
    :class="[
      mobileOpen ? 'w-72' : collapsed ? 'w-12' : 'w-64',
      mobileOpen ? 'translate-x-0' : '-translate-x-full',
    ]"
    @keydown="keepMobileFocus"
  >
    <div class="flex h-12 shrink-0 items-center justify-between px-2">
      <NuxtLink
        v-if="sidebarExpanded"
        class="text-primary px-2 font-serif text-base"
        to="/workspace"
        >DeerFlow</NuxtLink
      >
      <span v-else class="text-primary mx-auto font-serif">DF</span>
      <button
        type="button"
        class="hover:bg-sidebar-accent hidden size-8 items-center justify-center rounded-md md:flex"
        :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        aria-controls="workspace-sidebar"
        :aria-expanded="!collapsed"
        @click="setCollapsed(!collapsed)"
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
        <span v-if="sidebarExpanded">{{ $i18n.t.value.sidebar.newChat }}</span>
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
        <span v-if="sidebarExpanded">{{ $i18n.t.value.sidebar.chats }}</span>
      </NuxtLink>
      <NuxtLink
        v-if="features.agentsApiEnabled.value"
        data-sidebar="menu-button"
        class="text-muted-foreground hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground flex h-8 items-center gap-2 rounded-md px-2"
        :data-active="route.path.startsWith('/workspace/agents')"
        to="/workspace/agents"
        :title="collapsed ? $i18n.t.value.sidebar.agents : undefined"
      >
        <Bot :size="16" class="shrink-0" />
        <span v-if="sidebarExpanded">{{ $i18n.t.value.sidebar.agents }}</span>
      </NuxtLink>
      <div v-else class="group relative">
        <button
          type="button"
          aria-label="Agents"
          aria-disabled="true"
          aria-describedby="agents-disabled-description"
          class="text-muted-foreground hover:bg-sidebar-accent flex h-8 w-full items-center gap-2 rounded-md px-2"
        >
          <Bot :size="16" class="shrink-0" />
          <span v-if="sidebarExpanded">{{ $i18n.t.value.sidebar.agents }}</span>
        </button>
        <span id="agents-disabled-description" class="sr-only"
          >Feature not enabled</span
        >
        <span
          role="tooltip"
          class="bg-popover text-popover-foreground absolute top-full left-2 z-50 hidden rounded-md border px-2 py-1 text-xs whitespace-nowrap shadow group-focus-within:block group-hover:block"
          >Feature not enabled</span
        >
      </div>
      <NuxtLink
        data-sidebar="menu-button"
        to="/workspace/scheduled-tasks"
        class="text-muted-foreground hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent flex h-8 items-center gap-2 rounded-md px-2"
        :data-active="route.path.startsWith('/workspace/scheduled-tasks')"
        :title="collapsed ? 'Scheduled tasks' : undefined"
      >
        <CalendarClock :size="16" class="shrink-0" />
        <span v-if="sidebarExpanded">Scheduled tasks</span>
      </NuxtLink>
    </nav>

    <ChannelConnections v-if="sidebarExpanded" />

    <div
      v-if="sidebarExpanded"
      class="text-muted-foreground px-4 py-2 text-xs font-medium"
    >
      {{ $i18n.t.value.sidebar.recentChats }}
    </div>
    <ul
      v-if="sidebarExpanded"
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
        <ThreadActionsMenu
          :thread="thread"
          :pinned="threads.isPinned(thread)"
          :deleting="deletingThreadId === thread.thread_id"
          @rename="beginRename(thread.thread_id)"
          @toggle-pin="
            threads.setPinned(thread.thread_id, !threads.isPinned(thread))
          "
          @delete="removeThread(thread.thread_id)"
        />
      </li>
      <li
        v-if="threads.hasMore"
        ref="sentinel"
        data-testid="recent-chat-list-sentinel"
        class="h-1"
      />
    </ul>
    <div
      v-if="sidebarExpanded && deleteError"
      role="alert"
      class="border-destructive/30 bg-destructive/5 text-destructive mx-2 mb-2 rounded-md border p-2 text-xs"
    >
      <p>{{ deleteError }}</p>
      <button
        v-if="failedDeleteThreadId"
        type="button"
        class="mt-1 underline"
        :disabled="Boolean(deletingThreadId)"
        @click="removeThread(failedDeleteThreadId)"
      >
        Try again
      </button>
    </div>
    <div class="relative mt-auto p-2">
      <div
        v-if="settingsOpen"
        role="menu"
        class="bg-popover text-popover-foreground border-border absolute right-2 bottom-12 left-2 z-30 space-y-1 rounded-lg border p-2 text-sm shadow-lg"
      >
        <button
          role="menuitem"
          type="button"
          class="hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5"
          @click="openSettingsDialog"
        >
          <Settings :size="14" /> Settings
        </button>
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
        ref="settingsTrigger"
        type="button"
        class="text-muted-foreground hover:bg-sidebar-accent flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm"
        :title="collapsed ? 'Settings & more' : undefined"
        aria-label="Settings and more"
        :aria-expanded="settingsOpen"
        @click="settingsOpen = !settingsOpen"
      >
        <Settings :size="16" class="shrink-0" />
        <span v-if="sidebarExpanded">Settings and more</span>
      </button>
    </div>
  </aside>
  <button
    v-if="mobileOpen"
    type="button"
    aria-label="Close sidebar"
    aria-controls="workspace-sidebar"
    class="fixed inset-0 z-40 bg-black/30 md:hidden"
    @click="closeMobileSidebar"
  />
  <div
    v-if="renameThreadId"
    class="fixed inset-0 z-[70] grid place-items-center bg-black/40 p-4"
  >
    <form
      role="dialog"
      aria-label="Rename chat"
      class="bg-background border-border w-full max-w-sm rounded-xl border p-5 shadow-xl"
      @submit.prevent="submitRename"
    >
      <h2 class="text-lg font-semibold">Rename chat</h2>
      <input
        v-model="renameTitle"
        aria-label="Chat title"
        class="border-input mt-4 w-full rounded-md border px-3 py-2"
      />
      <p v-if="renameError" role="alert" class="mt-2 text-sm text-red-600">
        {{ renameError }}
      </p>
      <div class="mt-4 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-md border px-3 py-2"
          @click="renameThreadId = null"
        >
          Cancel</button
        ><button
          type="submit"
          class="bg-primary text-primary-foreground rounded-md px-3 py-2"
        >
          Save
        </button>
      </div>
    </form>
  </div>
</template>
