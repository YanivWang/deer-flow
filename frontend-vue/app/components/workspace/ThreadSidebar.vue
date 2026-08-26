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
import { useAgentsApiEnabled } from "@/composables/useWorkspaceFeatures";
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
const features = useAgentsApiEnabled();
const settingsDialog = useSettingsDialog();
const sentinel = ref<HTMLElement | null>(null);
const sidebarElement = ref<HTMLElement | null>(null);
const collapsed = ref(false);
const mobileOpen = ref(false);
/*
  窄屏由 JS 判定而不是只靠 CSS：React 在移动端把侧栏换成 Sheet，关着时**整棵子树
  都不在 DOM 里**。只用 translate 推出屏幕的话，元素仍然可聚焦、仍然被读屏器遍历——
  用户会 Tab 进一个自己看不见的导航。SSR 阶段当作宽屏，与 React 的 useIsMobile
  在服务端返回 undefined（按桌面渲染）一致，水合后再纠正。
*/
const isNarrow = ref(false);
const NARROW_QUERY = "(max-width: 767px)";
let narrowMedia: MediaQueryList | null = null;
function syncNarrow(event: MediaQueryList | MediaQueryListEvent) {
  isNarrow.value = event.matches;
}
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

/*
  收起（不是切换）。React 在选中 artifact 时调 `useSidebar().setOpen(false)`
  （frontend/src/components/workspace/artifacts/context.tsx），也就是把桌面侧栏
  收起并写进同一个 cookie；`openMobile` 不受影响。这里照同样的语义实现，
  用一个**独立**事件而不是给 toggle 加参数：一个叫 toggle 的事件有时不切换，
  是下一个读者最容易读错的那种代码。
*/
function collapseSidebar() {
  if (collapsed.value) return;
  setCollapsed(true);
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
  narrowMedia = globalThis.matchMedia?.(NARROW_QUERY) ?? null;
  if (narrowMedia) {
    syncNarrow(narrowMedia);
    narrowMedia.addEventListener("change", syncNarrow);
  }
  const persisted = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${SIDEBAR_COOKIE}=`))
    ?.slice(SIDEBAR_COOKIE.length + 1);
  if (persisted === "false") collapsed.value = true;
  globalThis.addEventListener("deerflow:toggle-sidebar", toggleSidebar);
  globalThis.addEventListener("deerflow:collapse-sidebar", collapseSidebar);
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
  narrowMedia?.removeEventListener("change", syncNarrow);
  observer?.disconnect();
  globalThis.removeEventListener("deerflow:toggle-sidebar", toggleSidebar);
  globalThis.removeEventListener("deerflow:collapse-sidebar", collapseSidebar);
  globalThis.removeEventListener("keydown", onWindowKeydown);
});

watch(sentinel, (element, previous) => {
  if (previous) observer?.unobserve(previous);
  if (element) observer?.observe(element);
});

watch(mobileOpen, async (open) => {
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
  <!--
    侧栏是 div、导航是 ul/li，都照 React 的 shadcn sidebar
    （frontend/src/components/ui/sidebar.tsx）。改成 aside + nav 看起来更"语义"，
    但那样 Vue 会比 React 多出 complementary 与 navigation 两个地标，读屏器的地标
    列表两边对不上；而条目不放在 li 里，读屏器就不会报"第 2 项，共 4 项"。

    窄屏下整个侧栏**不渲染**：React 在移动端换成一个 Sheet，关着的时候 DOM 里什么
    都没有。Vue 原来只是把它 translate 出屏幕——看不见，但 Tab 一路按下去仍然会走
    进这 5 个入口，读屏器也照念不误。
  -->
  <div
    v-if="mobileOpen || !isNarrow"
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
    <!--
      收起态换的是**整块**头部，不是给同一块加几个 class：React 的 WorkspaceHeader
      在 collapsed 分支里渲染的是「DF + 悬停才出现的触发器」，展开分支才是
      「DeerFlow + 常驻触发器」（frontend/src/components/workspace/workspace-header.tsx）。
      触发器在收起态是 display:none 直到悬停，所以它此时**不在可访问性树里**——
      不是看不见而已。
    -->
    <div
      data-sidebar="header"
      class="group/workspace-header flex h-12 shrink-0 items-center px-2"
      :class="sidebarExpanded ? 'justify-between' : 'justify-center'"
    >
      <div
        v-if="sidebarExpanded"
        class="text-primary cursor-default px-2 font-serif text-base"
      >
        DeerFlow
      </div>
      <span
        v-else
        class="text-primary font-serif group-hover/workspace-header:hidden"
        >DF</span
      >
      <!--
        名字恒为 "Toggle Sidebar"，也不带 aria-expanded：React 的 SidebarTrigger
        就是一个 sr-only 的固定名字。名字随收起态在"收起/展开"之间来回换，读屏器
        每次折叠都会重念一遍按钮，用户听到的是控件变了，其实只是状态变了。
      -->
      <button
        type="button"
        data-sidebar="trigger"
        class="hover:bg-sidebar-accent size-8 items-center justify-center rounded-md"
        :class="
          sidebarExpanded
            ? 'hidden md:flex'
            : 'hidden md:group-hover/workspace-header:flex'
        "
        :aria-label="$i18n.t.value.primitives.toggleSidebar"
        @click="setCollapsed(!collapsed)"
      >
        <ChevronsRight v-if="collapsed" :size="16" />
        <ChevronsLeft v-else :size="16" />
      </button>
    </div>
    <!--
      两组菜单的内外边距照 React 的 SidebarHeader / SidebarGroup 取：
      头部与「新对话」之间是 gap-2（8px），第二组菜单上面只有 pt-1（4px）。
      原来把 8px 放在第一组的下边、上边留 0，整条导航就整体上移 4px——
      看起来只是"间距差不多"，量出来是每一个入口都不在 React 的位置上。
    -->
    <ul data-sidebar="menu" class="space-y-1 px-2 pt-2 text-sm">
      <li data-sidebar="menu-item">
        <NuxtLink
          data-sidebar="menu-button"
          to="/workspace/chats/new"
          :data-active="isActive('/workspace/chats/new')"
          class="text-muted-foreground hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground flex h-8 items-center gap-2 rounded-md px-2 font-medium"
          :title="collapsed ? $i18n.t.value.sidebar.newChat : undefined"
          @click="startNewChat"
        >
          <MessageSquarePlus :size="16" class="shrink-0" />
          <span v-if="sidebarExpanded">{{
            $i18n.t.value.sidebar.newChat
          }}</span>
        </NuxtLink>
      </li>
    </ul>
    <ul data-sidebar="menu" class="space-y-1 px-2 pt-1 pb-2 text-sm">
      <li data-sidebar="menu-item">
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
      </li>
      <li data-sidebar="menu-item">
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
            <span v-if="sidebarExpanded">{{
              $i18n.t.value.sidebar.agents
            }}</span>
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
      </li>
      <li data-sidebar="menu-item">
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
      </li>
    </ul>

    <ChannelConnections v-if="sidebarExpanded" />

    <!--
      一条会话都没有的时候，标题和列表**都不渲染**——React 的 RecentChatList 在
      threads.length === 0 时直接 return null。留一个空标题加一个空 ul，读屏器会
      念出「最近的对话，列表，0 项」，而屏幕上其实什么都没有。
    -->
    <div
      v-if="sidebarExpanded && threads.displayedThreads.length"
      class="text-muted-foreground px-4 py-2 text-xs font-medium"
    >
      {{ $i18n.t.value.sidebar.recentChats }}
    </div>
    <ul
      v-if="sidebarExpanded && threads.displayedThreads.length"
      data-sidebar="menu"
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
    <ul data-sidebar="menu" class="mt-auto p-2">
      <li data-sidebar="menu-item">
        <DropdownMenu v-model:open="settingsOpen">
          <DropdownMenuTrigger>
            <!--
              名字只来自可见文字，不额外挂 aria-label / title：React 的
              WorkspaceNavMenu 给这颗按钮的全部内容就是收起时一个图标、展开时
              图标 + "Settings and more" 文本（frontend/src/components/workspace/workspace-nav-menu.tsx），
              没有 sr-only 也没有 tooltip prop。补上名字听起来更好，但那样两个
              应用在收起态念出来的东西不一样，而这份对照要求它们一样。
            -->
            <button
              ref="settingsTrigger"
              type="button"
              data-testid="workspace-nav-menu-trigger"
              class="text-muted-foreground hover:bg-sidebar-accent flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm"
            >
              <Settings :size="16" class="shrink-0" />
              <span v-if="sidebarExpanded">{{
                $i18n.t.value.workspace.settingsAndMore
              }}</span>
              <ChevronsUpDown
                v-if="sidebarExpanded"
                :size="16"
                class="ml-auto"
              />
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
                <Globe :size="14" />
                {{ $i18n.t.value.workspace.officialWebsite }}
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
      </li>
    </ul>
    <!--
      SidebarRail：一条贴着侧栏右缘、宽 16px 的拖拽热区，点一下也能收起/展开。
      tabindex="-1" 是 React 的选择——它与头部那个触发器同名同功能，进 Tab 序列
      只会让键盘用户连按两次听到同一个按钮。窄屏没有它（React 的 rail 是 sm:flex）。
    -->
    <button
      type="button"
      data-sidebar="rail"
      :aria-label="$i18n.t.value.primitives.toggleSidebar"
      :title="$i18n.t.value.primitives.toggleSidebar"
      tabindex="-1"
      class="hover:after:bg-sidebar-border absolute inset-y-0 -right-4 z-20 hidden w-4 -translate-x-1/2 cursor-w-resize after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] sm:flex"
      @click="setCollapsed(!collapsed)"
    />
  </div>
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
