<!--
  【文件职责】     完整本地登录/注册、SSO 入口与 setup-status fail-closed 恢复。
  【对应 frontend/】 frontend/src/app/(auth)/login/page.tsx
  【架构位置】     L3 auth surface
  【主要导出】     默认 login page
  【依赖关系】     Gateway auth/setup APIs · auth layout
  【边界与注意】   回跳必须经过 resolveAuthNextPath；未知 setup 状态不得开放注册。
-->

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";

import FlickeringGrid from "@/components/ui/effects/FlickeringGrid.vue";
import { resolveAuthNextPath } from "@/core/auth/next-path";
import {
  loadRememberLoginPreference,
  saveRememberLoginPreference,
} from "@/core/auth/remember-login";
import {
  canCreateRegularAccount,
  fetchSetupStatus,
  type SetupStatusResponse,
} from "@/core/auth/setup";
import { parseAuthError } from "@/core/auth/types";

definePageMeta({ layout: "auth" });

type Provider = { id: string; display_name: string; type: string };

const route = useRoute();
const email = ref("");
const password = ref("");
const rememberMe = ref(true);
const isLogin = ref(true);
const providers = ref<Provider[]>([]);
const setupStatus = ref<SetupStatusResponse | null>(null);
const setupPhase = ref<"checking" | "ready" | "unavailable">("checking");
const setupAttempt = ref(0);
const error = ref(
  typeof route.query.error === "string" ? "Authentication failed." : "",
);
const showSsoHint = ref(false);
const loading = ref(false);

const redirectPath = computed(() =>
  resolveAuthNextPath(
    typeof route.query.next === "string"
      ? route.query.next
      : typeof route.query.redirect === "string"
        ? route.query.redirect
        : null,
  ),
);
const signupAllowed = computed(() =>
  canCreateRegularAccount({
    checked: setupPhase.value === "ready",
    status: setupStatus.value,
  }),
);
const setupUnavailable = computed(
  () =>
    setupPhase.value === "unavailable" ||
    (setupAttempt.value > 0 && setupPhase.value === "checking"),
);

async function checkSetupStatus() {
  setupPhase.value = "checking";
  try {
    setupStatus.value = await fetchSetupStatus();
    setupPhase.value = "ready";
    if (setupStatus.value.needs_setup) isLogin.value = true;
  } catch {
    setupStatus.value = null;
    setupPhase.value = "unavailable";
  }
}

async function submit() {
  error.value = "";
  showSsoHint.value = false;
  if (!isLogin.value && !signupAllowed.value) {
    error.value =
      "DeerFlow needs an administrator account before new regular accounts can be created.";
    return;
  }

  loading.value = true;
  try {
    const endpoint = isLogin.value
      ? "/api/v1/auth/login/local"
      : "/api/v1/auth/register";
    const response = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": isLogin.value
          ? "application/x-www-form-urlencoded"
          : "application/json",
      },
      body: isLogin.value
        ? new URLSearchParams({
            username: email.value,
            password: password.value,
            remember_me: String(rememberMe.value),
          })
        : JSON.stringify({
            email: email.value,
            password: password.value,
            remember_me: rememberMe.value,
          }),
    });
    if (!response.ok) {
      error.value = parseAuthError(await response.json()).message;
      showSsoHint.value = isLogin.value && providers.value.length > 0;
      return;
    }
    saveRememberLoginPreference({
      email: email.value,
      rememberMe: rememberMe.value,
    });
    await navigateTo(redirectPath.value);
  } catch {
    error.value = "Network error. Please try again.";
  } finally {
    loading.value = false;
  }
}

function startSso(provider: Provider) {
  window.location.assign(
    `/api/v1/auth/oauth/${encodeURIComponent(provider.id)}?next=${encodeURIComponent(redirectPath.value)}&remember_me=${String(rememberMe.value)}`,
  );
}

