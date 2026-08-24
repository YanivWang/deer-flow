/*
  【文件职责】     为纯 happy-dom 组件测试提供 Nuxt 在真实应用里注入的默认 i18n 上下文。
  【架构位置】     测试基础设施
  【主要导出】     无；由 vitest.config.ts 的 dom project 在每个测试前执行
  【依赖关系】     @vue/test-utils 全局 mocks · Vitest globals · en-US 词典
  【边界与注意】   dom project 故意不启动 Nuxt；组件仍应使用生产 useNuxtApp/$i18n，
                   这里只复刻框架注入边界。每条用例都创建新 ref，避免 locale 状态串案；
                   需要特定 locale/theme 的用例可以继续用 vi.stubGlobal 覆盖。
*/

import { config } from "@vue/test-utils";
import { beforeEach, vi } from "vitest";
import { ref } from "vue";

import { enUS } from "@/core/i18n/locales/en-US";

beforeEach(() => {
  const $i18n = {
    locale: ref<"en-US" | "zh-CN">("en-US"),
    setLocale: vi.fn(),
    t: ref(enUS),
  };
  vi.stubGlobal("useNuxtApp", () => ({ $i18n }));
  config.global.mocks = { ...config.global.mocks, $i18n };
});
