<script setup lang="ts">
/*
  【文件职责】     编排 DeerFlow settings 的导航、路由深链与可访问 modal 生命周期。
  【架构位置】     L3 workspace settings shell
  【主要导出】     默认 SettingsDialog 组件
  【依赖关系】     Reka Dialog · useSettingsDialog · vue-router · settings panels
  【边界与注意】   useSettingsDialog 是唯一 UI owner；各 WP-10 Query owner 保持在子面板内。
*/
import { computed, defineAsyncComponent, nextTick, ref, watch } from "vue";
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from "reka-ui";

import ChannelConnections from "@/components/workspace/channels/ChannelConnections.vue";
import AboutSettings from "@/components/workspace/settings/AboutSettings.vue";
import AccountSettings from "@/components/workspace/settings/AccountSettings.vue";
import AppearanceSettings from "@/components/workspace/settings/AppearanceSettings.vue";
import MemorySettings from "@/components/workspace/settings/MemorySettings.vue";
import NotificationSettings from "@/components/workspace/settings/NotificationSettings.vue";
import SkillSettings from "@/components/workspace/settings/SkillSettings.vue";
import ToolSettings from "@/components/workspace/settings/ToolSettings.vue";
import {
  useSettingsDialog,
  type SettingsSection,
} from "@/composables/useSettingsDialog";
import {
  buildSettingsCloseLocation,
  readSettingsSection,
  SETTINGS_SECTIONS,
} from "@/core/workspace-shell/settings-query";

const IntegrationsSettings = defineAsyncComponent(
  () => import("@/components/workspace/settings/IntegrationsSettings.vue"),
);

const { $i18n } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const settings = useSettingsDialog();
const sectionButtons = ref<Partial<Record<SettingsSection, HTMLButtonElement>>>(
  {},
);
let routeOwnsDialog = false;
let focusBeforeOpen: HTMLElement | null = null;

const sections = computed(() =>
  SETTINGS_SECTIONS.map((id) => ({
    id,
    label: $i18n.t.value.settings.sections[id],
  })),
);

watch(
  () => route.query.settings,
  (value) => {
    const requested = readSettingsSection(value);
    if (requested) {
      if (!settings.open.value) {
        focusBeforeOpen =
          settings.returnFocus.value ??
          (document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null);
      }
      routeOwnsDialog = true;
      settings.show(requested);
    } else if (routeOwnsDialog) {
      routeOwnsDialog = false;
      settings.close({ source: "route" });
    }
  },
  { immediate: true },
);

watch(
  () => settings.open.value,
  (open, previous) => {
    if (open && !previous && !focusBeforeOpen) {
      focusBeforeOpen =
        settings.returnFocus.value ??
        (document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null);
    }
  },
);

function setSectionButton(
  section: SettingsSection,
  element: Element | { $el?: Element } | null,
) {
  const candidate = element && "$el" in element ? element.$el : element;
  if (candidate instanceof HTMLButtonElement) {
    sectionButtons.value[section] = candidate;
  }
}

function focusInitial(event: Event) {
  event.preventDefault();
  void nextTick(() => sectionButtons.value[settings.section.value]?.focus());
}

function restoreFocus(event: Event) {
  event.preventDefault();
  focusBeforeOpen?.focus({ preventScroll: true });
  focusBeforeOpen = null;
  settings.returnFocus.value = null;
}

async function closeFromUser() {
  settings.close({ source: "user" });
  if (!routeOwnsDialog) return;
  routeOwnsDialog = false;
  await router.push(
    buildSettingsCloseLocation({
      path: route.path,
      query: route.query,
      hash: route.hash,
    }),
  );
}

function onOpenChange(open: boolean) {
  if (!open && settings.open.value) void closeFromUser();
}
</script>

<template>
  <DialogRoot :open="settings.open.value" @update:open="onOpenChange">
    <DialogPortal>
      <DialogOverlay
        data-testid="settings-overlay"
        class="fixed inset-0 z-[80] bg-black/40"
      />
      <DialogContent
        aria-modal="true"
        class="bg-background border-border fixed top-1/2 left-1/2 z-[81] flex h-[min(720px,90vh)] w-[min(96vw,896px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border shadow-2xl"
        @open-auto-focus="focusInitial"
        @close-auto-focus="restoreFocus"
      >
        <DialogTitle class="sr-only">
          {{ $i18n.t.value.settings.title }}
        </DialogTitle>
        <DialogDescription class="sr-only">
          {{ $i18n.t.value.settings.description }}
        </DialogDescription>
        <aside class="bg-muted/40 w-48 shrink-0 border-r p-3">
          <h1 class="px-2 pb-3 text-lg font-semibold">
            {{ $i18n.t.value.settings.title }}
          </h1>
          <button
            v-for="item in sections"
            :key="item.id"
            :ref="(element) => setSectionButton(item.id, element)"
            type="button"
            class="hover:bg-accent mb-1 w-full rounded-md px-3 py-2 text-left text-sm"
            :class="settings.section.value === item.id ? 'bg-accent' : ''"
            @click="settings.section.value = item.id"
          >
            {{ item.label }}
          </button>
        </aside>
        <main class="min-w-0 flex-1 overflow-y-auto p-6">
          <AccountSettings v-if="settings.section.value === 'account'" />
          <AppearanceSettings
            v-else-if="settings.section.value === 'appearance'"
          />
          <NotificationSettings
            v-else-if="settings.section.value === 'notification'"
          />
          <IntegrationsSettings
            v-else-if="settings.section.value === 'integrations'"
          />
          <ChannelConnections
            v-else-if="settings.section.value === 'channels'"
            variant="settings"
          />
          <ToolSettings v-else-if="settings.section.value === 'tools'" />
          <SkillSettings v-else-if="settings.section.value === 'skills'" />
          <MemorySettings v-else-if="settings.section.value === 'memory'" />
          <AboutSettings v-else-if="settings.section.value === 'about'" />
        </main>
        <button
          type="button"
          :aria-label="`${$i18n.t.value.common.close} ${$i18n.t.value.settings.title}`"
          class="hover:bg-accent m-3 size-8 rounded-md"
          @click="closeFromUser"
        >
          ×
        </button>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
