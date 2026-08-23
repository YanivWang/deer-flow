<script setup lang="ts">
/*
  【文件职责】     Workspace command palette 与全局快捷操作的唯一 window-listener owner。
  【对应 frontend/】 command-palette.tsx · use-global-shortcuts.ts
  【架构位置】     L3 workspace shell
  【主要导出】     默认 CommandPalette 组件
  【依赖关系】     Reka Dialog · settings owner · shortcut matcher · Vue Router
  【边界与注意】   不持有 thread/server state；卸载时删除唯一 listener。
*/
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from "reka-ui";
import { Keyboard, MessageSquarePlus, Search, Settings } from "lucide-vue-next";

import { useSettingsDialog } from "@/composables/useSettingsDialog";
import {
  commandForWorkspaceShortcut,
  isWorkspaceShortcutEditableTarget,
  type WorkspaceShortcutCommand,
} from "@/core/workspace-shell/shortcuts";

const { $i18n } = useNuxtApp();
const router = useRouter();
const route = useRoute();
const settings = useSettingsDialog();
const paletteOpen = ref(false);
const shortcutsOpen = ref(false);
const search = ref("");
const activeIndex = ref(-1);
const searchInput = ref<HTMLInputElement | null>(null);
let focusBeforeDialog: HTMLElement | null = null;

const actions = computed(() => [
  {
    id: "new-chat" as const,
    label: $i18n.t.value.sidebar.newChat,
    shortcut: "⇧⌘N",
    icon: MessageSquarePlus,
  },
  {
    id: "settings" as const,
    label: $i18n.t.value.common.settings,
    shortcut: "⌘,",
    icon: Settings,
  },
  {
    id: "shortcuts" as const,
    label: $i18n.t.value.shortcuts.keyboardShortcuts,
    shortcut: "⌘/",
    icon: Keyboard,
  },
]);
const filteredActions = computed(() => {
  const query = search.value.trim().toLocaleLowerCase();
  return query
    ? actions.value.filter((action) =>
        action.label.toLocaleLowerCase().includes(query),
      )
    : actions.value;
});

function rememberFocus() {
  focusBeforeDialog =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
}

function openPalette() {
  rememberFocus();
  search.value = "";
  activeIndex.value = -1;
  shortcutsOpen.value = false;
  paletteOpen.value = true;
}

function openShortcuts() {
  rememberFocus();
  paletteOpen.value = false;
  shortcutsOpen.value = true;
}

function restoreFocus(event: Event) {
  event.preventDefault();
  focusBeforeDialog?.focus({ preventScroll: true });
  focusBeforeDialog = null;
}

function focusSearch(event: Event) {
  event.preventDefault();
  void nextTick(() => searchInput.value?.focus());
}

async function runCommand(
  command: Exclude<
    WorkspaceShortcutCommand,
    "command-palette" | "toggle-sidebar"
  >,
) {
  paletteOpen.value = false;
  if (command === "new-chat") {
    await router.push("/workspace/chats/new");
  } else if (command === "settings") {
    settings.show("appearance", {
      returnFocus:
        focusBeforeDialog ??
        (document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null),
    });
  } else {
    openShortcuts();
  }
}

function onGlobalKeydown(event: KeyboardEvent) {
  if (event.defaultPrevented) return;
  const command = commandForWorkspaceShortcut(event);
  if (!command) return;
  if (
    command !== "command-palette" &&
    isWorkspaceShortcutEditableTarget(event.target)
  ) {
    return;
  }
  event.preventDefault();
  if (command === "command-palette") {
    if (paletteOpen.value) paletteOpen.value = false;
    else openPalette();
  } else if (command === "toggle-sidebar") {
    globalThis.dispatchEvent(new CustomEvent("deerflow:toggle-sidebar"));
  } else {
    void runCommand(command);
  }
}

function onPaletteKeydown(event: KeyboardEvent) {
  if (!filteredActions.value.length) return;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    activeIndex.value = (activeIndex.value + 1) % filteredActions.value.length;
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    activeIndex.value =
      (activeIndex.value - 1 + filteredActions.value.length) %
      filteredActions.value.length;
  } else if (event.key === "Enter") {
    event.preventDefault();
    const action =
      filteredActions.value[activeIndex.value < 0 ? 0 : activeIndex.value];
    if (action) void runCommand(action.id);
  }
}

