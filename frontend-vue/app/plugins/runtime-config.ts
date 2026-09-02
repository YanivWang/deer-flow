/*
  【文件职责】     将 Nuxt runtime config 映射为 DeerFlow 纯运行时选项。
  【架构位置】     L3 Nuxt adapter
  【主要导出】     默认 Nuxt plugin
  【依赖关系】     useRuntimeConfig · core/config
  【边界与注意】   L1 不得读取 runtime config；只能由此适配层注入。
*/

import { setDeerFlowRuntimeOptions } from "@/core/config";
import { isEnabledRuntimeFlag } from "@/core/auth/decision";

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  setDeerFlowRuntimeOptions({
    langgraphBaseUrl: String(config.public.langgraphBaseUrl ?? ""),
    backendBaseUrl: String(config.public.backendBaseUrl ?? ""),
    authDisabled: isEnabledRuntimeFlag(config.public.authDisabled),
    appVersion: String(config.public.appVersion ?? ""),
  });
});
