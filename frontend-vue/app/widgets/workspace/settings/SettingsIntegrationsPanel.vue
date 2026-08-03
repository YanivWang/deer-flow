<script setup lang="ts">
import type { SettingsIntegrationsController } from "../../../features/settings/integrations/use-settings-integrations";
import { displayLarkAuthStatus } from "../../../features/settings/integrations/use-settings-integrations";
import AppDialog from "../../../shared/ui/AppDialog.vue";

const props = defineProps<{
  integrations: SettingsIntegrationsController;
  configDialogOpen: boolean;
  authDialogOpen: boolean;
}>();

const emit = defineEmits<{
  "close-dialog": [];
  "open-auth-dialog": [];
  "open-config-dialog": [];
}>();

function eventTargetValue(event: Event): string {
  return event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement
    ? event.target.value
    : "";
}

function eventTargetChecked(event: Event): boolean {
  return event.target instanceof HTMLInputElement ? event.target.checked : false;
}

async function startConfig() {
  await props.integrations.startConfigWizard();
  emit("open-config-dialog");
}

async function startAuth() {
  await props.integrations.startAuthWizard();
  emit("open-auth-dialog");
}

function openCalendarAuth() {
  props.integrations.openCalendarAuth();
  emit("open-auth-dialog");
}
</script>

