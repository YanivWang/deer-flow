/*
  【文件职责】     见下方源码；本文件由 frontend/src/core/threads/types.ts retype 而来。
  【对应 frontend/】 frontend/src/core/threads/types.ts
  【架构位置】     L3
  【主要导出】     GoalState / AgentThreadState / AgentThreadContext / AgentThread / RunMessage / ThreadContextUsage 等 7 个
  【依赖关系】     见下方 import；改写清单由 scripts/land-retyped.mjs 声明
  【边界与注意】   RETYPED：内容**不是**上游逐字节等同，因此不参与 COPIED hash 护城河。
                   相对上游的改动只有这些：SDK 类型改指向自写 @/core/types/message（06 §M1 1b 的 17 个）。（@langchain/langgraph-sdk → @/core/types/message）
                   勿手改——`make land-retyped-check` 会红；确需手改就登记进
                   land-retyped.mjs 的 HAND_MAINTAINED 并写明理由。
*/

import type { Message, Thread } from "@/core/types/message";

import type { Todo } from "../todos";

export interface GoalState {
  objective: string;
  status: "active";
  created_at: string;
  updated_at: string;
  continuation_count: number;
  max_continuations: number;
  no_progress_count: number;
  max_no_progress_continuations: number;
  last_evaluation?: {
    satisfied: boolean;
    blocker:
      | "none"
      | "missing_evidence"
      | "needs_user_input"
      | "run_failed"
      | "external_wait"
      | "goal_not_met_yet";
    reason: string;
    evidence_summary?: string;
    run_id?: string;
    evaluated_at?: string;
    progress_key?: string;
    stand_down_reason?: string;
  };
}

export interface AgentThreadState extends Record<string, unknown> {
  title: string;
  messages: Message[];
  artifacts?: string[];
  todos?: Todo[];
  goal?: GoalState | null;
}

export interface AgentThreadContext extends Record<string, unknown> {
  thread_id: string;
  model_name: string | undefined;
  thinking_enabled: boolean;
  is_plan_mode: boolean;
  subagent_enabled: boolean;
  reasoning_effort?: "minimal" | "low" | "medium" | "high";
  agent_name?: string;
}

export interface AgentThread extends Thread<AgentThreadState> {
  context?: AgentThreadContext;
}

export interface RunMessage {
  run_id: string;
  seq: number;
  content: Message;
  metadata: {
    caller: string;
    [key: string]: unknown;
  };
  created_at: string;
}

export interface ThreadContextUsage {
  token_count: number;
  max_context_tokens: number | null;
  percentage: number | null;
}

export interface ThreadTokenUsageResponse {
  thread_id: string;
  total_tokens: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_runs: number;
  by_model: Record<string, { tokens: number; runs: number }>;
  by_caller: {
    lead_agent: number;
    subagent: number;
    middleware: number;
  };
  context_usage?: ThreadContextUsage | null;
}
