import { resolveArtifactUrl } from "../../artifacts/utils";

export interface BrowserNavigateResult {
  screenshot: string | null;
  url: string;
  title: string;
}

export interface BrowserFrame {
  screenshot: string;
  url?: string;
  title?: string;
  action?: string;
}

export interface BrowserTab {
  index: number;
  title: string;
  url: string;
  active: boolean;
}

export async function navigateBrowser(threadId: string, url: string): Promise<BrowserNavigateResult> {
  const response = await fetch(`/api/threads/${encodeURIComponent(threadId)}/browser/navigate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) {
    throw new Error(await readBrowserError(response, `无法打开浏览器页面：${response.statusText}`));
  }
  return response.json() as Promise<BrowserNavigateResult>;
}

async function readBrowserError(response: Response, fallback: string): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (typeof payload === "object" && payload !== null && "detail" in payload && typeof payload.detail === "string" && payload.detail.trim()) {
      return payload.detail.trim();
    }
  } catch {
    // Keep the HTTP fallback when the Gateway did not return JSON.
  }
  return fallback;
}

export function browserFrameUrl(frame: BrowserFrame | null, threadId: string): string | null {
  if (!frame) return null;
  if (/^(?:data:|https?:|blob:)/i.test(frame.screenshot)) return frame.screenshot;
  return resolveArtifactUrl(frame.screenshot, threadId);
}

export function browserFrameFromMessage(message: unknown): BrowserFrame | null {
  if (typeof message !== "object" || message === null) return null;
  const additionalKwargs = Reflect.get(message, "additional_kwargs");
  if (typeof additionalKwargs !== "object" || additionalKwargs === null) return null;
  const browserView = Reflect.get(additionalKwargs, "browser_view");
  if (typeof browserView !== "object" || browserView === null) return null;
  const screenshot = Reflect.get(browserView, "screenshot");
  if (typeof screenshot !== "string" || !screenshot.trim()) return null;
  const url = Reflect.get(browserView, "url");
  const title = Reflect.get(browserView, "title");
  const action = Reflect.get(browserView, "action");
  return {
    screenshot,
    ...(typeof url === "string" ? { url } : {}),
    ...(typeof title === "string" ? { title } : {}),
    ...(typeof action === "string" ? { action } : {}),
  };
}

export function browserStreamUrl(threadId: string, seedUrl?: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const wsOrigin = origin.replace(/^http/i, "ws");
  const query = seedUrl ? `?seed=${encodeURIComponent(seedUrl)}` : "";
  return `${wsOrigin}/api/threads/${encodeURIComponent(threadId)}/browser/stream${query}`;
}