watch(search, () => {
  activeIndex.value = -1;
});
watch(
  () => route.fullPath,
  () => {
    paletteOpen.value = false;
    shortcutsOpen.value = false;
  },
);
onMounted(() => globalThis.addEventListener("keydown", onGlobalKeydown));
onUnmounted(() => globalThis.removeEventListener("keydown", onGlobalKeydown));
</script>

<template>
  <DialogRoot v-model:open="paletteOpen">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-[90] bg-black/40" />
      <DialogContent
        aria-modal="true"
        class="bg-popover text-popover-foreground border-border fixed top-[20%] left-1/2 z-[91] w-[min(92vw,560px)] -translate-x-1/2 overflow-hidden rounded-xl border shadow-2xl"
        @open-auto-focus="focusSearch"
        @close-auto-focus="restoreFocus"
      >
        <DialogTitle class="sr-only">
          {{ $i18n.t.value.shortcuts.actions }}
        </DialogTitle>
        <DialogDescription class="sr-only">
          {{ $i18n.t.value.shortcuts.searchActions }}
        </DialogDescription>
        <div class="border-border flex items-center gap-2 border-b px-3">
          <Search :size="16" class="text-muted-foreground" />
          <input
            ref="searchInput"
            v-model="search"
            :aria-label="
              $i18n.t.value.shortcuts.searchActions.replace('...', '')
            "
            :placeholder="$i18n.t.value.shortcuts.searchActions"
            class="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none"
            @keydown="onPaletteKeydown"
          />
        </div>
        <div
          class="max-h-80 overflow-y-auto p-2"
          role="listbox"
          :aria-label="$i18n.t.value.shortcuts.actions"
        >
          <p
            v-if="!filteredActions.length"
            class="text-muted-foreground px-3 py-6 text-center text-sm"
          >
            {{ $i18n.t.value.shortcuts.noResults }}
          </p>
          <button
            v-for="(action, index) in filteredActions"
            :key="action.id"
            type="button"
            role="option"
            :aria-selected="activeIndex === index"
            class="hover:bg-accent aria-selected:bg-accent flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm"
            @mouseenter="activeIndex = index"
            @click="runCommand(action.id)"
          >
            <component :is="action.icon" :size="16" />
            <span class="flex-1">{{ action.label }}</span>
            <kbd class="text-muted-foreground text-xs">{{
              action.shortcut
            }}</kbd>
          </button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>

  <DialogRoot v-model:open="shortcutsOpen">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-[90] bg-black/40" />
      <DialogContent
        aria-modal="true"
        class="bg-popover text-popover-foreground border-border fixed top-1/2 left-1/2 z-[91] w-[min(92vw,480px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border p-5 shadow-2xl"
        @close-auto-focus="restoreFocus"
      >
        <DialogTitle class="text-lg font-semibold">
          {{ $i18n.t.value.shortcuts.keyboardShortcuts }}
        </DialogTitle>
        <DialogDescription class="text-muted-foreground mt-1 text-sm">
          {{ $i18n.t.value.shortcuts.keyboardShortcutsDescription }}
        </DialogDescription>
        <dl class="mt-4 grid grid-cols-[1fr_auto] gap-x-5 gap-y-3 text-sm">
          <dt>{{ $i18n.t.value.shortcuts.openCommandPalette }}</dt>
          <dd><kbd>⌘K</kbd></dd>
          <dt>{{ $i18n.t.value.sidebar.newChat }}</dt>
          <dd><kbd>⇧⌘N</kbd></dd>
          <dt>{{ $i18n.t.value.common.settings }}</dt>
          <dd><kbd>⌘,</kbd></dd>
          <dt>{{ $i18n.t.value.shortcuts.keyboardShortcuts }}</dt>
          <dd><kbd>⌘/</kbd></dd>
          <dt>{{ $i18n.t.value.shortcuts.toggleSidebar }}</dt>
          <dd><kbd>⌘B</kbd></dd>
        </dl>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
