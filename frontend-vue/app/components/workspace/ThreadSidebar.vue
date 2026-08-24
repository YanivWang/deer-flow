<script setup lang="ts">
/*
  【文件职责】     DeerFlow thread 导航、搜索、分页、重命名与移动端侧栏。
  【架构位置】     L3
  【主要导出】     默认 ThreadSidebar 组件
  【依赖关系】     threads store/API · workspace routes · ui/dialog · ui/dropdown-menu
  【边界与注意】   业务导航壳，不属于通用 agent UI 契约。
*/
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import {
  Bot,
  Bug,
  CalendarClock,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  Github,
  Globe,
  Info,
  Mail,
  MessageSquarePlus,
  MessagesSquare,
  Pin,
  Settings,
  Settings2,
} from "lucide-vue-next";

import ChannelConnections from "@/components/workspace/channels/ChannelConnections.vue";
import ThreadActionsMenu from "@/components/workspace/ThreadActionsMenu.vue";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSettingsDialog } from "@/composables/useSettingsDialog";
import { useThreads } from "@/composables/useThreads";
import { useWorkspaceFeatures } from "@/composables/useWorkspaceFeatures";
import { ThreadCascadeDeleteError } from "@/core/threads/delete";
import {
  channelSourceOfThread,
  pathOfThread,
  titleOfThread,
} from "@/core/threads/utils";
import { visibleFocusableWithin } from "@/lib/focusable";

const route = useRoute();
const router = useRouter();
const { $i18n } = useNuxtApp();
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
const displayThreadTitle = (thread: Parameters<typeof titleOfThread>[0]) =>
  titleOfThread(thread, $i18n.t.value.pages.untitled);

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

/**
 * 抽屉里当前**可见且可聚焦**的元素，按文档序。
 *
 * 判据本身住在 `@/lib/focusable`，和 UI primitive 共用同一份定义——
 * 抽屉自己再写一遍，就会出现「primitive 认为第一个可聚焦元素是 A、
 * 抽屉认为是 B」这种只在窄屏才暴露的分叉。为什么必须过滤可见性，
 * 见那个文件里的说明。
 */
function focusableInDrawer(): HTMLElement[] {
  return visibleFocusableWithin(sidebarElement.value);
}

function keepMobileFocus(event: KeyboardEvent) {
  if (event.key !== "Tab" || !mobileOpen.value) return;
  const focusable = focusableInDrawer();
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
    focusableInDrawer()[0]?.focus();
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
          : $i18n.t.value.navigation.deleteConversationFailed;
  } finally {
    deletingThreadId.value = null;
  }
}

function beginRename(threadId: string) {
  const thread = threads.threads.find((item) => item.thread_id === threadId);
  renameThreadId.value = threadId;
  renameTitle.value = thread ? displayThreadTitle(thread) : "";
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
      cause instanceof Error
        ? cause.message
        : $i18n.t.value.navigation.renameThreadFailed;
  }
}

