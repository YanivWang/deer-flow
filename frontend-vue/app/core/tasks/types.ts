/*
  【文件职责】     见下方源码；本文件由 frontend/src/core/tasks/types.ts retype 而来。
  【对应 frontend/】 frontend/src/core/tasks/types.ts
  【架构位置】     L3
  【主要导出】     Subtask
  【依赖关系】     见下方 import；改写清单由 scripts/land-retyped.mjs 声明
  【边界与注意】   RETYPED：内容**不是**上游逐字节等同，因此不参与 COPIED hash 护城河。
                   相对上游的改动只有这些：SDK 类型改指向自写 @/core/types/message（06 §M1 1b 的 17 个）。（@langchain/langgraph-sdk → @/core/types/message）
                   勿手改——`make land-retyped-check` 会红；确需手改就登记进
                   land-retyped.mjs 的 HAND_MAINTAINED 并写明理由。
*/

import type { AIMessage } from "@/core/types/message";

import type { TokenUsage } from "../messages/usage";

import type { SubtaskStep } from "./steps";

export interface Subtask {
  id: string;
  status: "in_progress" | "completed" | "failed";
  subagent_type: string;
  description: string;
  /** Effective DeerFlow model selected for this subagent run. */
  modelName?: string;
  /** Latest cumulative token snapshot reported while the subagent runs. */
  usage?: TokenUsage;
  latestMessage?: AIMessage;
  /**
   * Full ordered step history (assistant turns + tool outputs) of the subagent.
   * Accumulated live from `task_running` events and backfilled on expand for
   * historical runs (#3779). Replaces the old "only latestMessage" behavior.
   */
  steps?: SubtaskStep[];
  prompt: string;
  result?: string;
  error?: string;
  /**
   * Why a guardrail cap ended the run early (``token_capped`` / ``turn_capped``
   * / ``loop_capped``), or ``undefined`` for a clean run. The pill status stays
   * normal (``completed``/``failed``); this carries the cap detail so a future
   * badge can show "capped" without parsing result text (#3875 Phase 2).
   */
  stopReason?: string;
}
