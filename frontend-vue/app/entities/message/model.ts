import type { StreamViewMessage } from "../../core/stream/view-model";
import { extractHumanInputRequest, type HumanInputRequest } from "../../core/messages/human-input";
import { extractToolRichCards, type ToolRichCard } from "../../core/messages/tool-cards";

export type MessageGroupRole = "human" | "ai" | "tool" | "error" | "unknown";

export type MessageRenderEntry = {
  message: StreamViewMessage;
  humanInputRequest: HumanInputRequest | null;
  toolCards: ToolRichCard[];
};

export function normalizeMessageRole(role: string): MessageGroupRole {
  if (role === "human" || role === "user") return "human";
  if (role === "ai" || role === "assistant") return "ai";
  if (role === "tool") return "tool";
  if (role === "error") return "error";
  return "unknown";
}

export function toMessageRenderEntry(message: StreamViewMessage): MessageRenderEntry {
  return {
    message,
    humanInputRequest: extractHumanInputRequest(message.raw ?? message),
    toolCards: extractToolRichCards(message.raw ?? message),
  };
}
