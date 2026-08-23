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
import { getSessionComposerDraftStorage } from "@/core/threads/composer-draft";
import { clearComposerDrafts } from "@/core/threads/composer-draft-lifecycle";

const { $i18n } = useNuxtApp();
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
      cause instanceof Error
        ? cause.message
        : $i18n.t.value.settings.account.loadFailed;
  }
});

async function changePassword() {
  error.value = "";
  message.value = "";
  if (newPassword.value !== confirmPassword.value) {
    error.value = $i18n.t.value.settings.account.passwordMismatch;
    return;
  }
  if (newPassword.value.length < 8) {
    error.value = $i18n.t.value.settings.account.passwordTooShort;
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
          : (body.detail?.message ??
              $i18n.t.value.settings.account.changePasswordFailed),
      );
    }
    currentPassword.value = "";
    newPassword.value = "";
    confirmPassword.value = "";
    message.value = $i18n.t.value.settings.account.passwordChangedSuccess;
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : $i18n.t.value.settings.account.changePasswordFailed;
  } finally {
    busy.value = false;
  }
}

async function logout() {
  const response = await fetchWithAuth("/api/v1/auth/logout", {
    method: "POST",
  });
  if (!response.ok) {
    error.value = $i18n.t.value.settings.account.signOutFailed;
    return;
  }
  clearComposerDrafts(getSessionComposerDraftStorage() as Storage | null);
  await navigateTo("/login");
}
</script>

<template>
  <section class="space-y-8">
    <div>
      <h2 class="text-lg font-semibold">
        {{ $i18n.t.value.settings.account.profileTitle }}
      </h2>
      <dl class="mt-3 grid grid-cols-[max-content_1fr] gap-x-5 gap-y-2 text-sm">
        <dt class="text-muted-foreground">
          {{ $i18n.t.value.settings.account.email }}
        </dt>
        <dd>{{ user?.email ?? "—" }}</dd>
        <dt class="text-muted-foreground">
          {{ $i18n.t.value.settings.account.role }}
        </dt>
        <dd class="capitalize">{{ user?.system_role ?? "—" }}</dd>
        <template v-if="user?.oauth_provider">
          <dt class="text-muted-foreground">
            {{ $i18n.t.value.settings.account.ssoProvider }}
          </dt>
          <dd class="capitalize">{{ user.oauth_provider }}</dd>
        </template>
      </dl>
    </div>
    <form
      v-if="!user?.oauth_provider"
      class="max-w-sm space-y-3"
      @submit.prevent="changePassword"
    >
      <h2 class="text-lg font-semibold">
        {{ $i18n.t.value.settings.account.changePasswordTitle }}
      </h2>
      <input
        v-model="currentPassword"
        type="password"
        required
        :placeholder="$i18n.t.value.settings.account.currentPassword"
        class="border-input w-full rounded-md border px-3 py-2"
      />
      <input
        v-model="newPassword"
        type="password"
        required
        minlength="8"
        :placeholder="$i18n.t.value.settings.account.newPassword"
        class="border-input w-full rounded-md border px-3 py-2"
      />
      <input
        v-model="confirmPassword"
        type="password"
        required
        minlength="8"
        :placeholder="$i18n.t.value.settings.account.confirmNewPassword"
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
        {{
          busy
            ? $i18n.t.value.settings.account.updating
            : $i18n.t.value.settings.account.updatePassword
        }}
      </button>
    </form>
    <p v-else class="text-muted-foreground text-sm">
      {{
        $i18n.t.value.settings.account.ssoPasswordMessage.replace(
          "{provider}",
          user.oauth_provider,
        )
      }}
    </p>
    <button
      type="button"
      class="rounded-md bg-red-600 px-3 py-2 text-white"
      @click="logout"
    >
      {{ $i18n.t.value.settings.account.signOut }}
    </button>
  </section>
</template>
