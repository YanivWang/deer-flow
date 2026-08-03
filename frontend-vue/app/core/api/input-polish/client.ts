export type InputPolishResponse = {
  rewritten_text?: string;
  changed?: boolean;
};

export async function polishInput(
  text: string,
  threadId: string,
  signal?: AbortSignal,
): Promise<InputPolishResponse> {
  const response = await fetch("/api/input-polish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, thread_id: threadId }),
    signal,
  });
  if (!response.ok) {
    throw new Error("Failed to polish input");
  }
  return await response.json() as InputPolishResponse;
}
