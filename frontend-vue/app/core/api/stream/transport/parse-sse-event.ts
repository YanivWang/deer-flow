import type { SseFrame } from "./sse-event";

export function parseSseFrame(frame: string): SseFrame | undefined {
  let event = "message";
  let id: string | undefined;
  const dataLines: string[] = [];
  const commentLines: string[] = [];

  for (const rawLine of frame.split(/\r?\n/)) {
    if (rawLine === "") {
      continue;
    }
    if (rawLine.startsWith(":")) {
      commentLines.push(rawLine.slice(1).trimStart());
      continue;
    }

    const separatorIndex = rawLine.indexOf(":");
    const field = separatorIndex === -1 ? rawLine : rawLine.slice(0, separatorIndex);
    const rawValue = separatorIndex === -1 ? "" : rawLine.slice(separatorIndex + 1);
    const value = rawValue.startsWith(" ") ? rawValue.slice(1) : rawValue;

    if (field === "event") {
      event = value;
    } else if (field === "data") {
      dataLines.push(value);
    } else if (field === "id") {
      id = value;
    }
  }

  if (dataLines.length === 0) {
    if (commentLines.length > 0) {
      return { kind: "heartbeat", comment: commentLines.join("\n") };
    }
    return undefined;
  }

  return {
    kind: "event",
    event: {
      event,
      data: dataLines.join("\n"),
      ...(id !== undefined ? { id } : {}),
    },
  };
}
