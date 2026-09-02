<script setup lang="ts">
/*
  【文件职责】     按 session role 读取和更新 admin-only MCP server config。
  【架构位置】     L3 product UI
  【主要导出】     默认 ToolSettings 组件
  【依赖关系】     useSettingsPermissions · useMCPConfig · ui/switch
  【边界与注意】   已知普通用户不发 GET/PATCH；真实 403 单独显示 admin-required，其他错误保留 detail。
*/

import { computed, ref } from "vue";

import SettingsSection from "./SettingsSection.vue";
import { Switch } from "@/components/ui/switch";
import { useMCPConfig } from "@/composables/useMCPConfig";
import { useSettingsPermissions } from "@/composables/useSettingsPermissions";
import { MCPConfigRequestError } from "@/core/mcp/api";

const { $i18n } = useNuxtApp();
const t = computed(() => $i18n.t.value);
const access = useSettingsPermissions();
const mcp = useMCPConfig({ enabled: access.canReadMcp });
const actionError = ref("");
const pendingName = ref<string | null>(null);
const actualAdminRequired = computed(
  () =>
    (mcp.error.value instanceof MCPConfigRequestError &&
      mcp.error.value.isAdminRequired) ||
    (mcp.mutationError.value instanceof MCPConfigRequestError &&
      mcp.mutationError.value.isAdminRequired),
);

function errorMessage(cause: unknown) {
  if (cause instanceof MCPConfigRequestError && cause.isAdminRequired) {
    return t.value.settings.tools.adminRequired;
  }
  return cause instanceof Error && cause.message
    ? cause.message
    : t.value.settings.tools.description;
}

async function toggle(name: string, enabled: boolean) {
  // 受控开关：视觉状态只跟随服务端真相，请求失败时不会停在一个假的 on。
  if (!access.canManageMcp.value || mcp.pending.value) return;
  actionError.value = "";
  pendingName.value = name;
  try {
    await mcp.toggle(name, enabled);
  } catch (cause) {
    actionError.value = errorMessage(cause);
  } finally {
    pendingName.value = null;
  }
}
</script>

<template>
  <SettingsSection
    data-testid="tool-settings"
    :title="t.settings.tools.title"
    :description="t.settings.tools.description"
  >
    <div class="space-y-4">
      <p
        v-if="access.permissions.value.state === 'loading'"
        class="text-muted-foreground text-sm"
      >
        {{ t.common.loading }}
      </p>
      <p
        v-else-if="access.permissions.value.state === 'unavailable'"
        role="alert"
        class="rounded-md bg-red-50 p-3 text-sm text-red-700"
        data-testid="settings-session-unavailable"
      >
        {{ t.settings.sessionUnavailable }}
      </p>
      <p
        v-else-if="
          access.permissions.value.adminRequired || actualAdminRequired
        "
        class="rounded-md bg-amber-50 p-3 text-sm text-amber-800"
        data-testid="mcp-admin-required"
      >
        {{ t.settings.tools.adminRequired }}
      </p>
      <template v-else>
        <p v-if="mcp.loading.value" class="text-muted-foreground text-sm">
          {{ t.common.loading }}
        </p>
        <p
          v-else-if="mcp.error.value"
          role="alert"
          class="rounded-md bg-red-50 p-3 text-sm text-red-700"
        >
          {{ errorMessage(mcp.error.value) }}
        </p>
        <p
          v-if="actionError"
          role="alert"
          class="rounded-md bg-red-50 p-3 text-sm text-red-700"
          data-testid="mcp-action-error"
        >
          {{ actionError }}
        </p>
        <!--
          空态是一段裸文本，不是一张带边框的卡片（上游 tool-settings-page.tsx:53
          是 `<div className="text-muted-foreground text-sm">`）。`<p>` 在可访问性
          树里会多出一个 paragraph 节点，而上游那一句直接挂在 main 的文本里。
        -->
        <div
          v-if="
            !mcp.loading.value &&
            !mcp.error.value &&
            Object.keys(mcp.config.value?.mcp_servers ?? {}).length === 0
          "
          class="text-muted-foreground text-sm"
        >
          {{ t.settings.tools.empty }}
        </div>
        <div
          v-for="(server, name) in mcp.config.value?.mcp_servers ?? {}"
          :key="name"
          class="border-border flex items-center justify-between border-b py-3"
          :data-testid="`mcp-${String(name)}`"
        >
          <div>
            <div class="font-medium">{{ name }}</div>
            <div class="text-muted-foreground text-xs">
              {{ server.description }}
            </div>
          </div>
          <Switch
            :aria-label="String(name)"
            :model-value="server.enabled"
            :disabled="!access.canManageMcp.value || mcp.pending.value"
            :data-pending="pendingName === name || undefined"
            @update:model-value="toggle(String(name), $event)"
          />
        </div>
      </template>
    </div>
  </SettingsSection>
</template>