function openSettingsDialog(section: "appearance" | "about") {
  settingsOpen.value = false;
  settingsDialog.show(section, { returnFocus: settingsTrigger.value });
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
    :aria-label="mobileOpen ? $i18n.t.value.navigation.workspace : undefined"
    class="border-sidebar-border bg-sidebar text-sidebar-foreground fixed inset-y-0 left-0 z-50 flex h-screen shrink-0 flex-col border-r transition-[width,transform] duration-200 md:static md:translate-x-0"
    :class="[
      mobileOpen ? 'w-72' : collapsed ? 'w-12' : 'w-64',
      mobileOpen ? 'translate-x-0' : '-translate-x-full',
    ]"
    @keydown="keepMobileFocus"
  >
    <div class="flex h-12 shrink-0 items-center justify-between px-2">
      <div
        v-if="sidebarExpanded"
        class="text-primary cursor-default px-2 font-serif text-base"
      >
        DeerFlow
      </div>
      <span v-else class="text-primary mx-auto font-serif">DF</span>
      <button
        type="button"
        class="hover:bg-sidebar-accent hidden size-8 items-center justify-center rounded-md md:flex"
        :aria-label="
          collapsed
            ? $i18n.t.value.navigation.expandSidebar
            : $i18n.t.value.navigation.collapseSidebar
        "
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
          :aria-label="$i18n.t.value.sidebar.agents"
          aria-disabled="true"
          aria-describedby="agents-disabled-description"
          class="text-muted-foreground hover:bg-sidebar-accent flex h-8 w-full items-center gap-2 rounded-md px-2"
        >
          <Bot :size="16" class="shrink-0" />
          <span v-if="sidebarExpanded">{{ $i18n.t.value.sidebar.agents }}</span>
        </button>
        <span id="agents-disabled-description" class="sr-only">{{
          $i18n.t.value.sidebar.agentsDisabledTooltip
        }}</span>
        <!--
          这里刻意**不**换成 Tooltip primitive。禁用入口的原因必须对键盘和读屏器
          恒定可见，所以它挂在一个常驻的 aria-describedby 上；Reka 的 tooltip 只在
          打开时才写 aria-describedby，as-child 合并会把这条常驻关联覆盖成 undefined。
          悬停浮层在这里只是视觉补充，用 CSS 就够。
        -->
        <span
          aria-hidden="true"
          class="bg-popover text-popover-foreground absolute top-full left-2 z-50 hidden rounded-md border px-2 py-1 text-xs whitespace-nowrap shadow group-focus-within:block group-hover:block"
          >{{ $i18n.t.value.sidebar.agentsDisabledTooltip }}</span
        >
      </div>
      <NuxtLink
        data-sidebar="menu-button"
        to="/workspace/scheduled-tasks"
        class="text-muted-foreground hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent flex h-8 items-center gap-2 rounded-md px-2"
        :data-active="route.path.startsWith('/workspace/scheduled-tasks')"
        :title="collapsed ? $i18n.t.value.sidebar.scheduledTasks : undefined"
      >
        <CalendarClock :size="16" class="shrink-0" />
        <span v-if="sidebarExpanded">{{
          $i18n.t.value.sidebar.scheduledTasks
        }}</span>
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
            :aria-label="$i18n.t.value.navigation.pinnedChat"
            class="mr-1 inline-block align-middle"
            ><Pin :size="12"
          /></span>
          {{ displayThreadTitle(thread) }}
          <span
            v-if="channelSourceOfThread(thread)"
            :aria-label="
              $i18n.t.value.navigation.channel(
                channelSourceOfThread(thread)?.label ?? '',
              )
            "
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
        {{ $i18n.t.value.navigation.tryAgain }}
      </button>
    </div>
    <div class="mt-auto p-2">
      <DropdownMenu v-model:open="settingsOpen">
        <DropdownMenuTrigger>
          <button
            ref="settingsTrigger"
            type="button"
            class="text-muted-foreground hover:bg-sidebar-accent flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm"
            :title="
              collapsed ? $i18n.t.value.workspace.settingsAndMore : undefined
            "
            :aria-label="$i18n.t.value.workspace.settingsAndMore"
          >
            <Settings :size="16" class="shrink-0" />
            <span v-if="sidebarExpanded">{{
              $i18n.t.value.workspace.settingsAndMore
            }}</span>
            <ChevronsUpDown v-if="sidebarExpanded" :size="16" class="ml-auto" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side="top"
          class="w-[calc(var(--reka-dropdown-menu-trigger-width))] min-w-56"
        >
          <DropdownMenuItem @select="openSettingsDialog('appearance')">
            <Settings2 :size="14" /> {{ $i18n.t.value.common.settings }}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem as-child>
            <a
              href="https://deerflow.tech/"
              target="_blank"
              rel="noopener noreferrer"
              class="flex w-full items-center gap-2"
            >
              <Globe :size="14" /> {{ $i18n.t.value.workspace.officialWebsite }}
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem as-child>
            <a
              href="https://github.com/bytedance/deer-flow"
              target="_blank"
              rel="noopener noreferrer"
              class="flex w-full items-center gap-2"
            >
              <Github :size="14" /> {{ $i18n.t.value.workspace.visitGithub }}
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem as-child>
            <a
              href="https://github.com/bytedance/deer-flow/issues"
              target="_blank"
              rel="noopener noreferrer"
              class="flex w-full items-center gap-2"
            >
              <Bug :size="14" /> {{ $i18n.t.value.workspace.reportIssue }}
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem as-child>
            <a
              href="mailto:support@deerflow.tech"
              class="flex w-full items-center gap-2"
            >
              <Mail :size="14" /> {{ $i18n.t.value.workspace.contactUs }}
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem @select="openSettingsDialog('about')">
            <Info :size="14" /> {{ $i18n.t.value.workspace.about }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </aside>
  <button
    v-if="mobileOpen"
    type="button"
    :aria-label="$i18n.t.value.navigation.closeSidebar"
    aria-controls="workspace-sidebar"
    class="fixed inset-0 z-40 bg-black/30 md:hidden"
    @click="closeMobileSidebar"
  />
  <Dialog
    :open="renameThreadId !== null"
    @update:open="!$event && (renameThreadId = null)"
  >
    <DialogContent class="sm:max-w-sm">
      <form class="grid gap-4" @submit.prevent="submitRename">
        <DialogHeader>
          <DialogTitle>{{ $i18n.t.value.navigation.renameChat }}</DialogTitle>
          <DialogDescription class="sr-only">
            {{ $i18n.t.value.navigation.chatTitle }}
          </DialogDescription>
        </DialogHeader>
        <input
          v-model="renameTitle"
          :aria-label="$i18n.t.value.navigation.chatTitle"
          class="border-input w-full rounded-md border px-3 py-2"
        />
        <p v-if="renameError" role="alert" class="text-sm text-red-600">
          {{ renameError }}
        </p>
        <DialogFooter>
          <Button variant="outline" @click="renameThreadId = null">
            {{ $i18n.t.value.common.cancel }}
          </Button>
          <Button type="submit">{{ $i18n.t.value.common.save }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
