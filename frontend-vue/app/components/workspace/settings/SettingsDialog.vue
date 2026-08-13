<script setup lang="ts">
/*
  【文件职责】     编排 DeerFlow settings 的导航与各业务面板。
  【对应 frontend/】 src/components/workspace/settings/settings-dialog.tsx
  【架构位置】     L3
  【主要导出】     默认 SettingsDialog 组件
  【依赖关系】     useSettingsDialog · settings panels
  【边界与注意】   产品设置容器，不属于 L2。
*/
import { defineAsyncComponent, onMounted, onUnmounted, watch } from "vue";

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

const IntegrationsSettings = defineAsyncComponent(
  () => import("@/components/workspace/settings/IntegrationsSettings.vue"),
);

const route = useRoute();
const settings = useSettingsDialog();
const sections: Array<{ id: SettingsSection; label: string }> = [
  { id: "account", label: "Account" },
  { id: "appearance", label: "Appearance" },
  { id: "notification", label: "Notification" },
  { id: "tools", label: "Tools" },
  { id: "skills", label: "Skills" },
  { id: "memory", label: "Memory" },
  { id: "integrations", label: "Integrations" },
  { id: "channels", label: "Channels" },
  { id: "about", label: "About" },
];

watch(
  () => route.query.settings,
  (value) => {
    const requested = Array.isArray(value) ? value[0] : value;
    if (sections.some((item) => item.id === requested))
      settings.show(requested as SettingsSection);
  },
  { immediate: true },
);

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && settings.open.value) settings.close();
}

onMounted(() => globalThis.addEventListener("keydown", onKeydown));
onUnmounted(() => globalThis.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div
    v-if="settings.open.value"
    class="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-3"
    @mousedown.self="settings.close()"
  >
    <div
      role="dialog"
      aria-label="Settings"
      aria-modal="true"
      class="bg-background border-border flex h-[min(720px,90vh)] w-full max-w-4xl overflow-hidden rounded-xl border shadow-2xl"
    >
      <aside class="bg-muted/40 w-48 shrink-0 border-r p-3">
        <h1 class="px-2 pb-3 text-lg font-semibold">Settings</h1>
        <button
          v-for="item in sections"
          :key="item.id"
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
        aria-label="Close Settings"
        class="hover:bg-accent m-3 size-8 rounded-md"
        @click="settings.close()"
      >
        ×
      </button>
    </div>
  </div>
</template>
