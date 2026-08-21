/*
  【文件职责】     解析 composer 默认模型并按模型能力规范化运行上下文。
  【对应 frontend/】 components/workspace/input-box.tsx
  【架构位置】     L3 模型/提交协议适配
  【主要导出】     resolveComposerModel · normalizeComposerContext
  【依赖关系】     models/types
  【边界与注意】   不支持的 reasoning 字段必须省略，不能伪造后端默认值。
*/

import type { Model } from "./types";

export type ComposerMode = "flash" | "thinking" | "pro" | "ultra";
export type ComposerReasoningEffort = "minimal" | "low" | "medium" | "high";

const VALID_MODES = new Set<ComposerMode>([
  "flash",
  "thinking",
  "pro",
  "ultra",
]);

const REASONING_EFFORT_BY_MODE: Record<
  ComposerMode,
  ComposerReasoningEffort | undefined
> = {
  flash: "minimal",
  thinking: "low",
  pro: "medium",
  ultra: "high",
};

export function resolveComposerModel(
  models: readonly Model[],
  requestedModelName?: string,
  agentDefaultModelName?: string | null,
): Model | undefined {
  return (
    models.find((model) => model.name === requestedModelName) ??
    models.find((model) => model.name === agentDefaultModelName) ??
    models[0]
  );
}

function resolveMode(value: unknown, supportsThinking: boolean): ComposerMode {
  if (!supportsThinking) return "flash";
  return typeof value === "string" && VALID_MODES.has(value as ComposerMode)
    ? (value as ComposerMode)
    : "pro";
}

/**
 * Normalize the UI context against the selected backend model. Unsupported
 * options are omitted, matching the Gateway/model factory's undefined
 * semantics instead of sending invented values.
 */
export function normalizeComposerContext<T extends Record<string, unknown>>(
  context: T,
  model: Model | null | undefined,
): T & {
  model_name?: string;
  mode?: ComposerMode;
  reasoning_effort?: ComposerReasoningEffort;
} {
  if (!model) {
    return { ...context };
  }

  const mode = resolveMode(context.mode, model.supports_thinking === true);
  const normalized: Record<string, unknown> = {
    ...context,
    model_name: model.name,
    mode,
  };

  if (model.supports_reasoning_effort === true) {
    const explicitEffort = context.reasoning_effort;
    normalized.reasoning_effort =
      explicitEffort === "minimal" ||
      explicitEffort === "low" ||
      explicitEffort === "medium" ||
      explicitEffort === "high"
        ? explicitEffort
        : REASONING_EFFORT_BY_MODE[mode];
  } else {
    delete normalized.reasoning_effort;
  }

  return normalized as ReturnType<typeof normalizeComposerContext<T>>;
}
