/*
  【文件职责】     从 Gateway ToolMessage 元数据提取当前线程最新的 browser_view 静态帧。
  【架构位置】     L3
  【主要导出】     BrowserViewFrame · latestBrowserViewFrame · reconcileBrowserMessageFrame
  【依赖关系】     core/types/message.ts
  【边界与注意】   只信任 tool.additional_kwargs.browser_view；不从文案或 artifact 路径猜测。
*/

import type { Message } from "@/core/types/message";

export interface BrowserViewFrame {
  screenshot: string;
  url?: string;
  title?: string;
}

function readBrowserViewFrame(message: Message): BrowserViewFrame | null {
  if (message.type !== "tool") return null;
  const additional = message.additional_kwargs;
  if (typeof additional !== "object" || additional === null) return null;
  const raw = Reflect.get(additional, "browser_view");
  if (typeof raw !== "object" || raw === null) return null;
  const screenshot = Reflect.get(raw, "screenshot");
  if (typeof screenshot !== "string" || !screenshot.trim()) return null;
  const url = Reflect.get(raw, "url");
  const title = Reflect.get(raw, "title");
  return {
    screenshot,
    ...(typeof url === "string" ? { url } : {}),
    ...(typeof title === "string" ? { title } : {}),
  };
}

export function latestBrowserViewFrame(
  messages: readonly Message[],
): BrowserViewFrame | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const frame = readBrowserViewFrame(messages[index]!);
    if (frame) return frame;
  }
  return null;
}

export function sameBrowserViewFrame(
  left: BrowserViewFrame | null,
  right: BrowserViewFrame | null,
): boolean {
  return (
    left?.screenshot === right?.screenshot &&
    left?.url === right?.url &&
    left?.title === right?.title
  );
}

export function reconcileBrowserMessageFrame(
  display: BrowserViewFrame | null,
  observed: BrowserViewFrame | null,
  next: BrowserViewFrame,
): {
  display: BrowserViewFrame;
  observed: BrowserViewFrame;
  changed: boolean;
} {
  if (sameBrowserViewFrame(observed, next)) {
    return {
      display: display ?? next,
      observed: observed ?? next,
      changed: false,
    };
  }
  return { display: next, observed: next, changed: true };
}
