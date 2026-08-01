export type DeerFlowMessageContentPart = {
  type?: string;
  text?: string;
  content?: string;
  [key: string]: unknown;
};

export type DeerFlowMessage = {
  id?: string;
  type?: string;
  role?: string;
  content?: string | DeerFlowMessageContentPart[];
  additional_kwargs?: Record<string, unknown>;
  run_id?: string;
  tool_call_id?: string;
  [key: string]: unknown;
};

export type GoalState = {
  objective: string;
  status: "active";
  created_at: string;
  updated_at: string;
  continuation_count: number;
  max_continuations: number;
  no_progress_count: number;
  max_no_progress_continuations: number;
  last_evaluation?: Record<string, unknown>;
};

export type AgentThreadState = Record<string, unknown> & {
  title?: string;
  messages?: DeerFlowMessage[];
  artifacts?: string[];
  todos?: unknown[];
  goal?: GoalState | null;
};

export type AgentThreadContext = Record<string, unknown> & {
  thread_id?: string;
  model_name?: string;
  mode?: "flash" | "thinking" | "pro" | "ultra";
  thinking_enabled?: boolean;
  is_plan_mode?: boolean;
  subagent_enabled?: boolean;
  reasoning_effort?: "minimal" | "low" | "medium" | "high";
  agent_name?: string;
};

export type AgentThread = {
  thread_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
  values: AgentThreadState;
  interrupts?: Record<string, unknown>;
  context?: AgentThreadContext;
};

export type RunMessage = {
  run_id: string;
  seq: number;
  content: DeerFlowMessage;
  metadata: {
    caller?: string;
    [key: string]: unknown;
  };
  created_at: string;
};

export type ThreadMessagesPageResponse = {
  data: RunMessage[];
  has_more: boolean;
  next_before_seq: number | null;
};

export type ThreadSearchParams = {
  metadata?: Record<string, unknown>;
  limit?: number;
  offset?: number;
  status?: string | null;
};

export type ChannelThreadSource = {
  type: "im_channel";
  provider: string;
  label: string;
};

export type ThreadStateResponse = {
  values: AgentThreadState;
  next: string[];
  metadata: Record<string, unknown>;
  checkpoint: Record<string, unknown>;
  checkpoint_id: string | null;
  parent_checkpoint_id: string | null;
  created_at: string | null;
  tasks: Array<Record<string, unknown>>;
};

export type ThreadGoalResponse = {
  goal: GoalState | null;
};

export type ThreadCompactResponse = {
  thread_id: string;
  compacted: boolean;
  reason?: string | null;
  removed_message_count: number;
  preserved_message_count: number;
  summary_updated: boolean;
  checkpoint_id?: string | null;
  total_tokens: number;
};

export type ThreadMetadataPatchResponse = Pick<
  AgentThread,
  "thread_id" | "status" | "created_at" | "updated_at" | "metadata"
>;
