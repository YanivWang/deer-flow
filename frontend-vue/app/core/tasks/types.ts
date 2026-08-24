/*
  【文件职责】     见下方导出与 JSDoc。
  【架构位置】     L3
  【主要导出】     Subtask
  【依赖关系】     见下方 import。
  【边界与注意】   本文件由本仓维护；行为由 tests/ 下的用例约束。
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
