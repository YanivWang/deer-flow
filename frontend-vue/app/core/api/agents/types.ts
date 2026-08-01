export type AgentModelSettings = {
  temperature?: number | null;
  max_tokens?: number | null;
};

export type AgentReasoningEffort = "low" | "medium" | "high";

export type Agent = {
  name: string;
  description: string;
  model: string | null;
  tool_groups: string[] | null;
  skills: string[] | null;
  model_settings?: AgentModelSettings | null;
  thinking_enabled?: boolean | null;
  reasoning_effort?: AgentReasoningEffort | null;
  soul?: string | null;
};

export type CreateAgentRequest = {
  name: string;
  description?: string;
  model?: string | null;
  tool_groups?: string[] | null;
  skills?: string[] | null;
  model_settings?: AgentModelSettings | null;
  thinking_enabled?: boolean | null;
  reasoning_effort?: AgentReasoningEffort | null;
  soul?: string;
};

export type UpdateAgentRequest = {
  description?: string | null;
  model?: string | null;
  tool_groups?: string[] | null;
  skills?: string[] | null;
  model_settings?: AgentModelSettings | null;
  thinking_enabled?: boolean | null;
  reasoning_effort?: AgentReasoningEffort | null;
  soul?: string | null;
};

export type AgentNameCheckResult = {
  available: boolean;
  name: string;
};
