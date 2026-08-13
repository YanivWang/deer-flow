<script setup lang="ts">
/*
  【文件职责】     管理 DeerFlow locale、theme 与显示偏好。
  【对应 frontend/】 src/components/workspace/settings/appearance-settings.tsx
  【架构位置】     L3
  【主要导出】     默认 AppearanceSettings 组件
  【依赖关系】     i18n · color mode · settings store
  【边界与注意】   应用设置接线，不属于 L2。
*/
import { onMounted, ref } from "vue";
import type { Locale } from "@/core/i18n/locale";

const { $i18n } = useNuxtApp();
const theme = ref<"system" | "light" | "dark">("system");

function applyTheme(value: "system" | "light" | "dark") {
  theme.value = value;
  const dark =
    value === "dark" ||
    (value === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  localStorage.setItem("deerflow-theme", value);
}

function setLocale(event: Event) {
  $i18n.setLocale((event.target as HTMLSelectElement).value as Locale);
}

onMounted(() =>
  applyTheme(
    (localStorage.getItem("deerflow-theme") as typeof theme.value | null) ??
      "system",
  ),
);
</script>

<template>
  <section class="space-y-8">
    <div>
      <h2 class="text-lg font-semibold">Theme</h2>
      <p class="text-muted-foreground text-sm">
        Choose how DeerFlow appears on this device.
      </p>
      <div class="mt-3 grid gap-3 sm:grid-cols-3">
        <button
          v-for="option in ['system', 'light', 'dark'] as const"
          :key="option"
          type="button"
          class="rounded-lg border p-4 text-left capitalize"
          :class="
            theme === option ? 'border-primary ring-primary/30 ring-2' : ''
          "
          @click="applyTheme(option)"
        >
          {{ option }}
        </button>
      </div>
    </div>
    <div>
      <h2 class="text-lg font-semibold">Language</h2>
      <select
        :value="$i18n.locale.value"
        class="border-input mt-3 rounded-md border px-3 py-2"
        @change="setLocale"
      >
        <option value="en-US">English</option>
        <option value="zh-CN">简体中文</option>
      </select>
    </div>
  </section>
</template>
