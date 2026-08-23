<!--
  【文件职责】     提供 Gateway 首次初始化与管理员密码设置页面。
  【对应 frontend/】 src/app/setup/page.tsx
  【架构位置】     L3 application page
  【主要导出】     默认 setup page
  【依赖关系】     Gateway auth setup API
  【边界与注意】   保留 CSRF/auth 安全边界；不属于 L2。
-->

<!-- M7 auth setup surface; mirrors the Gateway's initialize/change-password contracts. -->
<script setup lang="ts">
import { onMounted, ref, watch } from "vue";

import FlickeringGrid from "@/components/ui/effects/FlickeringGrid.vue";
import { fetch as fetchWithAuth } from "@/core/api/fetcher";
import { loadRememberLoginPreference } from "@/core/auth/remember-login";
import {
  fetchSetupStatus,
  isSystemAlreadyInitializedError,
} from "@/core/auth/setup";
import { parseAuthError, userSchema, type User } from "@/core/auth/types";

definePageMeta({ layout: "auth" });
const { $i18n } = useNuxtApp();
type Mode = "loading" | "init_admin" | "change_password" | "unavailable";

const mode = ref<Mode>("loading");
const setupAttempt = ref(0);
const email = ref("");
const currentPassword = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
const rememberMe = ref(true);
const error = ref("");
const loading = ref(false);
let currentUser: User | null = null;

async function loadMode() {
  mode.value = "loading";
  try {
    const me = await fetch("/api/v1/auth/me", { credentials: "include" });
    if (me.ok) {
      const parsed = userSchema.safeParse(await me.json());
      currentUser = parsed.success ? parsed.data : null;
      if (currentUser?.needs_setup) {
        email.value = currentUser.email;
        mode.value = "change_password";
        return;
      }
      await navigateTo("/workspace", { replace: true });
      return;
    }
  } catch {
    // setup-status remains the authoritative unauthenticated recovery path.
  }

  try {
    const status = await fetchSetupStatus();
    if (status.needs_setup) mode.value = "init_admin";
    else await navigateTo("/login", { replace: true });
  } catch {
    mode.value = "unavailable";
  }
}

async function submitInitialize() {
  error.value = "";
  if (newPassword.value !== confirmPassword.value) {
    error.value = $i18n.t.value.setup.passwordMismatch;
    return;
  }
  loading.value = true;
  try {
    const response = await fetch("/api/v1/auth/initialize", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.value,
        password: newPassword.value,
        remember_me: rememberMe.value,
      }),
    });
    if (!response.ok) {
      const data: unknown = await response.json();
      if (isSystemAlreadyInitializedError(data)) {
        await navigateTo("/login", { replace: true });
        return;
      }
      error.value = parseAuthError(data).message;
      return;
    }
    await navigateTo("/workspace");
  } catch {
    error.value = $i18n.t.value.login.networkError;
  } finally {
    loading.value = false;
  }
}

async function submitPasswordChange() {
  error.value = "";
  if (newPassword.value !== confirmPassword.value) {
    error.value = $i18n.t.value.setup.passwordMismatch;
    return;
  }
  if (newPassword.value.length < 8) {
    error.value = $i18n.t.value.setup.passwordTooShort;
    return;
  }
  loading.value = true;
  try {
    const response = await fetchWithAuth("/api/v1/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        current_password: currentPassword.value,
        new_password: newPassword.value,
        new_email: email.value || undefined,
        remember_me: rememberMe.value,
      }),
    });
    if (!response.ok) {
      error.value = parseAuthError(await response.json()).message;
      return;
    }
    await navigateTo("/workspace");
  } catch {
    error.value = $i18n.t.value.login.networkError;
  } finally {
    loading.value = false;
  }
}

watch(setupAttempt, () => void loadMode(), { immediate: true });
onMounted(() => {
  rememberMe.value = loadRememberLoginPreference().rememberMe;
});
</script>

