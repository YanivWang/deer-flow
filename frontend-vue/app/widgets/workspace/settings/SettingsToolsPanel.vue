<script setup lang="ts">
import type { SettingsToolsController } from "../../../features/settings/tools/use-settings-tools";
import AppDialog from "../../../shared/ui/AppDialog.vue";

const props = defineProps<{
  configEditorOpen: boolean;
  tools: SettingsToolsController;
}>();

const emit = defineEmits<{
  "close-config": [];
  "open-config": [];
}>();

function eventTargetValue(event: Event): string {
  return event.target instanceof HTMLTextAreaElement ? event.target.value : "";
}

function eventTargetChecked(event: Event): boolean {
  return event.target instanceof HTMLInputElement ? event.target.checked : false;
}

function updateConfigText(event: Event) {
  props.tools.setMcpConfigText(eventTargetValue(event));
}
</script>

<template>
  <h2>工具</h2>
  <p data-testid="vue-settings-tools-anchor">
    MCP 工具管理会使用现有 Gateway `/api/mcp/config` 契约。
  </p>
  <p v-if="props.tools.query.isLoading.value" data-testid="vue-settings-tools-loading">
    正在加载 MCP 服务器...
  </p>
  <p
    v-else-if="props.tools.adminRequired.value"
    class="workspace-notice"
    data-testid="vue-settings-tools-admin-required"
  >
    管理 MCP 工具需要管理员权限。
  </p>
  <p
    v-else-if="props.tools.errorMessage.value"
    class="workspace-error"
    data-testid="vue-settings-tools-error"
  >
    {{ props.tools.errorMessage.value }}
  </p>
  <template v-else>
    <div class="settings-tools-actions">
      <button
        class="workspace-button"
        data-testid="vue-settings-tools-reset-cache"
        :disabled="props.tools.isMutationPending.value"
        type="button"
        @click="props.tools.resetMcpToolsCache"
      >
        重置缓存
      </button>
      <button
        class="workspace-button"
        data-testid="vue-settings-tools-open-config"
        type="button"
        @click="emit('open-config')"
      >
        编辑配置 JSON
      </button>
    </div>
    <dl class="settings-tool-runtime" data-testid="vue-settings-tools-runtime-summary">
      <dt>运行时发现</dt>
      <dd>
        已启用 {{ props.tools.mcpRuntimeSummary.value.enabledCount }} /
        {{ props.tools.mcpRuntimeSummary.value.serverCount }} 个服务器
      </dd>
      <dt>传输类型</dt>
      <dd>{{ props.tools.mcpRuntimeSummary.value.transportTypes.join(", ") || "-" }}</dd>
      <dt>已配置工具提示</dt>
      <dd>{{ props.tools.mcpRuntimeSummary.value.discoverableToolCount }}</dd>
    </dl>
    <p class="workspace-notice" data-testid="vue-settings-tools-runtime-note">
      Gateway 会在运行时以及重置缓存后发现已启用的 MCP 工具 schema；本页展示已配置服务器和工具覆盖项，不代表 live 工具 schema 验收。
    </p>
    <a-empty
      v-if="props.tools.serverEntries.value.length === 0"
      description="暂无 MCP 工具配置"
      data-testid="vue-settings-tools-empty"
    />
    <ul v-else class="settings-tools-list" data-testid="vue-settings-tools-list">
      <li
        v-for="entry in props.tools.serverEntries.value"
        :key="entry.name"
        class="settings-tool-server"
      >
        <div class="settings-tool-server__body">
          <strong>{{ entry.name }}</strong>
          <p>{{ entry.config.description || "暂无描述。" }}</p>
          <small>
            {{ entry.config.type || "stdio" }}
            <template v-if="entry.config.command"> · {{ entry.config.command }}</template>
            <template v-else-if="entry.config.url"> · {{ entry.config.url }}</template>
          </small>
          <dl class="settings-tool-server__details">
            <dt>参数</dt>
            <dd>{{ entry.config.args?.join(" ") || "-" }}</dd>
            <dt>环境变量键</dt>
            <dd>{{ Object.keys(entry.config.env ?? {}).join(", ") || "-" }}</dd>
            <dt>Header 键</dt>
            <dd>{{ Object.keys(entry.config.headers ?? {}).join(", ") || "-" }}</dd>
            <dt>路由</dt>
            <dd>
              {{ entry.config.routing?.mode || "off" }}
              <template v-if="entry.config.routing?.keywords?.length">
                · {{ entry.config.routing.keywords.join(", ") }}
              </template>
            </dd>
            <dt>工具覆盖项</dt>
            <dd>
              <span
                v-if="Object.keys(entry.config.tools ?? {}).length === 0"
                :data-testid="`vue-settings-tools-tool-empty-${entry.name}`"
              >
                -
              </span>
              <span v-else :data-testid="`vue-settings-tools-tool-list-${entry.name}`">
                {{ Object.keys(entry.config.tools ?? {}).join(", ") }}
              </span>
            </dd>
          </dl>
        </div>
        <label class="settings-tool-server__toggle">
          <input
            :checked="entry.config.enabled"
            :data-testid="`vue-settings-tools-toggle-${entry.name}`"
            :disabled="props.tools.isMutationPending.value"
            type="checkbox"
            @change="props.tools.toggleMcpServer(entry.name, eventTargetChecked($event))"
          >
          <span>{{ entry.config.enabled ? "已启用" : "已禁用" }}</span>
        </label>
      </li>
    </ul>
    <p
      v-if="props.tools.mutationErrorMessage.value"
      class="workspace-error"
      data-testid="vue-settings-tools-mutation-error"
    >
      {{ props.tools.mutationErrorMessage.value }}
    </p>
    <p
      v-if="props.tools.mcpFormError.value"
      class="workspace-error"
      data-testid="vue-settings-tools-form-error"
    >
      {{ props.tools.mcpFormError.value }}
    </p>
    <p
      v-if="props.tools.mcpResetMessage.value"
      class="settings-success"
      data-testid="vue-settings-tools-reset-message"
    >
      {{ props.tools.mcpResetMessage.value }}
    </p>
    <AppDialog :open="props.configEditorOpen" title="MCP 配置 JSON" @close="emit('close-config')">
      <form
        class="settings-tools-editor"
        data-testid="vue-settings-tools-editor"
        @submit.prevent="props.tools.submitMcpConfigEdit"
      >
        <label class="workspace-field">
          <span>MCP 配置 JSON</span>
          <textarea
            :value="props.tools.mcpConfigText.value"
            data-testid="vue-settings-tools-config-json"
            @input="updateConfigText"
          />
        </label>
        <button
          class="workspace-button workspace-button--primary"
          data-testid="vue-settings-tools-save-config"
          :disabled="props.tools.isMutationPending.value"
          type="submit"
        >
          保存配置
        </button>
      </form>
    </AppDialog>
  </template>
</template>
