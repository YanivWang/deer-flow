<script setup lang="ts">
import {
  fetchSetupStatus,
  listAuthProviders,
  loginLocal,
  resolveAuthNextPath,
  type AuthProviderSummary,
  type SetupStatusResponse,
} from "../core/auth/client";

const route = useRoute();
const router = useRouter();
const email = ref("");
const password = ref("");
const rememberMe = ref(true);
const errorMessage = ref("");
const isSubmitting = ref(false);
const setupStatus = ref<SetupStatusResponse | null>(null);
const setupStatusPhase = ref<"checking" | "ready" | "unavailable">("checking");
const providers = ref<AuthProviderSummary[]>([]);
const redirectPath = computed(() => resolveAuthNextPath(route.query.next?.toString()));
const systemNeedsAdminSetup = computed(() => setupStatus.value?.needs_setup === true);
const loginErrorId = "vue-login-error-message";

async function loadSetupStatus() {
  setupStatusPhase.value = "checking";
  try {
    setupStatus.value = await fetchSetupStatus();
    setupStatusPhase.value = "ready";
  } catch {
    setupStatusPhase.value = "unavailable";
  }
}

onMounted(async () => {
  await loadSetupStatus();

  providers.value = await listAuthProviders();
});

async function submitLogin() {
  errorMessage.value = "";
  isSubmitting.value = true;
  try {
    await loginLocal({
      email: email.value,
      password: password.value,
      rememberMe: rememberMe.value,
    });
    await router.push(redirectPath.value);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "认证失败。";
  } finally {
    isSubmitting.value = false;
  }
}

function startSso(provider: AuthProviderSummary) {
  window.location.href = `/api/v1/auth/oauth/${provider.id}?next=${encodeURIComponent(
    redirectPath.value,
  )}&remember_me=${String(rememberMe.value)}`;
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-panel">
      <h1>DeerFlow</h1>
      <p>登录后继续。</p>

      <a-alert
        v-if="setupStatusPhase === 'unavailable'"
        data-testid="vue-login-setup-unavailable"
        role="status"
        type="warning"
        show-icon
        message="无法获取 Gateway 初始化状态。已有用户仍可尝试登录。"
      >
        <template #description>
          <button type="button" data-testid="vue-login-setup-retry" @click="loadSetupStatus">重试</button>
        </template>
      </a-alert>
      <a-alert
        v-if="systemNeedsAdminSetup"
        data-testid="vue-login-needs-setup"
        role="status"
        type="info"
        show-icon
        message="需要先创建管理员账号，之后才能正常登录。"
      />

      <form
        class="auth-form"
        data-testid="vue-login-form"
        @submit.prevent="submitLogin"
      >
        <label>
          <span>邮箱</span>
          <input v-model="email" type="email" autocomplete="username" required data-testid="vue-login-email">
        </label>
        <label>
          <span>密码</span>
          <input
            v-model="password"
            type="password"
            autocomplete="current-password"
            required
            minlength="6"
            data-testid="vue-login-password"
          >
        </label>
        <label class="auth-form__check">
          <input v-model="rememberMe" type="checkbox" data-testid="vue-login-remember">
          <span>记住本次会话</span>
        </label>
        <a-alert
          v-if="errorMessage"
          :id="loginErrorId"
          data-testid="vue-login-error"
          role="alert"
          type="error"
          show-icon
          :message="errorMessage"
        />
        <a-button
          html-type="submit"
          type="primary"
          :loading="isSubmitting"
          data-testid="vue-login-submit"
        >
          登录
        </a-button>
      </form>

      <div v-if="providers.length > 0" class="auth-sso" data-testid="vue-login-sso">
        <a-button
          v-for="provider in providers"
          :key="provider.id"
          type="default"
          :disabled="isSubmitting"
          :data-testid="`vue-login-sso-${provider.id}`"
          @click="startSso(provider)"
        >
          使用 {{ provider.display_name }} 继续
        </a-button>
      </div>

      <NuxtLink v-if="systemNeedsAdminSetup" to="/setup" data-testid="vue-login-setup-link">
        创建管理员账号
      </NuxtLink>
    </section>
  </main>
</template>
