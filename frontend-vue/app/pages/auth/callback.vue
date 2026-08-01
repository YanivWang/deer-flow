<script setup lang="ts">
import { resolveAuthNextPath, verifyAuthenticatedSession } from "../../core/auth/client";

const route = useRoute();
const router = useRouter();
const status = ref<"loading" | "success" | "error">("loading");
const nextPath = computed(() => resolveAuthNextPath(route.query.next?.toString()));

onMounted(async () => {
  if (await verifyAuthenticatedSession()) {
    status.value = "success";
    setTimeout(() => {
      void router.replace(nextPath.value);
    }, 300);
    return;
  }
  status.value = "error";
  setTimeout(() => {
    void router.replace("/login?error=sso_failed");
  }, 1500);
});
</script>

<template>
  <main class="auth-page">
    <section class="auth-panel" data-testid="vue-auth-callback">
      <h1>正在完成登录</h1>
      <p v-if="status === 'loading'" role="status">正在登录...</p>
      <p v-else-if="status === 'success'" data-testid="vue-auth-callback-success" role="status">正在跳转...</p>
      <p v-else data-testid="vue-auth-callback-error" role="alert">
        认证失败，正在跳转到登录页...
      </p>
    </section>
  </main>
</template>
