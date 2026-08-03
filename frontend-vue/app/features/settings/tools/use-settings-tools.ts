import { computed, ref, watch, type MaybeRefOrGetter } from "vue";

import { useMcpSettings } from "./use-mcp-settings";
import type { McpConfig, McpServerConfig } from "../../../core/api/mcp/client";

export function useSettingsTools(enabled: MaybeRefOrGetter<boolean> = true) {
  const mcpSettings = useMcpSettings(enabled);
  const mcpConfigText = ref("");
  const mcpFormError = ref("");
  const mcpResetMessage = ref("");
  const hasUnsavedChanges = computed(() => {
    const config = mcpSettings.query.data.value;
    return Boolean(config) && mcpConfigText.value !== formatJson(config);
  });

  const mcpRuntimeSummary = computed(() => summarizeMcpRuntime(mcpSettings.serverEntries.value));

  watch(
    () => mcpSettings.query.data.value,
    (config) => {
      if (config && !mcpConfigText.value) {
        mcpConfigText.value = formatJson(config);
      }
    },
  );

  async function toggleMcpServer(serverName: string, enabled: boolean) {
    mcpFormError.value = "";
    mcpResetMessage.value = "";
    await mcpSettings.setServerEnabled({ enabled, serverName });
  }

  async function submitMcpConfigEdit() {
    mcpFormError.value = "";
    mcpResetMessage.value = "";
    const parsedConfig = parseMcpConfig(mcpConfigText.value);
    if (!parsedConfig) {
      mcpFormError.value = "MCP 配置 JSON 必须包含有效的 mcp_servers 对象。";
      return;
    }
    const savedConfig = await mcpSettings.saveConfig(parsedConfig);
    mcpConfigText.value = formatJson(savedConfig);
  }

  async function resetMcpToolsCache() {
    mcpFormError.value = "";
    const result = await mcpSettings.resetCache();
    mcpResetMessage.value = result.message;
  }

  function setMcpConfigText(value: string) {
    mcpConfigText.value = value;
  }

  function resetMcpConfigEditor() {
    const config = mcpSettings.query.data.value;
    mcpConfigText.value = config ? formatJson(config) : "";
    mcpFormError.value = "";
  }

  return {
    ...mcpSettings,
    mcpConfigText,
    mcpFormError,
    mcpResetMessage,
    mcpRuntimeSummary,
    hasUnsavedChanges,
    resetMcpToolsCache,
    resetMcpConfigEditor,
    setMcpConfigText,
    submitMcpConfigEdit,
    toggleMcpServer,
  };
}

export type SettingsToolsController = ReturnType<typeof useSettingsTools>;

function parseMcpConfig(value: string): McpConfig | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  return isMcpConfig(parsed) ? parsed : null;
}

function isMcpConfig(value: unknown): value is McpConfig {
  return (
    isRecord(value) &&
    isRecord(value.mcp_servers) &&
    Object.values(value.mcp_servers).every(isMcpServerConfig)
  );
}

function isMcpServerConfig(value: unknown): value is McpServerConfig {
  return (
    isRecord(value) &&
    typeof value.enabled === "boolean" &&
    typeof value.description === "string"
  );
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function summarizeMcpRuntime(
  entries: Array<{ config: McpServerConfig; name: string }>,
) {
  const enabledEntries = entries.filter((entry) => entry.config.enabled);
  const discoverableToolCount = entries.reduce(
    (count, entry) => count + Object.keys(entry.config.tools ?? {}).length,
    0,
  );
  return {
    discoverableToolCount,
    enabledCount: enabledEntries.length,
    serverCount: entries.length,
    transportTypes: uniqueStrings(entries.map((entry) => entry.config.type || "stdio")),
  };
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values)).sort();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
