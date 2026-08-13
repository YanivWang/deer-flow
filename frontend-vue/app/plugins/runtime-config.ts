import { setDeerFlowRuntimeOptions } from "@/core/config";
import { isEnabledRuntimeFlag } from "@/core/auth/decision";

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  setDeerFlowRuntimeOptions({
    langgraphBaseUrl: String(config.public.langgraphBaseUrl ?? ""),
    backendBaseUrl: String(config.public.backendBaseUrl ?? ""),
    authDisabled: isEnabledRuntimeFlag(config.public.authDisabled),
  });
});
