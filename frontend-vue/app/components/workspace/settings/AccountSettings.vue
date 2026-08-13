<script setup lang="ts">
/*
  【文件职责】     管理当前用户账号资料与密码。
  【对应 frontend/】 src/components/workspace/settings/account-settings.tsx
  【架构位置】     L3
  【主要导出】     默认 AccountSettings 组件
  【依赖关系】     Gateway auth/account APIs
  【边界与注意】   保留 HttpOnly/CSRF 边界，不进入 L2。
*/
import { onMounted, ref } from "vue";

import { fetch as fetchWithAuth } from "@/core/api/fetcher";
import type { User } from "@/core/auth/types";

const user = ref<User | null>(null);
const currentPassword = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
const busy = ref(false);
const message = ref("");
const error = ref("");

onMounted(async () => {
  try {
    const response = await fetchWithAuth("/api/v1/auth/me");
    if (response.ok) user.value = (await response.json()) as User;
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "Failed to load account";
  }
});

async function changePassword() {
  error.value = "";
  message.value = "";
  if (newPassword.value !== confirmPassword.value) {
    error.value = "New passwords do not match.";
    return;
  }
  if (newPassword.value.length < 8) {
    error.value = "New password must be at least 8 characters.";
    return;
  }
  busy.value = true;
  try {
    const response = await fetchWithAuth("/api/v1/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        current_password: currentPassword.value,
        new_password: newPassword.value,
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        detail?: string | { message?: string };
      };
      throw new Error(
        typeof body.detail === "string"
          ? body.detail
          : (body.detail?.message ?? "Failed to change password"),
      );
    }
    currentPassword.value = "";
    newPassword.value = "";
    confirmPassword.value = "";
    message.value = "Password updated.";
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "Failed to change password";
  } finally {
    busy.value = false;
  }
}

async function logout() {
  await fetchWithAuth("/api/v1/auth/logout", { method: "POST" });
  await navigateTo("/login");
}
</script>

<template>
  <section class="space-y-8">
    <div>
      <h2 class="text-lg font-semibold">Profile</h2>
      <dl class="mt-3 grid grid-cols-[max-content_1fr] gap-x-5 gap-y-2 text-sm">
        <dt class="text-muted-foreground">Email</dt>
        <dd>{{ user?.email ?? "—" }}</dd>
        <dt class="text-muted-foreground">Role</dt>
        <dd class="capitalize">{{ user?.system_role ?? "—" }}</dd>
        <template v-if="user?.oauth_provider">
          <dt class="text-muted-foreground">SSO provider</dt>
          <dd class="capitalize">{{ user.oauth_provider }}</dd>
        </template>
      </dl>
    </div>
    <form
      v-if="!user?.oauth_provider"
      class="max-w-sm space-y-3"
      @submit.prevent="changePassword"
    >
      <h2 class="text-lg font-semibold">Change password</h2>
      <input
        v-model="currentPassword"
        type="password"
        required
        placeholder="Current password"
        class="border-input w-full rounded-md border px-3 py-2"
      />
      <input
        v-model="newPassword"
        type="password"
        required
        minlength="8"
        placeholder="New password"
        class="border-input w-full rounded-md border px-3 py-2"
      />
      <input
        v-model="confirmPassword"
        type="password"
        required
        minlength="8"
        placeholder="Confirm new password"
        class="border-input w-full rounded-md border px-3 py-2"
      />
      <p v-if="error" role="alert" class="text-sm text-red-600">{{ error }}</p>
      <p v-if="message" role="status" class="text-sm text-emerald-700">
        {{ message }}
      </p>
      <button
        type="submit"
        class="rounded-md border px-3 py-2"
        :disabled="busy"
      >
        {{ busy ? "Updating…" : "Update password" }}
      </button>
    </form>
    <p v-else class="text-muted-foreground text-sm">
      Password changes are managed by {{ user.oauth_provider }}.
    </p>
    <button
      type="button"
      class="rounded-md bg-red-600 px-3 py-2 text-white"
      @click="logout"
    >
      Sign out
    </button>
  </section>
</template>
