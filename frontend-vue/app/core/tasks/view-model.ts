/*
  【文件职责】     合并子任务实时/历史/终态数据并生成稳定展示模型。
  【对应 frontend/】 components/workspace/messages/subtask-card.tsx
  【架构位置】     L3
  【主要导出】     buildSubtaskCardViewModel
  【依赖关系】     tasks/presentation · steps · subtask-result
  【边界与注意】   只做纯计算；历史 backfill 的网络与展开状态留在组件。
*/
import type { Model } from "@/core/models/types";

import {
  formatSubtaskTokenUsage,
  resolveSubtaskModelLabel,
} from "./presentation";
import { mergeSteps, stepsForDisplay, type SubtaskStep } from "./steps";
import type { SubtaskResultUpdate } from "./subtask-result";
import type { Subtask } from "./types";

export interface SubtaskCardViewModel {
  id: string;
  status: Subtask["status"];
  statusLabel: string;
  description: string;
  prompt: string;
  modelLabel?: string;
  tokenLabel?: string;
  steps: SubtaskStep[];
  result?: string;
  error?: string;
}

export function buildSubtaskCardViewModel(options: {
  id: string;
  description: string;
  prompt: string;
  pendingStatus: Subtask["status"];
  liveTask?: Subtask;
  terminal?: SubtaskResultUpdate;
  historicalSteps?: SubtaskStep[];
  models?: Model[];
}): SubtaskCardViewModel {
  const { liveTask, terminal } = options;
  const status = terminal?.status ?? liveTask?.status ?? options.pendingStatus;
  const steps = stepsForDisplay(
    mergeSteps(liveTask?.steps ?? [], options.historicalSteps ?? []),
    status,
  );
  const modelName = terminal?.modelName ?? liveTask?.modelName;
  const usage = terminal?.usage ?? liveTask?.usage;
  return {
    id: options.id,
    status,
    statusLabel:
      status === "completed"
        ? "Completed"
        : status === "failed"
          ? "Subtask failed"
          : "Running subtask",
    description: liveTask?.description || options.description || "Subtask",
    prompt: liveTask?.prompt || options.prompt,
    modelLabel: resolveSubtaskModelLabel(modelName, options.models ?? []),
    tokenLabel: formatSubtaskTokenUsage(usage),
    steps,
    result: terminal?.result ?? liveTask?.result,
    error: terminal?.error ?? liveTask?.error,
  };
}