<template>
  <div
    class="relative flex min-h-screen w-full items-center justify-center overflow-hidden p-4"
  >
    <FlickeringGrid
      class="absolute inset-0 z-0 text-black opacity-35 [mask:url('/images/deer.svg')_center/100vw_no-repeat] md:[mask-size:72vh] dark:text-white"
      :square-size="4"
      :grid-gap="4"
      color="currentColor"
      :max-opacity="0.3"
      :flicker-chance="0.25"
    />
    <p v-if="mode === 'loading'" class="text-muted-foreground text-sm">
      {{ $i18n.t.value.common.loading }}
    </p>
    <section
      v-else-if="mode === 'unavailable'"
      class="relative z-10 w-full max-w-md space-y-4 text-center"
    >
      <h1 class="text-xl font-semibold">
        {{ $i18n.t.value.login.serviceUnavailableTitle }}
      </h1>
      <p class="text-muted-foreground text-sm">
        {{ $i18n.t.value.login.serviceUnavailableDescription }}
      </p>
      <div class="flex justify-center gap-3">
        <button
          type="button"
          class="bg-primary text-primary-foreground rounded-md px-4 py-2"
          @click="setupAttempt += 1"
        >
          {{ $i18n.t.value.login.retry }}
        </button>
        <NuxtLink to="/login" class="rounded-md border px-4 py-2">{{
          $i18n.t.value.login.signIn
        }}</NuxtLink>
      </div>
    </section>
    <section
      v-else
      class="bg-background/90 border-border/50 relative z-10 w-full max-w-md space-y-6 rounded-3xl border p-8 shadow-xl backdrop-blur-sm"
    >
      <header class="text-center">
        <h1 class="font-serif text-3xl">DeerFlow</h1>
        <p class="text-muted-foreground mt-2">
          {{
            mode === "init_admin"
              ? $i18n.t.value.setup.createAdminTitle
              : $i18n.t.value.setup.completeAdminTitle
          }}
        </p>
      </header>
      <form
        class="space-y-3"
        @submit.prevent="
          mode === 'init_admin' ? submitInitialize() : submitPasswordChange()
        "
      >
        <label class="block text-sm font-medium" for="setup-email">{{
          $i18n.t.value.login.email
        }}</label>
        <input
          id="setup-email"
          v-model="email"
          type="email"
          autocomplete="email"
          required
          class="border-input w-full rounded-md border px-3 py-2"
          :placeholder="$i18n.t.value.login.emailPlaceholder"
        />
        <template v-if="mode === 'change_password'">
          <label class="block text-sm font-medium" for="current-password">{{
            $i18n.t.value.setup.currentPassword
          }}</label>
          <input
            id="current-password"
            v-model="currentPassword"
            type="password"
            autocomplete="current-password"
            required
            class="border-input w-full rounded-md border px-3 py-2"
          />
        </template>
        <label class="block text-sm font-medium" for="new-password">{{
          $i18n.t.value.setup.password
        }}</label>
        <input
          id="new-password"
          v-model="newPassword"
          type="password"
          autocomplete="new-password"
          required
          minlength="8"
          class="border-input w-full rounded-md border px-3 py-2"
          :placeholder="$i18n.t.value.setup.passwordPlaceholder"
        />
        <label class="block text-sm font-medium" for="confirm-password">{{
          $i18n.t.value.setup.confirmPassword
        }}</label>
        <input
          id="confirm-password"
          v-model="confirmPassword"
          type="password"
          autocomplete="new-password"
          required
          minlength="8"
          class="border-input w-full rounded-md border px-3 py-2"
          :placeholder="$i18n.t.value.setup.confirmPassword"
        />
        <label class="flex items-center gap-2 text-sm"
          ><input v-model="rememberMe" type="checkbox" />
          {{ $i18n.t.value.login.rememberMe }}</label
        >
        <p v-if="error" role="alert" class="text-sm text-red-500">
          {{ error }}
        </p>
        <button
          type="submit"
          class="bg-primary text-primary-foreground w-full rounded-md px-4 py-2"
          :disabled="loading"
        >
          {{
            loading
              ? $i18n.t.value.login.pleaseWait
              : mode === "init_admin"
                ? $i18n.t.value.setup.createAdmin
                : $i18n.t.value.setup.completeSetup
          }}
        </button>
      </form>
    </section>
  </div>
</template>
