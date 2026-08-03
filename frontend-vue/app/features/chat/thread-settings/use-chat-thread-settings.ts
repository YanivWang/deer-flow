import { computed, toValue, type MaybeRefOrGetter } from "vue";

import type { AgentThreadContext } from "../../../core/api/thread/types";
import type { LocalSettingsStorage, ThreadMode } from "../../../core/settings/local";
import { useLocalThreadSettings } from "../../../entities/thread/use-local-thread-settings";

export type ChatThreadSettingsController = ReturnType<typeof useChatThreadSettings>;

type ReasoningEffort = NonNullable<AgentThreadContext["reasoning_effort"]>;

export function useChatThreadSettings(options: {
  agentName: MaybeRefOrGetter<string | null | undefined>;
  serverContext: MaybeRefOrGetter<AgentThreadContext | null | undefined>;
  threadId: MaybeRefOrGetter<string>;
  storage?: LocalSettingsStorage | null;
}) {
  const localSettings = useLocalThreadSettings(options.threadId, options.serverContext, {
    storage: options.storage,
  });
  const threadRunContext = computed(() =>
    buildRunContext(localSettings.effectiveContext.value, toValue(options.agentName) ?? undefined),
  );

  function updateModelName(value: string) {
    localSettings.updateContext({ model_name: value.trim() || undefined });
  }

  function updateMode(value: string) {
    localSettings.updateContext({ mode: isThreadMode(value) ? value : undefined });
  }

  function updateReasoningEffort(value: string) {
    localSettings.updateContext({
      reasoning_effort: isReasoningEffort(value) ? value : undefined,
    });
  }

  function updateThinkingEnabled(value: boolean) {
    localSettings.updateContext({ thinking_enabled: value });
  }

  function updateSubagentEnabled(value: boolean) {
    localSettings.updateContext({ subagent_enabled: value });
  }

  return {
    effectiveContext: localSettings.effectiveContext,
    resetContext: localSettings.resetContext,
    threadRunContext,
    updateMode,
    updateModelName,
    updateReasoningEffort,
    updateSubagentEnabled,
    updateThinkingEnabled,
  };
}

function buildRunContext(
  context: AgentThreadContext,
  routeAgentName: string | undefined,
): Record<string, unknown> | undefined {
  const next = {
    ...context,
    ...(routeAgentName ? { agent_name: routeAgentName } : {}),
  };
  return Object.keys(next).length > 0 ? next : undefined;
}

function isReasoningEffort(value: string): value is ReasoningEffort {
  return value === "minimal" || value === "low" || value === "medium" || value === "high";
}

function isThreadMode(value: string): value is ThreadMode {
  return value === "flash" || value === "thinking" || value === "pro" || value === "ultra";
}