<template>
  <h2>集成</h2>
  <p data-testid="vue-settings-integrations-anchor">
    Lark/Feishu 集成使用 Gateway `/api/integrations/lark/*` 契约。
  </p>
  <p v-if="props.integrations.query.isLoading.value" data-testid="vue-settings-integrations-loading">
    正在加载 Lark 集成...
  </p>
  <p
    v-else-if="props.integrations.adminRequired.value"
    class="workspace-notice"
    data-testid="vue-settings-integrations-admin-required"
  >
    查看此集成需要管理员权限。
  </p>
  <p
    v-else-if="props.integrations.errorMessage.value"
    class="workspace-error"
    data-testid="vue-settings-integrations-error"
  >
    {{ props.integrations.errorMessage.value }}
  </p>
  <article
    v-else-if="props.integrations.status.value"
    class="settings-integration"
    data-testid="vue-settings-integrations-lark"
  >
    <div class="settings-integration__header">
      <div>
        <h3>Lark / Feishu CLI</h3>
        <p>{{ props.integrations.status.value.installed ? "Skill pack installed" : "Install the official skill pack first" }}</p>
      </div>
      <div class="settings-integration__actions">
        <button
          class="workspace-button"
          data-testid="vue-settings-integrations-lark-config-open"
          type="button"
          @click="emit('open-config-dialog')"
        >
          配置应用
        </button>
        <button
          class="workspace-button"
          data-testid="vue-settings-integrations-lark-auth-open"
          type="button"
          @click="emit('open-auth-dialog')"
        >
          授权用户
        </button>
        <button class="workspace-button" type="button" @click="openCalendarAuth">Calendar</button>
        <button
          class="workspace-button workspace-button--primary"
          data-testid="vue-settings-integrations-lark-install"
          :disabled="props.integrations.isMutationPending.value"
          type="button"
          @click="props.integrations.installSkillPack"
        >
          {{ props.integrations.status.value.installed ? "Reinstall" : "Install" }}
        </button>
      </div>
    </div>
    <dl class="settings-integration__details">
      <dt>技能</dt>
      <dd>{{ props.integrations.status.value.skills_installed }} / {{ props.integrations.status.value.skills_expected }}</dd>
      <dt>CLI</dt>
      <dd>{{ props.integrations.status.value.cli.available ? (props.integrations.status.value.cli.version || "可用") : (props.integrations.status.value.cli.error || "不可用") }}</dd>
      <dt>应用</dt>
      <dd>{{ props.integrations.status.value.app_configured ? (props.integrations.status.value.app_brand || "已配置") : "未配置" }}</dd>
      <dt>认证</dt>
      <dd>{{ displayLarkAuthStatus(props.integrations.status.value.auth) }}</dd>
      <dt>Sandbox runtime</dt>
      <dd>{{ props.integrations.status.value.sandbox_runtime_ready ? "Provisioned by init container" : (props.integrations.status.value.sandbox_runtime_detail || "Not ready") }}</dd>
    </dl>
    <AppDialog :open="props.configDialogOpen" title="Lark 应用配置" @close="emit('close-dialog')">
      <section class="settings-lark-wizard" data-testid="vue-settings-integrations-lark-config-dialog">
      <form
        class="settings-lark-wizard__form"
        data-testid="vue-settings-integrations-lark-config-start-form"
        @submit.prevent="startConfig"
      >
        <label class="workspace-field">
          <span>品牌</span>
          <select
            data-testid="vue-settings-integrations-lark-config-brand"
            :value="props.integrations.configBrand.value"
            @change="props.integrations.setConfigBrand(eventTargetValue($event))"
          >
            <option value="feishu">Feishu</option>
            <option value="lark">Lark</option>
          </select>
        </label>
        <button
          class="workspace-button"
          data-testid="vue-settings-integrations-lark-config-start"
          :disabled="props.integrations.isMutationPending.value"
          type="submit"
        >
          开始配置
        </button>
      </form>
      <dl
        v-if="props.integrations.configStartResult.value"
        class="settings-lark-wizard__result"
        data-testid="vue-settings-integrations-lark-config-result"
      >
        <dt>验证 URL</dt>
        <dd><a :href="props.integrations.configStartResult.value.verification_url" rel="noreferrer" target="_blank">{{ props.integrations.configStartResult.value.verification_url }}</a></dd>
        <dt>用户码</dt><dd>{{ props.integrations.configStartResult.value.user_code || "-" }}</dd>
        <dt>设备码</dt><dd>{{ props.integrations.configStartResult.value.device_code }}</dd>
        <dt>间隔</dt><dd>{{ props.integrations.configStartResult.value.interval ?? "-" }}</dd>
      </dl>
      <form
        class="settings-lark-wizard__form"
        data-testid="vue-settings-integrations-lark-config-complete-form"
        @submit.prevent="props.integrations.completeConfigWizard"
      >
        <label class="workspace-field">
          <span>设备码</span>
          <input
            data-testid="vue-settings-integrations-lark-config-device-code"
            :value="props.integrations.configDeviceCode.value"
            @input="props.integrations.setConfigDeviceCode(eventTargetValue($event))"
          >
        </label>
        <button
          class="workspace-button workspace-button--primary"
          data-testid="vue-settings-integrations-lark-config-complete"
          :disabled="props.integrations.isMutationPending.value"
          type="submit"
        >
          完成配置
        </button>
      </form>
      </section>
    </AppDialog>
    <AppDialog :open="props.authDialogOpen" title="Lark 用户授权" @close="emit('close-dialog')">
      <section class="settings-lark-wizard" data-testid="vue-settings-integrations-lark-auth-dialog">
      <form
        class="settings-lark-wizard__form"
        data-testid="vue-settings-integrations-lark-auth-start-form"
        @submit.prevent="startAuth"
      >
        <p v-if="props.integrations.calendarConfigPending.value && props.integrations.configStartResult.value" class="workspace-notice">
          <a :href="props.integrations.configStartResult.value.verification_url" target="_blank" rel="noreferrer">{{ props.integrations.configStartResult.value.verification_url }}</a>
        </p>
        <label class="workspace-field">
          <span>域</span>
          <input
            data-testid="vue-settings-integrations-lark-auth-domains"
            placeholder="docs,sheets"
            :value="props.integrations.authDomains.value"
            @input="props.integrations.setAuthDomains(eventTargetValue($event))"
          >
        </label>
        <label class="workspace-field">
          <span>授权范围</span>
          <input
            data-testid="vue-settings-integrations-lark-auth-scope"
            placeholder="可选 OAuth scope 覆盖"
            :value="props.integrations.authScope.value"
            @input="props.integrations.setAuthScope(eventTargetValue($event))"
          >
        </label>
        <label class="settings-inline-check">
          <input
            data-testid="vue-settings-integrations-lark-auth-recommend"
            type="checkbox"
            :checked="props.integrations.authRecommend.value"
            @change="props.integrations.setAuthRecommend(eventTargetChecked($event))"
          >
          <span>使用推荐 scope</span>
        </label>
        <button
          class="workspace-button"
          data-testid="vue-settings-integrations-lark-auth-start"
          :disabled="props.integrations.isMutationPending.value"
          type="submit"
        >
          {{ props.integrations.authStartResult.value ? "Reconnect Lark" : "Connect Lark" }}
        </button>
      </form>
      <dl
        v-if="props.integrations.authStartResult.value"
        class="settings-lark-wizard__result"
        data-testid="vue-settings-integrations-lark-auth-result"
      >
        <dt>验证 URL</dt>
        <dd><a :href="props.integrations.authStartResult.value.verification_url" target="_blank" rel="noreferrer">{{ props.integrations.authStartResult.value.verification_url }}</a></dd>
        <dt>用户码</dt><dd>{{ props.integrations.authStartResult.value.user_code || "-" }}</dd>
        <dt>设备码</dt><dd>{{ props.integrations.authStartResult.value.device_code }}</dd>
        <dt>提示</dt><dd>{{ props.integrations.authStartResult.value.hint || "-" }}</dd>
      </dl>
      <form
        class="settings-lark-wizard__form"
        data-testid="vue-settings-integrations-lark-auth-complete-form"
        @submit.prevent="props.integrations.continueOrCompleteAuth"
      >
        <label class="workspace-field">
          <span>设备码</span>
          <input
            data-testid="vue-settings-integrations-lark-auth-device-code"
            :value="props.integrations.authDeviceCode.value"
            @input="props.integrations.setAuthDeviceCode(eventTargetValue($event))"
          >
        </label>
        <label class="workspace-field">
          <span>等待超时秒数</span>
          <input
            data-testid="vue-settings-integrations-lark-auth-timeout"
            min="0"
            type="number"
            :value="props.integrations.authWaitTimeout.value"
            @input="props.integrations.setAuthWaitTimeout(eventTargetValue($event))"
          >
        </label>
        <button
          class="workspace-button workspace-button--primary"
          data-testid="vue-settings-integrations-lark-auth-complete"
          :disabled="props.integrations.isMutationPending.value"
          type="submit"
        >
          I completed browser confirmation, continue
        </button>
      </form>
      </section>
    </AppDialog>
    <p
      v-if="props.integrations.installAdminRequired.value"
      class="workspace-notice"
      data-testid="vue-settings-integrations-lark-install-admin"
    >
      安装集成需要管理员权限。
    </p>
    <p
      v-if="props.integrations.formError.value"
      class="workspace-error"
      data-testid="vue-settings-integrations-lark-form-error"
    >
      {{ props.integrations.formError.value }}
    </p>
    <p
      v-if="props.integrations.mutationErrorMessage.value"
      class="workspace-error"
      data-testid="vue-settings-integrations-lark-mutation-error"
    >
      {{ props.integrations.mutationErrorMessage.value }}
    </p>
    <p
      v-if="props.integrations.actionMessage.value"
      class="settings-success"
      data-testid="vue-settings-integrations-lark-action-message"
    >
      {{ props.integrations.actionMessage.value }}
    </p>
  </article>
</template>