watch(setupAttempt, () => void checkSetupStatus(), { immediate: true });
onMounted(() => {
  const preference = loadRememberLoginPreference();
  email.value = preference.email;
  rememberMe.value = preference.rememberMe;
  void fetch("/api/v1/auth/providers", { credentials: "include" })
    .then((response) => (response.ok ? response.json() : { providers: [] }))
    .then((data: { providers?: Provider[] }) => {
      providers.value = data.providers ?? [];
    })
    .catch(() => undefined);
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
    <section
      class="bg-background/85 border-border/50 relative z-10 w-full max-w-md space-y-6 rounded-3xl border p-8 shadow-xl backdrop-blur-sm"
    >
      <header class="text-center">
        <h1 class="font-serif text-3xl">DeerFlow</h1>
        <p class="text-muted-foreground mt-2">
          {{ isLogin ? "Sign in to your account" : "Create a new account" }}
        </p>
      </header>

      <div
        v-if="setupUnavailable"
        role="status"
        aria-live="polite"
        class="border-l-2 border-amber-500 ps-3 text-sm"
      >
        <p class="font-medium">Service temporarily unavailable</p>
        <p class="text-muted-foreground mt-1">
          The Gateway is taking too long to respond. Check that it is running,
          then try again.
        </p>
        <button
          type="button"
          class="mt-3 rounded-md border px-3 py-1.5"
          :disabled="setupPhase === 'checking'"
          @click="setupAttempt += 1"
        >
          {{ setupPhase === "checking" ? "Please wait..." : "Try again" }}
        </button>
      </div>

      <div
        v-if="setupStatus?.needs_setup"
        class="border-l-2 border-blue-500 ps-3 text-sm"
      >
        <p class="font-medium">Administrator setup is required</p>
        <p class="text-muted-foreground mt-1">
          DeerFlow needs an administrator account before new regular accounts
          can be created.
        </p>
        <NuxtLink
          to="/setup"
          class="mt-2 inline-block font-medium text-blue-500 hover:underline"
          >Create admin account</NuxtLink
        >
      </div>

      <form class="space-y-3" @submit.prevent="submit">
        <label class="block text-sm font-medium" for="email">Email</label>
        <input
          id="email"
          v-model="email"
          type="email"
          autocomplete="email"
          required
          class="border-input bg-background w-full rounded-md border px-3 py-2"
          placeholder="you@example.com"
        />
        <label class="block text-sm font-medium" for="password">Password</label>
        <input
          id="password"
          v-model="password"
          type="password"
          :autocomplete="isLogin ? 'current-password' : 'new-password'"
          required
          :minlength="isLogin ? 6 : 8"
          class="border-input bg-background w-full rounded-md border px-3 py-2"
          placeholder="•••••••"
        />
        <label class="flex items-start gap-2 text-sm">
          <input v-model="rememberMe" type="checkbox" class="mt-1" />
          <span
            ><span class="font-medium">Keep me signed in</span
            ><span class="text-muted-foreground block text-xs"
              >DeerFlow stores only your email, never your password.</span
            ></span
          >
        </label>
        <p v-if="error" role="alert" class="text-sm text-red-500">
          {{ error }}
        </p>
        <button
          type="submit"
          class="bg-primary text-primary-foreground w-full rounded-md px-4 py-2"
          :disabled="loading"
        >
          {{
            loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"
          }}
        </button>
      </form>

      <div v-if="providers.length" class="space-y-2">
        <p v-if="showSsoHint" class="text-muted-foreground text-center text-sm">
          If your account uses single sign-on, use the option below instead.
        </p>
        <button
          v-for="provider in providers"
          :key="provider.id"
          type="button"
          class="w-full rounded-md border px-4 py-2"
          :disabled="loading"
          @click="startSso(provider)"
        >
          Continue with {{ provider.display_name }}
        </button>
      </div>
      <button
        v-if="signupAllowed"
        type="button"
        class="w-full text-sm text-blue-500 hover:underline"
        @click="
          isLogin = !isLogin;
          error = '';
          showSsoHint = false;
        "
      >
        {{
          isLogin
            ? "Don't have an account? Sign up"
            : "Already have an account? Sign in"
        }}
      </button>
      <NuxtLink
        to="/"
        class="text-muted-foreground block text-center text-xs hover:underline"
        >← Back to home</NuxtLink
      >
    </section>
  </div>
</template>

<style scoped>
.auth-grid {
  background-image: radial-gradient(
    circle,
    color-mix(in srgb, currentColor 35%, transparent) 1px,
    transparent 1px
  );
  background-size: 8px 8px;
  mask-image: radial-gradient(circle at center, black, transparent 70%);
}
</style>
