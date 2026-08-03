export async function getSidecarMessages(threadId: string): Promise<unknown> {
  const response = await fetch(`/api/threads/${encodeURIComponent(threadId)}/messages/page`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to load sidecar messages");
  }
  return await response.json();
}

export async function createSidecarThread(metadata: Record<string, unknown>): Promise<{ thread_id?: string }> {
  const response = await fetch("/api/threads", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ metadata }),
  });
  if (!response.ok) {
    throw new Error("Failed to create sidecar thread");
  }
  return await response.json() as { thread_id?: string };
}

export async function runSidecar(
  threadId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  return fetch(`/api/langgraph/threads/${encodeURIComponent(threadId)}/runs/stream`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deleteSidecarThread(threadId: string): Promise<void> {
  await fetch(`/api/langgraph/threads/${encodeURIComponent(threadId)}`, {
    method: "DELETE",
    credentials: "include",
  });
  await fetch(`/api/threads/${encodeURIComponent(threadId)}`, {
    method: "DELETE",
    credentials: "include",
  });
}
