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
import ThreadChannelBadge from "@/components/workspace/ThreadChannelBadge.vue";
import ThreadChannelIcon from "@/components/workspace/ThreadChannelIcon.vue";
import VirtualThreadList from "@/components/workspace/VirtualThreadList.vue";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import type { AgentThread } from "@/core/threads/types";
import { visibleFocusableWithin } from "@/lib/focusable";
import { useWorkspaceToast } from "@/core/workspace-shell/toast";

const route = useRoute();
const router = useRouter();
const { $i18n } = useNuxtApp();
const threads = useThreads();
const features = useAgentsApiEnabled();
const settingsDialog = useSettingsDialog();
const toast = useWorkspaceToast();
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
const deleteError = ref<string | null>(null);
const failedDeleteThread = ref<AgentThread | null>(null);
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
      if (threads.canLoadMore && entries.some((entry) => entry.isIntersecting))
        void threads.loadMore();
    },
    { rootMargin: "120px 0px 120px 0px" },
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

/*
  侧栏显示的行 = 前 200 条（threads.displayedThreads）**加上当前打开的那条**，
  哪怕它已经掉出上限之外。React 的 RecentChatList 就是这么补的：翻得足够深再点开
  一条老会话，不补的话侧栏里没有任何一行是高亮的，用户看不出自己在哪儿。
*/
const sidebarThreads = computed(() => {
  const activeId = route.params.thread_id;
  if (typeof activeId !== "string" || !activeId) {
    return threads.displayedThreads;
  }
  if (
    threads.displayedThreads.some((thread) => thread.thread_id === activeId)
  ) {
    return threads.displayedThreads;
  }
  const active = threads.threads.find(
    (thread) => thread.thread_id === activeId,
  );
  return active
    ? [...threads.displayedThreads, active]
    : threads.displayedThreads;
});

function startNewChat() {
  mobileOpen.value = false;
  globalThis.dispatchEvent(new CustomEvent("deerflow:new-chat"));
}

/*
  「删掉的是不是我正看着的那条」有三种成立方式，照 React 的 handleDelete
  （frontend/src/components/workspace/recent-chat-list.tsx）：路由参数就是它、
  当前路径就是它的路径、**或者**停在 /chats/new 而它是列表里最新的一条。
  第三种最容易漏：新会话页此时展示的就是最新那条的延续，删掉它却不重置，
  用户会对着一个已经不存在的线程继续输入。

  判定必须在 await 之前做完——删完之后列表已经变了，`threads[0]` 不再是刚才那条。
  目标路径也不能写死 /workspace/chats/new：在 agent 会话里要回到那个 agent 的新会话页。
*/
function isCurrentThread(thread: AgentThread) {
  const threadPath = pathOfThread(thread);
  const newThreadPath = nextThreadPath();
  return (
    thread.thread_id === route.params.thread_id ||
    threadPath === route.path ||
    (route.path === newThreadPath &&
      threads.threads[0]?.thread_id === thread.thread_id)
  );
}

function nextThreadPath() {
  const agentName = route.params.agent_name;
  return pathOfThread("new", {
    agent_name: typeof agentName === "string" ? agentName : undefined,
  });
}

