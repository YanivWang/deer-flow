<script setup lang="ts">
import { fetchSetupStatus, initializeAdmin } from "../core/auth/client";

const router = useRouter();
const email = ref("");
const password = ref("");
const confirmPassword = ref("");
const rememberMe = ref(true);
const mode = ref<"loading" | "init_admin" | "unavailable">("loading");
const errorMessage = ref("");
const isSubmitting = ref(false);
const setupErrorId = "vue-setup-error-message";

onMounted(async () => {
  try {
    const status = await fetchSetupStatus();
    if (status.needs_setup) {
      mode.value = "init_admin";
    } else {
      await router.replace("/login");
    }
  } catch {
    mode.value = "unavailable";
  }
});

async function submitSetup() {
  errorMessage.value = "";
  if (password.value !== confirmPassword.value) {
    errorMessage.value = "两次输入的密码不一致。";
    return;
  }
  isSubmitting.value = true;
  try {
    await initializeAdmin({
      email: email.value,
      password: password.value,
      rememberMe: rememberMe.value,
    });
    await router.push("/workspace");
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "初始化失败。";
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-panel">
      <template v-if="mode === 'loading'">
        <h1>初始化</h1>
        <p data-testid="vue-setup-loading" role="status">正在检查初始化状态...</p>
      </template>

      <template v-else-if="mode === 'unavailable'">
        <h1>初始化不可用</h1>
        <p role="alert">无法获取 Gateway 初始化状态。</p>
        <a-button data-testid="vue-setup-login-link" @click="router.replace('/login')">
          登录
        </a-button>
      </template>

      <template v-else>
        <h1>DeerFlow</h1>
        <p>创建第一个管理员账号。</p>
        <form
          class="auth-form"
          data-testid="vue-setup-form"
          :aria-describedby="errorMessage ? setupErrorId : undefined"
          @submit.prevent="submitSetup"
        >
          <label>
            <span>邮箱</span>
            <input v-model="email" type="email" required data-testid="vue-setup-email">
          </label>
          <label>
            <span>密码</span>
            <input
              v-model="password"
              type="password"
              required
              minlength="8"
              data-testid="vue-setup-password"
              :aria-describedby="errorMessage ? setupErrorId : undefined"
              :aria-invalid="Boolean(errorMessage)"
            >
          </label>
          <label>
            <span>确认密码</span>
            <input
              v-model="confirmPassword"
              type="password"
              required
              minlength="8"
              data-testid="vue-setup-confirm-password"
              :aria-describedby="errorMessage ? setupErrorId : undefined"
              :aria-invalid="Boolean(errorMessage)"
            >
          </label>
          <label class="auth-form__check">
            <input v-model="rememberMe" type="checkbox" data-testid="vue-setup-remember">
            <span>记住本次会话</span>
          </label>
          <a-alert
            v-if="errorMessage"
            :id="setupErrorId"
            data-testid="vue-setup-error"
            role="alert"
            type="error"
            show-icon
            :message="errorMessage"
          />
          <a-button
            html-type="submit"
            type="primary"
            :loading="isSubmitting"
            data-testid="vue-setup-submit"
          >
            创建管理员账号
          </a-button>
        </form>
      </template>
    </section>
  </main>
</template>
