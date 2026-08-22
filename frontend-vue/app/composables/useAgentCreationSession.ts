/*
  【文件职责】     独占 Agent 保存、setup_agent 结果、有限可见性验证与 cleanup 状态机。
  【对应 frontend/】 app/workspace/agents/new/page.tsx
  【架构位置】     L3 Vue lifecycle owner
  【主要导出】     useAgentCreationSession
  【依赖关系】     core/agents/creation-session · Gateway errors · Vue scope
  【边界与注意】   idle/saving/verifying/created/error 互斥；验证重试不重新提交 setup_agent。
*/

import {
  onScopeDispose,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";

import { isGatewayResponseError } from "@/core/api/errors";
import { classifySetupAgentResult } from "@/core/agents/creation-session";
import type { Agent } from "@/core/agents/types";
import type { Message } from "@/core/types/message";

export type AgentCreationStatus =
  "idle" | "saving" | "verifying" | "created" | "error";

type ErrorOwner = "save" | "verify";

export interface AgentCreationSessionOptions {
  agentName: MaybeRefOrGetter<string>;
  submitSave: (signal: AbortSignal) => Promise<boolean>;
  loadAgent: (name: string, signal: AbortSignal) => Promise<Agent>;
  retryDelaysMs?: readonly number[];
  onCreated?: (agent: Agent) => void | Promise<void>;
  copy?: Partial<{
    saveNotAccepted: string;
    loadFailed: string;
    visibilityUnavailable: string;
    requestFailed: string;
    missingToolResult: string;
    runFailed: string;
  }>;
}

const DEFAULT_RETRY_DELAYS_MS = [0, 200, 500, 1_000, 2_000] as const;

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function abortError() {
  return new DOMException("The operation was aborted.", "AbortError");
}

export function useAgentCreationSession(options: AgentCreationSessionOptions) {
  const status = ref<AgentCreationStatus>("idle");
  const agent = ref<Agent | null>(null);
  const error = ref("");
  let errorOwner: ErrorOwner = "save";
  let generation = 0;
  let controller: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  function isCurrent(current: number, signal: AbortSignal) {
    return !disposed && generation === current && !signal.aborted;
  }

  function clearTimer() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  function invalidate() {
    generation += 1;
    clearTimer();
    controller?.abort();
    controller = null;
  }

  function begin() {
    invalidate();
    controller = new AbortController();
    return { current: generation, signal: controller.signal };
  }

  function fail(owner: ErrorOwner, detail: string) {
    errorOwner = owner;
    error.value = detail;
    agent.value = null;
    status.value = "error";
  }

  function wait(delayMs: number, signal: AbortSignal) {
    if (delayMs <= 0) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        clearTimer();
        reject(abortError());
      };
      signal.addEventListener("abort", onAbort, { once: true });
      timer = setTimeout(() => {
        timer = null;
        signal.removeEventListener("abort", onAbort);
        resolve();
      }, delayMs);
    });
  }

  async function verify(existing?: {
    current: number;
    signal: AbortSignal;
  }): Promise<boolean> {
    const operation = existing ?? begin();
    const name = toValue(options.agentName).trim();
    status.value = "verifying";
    error.value = "";
    let lastNotFound: unknown = null;

    for (const delayMs of options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS) {
      try {
        await wait(delayMs, operation.signal);
        if (!isCurrent(operation.current, operation.signal)) return false;
        const loaded = await options.loadAgent(name, operation.signal);
        if (!isCurrent(operation.current, operation.signal)) return false;
        agent.value = loaded;
        status.value = "created";
        await options.onCreated?.(loaded);
        return true;
      } catch (cause) {
        if (!isCurrent(operation.current, operation.signal)) return false;
        if (isGatewayResponseError(cause) && cause.status === 404) {
          lastNotFound = cause;
          continue;
        }
        fail(
          "verify",
          errorMessage(
            cause,
            options.copy?.loadFailed ?? "Failed to load the created agent.",
          ),
        );
        return false;
      }
    }

    if (isCurrent(operation.current, operation.signal)) {
      fail(
        "verify",
        errorMessage(
          lastNotFound,
          options.copy?.visibilityUnavailable ??
            "The created agent is not visible yet.",
        ),
      );
    }
    return false;
  }

  async function save(): Promise<boolean> {
    if (
      disposed ||
      status.value === "saving" ||
      status.value === "verifying" ||
      status.value === "created"
    ) {
      return false;
    }
    if (!toValue(options.agentName).trim()) return false;
    const operation = begin();
    status.value = "saving";
    error.value = "";
    agent.value = null;
    try {
      const submitted = await options.submitSave(operation.signal);
      if (!isCurrent(operation.current, operation.signal)) return false;
      if (!submitted) {
        fail(
          "save",
          options.copy?.saveNotAccepted ?? "The save request was not accepted.",
        );
        return false;
      }
      return true;
    } catch (cause) {
      if (!isCurrent(operation.current, operation.signal)) return false;
      fail(
        "save",
        errorMessage(
          cause,
          options.copy?.requestFailed ?? "Failed to request agent creation.",
        ),
      );
      return false;
    }
  }

  async function onRunFinished(messages: readonly Message[]) {
    if (status.value !== "saving" || !controller) return;
    const result = classifySetupAgentResult(messages);
    if (result.kind === "missing") {
      fail(
        "save",
        options.copy?.missingToolResult ??
          "The run finished without a setup_agent result.",
      );
      return;
    }
    if (result.kind === "error") {
      fail("save", result.detail);
      return;
    }
    await verify({ current: generation, signal: controller.signal });
  }

  function onRunError(cause: unknown) {
    if (status.value !== "saving" && status.value !== "verifying") return;
    invalidate();
    fail(
      "save",
      errorMessage(
        cause,
        options.copy?.runFailed ?? "The agent creation run failed.",
      ),
    );
  }

  async function retry() {
    if (status.value !== "error") return false;
    return errorOwner === "verify" ? verify() : save();
  }

  function reset() {
    invalidate();
    status.value = "idle";
    agent.value = null;
    error.value = "";
    errorOwner = "save";
  }

  watch(
    () => toValue(options.agentName),
    () => reset(),
    { flush: "sync" },
  );

  onScopeDispose(() => {
    disposed = true;
    invalidate();
  });

  return {
    status,
    agent,
    error,
    save,
    retry,
    reset,
    onRunFinished,
    onRunError,
  };
}
