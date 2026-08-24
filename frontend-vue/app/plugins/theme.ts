/*
  【文件职责】     在 Nuxt 应用级创建唯一 theme controller，并为 SSR 提供无副作用快照。
  【架构位置】     L3
  【主要导出】     Nuxt universal plugin
  【依赖关系】     core/theme/controller.ts · app.vue cleanup
  【边界与注意】   首屏 class 由同一配置生成的 head bootstrap 先行；只有 client 分支注册 listener。
*/

import { readonly, ref } from "vue";

import {
  createThemeController,
  type ThemeController,
} from "@/core/theme/controller";
import { THEME_MEDIA_QUERY } from "@/core/theme/bootstrap";

function createServerThemeSnapshot(): ThemeController {
  const preference = ref<"system" | "light" | "dark">("system");
  const resolved = ref<"light" | "dark">("light");
  const forced = ref<"light" | "dark" | null>(null);
  return {
    preference: readonly(preference),
    resolved: readonly(resolved),
    forced: readonly(forced),
    setPreference() {},
    setForcedTheme() {},
    dispose() {},
  };
}

export default defineNuxtPlugin(() => {
  const theme = import.meta.client
    ? createThemeController({
        root: document.documentElement,
        media: globalThis.matchMedia(THEME_MEDIA_QUERY),
        storage: localStorage,
        forced: globalThis.location.pathname === "/" ? "dark" : null,
      })
    : createServerThemeSnapshot();
  return { provide: { theme } };
});
