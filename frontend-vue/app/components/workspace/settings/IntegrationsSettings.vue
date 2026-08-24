<script setup lang="ts">
/*
  【文件职责】     管理 Lark/飞书集成的安装、App 配置、授权与凭证切换流程。
  【架构位置】     L3
  【主要导出】     默认 IntegrationsSettings 组件
  【依赖关系】     Vue-owned Lark flow API · i18n · clipboard
  【边界与注意】   流程以 generation 拦截过期响应，并在用户动作同步预开窗口；不依赖
                   React DOM，也不通过 sleep、重试测试或延迟产品行为解决时序。
*/
import { computed, onMounted, onUnmounted, ref } from "vue";

import { writeTextToClipboard } from "@/core/clipboard";
import {
  completeLarkAuthorization,
  completeLarkConfiguration,
  installLarkIntegration,
  LarkIntegrationRequestError,
  loadLarkIntegrationStatus,
  setLarkAppCredentials,
  startLarkAuthorization,
  startLarkConfiguration,
  type LarkAuthStartRequest,
  type LarkAuthStartResponse,
  type LarkBrand,
  type LarkConfigStartResponse,
} from "@/core/integrations/lark/flow";
import type { LarkIntegrationStatus } from "@/core/integrations/lark/types";

type PendingFlow =
  | ({ kind: "config" } & LarkConfigStartResponse)
  | ({ kind: "auth" } & LarkAuthStartResponse);

const DOMAINS = [
  "calendar",
  "im",
  "docs",
  "drive",
  "sheets",
  "base",
  "wiki",
  "task",
  "mail",
  "vc",
  "minutes",
  "note",
  "slides",
  "markdown",
  "mindnotes",
  "contact",
  "approval",
  "attendance",
  "okr",
  "event",
  "apps",
  "all",
] as const;

const { $i18n } = useNuxtApp();
const copy = computed(() => $i18n.t.value);
const larkCopy = computed(() => copy.value.settings.integrations.lark);

const status = ref<LarkIntegrationStatus | null>(null);
const loading = ref(true);
const fetching = ref(false);
const busy = ref(false);
const notice = ref<string | null>(null);
const error = ref<string | null>(null);
const selectedDomains = ref<string[]>([]);
const customScope = ref("");
const pendingFlow = ref<PendingFlow | null>(null);
const checkingConnection = ref(false);
const showChangeApp = ref(false);
const changeAppId = ref("");
const changeAppSecret = ref("");
const changeAppBrand = ref<LarkBrand>("feishu");
const browserWindow = ref<Window | null>(null);
const authRequest = ref<LarkAuthStartRequest>({ recommend: false });
let clientGeneration = 0;
let authAttempt = 0;
let authDeadline = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

const credentialsConfigured = computed(
  () => status.value?.auth.status === "authenticated",
);
const connected = computed(
  () => credentialsConfigured.value && status.value?.auth.verified === true,
);
const integrationBusy = computed(
  () => busy.value || checkingConnection.value || pendingFlow.value !== null,
);
const showSandboxRuntime = computed(
  () => status.value?.sandbox_runtime_mode !== "none",
);
const connectLabel = computed(() => {
  if (checkingConnection.value) return larkCopy.value.checkingConnection;
  if (busy.value) return larkCopy.value.preparingAuthorization;
  if (credentialsConfigured.value && hasAdditionalPermissions.value)
    return larkCopy.value.requestPermissions;
  return credentialsConfigured.value
    ? larkCopy.value.connectedAction
    : larkCopy.value.connect;
});
const hasAdditionalPermissions = computed(
  () => selectedDomains.value.length > 0 || customScope.value.trim().length > 0,
);
const statusCards = computed(() => {
  if (!status.value) return [];
  return [
    {
      label: larkCopy.value.skillPack,
      ok: status.value.installed,
      value: status.value.installed
        ? larkCopy.value.skillsInstalled(
            status.value.skills_installed,
            status.value.skills_expected,
          )
        : larkCopy.value.notInstalled,
    },
    {
      label: larkCopy.value.gatewayCli,
      ok: status.value.cli.available,
      value: status.value.cli.available
        ? (status.value.cli.version ??
          copy.value.settings.integrations.available)
        : (status.value.cli.error ??
          copy.value.settings.integrations.unavailable),
    },
    {
      label: larkCopy.value.auth,
      ok: connected.value,
      value: credentialsConfigured.value
        ? status.value.auth.user
          ? larkCopy.value.authConfiguredFor(status.value.auth.user)
          : larkCopy.value.authConfigured
        : larkCopy.value.authNotConfigured,
    },
  ];
});
const sandboxRuntimeLabel = computed(() => {
  const current = status.value;
  if (!current?.sandbox_runtime_ready)
    return (
      current?.sandbox_runtime_detail ?? larkCopy.value.sandboxRuntimeNotReady
    );
  if (current.sandbox_runtime_mode === "init-container")
    return larkCopy.value.sandboxRuntimeInitContainer;
  if (current.sandbox_runtime_mode === "broker")
    return larkCopy.value.sandboxRuntimeBroker;
  return larkCopy.value.sandboxRuntimeGatewayDownload;
});
const nextStepTitle = computed(() => {
  if (!status.value?.installed) return larkCopy.value.installNextTitle;
  if (!status.value.cli.available) return larkCopy.value.cliNextTitle;
  if (connected.value) return larkCopy.value.connectedTitle;
  if (credentialsConfigured.value) return larkCopy.value.configuredTitle;
  return larkCopy.value.authNextTitle;
});