async function removeThread(thread: AgentThread) {
  const threadId = thread.thread_id;
  if (deletingThreadId.value) return;
  const active = isCurrentThread(thread);
  const nextPath = nextThreadPath();
  deleteError.value = null;
  failedDeleteThread.value = null;
  deletingThreadId.value = threadId;
  try {
    await threads.remove(threadId);
    if (active) {
      // 先重置会话状态再换 URL，与 React 的 resetThreadChatAfterDelete + replace 同序。
      globalThis.dispatchEvent(new CustomEvent("deerflow:new-chat"));
      // replace 而不是 push：删完再按后退不该回到一个已经不存在的线程。
      await router.replace(nextPath);
    }
  } catch (cause) {
    failedDeleteThread.value = thread;
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
}

/*
  失败走 toast，不是对话框里的内联错误——React 的 handleRenameSubmit 就是
  `toast.error(error.message || t.common.renameFailed)`，对话框保持打开、内容不变。
  内联错误看起来更贴心，但那样 Vue 的这个对话框比 React 多一个 alert 节点，
  而这份对照的判据是双向的。
*/
async function submitRename() {
  if (!renameThreadId.value || !renameTitle.value.trim()) return;
  try {
    await threads.rename(renameThreadId.value, renameTitle.value.trim());
    renameThreadId.value = null;
  } catch (cause) {
    toast.error(
      cause instanceof Error && cause.message
        ? cause.message
        : $i18n.t.value.common.renameFailed,
    );
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
    <div data-sidebar="header" class="flex flex-col gap-2 px-2">
      <div
        class="group/workspace-header flex h-12 shrink-0 items-center"
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
        「新对话」和上面那条标题栏同属 SidebarHeader，中间隔 gap-2（8px）：React 把
        两者一起交给 SidebarHeader（frontend/src/components/workspace/workspace-sidebar.tsx），
        那是 `flex flex-col gap-2 p-2`，再被页面的 `py-0` 抹掉上下内边距。
        原来两块是平级兄弟、靠第一组 ul 的 pt-2 凑出这 8px，凑得出位置凑不出结构——
        侧栏一旦要整体滚动，靠 padding 拼出来的间距会跟着一起错位。
      -->
      <ul
        data-sidebar="menu"
        class="flex w-full min-w-0 flex-col gap-1 text-sm"
      >
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
    </div>
    <!--
      导航、渠道、最近的对话住在**同一个可滚动容器**里，组与组之间 gap-2——这是
      React 的 SidebarContent（`flex min-h-0 flex-1 flex-col gap-2 overflow-auto`）。

      原来只有「最近的对话」那个 ul 自己 overflow-y-auto，导航入口固定在上方不动。
      看起来更好用，但那不是 React 的行为：会话多到要滚动时，React 会把导航一起滚走。
      更要紧的是位置——少了组间那 8px，整块「最近的对话」比 React 高 8px，再加上
      标题没有按 SidebarGroupLabel 的 h-8 + 组内边距排，每一行会话都落在错的 y 上。
    -->
    <div
      data-sidebar="content"
      class="flex min-h-0 flex-1 flex-col gap-2 overflow-auto"
    >
      <div
        data-sidebar="group"
        class="relative flex w-full min-w-0 flex-col p-2 pt-1"
      >
        <ul
          data-sidebar="menu"
          class="flex w-full min-w-0 flex-col gap-1 text-sm"
        >
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
              <span v-if="sidebarExpanded">{{
                $i18n.t.value.sidebar.chats
              }}</span>
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
              <span v-if="sidebarExpanded">{{
                $i18n.t.value.sidebar.agents
              }}</span>
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
              :title="
                collapsed ? $i18n.t.value.sidebar.scheduledTasks : undefined
              "
            >
              <CalendarClock :size="16" class="shrink-0" />
              <span v-if="sidebarExpanded">{{
                $i18n.t.value.sidebar.scheduledTasks
              }}</span>
            </NuxtLink>
          </li>
        </ul>
      </div>

      <ChannelConnections v-if="sidebarExpanded" />

      <!--
        一条会话都没有的时候，标题和列表**都不渲染**——React 的 RecentChatList 在
        threads.length === 0 时直接 return null。留一个空标题加一个空 ul，读屏器会
        念出「最近的对话，列表，0 项」，而屏幕上其实什么都没有。
      -->
      <div
        v-if="sidebarExpanded && sidebarThreads.length"
        data-sidebar="group"
        class="relative flex w-full min-w-0 flex-col p-2"
      >
        <div
          data-sidebar="group-label"
          class="text-sidebar-foreground/70 flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium"
        >
          {{ $i18n.t.value.sidebar.recentChats }}
        </div>
        <div data-sidebar="group-content" class="w-full text-sm">
          <ul data-sidebar="menu" class="flex w-full min-w-0 flex-col gap-1">
            <!--
              按钮和哨兵是 ul 的**非 li 子节点**，与 React 一样：它们不是列表项，
              包进 li 会让读屏器把「加载更早的对话」念成第 51 个会话。哨兵还要
              aria-hidden——一个 1px 高的空 li 在可访问性树里是一个真实的 listitem。
            -->
            <div
              class="flex w-full flex-col gap-1"
              style="overflow-anchor: none"
            >
              <VirtualThreadList
                :estimate-size="36"
                :gap="4"
                :items="sidebarThreads"
                scroll-parent-selector='[data-sidebar="content"]'
              >
                <template #default="{ thread }">
                  <li data-sidebar="menu-item" class="group/menu-item relative">
                    <!--
                      标题包在一个 `min-w-0 truncate` 的 span 里，链接自己是
                      `w-full ... p-2 pr-8` 的 h-8 行——这是 React 的
                      SidebarMenuButton 加上 group-has-[menu-action] 的 pr-8。
                      原来标题是链接的裸文本、操作菜单是同一行的 flex 兄弟，于是
                      「会话标题」这个可视元素量出来是整行：撑满 203px、高 32px、
                      用前景色。React 那一份是文字宽度、20px 高、muted 色。
                    -->
                    <NuxtLink
                      data-sidebar="menu-button"
                      :to="pathOfThread(thread)"
                      :data-active="isActive(pathOfThread(thread))"
                      class="text-muted-foreground hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground peer/menu-button flex h-8 w-full min-w-0 items-center gap-2 overflow-hidden rounded-md p-2 pr-8 text-left text-sm whitespace-nowrap"
                    >
                      <ThreadChannelIcon
                        :source="channelSourceOfThread(thread)"
                      />
                      <Pin
                        v-if="threads.isPinned(thread)"
                        aria-hidden="true"
                        class="text-muted-foreground size-3.5 shrink-0"
                      />
                      <span class="min-w-0 truncate">{{
                        displayThreadTitle(thread)
                      }}</span>
                      <ThreadChannelBadge
                        :source="channelSourceOfThread(thread)"
                        class="ml-auto h-5 max-w-14 shrink-0 px-1.5 text-[10px]"
                      />
                    </NuxtLink>
                    <ThreadActionsMenu
                      :thread="thread"
                      :pinned="threads.isPinned(thread)"
                      :deleting="deletingThreadId === thread.thread_id"
                      @rename="beginRename(thread.thread_id)"
                      @toggle-pin="
                        threads.setPinned(
                          thread.thread_id,
                          !threads.isPinned(thread),
                        )
                      "
                      @delete="removeThread(thread)"
                    />
                  </li>
                </template>
              </VirtualThreadList>
              <template v-if="threads.hasMore && threads.canLoadMore">
                <button
                  type="button"
                  data-testid="recent-chat-list-load-more"
                  :disabled="threads.loadingMore"
                  class="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground mx-2 my-1 inline-flex h-8 w-[calc(100%-1rem)] items-center justify-center rounded-md px-3 text-xs disabled:pointer-events-none disabled:opacity-50"
                  @click="threads.loadMore()"
                >
                  {{
                    threads.loadingMore
                      ? $i18n.t.value.chats.loadingMore
                      : $i18n.t.value.chats.loadOlderChats
                  }}
                </button>
                <div
                  ref="sentinel"
                  aria-hidden="true"
                  data-testid="recent-chat-list-sentinel"
                  class="h-px w-full"
                />
              </template>
            </div>
          </ul>
        </div>
      </div>
    </div>
    <div
      v-if="sidebarExpanded && deleteError"
      role="alert"
      class="border-destructive/30 bg-destructive/5 text-destructive mx-2 mb-2 rounded-md border p-2 text-xs"
    >
      <p>{{ deleteError }}</p>
      <button
        v-if="failedDeleteThread"
        type="button"
        class="mt-1 underline"
        :disabled="Boolean(deletingThreadId)"
        @click="removeThread(failedDeleteThread)"
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
      <!--
        标题、输入框的名字来源和"没有描述"都照 React 的重命名对话框：标题是
        `common.rename`（"Rename"，不是"Rename chat"），输入框**只有 placeholder**、
        没有 aria-label 也没有 sr-only 描述。给它补一个名字是更好的可访问性，
        但那样两个应用的对话框叫两个名字、输入框念两句话，对照永远对不上。
      -->
      <form class="grid gap-4" @submit.prevent="submitRename">
        <DialogHeader>
          <DialogTitle>{{ $i18n.t.value.common.rename }}</DialogTitle>
        </DialogHeader>
        <input
          v-model="renameTitle"
          :placeholder="$i18n.t.value.common.rename"
          class="border-input w-full rounded-md border px-3 py-2"
        />
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
