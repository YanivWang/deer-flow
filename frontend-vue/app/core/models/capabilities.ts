/*
  【文件职责】     解析 composer 默认模型并按模型能力规范化运行上下文。
  【对应 frontend/】 components/workspace/input-box.tsx
  【架构位置】     L3 模型/提交协议适配
  【主要导出】     resolveComposerModel · normalizeComposerContext
  【依赖关系】     models/types
  【边界与注意】   UI 可见能力仍由模型元数据控制；run context 必须保留与 React 相同的模式 effort。
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
 * Normalize composer selection against the selected model. Capability flags
 * control which UI choices are available, while the selected mode/effort is
 * retained so every frontend submits the same observable run context. The
 * Gateway model factory remains the authority that strips unsupported model
 * kwargs before provider construction.
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

  const explicitEffort = context.reasoning_effort;
  if (
    explicitEffort === "minimal" ||
    explicitEffort === "low" ||
    explicitEffort === "medium" ||
    explicitEffort === "high"
  ) {
    normalized.reasoning_effort = explicitEffort;
  } else {
    delete normalized.reasoning_effort;
  }

  return normalized as ReturnType<typeof normalizeComposerContext<T>>;
}