function domainLabel(domain: (typeof DOMAINS)[number]) {
  return larkCopy.value.authDomains[domain].label;
}

function clearRetry() {
  if (retryTimer !== null) clearTimeout(retryTimer);
  retryTimer = null;
}

function beginFlow() {
  clearRetry();
  authAttempt += 1;
  clientGeneration += 1;
  pendingFlow.value = null;
  error.value = null;
  return clientGeneration;
}

function active(generation: number) {
  return generation === clientGeneration;
}

function preopenBrowser() {
  const target = globalThis.open?.("about:blank", "_blank") ?? null;
  if (target) target.opener = null;
  browserWindow.value = target;
  return target;
}

function closeBrowser(target: Window | null) {
  target?.close();
  if (browserWindow.value === target) browserWindow.value = null;
}

function openUrl(url: string, target = browserWindow.value) {
  if (target && !target.closed) {
    target.location.href = url;
    browserWindow.value = target;
  } else {
    browserWindow.value =
      globalThis.open?.(url, "_blank", "noopener,noreferrer") ?? null;
  }
}

function buildAuthRequest(): LarkAuthStartRequest {
  const domains = selectedDomains.value.includes("all")
    ? ["all"]
    : [...new Set(selectedDomains.value)];
  const scopes = [
    ...new Set(
      customScope.value
        .split(/[\s,]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
  return {
    recommend: false,
    domains,
    scope: scopes.length ? scopes.join(" ") : null,
  };
}

function toggleDomain(domain: string) {
  if (integrationBusy.value) return;
  if (domain === "all") {
    selectedDomains.value = selectedDomains.value.includes("all")
      ? []
      : ["all"];
    return;
  }
  const withoutAll = selectedDomains.value.filter((item) => item !== "all");
  selectedDomains.value = withoutAll.includes(domain)
    ? withoutAll.filter((item) => item !== domain)
    : [...withoutAll, domain];
}

async function load(initial = false, propagate = false) {
  if (initial) loading.value = true;
  else fetching.value = true;
  error.value = null;
  try {
    status.value = await loadLarkIntegrationStatus();
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : copy.value.settings.integrations.loadFailed;
    if (propagate) throw cause;
  } finally {
    loading.value = false;
    fetching.value = false;
  }
}

async function install() {
  busy.value = true;
  error.value = null;
  try {
    const result = await installLarkIntegration();
    status.value = result.status;
    notice.value = result.message;
  } catch (cause) {
    error.value =
      cause instanceof LarkIntegrationRequestError && cause.isAdminRequired
        ? copy.value.settings.integrations.adminRequired
        : cause instanceof Error
          ? cause.message
          : copy.value.settings.integrations.installFailed;
  } finally {
    busy.value = false;
  }
}

function scheduleAuthRetry(
  result: LarkAuthStartResponse,
  generation: number,
  attempt: number,
) {
  clearRetry();
  if (!active(generation) || Date.now() >= authDeadline) return;
  retryTimer = setTimeout(
    () => void completeAuth(result, generation, attempt, true),
    1500,
  );
}

async function completeAuth(
  result: LarkAuthStartResponse,
  generation: number,
  attempt: number,
  automatic: boolean,
) {
  try {
    const completed = await completeLarkAuthorization({
      device_code: result.device_code,
      generation: result.generation,
      ...(automatic ? { wait_timeout_seconds: 8 } : {}),
    });
    if (!active(generation) || attempt !== authAttempt) return;
    status.value = completed.status;
    notice.value = completed.status.auth.verified
      ? larkCopy.value.connectedTitle
      : completed.message;
    if (completed.success) {
      clearRetry();
      pendingFlow.value = null;
      browserWindow.value = null;
    } else if (automatic) {
      scheduleAuthRetry(result, generation, attempt);
    }
  } catch (cause) {
    if (!active(generation) || attempt !== authAttempt) return;
    if (
      automatic &&
      cause instanceof LarkIntegrationRequestError &&
      cause.status === 504
    ) {
      notice.value = larkCopy.value.authorizationStillPending;
      scheduleAuthRetry(result, generation, attempt);
      return;
    }
    error.value =
      cause instanceof Error
        ? cause.message
        : copy.value.settings.integrations.authorizationFailed;
  }
}

async function startAuth(
  generation: number,
  target: Window | null,
  serverGeneration?: string,
) {
  busy.value = true;
  try {
    const result = await startLarkAuthorization({
      ...authRequest.value,
      ...(serverGeneration ? { generation: serverGeneration } : {}),
    });
    if (!active(generation)) return;
    pendingFlow.value = { kind: "auth", ...result };
    openUrl(result.verification_url, target);
    notice.value = larkCopy.value.authStarted;
    authAttempt += 1;
    const attempt = authAttempt;
    authDeadline = Date.now() + Math.max(result.expires_in ?? 300, 30) * 1000;
    void completeAuth(result, generation, attempt, true);
  } catch (cause) {
    if (!active(generation)) return;
    closeBrowser(target);
    error.value =
      cause instanceof Error
        ? cause.message
        : copy.value.settings.integrations.connectionFailed;
  } finally {
    if (active(generation)) busy.value = false;
  }
}

async function startRegistration(
  brand: LarkBrand,
  generation: number,
  target: Window | null,
) {
  busy.value = true;
  try {
    const result = await startLarkConfiguration(brand);
    if (!active(generation)) return;
    pendingFlow.value = { kind: "config", ...result };
    openUrl(result.verification_url, target);
    notice.value = larkCopy.value.connectionStarted;
  } catch (cause) {
    if (!active(generation)) return;
    closeBrowser(target);
    error.value =
      cause instanceof Error
        ? cause.message
        : copy.value.settings.integrations.connectionFailed;
  } finally {
    if (active(generation)) busy.value = false;
  }
}

async function connect() {
  if (!status.value) return;
  authRequest.value = buildAuthRequest();
  const target = preopenBrowser();
  const generation = beginFlow();
  checkingConnection.value = true;
  try {
    await load(false, true);
    if (!active(generation) || !status.value) return;
    if (status.value.app_configured) await startAuth(generation, target);
    else await startRegistration("feishu", generation, target);
  } catch {
    if (active(generation)) closeBrowser(target);
  } finally {
    if (active(generation)) checkingConnection.value = false;
  }
}

async function continueConfiguration() {
  const pending = pendingFlow.value;
  if (!pending || pending.kind !== "config") return;
  const generation = clientGeneration;
  busy.value = true;
  try {
    const configured = await completeLarkConfiguration({
      device_code: pending.device_code,
      generation: pending.generation,
      brand: pending.brand,
      interval: pending.interval,
      expires_in: pending.expires_in,
    });
    if (!active(generation)) return;
    status.value = configured.status;
    pendingFlow.value = null;
    notice.value = larkCopy.value.connectionReady;
    await startAuth(generation, browserWindow.value, configured.generation);
  } catch (cause) {
    if (active(generation))
      error.value =
        cause instanceof Error
          ? cause.message
          : copy.value.settings.integrations.connectionFailed;
  } finally {
    if (active(generation)) busy.value = false;
  }
}

async function switchApp() {
  authRequest.value = buildAuthRequest();
  const target = preopenBrowser();
  const generation = beginFlow();
  busy.value = true;
  try {
    const result = await setLarkAppCredentials({
      app_id: changeAppId.value.trim(),
      app_secret: changeAppSecret.value.trim(),
      brand: changeAppBrand.value,
    });
    if (!active(generation)) return;
    status.value = result.status;
    changeAppSecret.value = "";
    showChangeApp.value = false;
    notice.value = larkCopy.value.changeAppSwitched;
    await startAuth(generation, target, result.generation);
  } catch (cause) {
    if (!active(generation)) return;
    closeBrowser(target);
    error.value =
      cause instanceof Error
        ? cause.message
        : copy.value.settings.integrations.appSwitchFailed;
  } finally {
    if (active(generation)) busy.value = false;
  }
}

function reRegister() {
  authRequest.value = buildAuthRequest();
  const target = preopenBrowser();
  const generation = beginFlow();
  void startRegistration(changeAppBrand.value, generation, target);
}

async function copyLink() {
  if (!pendingFlow.value) return;
  notice.value = (await writeTextToClipboard(
    pendingFlow.value.verification_url,
  ))
    ? copy.value.clipboard.copiedToClipboard
    : copy.value.clipboard.failedToCopyToClipboard;
}

function manualComplete() {
  const pending = pendingFlow.value;
  if (!pending || pending.kind !== "auth") return;
  clearRetry();
  authAttempt += 1;
  void completeAuth(pending, clientGeneration, authAttempt, false);
}

onMounted(() => void load(true));
onUnmounted(() => {
  clientGeneration += 1;
  clearRetry();
});
</script>

<template>
  <section class="space-y-4">
    <div class="rounded-xl border">
      <header class="flex items-start justify-between gap-4 border-b p-5">
        <div class="flex items-center gap-3">
          <div class="bg-primary/10 text-primary rounded-lg p-2">
            <span
              class="flex size-5 items-center justify-center"
              aria-hidden="true"
              >⚡</span
            >
          </div>
          <div>
            <h2 class="font-semibold">{{ larkCopy.title }}</h2>
            <p class="text-muted-foreground text-sm">
              {{ larkCopy.description }}
            </p>
          </div>
        </div>
        <button
          type="button"
          class="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
          :disabled="fetching"
          @click="load()"
        >
          <span
            aria-hidden="true"
            class="inline-flex size-4 items-center justify-center"
            :class="fetching ? 'animate-spin' : ''"
            >↻</span
          >
          {{ copy.settings.integrations.refresh }}
        </button>
      </header>
      <div class="space-y-4 p-5">
        <p v-if="loading" class="text-muted-foreground text-sm">
          {{ copy.common.loading }}
        </p>
        <p
          v-if="error"
          role="alert"
          class="flex gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700"
        >
          <span aria-hidden="true">×</span>{{ error }}
        </p>
        <p
          v-if="notice"
          role="status"
          data-sonner-toast
          class="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700"
        >
          {{ notice }}
        </p>

        <template v-if="status">
          <div
            class="grid gap-3"
            :class="showSandboxRuntime ? 'md:grid-cols-4' : 'md:grid-cols-3'"
          >
            <div
              v-for="item in statusCards"
              :key="item.label"
              class="rounded-lg border p-3"
            >
              <div
                class="mb-2 flex items-center justify-between gap-2 text-sm font-medium"
              >
                {{ item.label }}
                <span
                  class="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
                  ><span aria-hidden="true">{{ item.ok ? "✓" : "×" }}</span
                  >{{
                    item.ok
                      ? copy.settings.integrations.ready
                      : copy.settings.integrations.pending
                  }}</span
                >
              </div>
              <p class="text-muted-foreground text-sm break-words">
                {{ item.value }}
              </p>
            </div>
            <div v-if="showSandboxRuntime" class="rounded-lg border p-3">
              <div class="mb-2 text-sm font-medium">
                {{ larkCopy.sandboxRuntime }}
              </div>
              <p class="text-muted-foreground text-sm">
                {{ sandboxRuntimeLabel }}
              </p>
            </div>
          </div>

          <div class="rounded-lg border p-3 text-sm">
            <strong>{{ nextStepTitle }}</strong>
          </div>

          <div
            v-if="status.installed && status.cli.available"
            class="rounded-lg border p-3"
          >
            <div class="text-sm font-medium">
              {{ larkCopy.permissionTitle }}
            </div>
            <p class="text-muted-foreground text-sm">
              {{ larkCopy.permissionDescription }}
            </p>
            <div class="mt-3 flex flex-wrap gap-2">
              <button
                v-for="domain in DOMAINS"
                :key="domain"
                type="button"
                class="rounded-md border px-3 py-1.5 text-sm capitalize"
                :class="
                  selectedDomains.includes(domain)
                    ? 'bg-primary text-primary-foreground'
                    : ''
                "
                :disabled="integrationBusy"
                :aria-pressed="selectedDomains.includes(domain)"
                @click="toggleDomain(domain)"
              >
                {{ domainLabel(domain) }}
              </button>
            </div>
            <input
              v-model="customScope"
              :aria-label="larkCopy.customScopeLabel"
              :placeholder="larkCopy.customScopePlaceholder"
              class="border-input mt-3 w-full rounded-md border px-3 py-2 text-sm"
              :disabled="integrationBusy"
            />
          </div>

          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm"
              :disabled="integrationBusy"
              @click="install"
            >
              {{
                status.installed
                  ? copy.settings.integrations.reinstall
                  : copy.settings.integrations.install
              }}
            </button>
            <button
              type="button"
              class="rounded-md border px-3 py-2 text-sm"
              :disabled="
                !status.installed || !status.cli.available || integrationBusy
              "
              @click="connect"
            >
              {{ connectLabel }}
            </button>
            <button
              v-if="
                status.installed &&
                status.cli.available &&
                status.app_configured
              "
              type="button"
              class="hover:bg-accent rounded-md px-3 py-2 text-sm"
              :disabled="integrationBusy"
              @click="showChangeApp = !showChangeApp"
            >
              {{ larkCopy.changeAppButton }}
            </button>
          </div>

          <div v-if="showChangeApp" class="space-y-3 rounded-lg border p-3">
            <div>
              <div class="text-sm font-medium">
                {{ larkCopy.changeAppTitle }}
              </div>
              <p class="text-muted-foreground text-sm">
                {{ larkCopy.changeAppDescription }}
              </p>
            </div>
            <div class="flex gap-2">
              <button
                v-for="brand in ['feishu', 'lark'] as const"
                :key="brand"
                type="button"
                class="rounded-md border px-3 py-1.5 text-sm capitalize"
                :class="
                  changeAppBrand === brand
                    ? 'bg-primary text-primary-foreground'
                    : ''
                "
                @click="changeAppBrand = brand"
              >
                {{
                  brand === "feishu" ? larkCopy.brandFeishu : larkCopy.brandLark
                }}
              </button>
            </div>
            <input
              v-model="changeAppId"
              :aria-label="larkCopy.changeAppIdLabel"
              :placeholder="larkCopy.changeAppIdLabel"
              class="border-input w-full rounded-md border px-3 py-2"
            />
            <input
              v-model="changeAppSecret"
              type="password"
              :aria-label="larkCopy.changeAppSecretLabel"
              :placeholder="larkCopy.changeAppSecretLabel"
              class="border-input w-full rounded-md border px-3 py-2"
            />
            <p class="text-muted-foreground text-xs">
              {{ larkCopy.changeAppAuthResetNote }}
            </p>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm"
                :disabled="
                  integrationBusy ||
                  !changeAppId.trim() ||
                  !changeAppSecret.trim()
                "
                @click="switchApp"
              >
                {{ busy ? larkCopy.authStarting : larkCopy.changeAppSubmit }}
              </button>
              <button
                type="button"
                class="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                :disabled="integrationBusy"
                @click="reRegister"
              >
                <span aria-hidden="true">↗</span>
                {{ larkCopy.changeAppReRegister }}
              </button>
            </div>
          </div>

          <div
            v-if="pendingFlow"
            class="space-y-3 rounded-lg border p-3 text-sm"
          >
            <div class="flex items-center gap-2 font-medium">
              <span aria-hidden="true">↗</span
              >{{
                pendingFlow.kind === "config"
                  ? larkCopy.openConnectionLinkTitle
                  : larkCopy.openAuthLinkTitle
              }}
            </div>
            <div class="bg-muted rounded-md px-3 py-2 text-xs break-all">
              {{ pendingFlow.verification_url }}
            </div>
            <div class="flex flex-wrap gap-2">
              <a
                :href="pendingFlow.verification_url"
                target="_blank"
                rel="noreferrer"
                class="bg-primary text-primary-foreground flex items-center gap-2 rounded-md px-3 py-2"
                ><span aria-hidden="true">↗</span>
                {{ larkCopy.openAuthLink }}</a
              >
              <button
                type="button"
                class="flex items-center gap-2 rounded-md border px-3 py-2"
                @click="copyLink"
              >
                <span aria-hidden="true">⧉</span> {{ larkCopy.copyAuthLink }}
              </button>
              <button
                v-if="pendingFlow.kind === 'config'"
                type="button"
                class="rounded-md border px-3 py-2"
                :disabled="busy"
                @click="continueConfiguration"
              >
                {{ larkCopy.continueAuth }}
              </button>
              <button
                v-else
                type="button"
                class="bg-primary text-primary-foreground rounded-md px-3 py-2"
                :disabled="busy"
                @click="manualComplete"
              >
                {{ larkCopy.completeAuth }}
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>
