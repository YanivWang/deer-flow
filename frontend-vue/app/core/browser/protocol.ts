/*
  【文件职责】     定义 Gateway browser-control 的客户端 wire 事件与权威状态载荷。
  【架构位置】     L3
  【主要导出】     BrowserInputEvent · BrowserTab · BrowserStreamStatus
  【依赖关系】     无
  【边界与注意】   只声明 backend/routers/browser.py 已接受或发出的字段；不发明 mode/state。
*/

export interface BrowserTab {
  index: number;
  title: string;
  url: string;
  active: boolean;
}

export type BrowserInputEvent =
  | { type: "click"; nx: number; ny: number }
  | { type: "move"; nx: number; ny: number }
  | { type: "wheel"; dx: number; dy: number; nx?: number; ny?: number }
  | { type: "key"; key: string }
  | { type: "text"; text: string }
  | { type: "navigate"; url: string }
  | { type: "back" | "forward" }
  | { type: "activate_tab"; index: number };

export type BrowserNavigateIntent = Extract<
  BrowserInputEvent,
  { type: "navigate" }
>;

export type BrowserInputDisposition = "sent" | "queued" | "unavailable";

export type BrowserStreamStatus =
  "idle" | "connecting" | "reconnecting" | "open" | "closed" | "error";
