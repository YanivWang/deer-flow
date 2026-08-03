import { computed, ref, type MaybeRefOrGetter } from "vue";

import { useLarkIntegration } from "./use-lark-integration";
import type {
  LarkAuthStartResponse,
  LarkConfigStartResponse,
} from "../../../core/api/integrations/lark";

export function useSettingsIntegrations(enabled: MaybeRefOrGetter<boolean> = true) {
  const integrationSettings = useLarkIntegration(enabled);
  const actionMessage = ref("");
  const formError = ref("");
  const configBrand = ref("feishu");
  const configStartResult = ref<LarkConfigStartResponse | null>(null);
  const configDeviceCode = ref("");
  const authDomains = ref("docs,sheets");
  const authScope = ref("");
  const authRecommend = ref(true);
  const authStartResult = ref<LarkAuthStartResponse | null>(null);
  const authDeviceCode = ref("");
  const authWaitTimeout = ref("8");
  const calendarFlow = ref(false);
  const calendarConfigPending = ref(false);
  const hasUnsavedChanges = computed(() =>
    configDeviceCode.value.trim().length > 0
    || authDeviceCode.value.trim().length > 0
    || authDomains.value !== "docs,sheets"
    || authScope.value.trim().length > 0
    || !authRecommend.value
    || authWaitTimeout.value !== "8",
  );

  async function installSkillPack() {
    clearTransientState();
    const result = await integrationSettings.install();
    actionMessage.value = result.message;
  }

  async function startConfigWizard() {
    clearTransientState();
    const result = await integrationSettings.startConfig({ brand: configBrand.value });
    configStartResult.value = result;
    configDeviceCode.value = result.device_code;
    actionMessage.value = "Lark 应用配置验证已开始。";
  }

  async function completeConfigWizard() {
    clearTransientState();
    const deviceCode = configDeviceCode.value.trim();
    if (!deviceCode) {
      formError.value = "配置设备码为必填项。";
      return;
    }
    const result = await integrationSettings.completeConfig({
      brand: configBrand.value,
      device_code: deviceCode,
      expires_in: configStartResult.value?.expires_in ?? null,
      interval: configStartResult.value?.interval ?? null,
    });
    actionMessage.value = result.message;
  }

  async function startAuthWizard() {
    clearTransientState();
    if (calendarFlow.value && !calendarConfigPending.value && !authStartResult.value) {
      configStartResult.value = await integrationSettings.startConfig({ brand: configBrand.value });
      calendarConfigPending.value = true;
      return;
    }
    await requestAuth();
  }

  async function requestAuth() {
    clearTransientState();
    const result = await integrationSettings.startAuth({
      domains: parseCsvList(authDomains.value),
      recommend: authRecommend.value,
      scope: authScope.value.trim() || null,
    });
    authStartResult.value = result;
    authDeviceCode.value = result.device_code;
    actionMessage.value = "Lark 授权验证已开始。";
  }

  function openCalendarAuth() {
    calendarFlow.value = true;
    calendarConfigPending.value = false;
    authDomains.value = "calendar";
    authScope.value = "";
    authRecommend.value = false;
  }

  async function continueOrCompleteAuth() {
    if (calendarFlow.value && calendarConfigPending.value) {
      calendarConfigPending.value = false;
      await requestAuth();
      if (authStartResult.value) {
        await completeAuthWizard();
      }
      return;
    }
    await completeAuthWizard();
  }

  async function completeAuthWizard() {
    clearTransientState();
    const deviceCode = authDeviceCode.value.trim();
    if (!deviceCode) {
      formError.value = "授权设备码为必填项。";
      return;
    }
    const waitTimeout = Number(authWaitTimeout.value);
    if (!Number.isFinite(waitTimeout) || waitTimeout < 0) {
      formError.value = "等待超时必须大于或等于 0。";
      return;
    }
    const result = await integrationSettings.completeAuth({
      device_code: deviceCode,
      wait_timeout_seconds: waitTimeout,
    });
    actionMessage.value = result.message;
  }

  function clearTransientState() {
    actionMessage.value = "";
    formError.value = "";
  }

  function resetIntegrationDialogState() {
    actionMessage.value = "";
    formError.value = "";
    configBrand.value = "feishu";
    configStartResult.value = null;
    configDeviceCode.value = "";
    authDomains.value = "docs,sheets";
    authScope.value = "";
    authRecommend.value = true;
    authStartResult.value = null;
    authDeviceCode.value = "";
    authWaitTimeout.value = "8";
    calendarFlow.value = false;
    calendarConfigPending.value = false;
  }

  return {
    ...integrationSettings,
    actionMessage,
    authDeviceCode,
    authDomains,
    authRecommend,
    authScope,
    authStartResult,
    authWaitTimeout,
    calendarConfigPending,
    calendarFlow,
    completeAuthWizard,
    completeConfigWizard,
    configBrand,
    configDeviceCode,
    configStartResult,
    continueOrCompleteAuth,
    formError,
    hasUnsavedChanges,
    installSkillPack,
    openCalendarAuth,
    requestAuth,
    resetIntegrationDialogState,
    setAuthDeviceCode: (value: string) => { authDeviceCode.value = value; },
    setAuthDomains: (value: string) => { authDomains.value = value; },
    setAuthRecommend: (value: boolean) => { authRecommend.value = value; },
    setAuthScope: (value: string) => { authScope.value = value; },
    setAuthWaitTimeout: (value: string) => { authWaitTimeout.value = value; },
    setConfigBrand: (value: string) => { configBrand.value = value; },
    setConfigDeviceCode: (value: string) => { configDeviceCode.value = value; },
    startAuthWizard,
    startConfigWizard,
  };
}

export type SettingsIntegrationsController = ReturnType<typeof useSettingsIntegrations>;

export function displayLarkAuthStatus(status: {
  message?: string | null;
  user?: string | null;
  status?: string;
}): string {
  return (status.message || status.user || status.status || "").replace("Lark/Feishu", "Lark");
}

function parseCsvList(value: string): string[] {
  return value.split(",").map((part) => part.trim()).filter(Boolean);
}
