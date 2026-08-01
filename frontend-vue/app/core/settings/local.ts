import type { AgentThreadContext } from "../api/thread/types";

export type ThreadMode = "flash" | "thinking" | "pro" | "ultra";

export type LocalThreadContext = Pick<
  AgentThreadContext,
  "agent_name" | "model_name" | "thinking_enabled" | "reasoning_effort" | "subagent_enabled"
> & {
  mode?: ThreadMode;
};

export type LocalSettings = {
  context: LocalThreadContext;
};

export const DEFAULT_LOCAL_SETTINGS: LocalSettings = {
  context: {},
};

export const LOCAL_SETTINGS_KEY = "deerflow.local-settings";
export const THREAD_MODEL_KEY_PREFIX = "deerflow.thread-model.";

export type LocalSettingsStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export function readLocalSettings(storage: LocalSettingsStorage | null = readBrowserStorage()) {
  const raw = safeGet(storage, LOCAL_SETTINGS_KEY);
  if (!raw) {
    return DEFAULT_LOCAL_SETTINGS;
  }
  try {
    return mergeLocalSettings(JSON.parse(raw) as Partial<LocalSettings>);
  } catch {
    return DEFAULT_LOCAL_SETTINGS;
  }
}

export function writeLocalSettings(
  settings: LocalSettings,
  storage: LocalSettingsStorage | null = readBrowserStorage(),
) {
  return safeSet(storage, LOCAL_SETTINGS_KEY, JSON.stringify(mergeLocalSettings(settings)));
}

export function readThreadModelName(
  threadId: string,
  storage: LocalSettingsStorage | null = readBrowserStorage(),
) {
  return safeGet(storage, threadModelStorageKey(threadId)) ?? undefined;
}

export function writeThreadModelName(
  threadId: string,
  modelName: string | undefined,
  storage: LocalSettingsStorage | null = readBrowserStorage(),
) {
  const key = threadModelStorageKey(threadId);
  if (!modelName) {
    return safeRemove(storage, key);
  }
  return safeSet(storage, key, modelName);
}

export function threadModelStorageKey(threadId: string) {
  return `${THREAD_MODEL_KEY_PREFIX}${threadId}`;
}

export function mergeLocalSettings(settings?: Partial<LocalSettings>): LocalSettings {
  return {
    context: {
      ...DEFAULT_LOCAL_SETTINGS.context,
      ...sanitizeContext(settings?.context),
    },
  };
}

export function sanitizeContext(context: unknown): LocalThreadContext {
  if (!isRecord(context)) {
    return {};
  }
  return {
    ...(readString(context.agent_name) ? { agent_name: readString(context.agent_name) } : {}),
    ...(readString(context.model_name) ? { model_name: readString(context.model_name) } : {}),
    ...(typeof context.thinking_enabled === "boolean"
      ? { thinking_enabled: context.thinking_enabled }
      : {}),
    ...(typeof context.subagent_enabled === "boolean"
      ? { subagent_enabled: context.subagent_enabled }
      : {}),
    ...(isReasoningEffort(context.reasoning_effort)
      ? { reasoning_effort: context.reasoning_effort }
      : {}),
    ...(isThreadMode(context.mode) ? { mode: context.mode } : {}),
  };
}

function readBrowserStorage(): LocalSettingsStorage | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage;
}

function safeGet(storage: LocalSettingsStorage | null, key: string) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSet(storage: LocalSettingsStorage | null, key: string, value: string) {
  try {
    storage?.setItem(key, value);
    return Boolean(storage);
  } catch {
    return false;
  }
}

function safeRemove(storage: LocalSettingsStorage | null, key: string) {
  try {
    storage?.removeItem(key);
    return Boolean(storage);
  } catch {
    return false;
  }
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isReasoningEffort(value: unknown): value is NonNullable<AgentThreadContext["reasoning_effort"]> {
  return value === "minimal" || value === "low" || value === "medium" || value === "high";
}

function isThreadMode(value: unknown): value is ThreadMode {
  return value === "flash" || value === "thinking" || value === "pro" || value === "ultra";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
