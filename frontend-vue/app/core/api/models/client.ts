export type ModelProfile = {
  name: string;
  model: string;
  display_name: string | null;
  description: string | null;
  supports_thinking: boolean;
  supports_reasoning_effort: boolean;
};

export async function listModels(): Promise<ModelProfile[]> {
  const response = await fetch("/api/models", { credentials: "include" });
  if (!response.ok) {
    throw new Error("模型列表加载失败。");
  }
  const payload = (await response.json()) as { models?: ModelProfile[] };
  return payload.models ?? [];
}
