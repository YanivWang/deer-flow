<script setup lang="ts">
/*
  【文件职责】     Workspace command palette 与全局快捷操作的唯一 window-listener owner。
  【架构位置】     L3 workspace shell
  【主要导出】     默认 CommandPalette 组件
  【依赖关系】     ui/dialog · ui/command · settings owner · shortcut matcher · Vue Router
  【边界与注意】   不持有 thread/server state；卸载时删除唯一 listener。
                   过滤仍然由本组件做（Command primitive 不接管筛选）；方向键、Enter、
                   aria-activedescendant 归 primitive，所以这里不再有第二份键盘状态机。
*/
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { Keyboard, MessageSquarePlus, Settings } from "lucide-vue-next";

import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSettingsDialog } from "@/composables/useSettingsDialog";
import {
  commandForWorkspaceShortcut,
  isWorkspaceShortcutEditableTarget,
  type WorkspaceShortcutCommand,
} from "@/core/workspace-shell/shortcuts";

type PaletteCommand = Exclude<
  WorkspaceShortcutCommand,
  "command-palette" | "toggle-sidebar"
>;

const { $i18n } = useNuxtApp();
const router = useRouter();
const route = useRoute();
const settings = useSettingsDialog();
const paletteOpen = ref(false);
const shortcutsOpen = ref(false);
const search = ref("");
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

async function runCommand(command: PaletteCommand) {
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
  <Dialog v-model:open="paletteOpen">
    <DialogContent
      overlay-class="bg-black/40"
      class="bg-popover text-popover-foreground top-[20%] w-[min(92vw,560px)] max-w-none translate-y-0 gap-0 overflow-hidden rounded-xl p-0 shadow-2xl sm:max-w-none"
      :close-label="$i18n.t.value.primitives.close"
      @close-auto-focus="restoreFocus"
    >
      <DialogTitle class="sr-only">
        {{ $i18n.t.value.shortcuts.actions }}
      </DialogTitle>
      <DialogDescription class="sr-only">
        {{ $i18n.t.value.shortcuts.searchActions }}
      </DialogDescription>
      <Command>
        <CommandInput
          v-model="search"
          :aria-label="$i18n.t.value.shortcuts.searchActions.replace('...', '')"
          :placeholder="$i18n.t.value.shortcuts.searchActions"
        />
        <CommandList :aria-label="$i18n.t.value.shortcuts.actions">
          <CommandEmpty v-if="!filteredActions.length">
            {{ $i18n.t.value.shortcuts.noResults }}
          </CommandEmpty>
          <CommandItem
            v-for="action in filteredActions"
            :key="action.id"
            :value="action.id"
            @select="runCommand(action.id)"
          >
            <component :is="action.icon" :size="16" />
            <span class="flex-1">{{ action.label }}</span>
            <CommandShortcut>{{ action.shortcut }}</CommandShortcut>
          </CommandItem>
        </CommandList>
      </Command>
    </DialogContent>
  </Dialog>

  <Dialog v-model:open="shortcutsOpen">
    <DialogContent
      overlay-class="bg-black/40"
      class="bg-popover text-popover-foreground w-[min(92vw,480px)] rounded-xl p-5 shadow-2xl"
      :close-label="$i18n.t.value.primitives.close"
      @close-auto-focus="restoreFocus"
    >
      <DialogTitle>
        {{ $i18n.t.value.shortcuts.keyboardShortcuts }}
      </DialogTitle>
      <DialogDescription>
        {{ $i18n.t.value.shortcuts.keyboardShortcutsDescription }}
      </DialogDescription>
      <dl class="grid grid-cols-[1fr_auto] gap-x-5 gap-y-3 text-sm">
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
  </Dialog>
</template>
