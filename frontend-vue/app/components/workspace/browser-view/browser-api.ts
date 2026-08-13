import { getBackendBaseURL } from "@/core/config";

export function browserStreamURL(threadId: string, seedUrl?: string): string {
  const base =
    getBackendBaseURL() ||
    (typeof window === "undefined" ? "" : window.location.origin);
  const query = new URLSearchParams({ frame_format: "binary" });
  if (seedUrl) query.set("seed", seedUrl);
  return `${base.replace(/^http/i, "ws")}/api/threads/${encodeURIComponent(threadId)}/browser/stream?${query}`;
}
